#!/usr/bin/env python3
"""Synchronize Google Scholar metrics and publication records into data/scholar.json.

Run on a schedule by .github/workflows/scholar-sync.yml. The website reads the JSON at load
time and shows the date of the last successful synchronization next to the numbers.

Google Scholar has no public API and refuses a share of automated requests from GitHub's
runners with HTTP 403 / 429 or a CAPTCHA page. That is expected, not a bug, so the script:

  * tries each page a few times with a pause between attempts (a block is often transient);
  * on a block keeps the previous data file untouched except for the attempt record
    (status "blocked", last_attempt, error), so the site keeps showing the last good
    figures *with their date* instead of showing nothing or pretending they are fresh;
  * exits 0 for an expected block (the workflow then just records the status) and exits 1
    only for a real problem (unexpected markup, missing metrics table, I/O error), so the
    repository owner is emailed only when something actually needs attention.

Usage: python scripts/sync_scholar.py [--user SCHOLAR_USER_ID] [--out data/scholar.json]
                                     [--attempts N] [--fail-on-block]
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
SOURCE = ("Google Scholar profile, read by scripts/sync_scholar.py on a GitHub Actions schedule "
          "(twice a day, retried on blocks); not real-time data")
UA_POOL = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0",
]


class ScholarBlocked(Exception):
    """Google Scholar refused the request (captcha, rate limit, or block page)."""


class ScholarParseError(Exception):
    """The page came back but did not look like a Scholar profile."""


def now_iso():
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def load_previous(path):
    try:
        with open(path, encoding="utf-8") as fh:
            return json.load(fh)
    except (OSError, json.JSONDecodeError):
        return {}


def new_session():
    session = requests.Session()
    session.headers.update({
        "User-Agent": random.choice(UA_POOL),
        "Accept-Language": "en-US,en;q=0.9",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Encoding": "gzip, deflate",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
    })
    proxy = os.environ.get("SCHOLAR_PROXY")
    if proxy:
        session.proxies.update({"http": proxy, "https": proxy})
    return session


def fetch_once(session, url):
    resp = session.get(url, timeout=30, allow_redirects=True)
    text = resp.text or ""
    if resp.status_code in (403, 429, 503):
        raise ScholarBlocked(f"HTTP {resp.status_code}: Google Scholar rate-limited or blocked the request")
    if "/sorry/" in resp.url or "gs_captcha" in text or "unusual traffic" in text.lower():
        raise ScholarBlocked("Google Scholar presented a CAPTCHA / unusual-traffic page")
    if resp.status_code != 200:
        raise ScholarParseError(f"HTTP {resp.status_code} from Google Scholar")
    if "gsc_prf_in" not in text and "gsc_a_tr" not in text:
        raise ScholarParseError("Unexpected page content: profile markup not found")
    return text


def fetch(url, attempts, wait_range=(45, 90)):
    """Fetch a profile page, retrying on blocks with a fresh session and a pause."""
    last = None
    for i in range(1, attempts + 1):
        try:
            return fetch_once(new_session(), url)
        except (ScholarBlocked, requests.RequestException) as exc:
            last = exc
            if i < attempts:
                pause = random.uniform(*wait_range)
                print(f"attempt {i}/{attempts} failed ({exc}); retrying in {pause:.0f}s", flush=True)
                time.sleep(pause)
    if isinstance(last, requests.RequestException):
        raise ScholarBlocked(f"network error reaching Google Scholar: {last}")
    raise last


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
        for th in table.select("th"):
            m = re.search(r"Since\s+(\d{4})", th.get_text(strip=True))
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


def write_json(path, data):
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, indent=2)
        fh.write("\n")
    os.replace(tmp, path)


def sync(user, out_path, attempts):
    previous = load_previous(out_path)
    attempt = now_iso()
    profile_url = f"{BASE}/citations?user={user}"
    try:
        first = fetch(f"{profile_url}&hl=en&cstart=0&pagesize={PAGESIZE}&sortby=pubdate", attempts)
        profile = parse_profile(first)
        pubs = parse_publications(first)
        cstart = PAGESIZE
        while len(pubs) == cstart and cstart < 1000:  # a full page may mean more rows
            time.sleep(random.uniform(4, 9))  # be gentle
            more = parse_publications(fetch(f"{profile_url}&hl=en&cstart={cstart}&pagesize={PAGESIZE}&sortby=pubdate", attempts))
            if not more:
                break
            pubs.extend(more)
            cstart += PAGESIZE
        seen, unique = set(), []
        for p in pubs:
            key = re.sub(r"[^a-z0-9]+", " ", p["title"].lower()).strip()
            if key in seen:
                continue
            seen.add(key)
            unique.append(p)
        if not profile["metrics"]:
            raise ScholarParseError("Profile loaded but the metrics table was not found")
        data = {
            "profile": {"user": user, "url": profile_url, "name": profile["name"], "affiliation": profile["affiliation"]},
            "metrics": profile["metrics"],
            "publications": unique,
            "publication_count": len(unique),
            "last_success": attempt,
            "last_attempt": attempt,
            "status": "ok",
            "error": None,
            "source": SOURCE,
        }
        write_json(out_path, data)
        m = profile["metrics"]
        print(f"OK: {len(unique)} publications, citations={m.get('citations')}, h={m.get('h_index')}, i10={m.get('i10_index')}")
        return "ok"
    except ScholarBlocked as exc:
        # Expected: keep the last good data, record the attempt, do not fail the job.
        data = dict(previous) if previous else {"profile": {"user": user, "url": profile_url}, "metrics": None, "publications": []}
        data["last_attempt"] = attempt
        data["status"] = "blocked" if data.get("metrics") else "never_synced"
        data["error"] = str(exc)[:300]
        data.setdefault("last_success", None)
        data["source"] = SOURCE
        write_json(out_path, data)
        print(f"::warning title=Google Scholar blocked this run::{exc} (last good data from {data.get('last_success')} kept)")
        return data["status"]
    except (ScholarParseError, requests.RequestException, OSError) as exc:
        # Unexpected: keep the file as it was and fail loudly so the owner is notified.
        data = dict(previous) if previous else {"profile": {"user": user, "url": profile_url}, "metrics": None, "publications": []}
        data["last_attempt"] = attempt
        data["status"] = "error" if data.get("metrics") else "never_synced"
        data["error"] = str(exc)[:300]
        data.setdefault("last_success", None)
        data["source"] = SOURCE
        write_json(out_path, data)
        print(f"::error title=Google Scholar sync error::{exc}")
        return "error"


def write_summary(status, out_path):
    """Append a short report to the GitHub Actions job summary when running in Actions."""
    path = os.environ.get("GITHUB_STEP_SUMMARY")
    if not path:
        return
    d = load_previous(out_path)
    m = d.get("metrics") or {}
    lines = ["## Google Scholar sync", "", f"* Result of this run: **{status}**"]
    if d.get("last_success"):
        lines.append(f"* Last successful synchronization: {d['last_success']}")
    if m:
        lines.append(f"* Publications: {d.get('publication_count')} · Citations: {m.get('citations', {}).get('all')} · "
                     f"h-index: {m.get('h_index', {}).get('all')} · i10-index: {m.get('i10_index', {}).get('all')}")
    if d.get("error"):
        lines.append(f"* Note: {d['error']}")
    with open(path, "a", encoding="utf-8") as fh:
        fh.write("\n".join(lines) + "\n")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--user", default=os.environ.get("SCHOLAR_USER", "SSoTLJoAAAAJ"), help="Google Scholar user id (the 'user=' value in the profile URL)")
    ap.add_argument("--out", default="data/scholar.json")
    ap.add_argument("--attempts", type=int, default=3, help="attempts per page before giving up (default 3)")
    ap.add_argument("--fail-on-block", action="store_true", help="also exit with status 1 when Google Scholar blocks the request")
    args = ap.parse_args()
    status = sync(args.user, args.out, max(1, args.attempts))
    write_summary(status, args.out)
    failed = status == "error" or (args.fail_on_block and status != "ok")
    sys.exit(1 if failed else 0)
