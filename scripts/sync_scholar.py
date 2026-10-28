#!/usr/bin/env python3
"""Synchronize Google Scholar metrics and publication records into data/scholar.json.

Run on a schedule by .github/workflows/scholar-sync.yml. The website reads the JSON at
load time and shows the last successful synchronization date. When Google Scholar blocks
or rate-limits the request, the previous data is kept and the failure is recorded in the
file (status, last_attempt, error) so the site can report it instead of showing stale data
as fresh.

Usage: python scripts/sync_scholar.py [--user SCHOLAR_USER_ID] [--out data/scholar.json]
Environment: SCHOLAR_PROXY (optional) - an HTTP(S) proxy URL used for the requests.
"""
import argparse
import datetime as dt
import json
import os
import random
import re
import sys
import time
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

BASE = "https://scholar.google.com"
PAGESIZE = 100
UA_POOL = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64; rv:126.0) Gecko/20100101 Firefox/126.0",
]


class ScholarBlocked(Exception):
    """Google Scholar refused the request (captcha, rate limit, or block page)."""


def now_iso():
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def load_previous(path):
    try:
        with open(path, encoding="utf-8") as fh:
            return json.load(fh)
    except (OSError, json.JSONDecodeError):
        return {}


def fetch(session, url):
    resp = session.get(url, timeout=30, allow_redirects=True)
    text = resp.text or ""
    if resp.status_code in (403, 429):
        raise ScholarBlocked(f"HTTP {resp.status_code}: Google Scholar rate-limited or blocked the request")
    if "/sorry/" in resp.url or "gs_captcha" in text or "unusual traffic" in text.lower():
        raise ScholarBlocked("Google Scholar presented a CAPTCHA / unusual-traffic page")
    if resp.status_code != 200:
        raise RuntimeError(f"HTTP {resp.status_code} from Google Scholar")
    if "gsc_prf_in" not in text and "gsc_a_tr" not in text:
        raise RuntimeError("Unexpected page content: profile markup not found")
    return text


def parse_int(text):
    text = (text or "").strip().replace(",", "")
    return int(text) if text.isdigit() else None


def parse_profile(html):
    soup = BeautifulSoup(html, "html.parser")
    name = soup.select_one("#gsc_prf_in")
    affil = soup.select_one(".gsc_prf_il")
    metrics = {}
    recent_since = None
    table = soup.select_one("#gsc_rsb_st")
    if table:
        heads = [th.get_text(strip=True) for th in table.select("th")]
        for h in heads:
            m = re.search(r"Since\s+(\d{4})", h)
            if m:
                recent_since = int(m.group(1))
        for row in table.select("tr"):
            label_el = row.select_one(".gsc_rsb_f, .gsc_rsb_sc1")
            vals = [parse_int(td.get_text()) for td in row.select("td.gsc_rsb_std")]
            if not label_el or len(vals) < 2:
                continue
            label = label_el.get_text(strip=True).lower()
            key = {"citations": "citations", "h-index": "h_index", "i10-index": "i10_index"}.get(label)
            if key:
                metrics[key] = {"all": vals[0], "recent": vals[1]}
    if metrics:
        metrics["recent_since"] = recent_since
    return {
        "name": name.get_text(strip=True) if name else None,
        "affiliation": affil.get_text(strip=True) if affil else None,
        "metrics": metrics or None,
    }


def parse_publications(html):
    soup = BeautifulSoup(html, "html.parser")
    pubs = []
    for row in soup.select("tr.gsc_a_tr"):
        title_el = row.select_one("a.gsc_a_at")
        if not title_el:
            continue
        grays = [g.get_text(" ", strip=True) for g in row.select(".gs_gray")]
        cited_el = row.select_one("td.gsc_a_c a")
        year_el = row.select_one("td.gsc_a_y span")
        pubs.append({
            "title": title_el.get_text(" ", strip=True),
            "authors": grays[0] if grays else "",
            "venue": re.sub(r",\s*\d{4}$", "", grays[1]).strip() if len(grays) > 1 else "",
            "year": parse_int(year_el.get_text()) if year_el else None,
            "citations": parse_int(cited_el.get_text()) if cited_el else None,
            "url": urljoin(BASE, title_el.get("href", "")),
        })
    return pubs


def sync(user, out_path):
    previous = load_previous(out_path)
    attempt = now_iso()
    session = requests.Session()
    session.headers.update({
        "User-Agent": random.choice(UA_POOL),
        "Accept-Language": "en-US,en;q=0.9",
        "Accept": "text/html,application/xhtml+xml",
    })
    proxy = os.environ.get("SCHOLAR_PROXY")
    if proxy:
        session.proxies.update({"http": proxy, "https": proxy})

    try:
        first = fetch(session, f"{BASE}/citations?user={user}&hl=en&cstart=0&pagesize={PAGESIZE}&sortby=pubdate")
        profile = parse_profile(first)
        pubs = parse_publications(first)
        cstart = PAGESIZE
        while len(pubs) == cstart and cstart < 1000:  # a full page may mean more rows
            time.sleep(random.uniform(4, 9))  # be gentle
            html = fetch(session, f"{BASE}/citations?user={user}&hl=en&cstart={cstart}&pagesize={PAGESIZE}&sortby=pubdate")
            more = parse_publications(html)
            if not more:
                break
            pubs.extend(more)
            cstart += PAGESIZE
        # de-duplicate by Scholar citation id, then by normalised title
        seen, unique = set(), []
        for p in pubs:
            key = re.sub(r"[^a-z0-9]+", " ", p["title"].lower()).strip()
            if key in seen:
                continue
            seen.add(key)
            unique.append(p)
        if not profile["metrics"]:
            raise RuntimeError("Profile loaded but the metrics table was not found")
        data = {
            "profile": {"user": user, "url": f"{BASE}/citations?user={user}", "name": profile["name"], "affiliation": profile["affiliation"]},
            "metrics": profile["metrics"],
            "publications": unique,
            "publication_count": len(unique),
            "last_success": attempt,
            "last_attempt": attempt,
            "status": "ok",
            "error": None,
            "source": "Google Scholar profile, read by scripts/sync_scholar.py on a weekly GitHub Actions schedule (not real-time data)",
        }
        print(f"OK: {len(unique)} publications, citations={profile['metrics'].get('citations')}")
    except (ScholarBlocked, RuntimeError, requests.RequestException) as exc:
        # keep whatever was valid before; record the failure for the site to display
        data = dict(previous) if previous else {"profile": {"user": user, "url": f"{BASE}/citations?user={user}"}, "metrics": None, "publications": []}
        data["last_attempt"] = attempt
        data["status"] = "failed" if data.get("metrics") else "never_synced"
        data["error"] = str(exc)[:300]
        data.setdefault("last_success", None)
        data.setdefault("source", "Google Scholar profile, read by scripts/sync_scholar.py on a weekly GitHub Actions schedule (not real-time data)")
        print(f"::warning title=Google Scholar sync failed::{exc}")
        print(f"FAILED: {exc} (previous data retained; status={data['status']})")

    os.makedirs(os.path.dirname(out_path) or ".", exist_ok=True)
    tmp = out_path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, indent=2)
        fh.write("\n")
    os.replace(tmp, out_path)
    return data["status"]


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--user", default=os.environ.get("SCHOLAR_USER", "SSoTLJoAAAAJ"), help="Google Scholar user id (the 'user=' value in the profile URL)")
    ap.add_argument("--out", default="data/scholar.json")
    ap.add_argument("--strict", action="store_true", help="exit with status 1 when the synchronization fails")
    args = ap.parse_args()
    status = sync(args.user, args.out)
    sys.exit(1 if (args.strict and status != "ok") else 0)
