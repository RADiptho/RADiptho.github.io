#!/usr/bin/env python3
"""Synchronize Google Scholar metrics and the author's registry records into data/scholar.json.

Run on a schedule by .github/workflows/scholar-sync.yml. The website reads the JSON at load
time, shows the numbers with the date they were read, and adds to its lists any article,
conference paper or dataset that the registries have and index.html does not have yet.

Three sources, each independent of the others:

1. Google Scholar (citations, h-index, i10-index, the records of the profile).
   Google Scholar has no public API and refuses almost every request that comes from
   GitHub's runners (HTTP 403 / 429 or a CAPTCHA page). Two ways of reading it:

   * SerpApi (https://serpapi.com), used when the repository secret SERPAPI_KEY is set.
     It reads the same public profile page through its own network and is not refused.
     One run costs one search; the free plan is far more than this schedule uses.
   * a direct request, used when there is no key or SerpApi fails. Most of these are
     refused. That is expected, not a bug: the previous figures are kept *with their
     date* and the run is recorded as "blocked".

2. Crossref (https://api.crossref.org): journal articles and conference papers that carry
   the author's ORCID iD or name. Open, no key.

3. DataCite (https://api.datacite.org): datasets (Mendeley Data, Zenodo, ...) that carry
   the author's name. Open, no key. All versions of one deposit are one dataset.

Nothing is ever invented or estimated: a value is written only when a source returned it,
and when a source fails its previous values stay as they were.

The file is rewritten when Google Scholar was read, when anything changed, and otherwise
once a day (so the "latest check" date stays honest without a commit for every refusal).

Exit status: 0 when the run did what it could (including an expected block), 1 when
something needs the owner's attention (the SerpApi key was rejected, the profile markup
changed, an I/O error).

Usage: python scripts/sync_scholar.py [--user ID] [--out data/scholar.json] [--attempts N]
                                     [--orcid ID] [--family NAME] [--given NAME] [--name NAME]
                                     [--min-hours H] [--quiet-hours H] [--force]
                                     [--message-file PATH] [--fail-on-block]
Environment: SERPAPI_KEY   (optional) API key for serpapi.com; never printed or stored
             SCHOLAR_PROXY (optional) an HTTP(S) proxy URL for the direct request
"""
import argparse
import copy
import datetime as dt
import html
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
SERPAPI = "https://serpapi.com/search"
CROSSREF = "https://api.crossref.org/works"
DATACITE = "https://api.datacite.org/dois"
PAGESIZE = 100
SOURCE = ("Google Scholar profile, read by scripts/sync_scholar.py on a GitHub Actions schedule; "
          "not real-time data")
REGISTRY_SOURCE = ("Crossref (articles, conference papers) and DataCite (datasets): records that carry "
                   "the author's name, read by scripts/sync_scholar.py")
REGISTRY_UA = "RADiptho.github.io scholar-sync (+https://radiptho.github.io/)"
CROSSREF_SELECT = "DOI,type,title,author,container-title,publisher,issued,created,volume,issue,page,article-number"
UA_POOL = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0",
]
# Publisher names as the registries spell them -> as the site writes them.
PUBLISHERS = {
    "mdpi ag": "MDPI",
    "springer science and business media llc": "Springer Nature",
    "springer nature": "Springer Nature",
    "elsevier bv": "Elsevier",
    "wiley": "Wiley",
    "institute of electrical and electronics engineers (ieee)": "IEEE",
    "ieee": "IEEE",
    "association for computing machinery (acm)": "ACM",
    "acm": "ACM",
    "frontiers media sa": "Frontiers",
    "informa uk limited": "Taylor & Francis",
    "oxford university press (oup)": "Oxford University Press",
    "cambridge university press (cup)": "Cambridge University Press",
    "public library of science (plos)": "PLOS",
    "sage publications": "SAGE",
    "hindawi limited": "Hindawi",
}
NOT_A_PAPER = re.compile(r"^\s*(author |publisher )?(correction|corrigendum|erratum|retraction|retracted|expression of concern)\b", re.I)
CONFERENCE_WORDS = re.compile(r"\b(conference|proceedings|symposium|workshop|congress)\b", re.I)


class ScholarBlocked(Exception):
    """Google Scholar refused the request (captcha, rate limit, or block page)."""


class ScholarParseError(Exception):
    """The page came back but did not look like a Scholar profile."""


class ProviderError(Exception):
    """SerpApi did not return the profile (bad key, quota, outage). `fatal` marks a rejected key."""

    def __init__(self, message, fatal=False):
        super().__init__(message)
        self.fatal = fatal


class RegistryError(Exception):
    """Crossref or DataCite could not be read."""


# ----------------------------------------------------------------------------- small helpers

def now_iso():
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def hours_since(iso, now=None):
    """Hours between an ISO time stamp and now; None when there is no usable stamp."""
    if not iso:
        return None
    try:
        then = dt.datetime.fromisoformat(str(iso).replace("Z", "+00:00"))
    except ValueError:
        return None
    if then.tzinfo is None:
        then = then.replace(tzinfo=dt.timezone.utc)
    now = now or dt.datetime.now(dt.timezone.utc)
    return (now - then).total_seconds() / 3600.0


def load_previous(path):
    try:
        with open(path, encoding="utf-8") as fh:
            data = json.load(fh)
            return data if isinstance(data, dict) else {}
    except (OSError, json.JSONDecodeError):
        return {}


def write_json(path, data):
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, indent=2)
        fh.write("\n")
    os.replace(tmp, path)


def parse_int(text):
    if isinstance(text, bool):
        return None
    if isinstance(text, int):
        return text
    text = str(text if text is not None else "").strip().replace(",", "")
    return int(text) if text.isdigit() else None


def clean(text):
    """Registry text -> plain text: no markup, entities resolved, single spaces."""
    text = html.unescape(re.sub(r"<[^>]+>", "", str(text or "")))
    return re.sub(r"\s+", " ", text).strip()


def title_key(title):
    return re.sub(r"[^a-z0-9]+", " ", str(title or "").lower()).strip()


def scrub(text, *secrets):
    """Remove secrets from a message before it is printed or stored in the public data file."""
    text = str(text)
    for secret in secrets:
        if secret:
            text = text.replace(secret, "***")
    return re.sub(r"(api_key=)[^&\s]+", r"\1***", text)


# ----------------------------------------------------------------------------- Google Scholar, direct

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
                print(f"attempt {i}/{attempts} failed ({scrub(exc, os.environ.get('SCHOLAR_PROXY'))}); retrying in {pause:.0f}s", flush=True)
                time.sleep(pause)
    if isinstance(last, requests.RequestException):
        raise ScholarBlocked(f"network error reaching Google Scholar ({type(last).__name__})")
    raise last


def parse_profile(page):
    soup = BeautifulSoup(page, "html.parser")
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


def parse_publications(page):
    soup = BeautifulSoup(page, "html.parser")
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


def read_direct(user, attempts):
    """The profile as Google Scholar serves it. Raises ScholarBlocked when it is refused."""
    profile_url = f"{BASE}/citations?user={user}"
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
    if not profile["metrics"]:
        raise ScholarParseError("Profile loaded but the metrics table was not found")
    return {"name": profile["name"], "affiliation": profile["affiliation"], "metrics": profile["metrics"], "publications": pubs}


# ----------------------------------------------------------------------------- Google Scholar, through SerpApi

def serpapi_get(params, key):
    """One SerpApi search. The key never appears in an error message."""
    query = dict(params)
    query["api_key"] = key
    try:
        resp = requests.get(SERPAPI, params=query, timeout=90)
    except requests.RequestException as exc:
        raise ProviderError(f"SerpApi could not be reached ({type(exc).__name__})")
    try:
        body = resp.json()
    except ValueError:
        body = {}
    if not isinstance(body, dict):
        body = {}
    message = body.get("error")
    if resp.status_code != 200 or message:
        text = scrub(message or f"HTTP {resp.status_code}", key)[:200]
        rejected = resp.status_code in (401, 403) or "invalid api key" in text.lower()
        raise ProviderError(f"SerpApi: {text}", fatal=rejected)
    return body


def parse_serpapi(body):
    """The profile part of a SerpApi answer in the shape parse_profile() returns."""
    author = body.get("author") or {}
    table = (body.get("cited_by") or {}).get("table") or []
    order = ["citations", "h_index", "i10_index"]          # the rows of the table on every Scholar profile
    metrics, recent_since = {}, None
    for idx, row in enumerate(table[:3]):
        if not isinstance(row, dict) or not row:
            continue
        label, vals = next(iter(row.items()))
        if not isinstance(vals, dict):
            continue
        key = label if label in order else order[idx]      # labels follow the language of the page; the order does not
        recent = None
        for name, value in vals.items():
            m = re.search(r"(\d{4})", str(name))
            if name != "all" and m:
                recent_since, recent = int(m.group(1)), parse_int(value)
        metrics[key] = {"all": parse_int(vals.get("all")), "recent": recent}
    if metrics:
        metrics["recent_since"] = recent_since
    return {"name": author.get("name"), "affiliation": author.get("affiliations"), "metrics": metrics or None}


def parse_serpapi_articles(body, user):
    pubs = []
    for art in body.get("articles") or []:
        if not isinstance(art, dict) or not art.get("title"):
            continue
        link = str(art.get("link") or "")
        pubs.append({
            "title": clean(art.get("title")),
            "authors": clean(art.get("authors")),
            "venue": re.sub(r",\s*\d{4}$", "", clean(art.get("publication"))).strip(),
            "year": parse_int(art.get("year")),
            "citations": parse_int((art.get("cited_by") or {}).get("value")),
            "url": link if link.startswith(BASE + "/") else f"{BASE}/citations?user={user}",
        })
    return pubs


def read_serpapi(user, key):
    """The same profile through SerpApi. Raises ProviderError when it cannot be had."""
    params = {"engine": "google_scholar_author", "author_id": user, "hl": "en", "sort": "pubdate", "num": PAGESIZE, "start": 0, "output": "json"}
    first = serpapi_get(params, key)
    profile = parse_serpapi(first)
    pubs = parse_serpapi_articles(first, user)
    start = PAGESIZE
    while len(pubs) == start and start < 1000:              # a full page may mean more rows
        params["start"] = start
        more = parse_serpapi_articles(serpapi_get(params, key), user)
        if not more:
            break
        pubs.extend(more)
        start += PAGESIZE
    cites = (profile["metrics"] or {}).get("citations") or {}
    if cites.get("all") is None:
        raise ProviderError("SerpApi: the answer has no citation table")
    return {"name": profile["name"], "affiliation": profile["affiliation"], "metrics": profile["metrics"], "publications": pubs}


# ----------------------------------------------------------------------------- Crossref and DataCite

def http_json(url, params, attempts=2):
    last = "no answer"
    for i in range(attempts):
        try:
            resp = requests.get(url, params=params, headers={"User-Agent": REGISTRY_UA, "Accept": "application/json"}, timeout=45)
            if resp.status_code == 200:
                body = resp.json()
                if isinstance(body, dict):
                    return body
                last = "unexpected answer"
            else:
                last = f"HTTP {resp.status_code}"
        except (requests.RequestException, ValueError) as exc:
            last = type(exc).__name__
        if i + 1 < attempts:
            time.sleep(4 * (i + 1))
    raise RegistryError(f"{url.split('/')[2]}: {last}")


def is_author(family, given, orcid, ident):
    """True when a registry name is the author of this site (family name and ORCID iD or given name)."""
    if str(family or "").strip().casefold() != ident["family"].casefold():
        return False
    if ident.get("orcid") and str(orcid or "").strip().upper().endswith(ident["orcid"].upper()):
        return True
    return ident["given"].casefold() in str(given or "").casefold()


def short_publisher(name):
    name = clean(name)
    if name.casefold() in PUBLISHERS:
        return PUBLISHERS[name.casefold()]
    name = re.sub(r"\s*\((?:[A-Z][A-Za-z]{1,7})\)$", "", name)                       # "... (OUP)"
    return re.sub(r",?\s+(AG|BV|B\.V\.|LLC|Ltd\.?|Limited|Inc\.?|SA|S\.A\.|GmbH|Co\.|Corp\.?)$", "", name).strip()


def date_parts(node):
    parts = ((node or {}).get("date-parts") or [[None]])[0] or [None]
    year = parts[0] if parts and isinstance(parts[0], int) else None
    text = "-".join(f"{int(x):02d}" if i else f"{int(x):04d}" for i, x in enumerate(parts[:3]) if isinstance(x, int)) if year else ""
    return year, text


def work_from_crossref(item, ident):
    """A Crossref record as the site needs it, or None when it is not an article or paper by the author."""
    kind = {"journal-article": "journal", "proceedings-article": "conference"}.get(item.get("type"))
    container = clean((item.get("container-title") or [""])[0])
    if kind is None and item.get("type") == "book-chapter" and CONFERENCE_WORDS.search(container):
        kind = "conference"                                # proceedings published as a book series
    title = clean((item.get("title") or [""])[0])
    doi = str(item.get("DOI") or "").strip()
    if not kind or not title or not doi or NOT_A_PAPER.search(title):
        return None
    authors, me = [], None
    for person in item.get("author") or []:
        given, family = clean(person.get("given")), clean(person.get("family"))
        name = (given + " " + family).strip() or clean(person.get("name"))
        if not name:
            continue
        if me is None and is_author(family, given, person.get("ORCID"), ident):
            me = len(authors)
        authors.append(name)
    if me is None:
        return None
    issued_year, issued = date_parts(item.get("issued"))
    created_year, created = date_parts(item.get("created"))
    years = [y for y in (issued_year, created_year) if y]
    work = {
        "doi": doi, "kind": kind, "title": title, "authors": authors, "me": me,
        "container": container, "publisher": short_publisher(item.get("publisher")),
        "year": min(years) if years else None,              # an article placed in next year's volume is listed under the year it appeared
        "date": created or issued,                           # when the record appeared: newest first on the site
    }
    for key, field in (("volume", "volume"), ("issue", "issue"), ("pages", "page"), ("article", "article-number")):
        value = clean(item.get(field))
        if value:
            work[key] = value
    return work


def crossref_works(ident):
    items, errors = {}, []
    queries = []
    if ident.get("orcid"):
        queries.append({"filter": f"orcid:{ident['orcid']}", "rows": 200, "select": CROSSREF_SELECT})
    queries.append({"query.author": ident.get("name") or f"{ident['given']} {ident['family']}", "rows": 100, "select": CROSSREF_SELECT})
    for params in queries:
        try:
            for item in (http_json(CROSSREF, params).get("message") or {}).get("items") or []:
                if isinstance(item, dict) and item.get("DOI"):
                    items.setdefault(str(item["DOI"]).lower(), item)
        except RegistryError as exc:
            errors.append(str(exc))
    if len(errors) == len(queries):
        raise RegistryError(errors[0])
    works = [w for w in (work_from_crossref(item, ident) for item in items.values()) if w]
    works.sort(key=lambda w: (w["date"] or "", w["doi"]), reverse=True)
    return works


def creator_name(person):
    given, family = clean(person.get("givenName")), clean(person.get("familyName"))
    if given and family:
        return f"{given} {family}"
    name = clean(person.get("name"))
    if "," in name:                                          # "Family, Given"
        family, given = [part.strip() for part in name.split(",", 1)]
        return f"{given} {family}".strip()
    return name


def version_rank(doi, attributes):
    m = re.search(r"\.(\d+)$", doi)
    nums = [int(x) for x in re.findall(r"\d+", str(attributes.get("version") or ""))]
    return (int(m.group(1)) if m else 0, nums, str(attributes.get("registered") or attributes.get("created") or ""), doi)


def datacite_sets(ident):
    body = http_json(DATACITE, {"query": f"creators.familyName:{ident['family']}", "page[size]": 200})
    groups = {}
    for item in body.get("data") or []:
        attr = (item or {}).get("attributes") or {}
        doi = str(attr.get("doi") or "").strip().lower()
        if not doi or (attr.get("types") or {}).get("resourceTypeGeneral") != "Dataset" or attr.get("state", "findable") != "findable":
            continue
        creators, me = [], None
        for person in attr.get("creators") or []:
            orcid = " ".join(str(n.get("nameIdentifier") or "") for n in person.get("nameIdentifiers") or [] if isinstance(n, dict))
            given, family = person.get("givenName"), person.get("familyName")
            if not given and "," in str(person.get("name") or ""):
                family, given = [part.strip() for part in str(person["name"]).split(",", 1)]
            if me is None and is_author(family, given, orcid.strip(), ident):
                me = len(creators)
            creators.append(creator_name(person))
        if me is None:
            continue
        related = [r for r in attr.get("relatedIdentifiers") or [] if isinstance(r, dict) and r.get("relatedIdentifierType") == "DOI"]
        parents = [str(r.get("relatedIdentifier") or "").lower() for r in related if r.get("relationType") == "IsVersionOf"]
        mendeley = re.match(r"^(10\.17632/[a-z0-9]+)\.\d+$", doi)
        key = parents[0] if parents else (mendeley.group(1) if mendeley else doi)   # every version of a deposit under one DOI
        title = clean(((attr.get("titles") or [{}])[0] or {}).get("title"))
        publisher = attr.get("publisher")
        groups.setdefault(key, []).append({
            "doi": doi, "title": title, "creators": creators, "me": me, "attr": attr,
            "host": clean(publisher.get("name") if isinstance(publisher, dict) else publisher),
            "year": parse_int(attr.get("publicationYear")),
        })
    sets = []
    for key, members in groups.items():
        versions = [m for m in members if m["doi"] != key] or members
        latest = max(versions, key=lambda m: version_rank(m["doi"], m["attr"]))
        concept = next((m for m in members if m["doi"] == key), latest)
        if not (concept["title"] or latest["title"]):
            continue
        suffix = re.search(r"\.(\d+)$", latest["doi"]) if key.startswith("10.17632/") else None
        sets.append({
            "doi": key, "dois": sorted(m["doi"] for m in members if m["doi"] != key), "latest": latest["doi"],
            "version": suffix.group(1) if suffix else (str(latest["attr"].get("version") or "") or None),
            "title": concept["title"] or latest["title"], "creators": latest["creators"], "me": latest["me"],
            "host": latest["host"] or concept["host"], "year": latest["year"] or concept["year"],
        })
    sets.sort(key=lambda s: (s["year"] or 0, s["doi"]), reverse=True)
    return sets


def read_registries(ident, previous):
    """Crossref and DataCite, each on its own: one failing leaves its previous list in place."""
    reg = {"works": list(previous.get("works") or []), "datasets": list(previous.get("datasets") or [])}
    errors = []
    try:
        works = crossref_works(ident)
        if works or not reg["works"]:
            reg["works"] = works
        else:
            errors.append("api.crossref.org: no record came back; the previous list is kept")
    except RegistryError as exc:
        errors.append(str(exc))
    try:
        sets = datacite_sets(ident)
        if sets or not reg["datasets"]:
            reg["datasets"] = sets
        else:
            errors.append("api.datacite.org: no record came back; the previous list is kept")
    except RegistryError as exc:
        errors.append(str(exc))
    reg["status"] = "ok" if not errors else ("partial" if len(errors) == 1 else "error")
    reg["error"] = "; ".join(errors)[:300] or None
    return reg


# ----------------------------------------------------------------------------- one run

def unique_by_title(pubs):
    seen, unique = set(), []
    for p in pubs:
        key = title_key(p.get("title"))
        if not key or key in seen:
            continue
        seen.add(key)
        unique.append(p)
    return unique


def scholar_core(data):
    """What a Scholar read says, without dates: used to tell whether anything changed."""
    metrics = {k: v for k, v in (data.get("metrics") or {}).items() if k != "confirmed"}
    return json.dumps([data.get("profile"), metrics, data.get("publications"), data.get("publication_count")], sort_keys=True, ensure_ascii=False)


def describe_change(previous, data):
    """A few words for the commit message: what is new in this file."""
    notes = []
    old = ((previous.get("metrics") or {}).get("citations") or {}).get("all")
    new = ((data.get("metrics") or {}).get("citations") or {}).get("all")
    if new is not None and old != new:
        notes.append(f"citations {old if old is not None else '?'} → {new}")
    old_titles = {title_key(p.get("title")) for p in previous.get("publications") or []}
    added = [p for p in data.get("publications") or [] if title_key(p.get("title")) not in old_titles]
    if added and old_titles:
        notes.append(f"{len(added)} new Scholar record{'s' if len(added) != 1 else ''}")
    old_reg, new_reg = previous.get("registry") or {}, data.get("registry") or {}
    old_dois = {str(w.get("doi")).lower() for w in old_reg.get("works") or []}
    new_works = [w for w in new_reg.get("works") or [] if str(w.get("doi")).lower() not in old_dois]
    if new_works and old_dois:
        notes.append(f"{len(new_works)} new Crossref record{'s' if len(new_works) != 1 else ''}")
    old_sets = {str(s.get("doi")).lower() for s in old_reg.get("datasets") or []}
    new_sets = [s for s in new_reg.get("datasets") or [] if str(s.get("doi")).lower() not in old_sets]
    if new_sets and old_sets:
        notes.append(f"{len(new_sets)} new dataset{'s' if len(new_sets) != 1 else ''}")
    return notes


def sync(user, out_path, attempts, ident=None, min_hours=5.0, quiet_hours=20.0, force=False, registries=True):
    """Read the sources, merge with the previous file, write when there is something to write.

    Returns a dict: status (ok | blocked | error | never_synced | fresh), written (bool), fatal (bool), message.
    """
    previous = load_previous(out_path)
    attempt = now_iso()
    profile_url = f"{BASE}/citations?user={user}"
    key = (os.environ.get("SERPAPI_KEY") or "").strip()
    data = copy.deepcopy(previous) if previous else {"profile": {"user": user, "url": profile_url}, "metrics": None, "publications": []}
    fatal, notes_for_owner = False, []

    # ---- Google Scholar ----
    age = hours_since(previous.get("last_success"))
    fresh = bool(key) and not force and previous.get("provider") == "serpapi" and previous.get("status") == "ok" and age is not None and 0 <= age < min_hours
    read, provider, blocked, broken = None, None, None, None
    if fresh:
        print(f"Google Scholar was read {age:.1f} h ago through SerpApi; not read again before {min_hours:g} h (use --force to read now)")
    else:
        if key:
            try:
                read, provider = read_serpapi(user, key), "serpapi"
            except ProviderError as exc:
                fatal = fatal or exc.fatal
                notes_for_owner.append(scrub(exc, key))
                print(f"::warning title=SerpApi did not return the profile::{scrub(exc, key)}")
        if read is None:
            try:
                read, provider = read_direct(user, attempts if not key else 1), "direct"
            except ScholarBlocked as exc:
                blocked = scrub(exc, os.environ.get("SCHOLAR_PROXY"))
            except (ScholarParseError, requests.RequestException) as exc:
                broken = scrub(exc, os.environ.get("SCHOLAR_PROXY"))
        if read is not None:
            pubs = unique_by_title(read["publications"])
            if not pubs and (previous.get("publication_count") or 0) >= 3:
                read, broken = None, "The profile came back without any record; the previous data is kept"
    if read is not None:
        data.update({
            "profile": {"user": user, "url": profile_url, "name": read["name"], "affiliation": read["affiliation"]},
            "metrics": read["metrics"],                      # a total confirmed by hand ends here: the source has spoken
            "publications": pubs,
            "publication_count": len(pubs),
            "last_success": attempt, "last_attempt": attempt,
            "status": "ok", "error": None, "source": SOURCE, "provider": provider,
        })
        m = read["metrics"]
        print(f"OK ({provider}): {len(pubs)} publications, citations={m.get('citations')}, h={m.get('h_index')}, i10={m.get('i10_index')}")
    elif not fresh:
        problem = "; ".join(notes_for_owner + [blocked or broken or "no answer"])[:300]
        data["last_attempt"] = attempt
        data["status"] = ("blocked" if blocked else "error") if data.get("metrics") else "never_synced"
        data["error"] = problem
        data.setdefault("last_success", None)
        data["source"] = SOURCE
        if blocked:
            print(f"::warning title=Google Scholar blocked this run::{problem} (last good data from {data.get('last_success')} kept)")
        else:
            print(f"::error title=Google Scholar sync error::{problem}")

    # ---- Crossref and DataCite ----
    old_reg = previous.get("registry") or {}
    if registries and ident:
        reg = read_registries(ident, old_reg)
        reg["source"] = REGISTRY_SOURCE
        reg["last_attempt"] = attempt
        reg["last_success"] = attempt if reg["status"] == "ok" else old_reg.get("last_success")
        if reg["error"]:
            print(f"::warning title=Registry read incomplete::{reg['error']}")
        else:
            print(f"OK (registries): {len(reg['works'])} Crossref records, {len(reg['datasets'])} datasets")
        data["registry"] = reg

    # ---- write when there is something to say ----
    def registry_core(reg):
        return json.dumps([(reg or {}).get("works"), (reg or {}).get("datasets"), (reg or {}).get("status")], sort_keys=True, ensure_ascii=False)

    changed = (scholar_core(data) != scholar_core(previous) or data.get("status") != previous.get("status")
               or registry_core(data.get("registry")) != registry_core(old_reg))
    stale = hours_since(previous.get("last_attempt"))
    due = stale is None or stale >= quiet_hours or stale < 0
    status = "fresh" if fresh else data["status"]
    notes = describe_change(previous, data)
    word = {"fresh": "ok", "never_synced": "not read yet"}.get(status, status)
    message = "Scholar sync: " + (", ".join(notes) if notes else word) + (f" (Scholar {word})" if notes and status not in ("ok", "fresh") else "")
    written = False
    # A successful read is always written: its date is what the site shows and what the next run measures --min-hours from.
    # A refused read is written when the status changed, and otherwise once a day, so the "latest check" date stays honest.
    if read is not None or changed or due or not previous:
        write_json(out_path, data)
        written = True
    else:
        print("Nothing new since the last write; the file is left as it is")
    return {"status": status, "written": written, "fatal": fatal or status == "error", "message": message}


def write_summary(result, out_path):
    """Append a short report to the GitHub Actions job summary when running in Actions."""
    path = os.environ.get("GITHUB_STEP_SUMMARY")
    if not path:
        return
    d = load_previous(out_path)
    m = d.get("metrics") or {}
    reg = d.get("registry") or {}
    lines = ["## Google Scholar sync", "", f"* Result of this run: **{result['status']}**" + ("" if result["written"] else " (file unchanged)")]
    if d.get("last_success"):
        lines.append(f"* Last successful read of Google Scholar: {d['last_success']}" + (f" ({d['provider']})" if d.get("provider") else ""))
    if m:
        lines.append(f"* Publications: {d.get('publication_count')} · Citations: {(m.get('citations') or {}).get('all')} · "
                     f"h-index: {(m.get('h_index') or {}).get('all')} · i10-index: {(m.get('i10_index') or {}).get('all')}")
    if reg:
        lines.append(f"* Registries ({reg.get('status')}): {len(reg.get('works') or [])} Crossref records, {len(reg.get('datasets') or [])} datasets")
    if d.get("error"):
        lines.append(f"* Note: {d['error']}")
    if not (os.environ.get("SERPAPI_KEY") or "").strip():
        lines.append("* No `SERPAPI_KEY` secret is set, so Google Scholar is asked directly and usually refuses. See README, section 4.")
    with open(path, "a", encoding="utf-8") as fh:
        fh.write("\n".join(lines) + "\n")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--user", default=os.environ.get("SCHOLAR_USER", "SSoTLJoAAAAJ"), help="Google Scholar user id (the 'user=' value in the profile URL)")
    ap.add_argument("--out", default="data/scholar.json")
    ap.add_argument("--attempts", type=int, default=3, help="direct attempts per page before giving up (default 3)")
    ap.add_argument("--orcid", default="0009-0007-3062-1034", help="ORCID iD of the author, for Crossref and DataCite")
    ap.add_argument("--family", default="Diptho", help="family name of the author as registries record it")
    ap.add_argument("--given", default="Rakib", help="a given name every registry record of the author contains")
    ap.add_argument("--name", default="Rakib Ahammed Diptho", help="the author's name as publishers print it, for the Crossref author search")
    ap.add_argument("--min-hours", type=float, default=5.0, help="with a SerpApi key: do not read Scholar again sooner than this (default 5)")
    ap.add_argument("--quiet-hours", type=float, default=20.0, help="rewrite an unchanged file only this often (default 20)")
    ap.add_argument("--force", action="store_true", help="read Scholar now even if it was read a moment ago")
    ap.add_argument("--no-registries", action="store_true", help="do not ask Crossref and DataCite")
    ap.add_argument("--message-file", help="write a one-line commit message for this run to this file")
    ap.add_argument("--fail-on-block", action="store_true", help="also exit with status 1 when Google Scholar blocks the request")
    args = ap.parse_args()
    identity = {"family": args.family, "given": args.given, "orcid": args.orcid, "name": args.name}
    try:
        outcome = sync(args.user, args.out, max(1, args.attempts), ident=identity, min_hours=args.min_hours,
                       quiet_hours=args.quiet_hours, force=args.force, registries=not args.no_registries)
    except OSError as exc:
        print(f"::error title=Google Scholar sync error::{exc}")
        sys.exit(1)
    if args.message_file:
        with open(args.message_file, "w", encoding="utf-8") as fh:
            fh.write(outcome["message"] + "\n")
    write_summary(outcome, args.out)
    print(outcome["message"])
    failed = outcome["fatal"] or (args.fail_on_block and outcome["status"] not in ("ok", "fresh"))
    sys.exit(1 if failed else 0)
