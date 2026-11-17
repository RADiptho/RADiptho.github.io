#!/usr/bin/env python3
"""Offline tests for sync_scholar.py:  python scripts/test_sync_scholar.py

No network is used: every request is answered from the samples below. The Crossref and
DataCite samples are real records of the author as the two registries returned them on
17 November 2026 (shortened to the fields the script reads); records marked TEST are
invented for the cases the real ones do not cover. The SerpApi sample follows the
documented answer of its google_scholar_author engine, and the Scholar page sample uses
the markup the profile page is parsed by.
"""
import contextlib
import copy
import datetime as dt
import io
import json
import os
import sys
import tempfile
import unittest
from unittest import mock

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sync_scholar as S  # noqa: E402

KEY = "k3y-THAT-must-never-be-written-0123456789"
IDENT = {"family": "Diptho", "given": "Rakib", "orcid": "0009-0007-3062-1034", "name": "Rakib Ahammed Diptho"}
ME = "https://orcid.org/0009-0007-3062-1034"

SCHOLAR_PAGE = """<html><body><div id="gsc_prf_in">Rakib Ahammed Diptho</div><div class="gsc_prf_il">Jahangirnagar University</div>
<table id="gsc_rsb_st"><thead><tr><th></th><th>All</th><th>Since 2021</th></tr></thead><tbody>
<tr><td class="gsc_rsb_sc1"><a class="gsc_rsb_f">Citations</a></td><td class="gsc_rsb_std">28</td><td class="gsc_rsb_std">28</td></tr>
<tr><td class="gsc_rsb_sc1"><a class="gsc_rsb_f">h-index</a></td><td class="gsc_rsb_std">3</td><td class="gsc_rsb_std">3</td></tr>
<tr><td class="gsc_rsb_sc1"><a class="gsc_rsb_f">i10-index</a></td><td class="gsc_rsb_std">1</td><td class="gsc_rsb_std">1</td></tr></tbody></table>
<table><tbody id="gsc_a_b">
<tr class="gsc_a_tr"><td class="gsc_a_t"><a class="gsc_a_at" href="/citations?view_op=view_citation&amp;user=SSoTLJoAAAAJ&amp;citation_for_view=SSoTLJoAAAAJ:AAA">Gesture-Based Navigation of Smart Wheelchairs: A Review of Current Trends and Future Directions</a><div class="gs_gray">RA Diptho, SH Chowdhury, MAA Mamun</div><div class="gs_gray">Technologies 14 (7), 430<span class="gs_oph">, 2026</span></div></td><td class="gsc_a_c"><a class="gsc_a_ac">5</a></td><td class="gsc_a_y"><span class="gsc_a_h">2026</span></td></tr>
<tr class="gsc_a_tr"><td class="gsc_a_t"><a class="gsc_a_at" href="/citations?view_op=view_citation&amp;user=SSoTLJoAAAAJ&amp;citation_for_view=SSoTLJoAAAAJ:BBB">Enhancing Dermatological Diagnosis Through Medical Image Analysis: How Effective Is YOLO11 Compared to Leading CNN Models?</a><div class="gs_gray">RA Diptho, S Basak</div><div class="gs_gray">Non-Destructive Testing 3 (2), 11<span class="gs_oph">, 2025</span></div></td><td class="gsc_a_c"><a class="gsc_a_ac">14</a></td><td class="gsc_a_y"><span class="gsc_a_h">2025</span></td></tr>
<tr class="gsc_a_tr"><td class="gsc_a_t"><a class="gsc_a_at" href="/citations?view_op=view_citation&amp;user=SSoTLJoAAAAJ&amp;citation_for_view=SSoTLJoAAAAJ:CCC">Event Aligned MODIS Dataset for Mangrove Canopy Response to Tropical Cyclones in the Bay of Bengal</a><div class="gs_gray">RA Diptho, P Ghosh</div><div class="gs_gray">Mendeley Data, Elsevier<span class="gs_oph">, 2026</span></div></td><td class="gsc_a_c"><a class="gsc_a_ac"></a></td><td class="gsc_a_y"><span class="gsc_a_h">2026</span></td></tr>
</tbody></table></body></html>"""

SERPAPI_ANSWER = {
    "search_metadata": {"status": "Success"},
    "author": {"name": "Rakib Ahammed Diptho", "affiliations": "Jahangirnagar University", "email": "Verified email at juniv.edu"},
    "articles": [
        {"title": "Gesture-Based Navigation of Smart Wheelchairs: A Review of Current Trends and Future Directions",
         "link": "https://scholar.google.com/citations?view_op=view_citation&hl=en&user=SSoTLJoAAAAJ&citation_for_view=SSoTLJoAAAAJ:AAA",
         "citation_id": "SSoTLJoAAAAJ:AAA", "authors": "RA Diptho, SH Chowdhury, MAA Mamun", "publication": "Technologies 14 (7), 430, 2026",
         "cited_by": {"value": 6, "link": "https://scholar.google.com/scholar?cites=1"}, "year": "2026"},
        {"title": "Enhancing Dermatological Diagnosis Through Medical Image Analysis: How Effective Is YOLO11 Compared to Leading CNN Models?",
         "link": "https://scholar.google.com/citations?view_op=view_citation&hl=en&user=SSoTLJoAAAAJ&citation_for_view=SSoTLJoAAAAJ:BBB",
         "citation_id": "SSoTLJoAAAAJ:BBB", "authors": "RA Diptho, S Basak", "publication": "Non-Destructive Testing 3 (2), 11, 2025",
         "cited_by": {"value": 14}, "year": "2025"},
        {"title": "Event Aligned MODIS Dataset for Mangrove Canopy Response to Tropical Cyclones in the Bay of Bengal",
         "link": "https://example.org/not-scholar", "citation_id": "SSoTLJoAAAAJ:CCC", "authors": "RA Diptho, P Ghosh",
         "publication": "Mendeley Data, Elsevier, 2026", "cited_by": {"value": None}, "year": ""},
    ],
    "cited_by": {"table": [{"citations": {"all": 29, "since_2021": 29}}, {"h_index": {"all": 3, "since_2021": 3}}, {"i10_index": {"all": 1, "since_2021": 1}}],
                 "graph": [{"year": 2025, "citations": 9}, {"year": 2026, "citations": 20}]},
}


def person(given, family, orcid=None, sequence="additional"):
    out = {"given": given, "family": family, "sequence": sequence, "affiliation": []}
    if orcid:
        out["ORCID"] = orcid
        out["authenticated-orcid"] = False
    return out


CROSSREF_ITEMS = [
    {"DOI": "10.3390/technologies14070430", "type": "journal-article", "title": ["Gesture-Based Navigation of Smart Wheelchairs: A Review of Current Trends and Future Directions"],
     "container-title": ["Technologies"], "publisher": "MDPI AG",
     "author": [person("Rakib Ahammed", "Diptho", ME, "first"), person("Safiul Haque", "Chowdhury"), person("Md Abdullah Al", "Mamun")],
     "issued": {"date-parts": [[2026, 7, 14]]}, "created": {"date-parts": [[2026, 7, 15]], "date-time": "2026-07-15T01:05:58Z"}, "volume": "14", "issue": "7", "page": "430"},
    {"DOI": "10.1016/j.ijmedinf.2026.106811", "type": "journal-article",
     "title": ["Self-report label bias in machine learning screening for undiagnosed diabetes: development, validation and offline on-device deployment of an interpretable HbA1c-anchored tool"],
     "container-title": ["International Journal of Medical Informatics"], "publisher": "Elsevier BV",
     "author": [person("Safiul Haque", "Chowdhury", None, "first"), person("Rakib Ahammed", "Diptho", ME), person("Pial", "Ghosh")],
     "issued": {"date-parts": [[2027, 2]]}, "created": {"date-parts": [[2026, 11, 10]], "date-time": "2026-11-10T17:07:56Z"}, "volume": "224", "page": "106811", "article-number": "106811"},
    {"DOI": "10.1007/s44288-026-00759-0", "type": "journal-article",
     "title": ["Physically consistent and spatially conformalized machine learning for trustworthy flood susceptibility mapping of the 2024 Feni flash flood"],
     "container-title": ["Discover Geoscience"], "publisher": "Springer Science and Business Media LLC",
     "author": [person("Rakib Ahammed", "Diptho", ME, "first"), person("Pial", "Ghosh"), person("Safiul Haque", "Chowdhury")],
     "issued": {"date-parts": [[2026, 10, 5]]}, "created": {"date-parts": [[2026, 10, 5]]}, "volume": "4", "issue": "1", "article-number": "390"},
    {"DOI": "10.1155/aia/7124711", "type": "journal-article", "title": ["CNN5Conv2FC: A Resource‐Aware Deep Learning Framework for Real‐Time Mango Leaf Disease Recognition"],
     "container-title": ["Advances in Agriculture"], "publisher": "Wiley",
     "author": [person("Rakib Ahammed", "Diptho", ME, "first"), person("Pial", "Ghosh")],
     "issued": {"date-parts": [[2026, 1]]}, "created": {"date-parts": [[2026, 10, 23]]}, "volume": "2026", "issue": "1", "article-number": "7124711"},
    {"DOI": "10.1109/iccit68739.2025.11491345", "type": "proceedings-article",
     "title": ["xLSTM-Based Framework for Accurate Rainfall Forecasting Across Bangladesh: A Comparative Analysis with LSTM and GRU"],
     "container-title": ["2025 28th International Conference on Computer and Information Technology (ICCIT)"], "publisher": "IEEE",
     "author": [person("Rakib Ahammed", "Diptho", None, "first"), person("Pial", "Ghosh"), person("Sarnali", "Basak")],
     "issued": {"date-parts": [[2025, 12, 19]]}, "created": {"date-parts": [[2026, 5, 6]]}, "page": "3329-3334"},
    {"DOI": "10.1109/iccit60459.2023.10441010", "type": "proceedings-article", "title": ["PCOS Diagnosis with Confluence CNN: A Revolution in Women's Health"],
     "container-title": ["2023 26th International Conference on Computer and Information Technology (ICCIT)"], "publisher": "IEEE",
     "author": [person("Rakib Ahammed", "Diptho", None, "first"), person("Nusrat", "Jahan"), {"family": "Sifat-E-Sadakin", "sequence": "additional", "affiliation": []}],
     "issued": {"date-parts": [[2023, 12, 13]]}, "created": {"date-parts": [[2024, 2, 27]]}, "page": "1-5"},
    # the name search also returns other people (real false matches of the query)
    {"DOI": "10.1007/s11896-024-09679-6", "type": "journal-article", "title": ["A paper by other people"], "container-title": ["Journal"], "publisher": "Springer Science and Business Media LLC",
     "author": [person("Rakib", "Islam", None, "first"), person("Md", "Ahammed")], "issued": {"date-parts": [[2024, 5, 1]]}, "created": {"date-parts": [[2024, 5, 1]]}},
    # TEST records for the cases the real ones do not cover
    {"DOI": "10.99999/test.correction", "type": "journal-article", "title": ["Correction: Gesture-Based Navigation of Smart Wheelchairs"], "container-title": ["Technologies"], "publisher": "MDPI AG",
     "author": [person("Rakib Ahammed", "Diptho", ME, "first")], "issued": {"date-parts": [[2026, 8, 1]]}, "created": {"date-parts": [[2026, 8, 1]]}},
    {"DOI": "10.99999/test.review", "type": "peer-review", "title": ["Review of a manuscript"], "publisher": "X",
     "author": [person("Rakib Ahammed", "Diptho", ME, "first")], "issued": {"date-parts": [[2026, 8, 1]]}, "created": {"date-parts": [[2026, 8, 1]]}},
    {"DOI": "10.99999/test.chapter", "type": "book-chapter", "title": ["TEST A paper in <i>proceedings</i> that are a book &amp; series"],
     "container-title": ["Proceedings of the International Conference on Test Records", "Lecture Notes in Networks and Systems"], "publisher": "Springer Nature Singapore",
     "author": [person("R. A.", "Diptho", ME, "first"), person("Pial", "Ghosh")], "issued": {"date-parts": [[2026, 9]]}, "created": {"date-parts": [[2026, 9, 2]]}, "page": "101-112"},
    {"DOI": "10.99999/test.namesake", "type": "journal-article", "title": ["TEST A paper by another Diptho"], "container-title": ["Journal"], "publisher": "X",
     "author": [person("Arnab", "Diptho", "https://orcid.org/0000-0000-0000-0001", "first")], "issued": {"date-parts": [[2026, 1, 1]]}, "created": {"date-parts": [[2026, 1, 1]]}},
]


def dc(doi, title, creators, publisher, related, version=None, kind="Dataset", state="findable"):
    return {"id": doi, "type": "dois", "attributes": {"doi": doi, "titles": [{"title": title}], "creators": creators, "publisher": publisher, "publicationYear": 2026,
            "version": version, "types": {"resourceTypeGeneral": kind}, "relatedIdentifiers": [{"relationType": r, "relatedIdentifier": d, "relatedIdentifierType": "DOI"} for r, d in related], "state": state}}


RAD = {"name": "Diptho, Rakib Ahammed", "givenName": "Rakib Ahammed", "familyName": "Diptho", "nameIdentifiers": []}
PG = {"name": "Ghosh, Pial ", "givenName": "Pial ", "familyName": "Ghosh", "nameIdentifiers": [{"nameIdentifier": "https://orcid.org/0009-0006-4950-659X", "nameIdentifierScheme": "ORCID"}]}
SHC = {"name": "Haque Chowdhury, Safiul", "givenName": "Safiul", "familyName": "Haque Chowdhury", "nameIdentifiers": []}
SB = {"name": "Basak, Sarnali", "givenName": "Sarnali", "familyName": "Basak", "nameIdentifiers": []}
ZEN = [{"name": "Diptho, Rakib Ahammed", "givenName": "Rakib Ahammed", "familyName": "Diptho", "nameIdentifiers": [{"nameIdentifier": "0009-0007-3062-1034", "nameIdentifierScheme": "ORCID"}]},
       {"name": "Safiul Haque Chowdhury", "familyName": "Safiul Haque Chowdhury", "nameIdentifiers": []}]
MODIS = "Event Aligned MODIS Dataset for Mangrove Canopy Response to Tropical Cyclones in the Bay of Bengal"
RAIN = "Bangladesh Historical Rainfall and Meteorological Dataset for Future Rainfall Prediction"
BDMET = "BD-MetHazard: A Multi-Source Meteorological and Hazard Indicator Dataset for Bangladesh (1981–2025)"
DATACITE_ITEMS = [
    dc("10.5281/zenodo.24081261", BDMET, ZEN, "Zenodo", [("HasVersion", "10.5281/zenodo.24081262")], "1"),
    dc("10.5281/zenodo.24081262", BDMET, ZEN, "Zenodo", [("IsVersionOf", "10.5281/zenodo.24081261")], "1"),
    dc("10.17632/r32hyd39dj.2", MODIS, [RAD, SHC, PG], "Mendeley Data", [("IsVersionOf", "10.17632/r32hyd39dj")]),
    dc("10.17632/r32hyd39dj", MODIS, [RAD, SHC, PG], "Mendeley Data", [("HasVersion", "10.17632/r32hyd39dj.2"), ("HasVersion", "10.17632/r32hyd39dj.1")]),
    dc("10.17632/2yhkdcw64t.2", RAIN, [RAD, PG, SB], "Mendeley Data", [("IsVersionOf", "10.17632/2yhkdcw64t")]),
    dc("10.17632/2yhkdcw64t", RAIN, [RAD, PG, SB], "Mendeley Data", [("HasVersion", "10.17632/2yhkdcw64t.2"), ("HasVersion", "10.17632/2yhkdcw64t.1")]),
    dc("10.17632/r32hyd39dj.1", MODIS, [RAD, PG], "Mendeley Data", [("IsVersionOf", "10.17632/r32hyd39dj")]),
    dc("10.17632/2yhkdcw64t.1", RAIN, [RAD, PG, SB], "Mendeley Data", [("IsVersionOf", "10.17632/2yhkdcw64t")]),
    # TEST records
    dc("10.17632/testonly99.1", "TEST A deposit of which only a version came back", [RAD], {"name": "Mendeley Data"}, []),
    dc("10.99999/test.text", "TEST A report, not a dataset", [RAD], "Zenodo", [], kind="Text"),
    dc("10.99999/test.other", "TEST A dataset by another Diptho", [{"name": "Diptho, Arnab", "givenName": "Arnab", "familyName": "Diptho", "nameIdentifiers": []}], "Zenodo", []),
    dc("10.99999/test.draft", "TEST A dataset that is not public", [RAD], "Zenodo", [], state="registered"),
]

PREVIOUS = {
    "profile": {"user": "SSoTLJoAAAAJ", "url": "https://scholar.google.com/citations?user=SSoTLJoAAAAJ", "name": "Rakib Ahammed Diptho", "affiliation": "Jahangirnagar University"},
    "metrics": {"citations": {"all": 28, "recent": 28}, "h_index": {"all": 3, "recent": 3}, "i10_index": {"all": 1, "recent": 1}, "recent_since": 2021,
                "confirmed": {"date": "2026-11-17", "fields": ["citations"], "by": "profile owner"}},
    "publications": [{"title": "Gesture-Based Navigation of Smart Wheelchairs: A Review of Current Trends and Future Directions", "authors": "RA Diptho", "venue": "Technologies 14 (7), 430", "year": 2026, "citations": 4, "url": "https://scholar.google.com/x"},
                     {"title": "A", "authors": "", "venue": "", "year": 2026, "citations": None, "url": ""}, {"title": "B", "authors": "", "venue": "", "year": 2026, "citations": None, "url": ""}],
    "publication_count": 3, "last_success": "2026-11-10T16:59:19Z", "last_attempt": None, "status": "blocked",
    "error": "HTTP 403: Google Scholar rate-limited or blocked the request", "source": "x", "kept_by_hand": {"note": "a key this script does not know"},
}


class Answer:
    def __init__(self, status=200, body=None, text="", url=""):
        self.status_code, self._body, self.text, self.url = status, body, text, url

    def json(self):
        if self._body is None:
            raise ValueError("no json")
        return self._body


def stamp(hours_ago):
    return (dt.datetime.now(dt.timezone.utc) - dt.timedelta(hours=hours_ago)).replace(microsecond=0).isoformat().replace("+00:00", "Z")


class Net:
    """Answers every request of one run and records what was asked."""

    def __init__(self, scholar=(403, ""), serpapi=None, crossref=CROSSREF_ITEMS, datacite=DATACITE_ITEMS):
        self.scholar, self.serpapi, self.crossref, self.datacite = scholar, serpapi, crossref, datacite
        self.asked = []

    def get(self, url, params=None, **kwargs):
        self.asked.append((url, dict(params or {})))
        if url == S.SERPAPI:
            if isinstance(self.serpapi, Exception):
                raise self.serpapi
            status, body = self.serpapi
            return Answer(status, body)
        if url == S.CROSSREF:
            if self.crossref is None:
                return Answer(503, None)
            if isinstance(self.crossref, dict):                      # one answer per query
                return Answer(200, {"message": {"items": self.crossref["orcid" if "filter" in (params or {}) else "name"]}})
            return Answer(200, {"message": {"items": self.crossref}})
        if url == S.DATACITE:
            return Answer(503, None) if self.datacite is None else Answer(200, {"data": self.datacite, "meta": {"total": len(self.datacite)}})
        raise AssertionError("unexpected request: " + url)

    def session(self):
        net = self

        class Session:
            def get(self, url, **kwargs):
                net.asked.append((url, {}))
                status, text = net.scholar
                return Answer(status, None, text, url)
        return Session()

    def count(self, prefix):
        return sum(1 for url, _ in self.asked if url.startswith(prefix))


def read_text(path):
    with open(path, encoding="utf-8") as fh:
        return fh.read()


def run(net, previous=None, key=None, **kwargs):
    """One sync() against the fake network; returns (result, file content or None, raw text, printed output)."""
    with tempfile.TemporaryDirectory() as tmp:
        path = os.path.join(tmp, "data", "scholar.json")
        if previous is not None:
            os.makedirs(os.path.dirname(path))
            with open(path, "w", encoding="utf-8") as fh:
                json.dump(previous, fh, ensure_ascii=False, indent=2)
                fh.write("\n")
        before = read_text(path) if previous is not None else None
        env = {"SERPAPI_KEY": key} if key else {}
        out = io.StringIO()
        with mock.patch.object(S.requests, "get", net.get), mock.patch.object(S, "new_session", net.session), \
                mock.patch.object(S.time, "sleep", lambda s: None), mock.patch.dict(os.environ, env, clear=False), contextlib.redirect_stdout(out):
            if not key:
                os.environ.pop("SERPAPI_KEY", None)
            kwargs.setdefault("ident", IDENT)
            result = S.sync("SSoTLJoAAAAJ", path, kwargs.pop("attempts", 2), **kwargs)
        raw = read_text(path) if os.path.exists(path) else None
        result["unchanged_on_disk"] = raw == before
        return result, (json.loads(raw) if raw else None), raw, out.getvalue()


def prev(**changes):
    data = copy.deepcopy(PREVIOUS)
    data.update(changes)
    return data


class Parsers(unittest.TestCase):
    def test_scholar_page(self):
        profile = S.parse_profile(SCHOLAR_PAGE)
        self.assertEqual(profile["metrics"], {"citations": {"all": 28, "recent": 28}, "h_index": {"all": 3, "recent": 3}, "i10_index": {"all": 1, "recent": 1}, "recent_since": 2021})
        pubs = S.parse_publications(SCHOLAR_PAGE)
        self.assertEqual([p["citations"] for p in pubs], [5, 14, None])
        self.assertEqual(pubs[0]["venue"], "Technologies 14 (7), 430")
        self.assertEqual(pubs[0]["year"], 2026)
        self.assertTrue(pubs[0]["url"].startswith("https://scholar.google.com/citations?view_op=view_citation"))

    def test_serpapi_answer(self):
        profile = S.parse_serpapi(SERPAPI_ANSWER)
        self.assertEqual(profile["metrics"], {"citations": {"all": 29, "recent": 29}, "h_index": {"all": 3, "recent": 3}, "i10_index": {"all": 1, "recent": 1}, "recent_since": 2021})
        self.assertEqual(profile["affiliation"], "Jahangirnagar University")
        pubs = S.parse_serpapi_articles(SERPAPI_ANSWER, "SSoTLJoAAAAJ")
        self.assertEqual([(p["venue"], p["year"], p["citations"]) for p in pubs],
                         [("Technologies 14 (7), 430", 2026, 6), ("Non-Destructive Testing 3 (2), 11", 2025, 14), ("Mendeley Data, Elsevier", None, None)])
        self.assertEqual(pubs[2]["url"], "https://scholar.google.com/citations?user=SSoTLJoAAAAJ")     # a link that is not Scholar's is not kept

    def test_serpapi_answer_in_another_language(self):
        body = {"cited_by": {"table": [{"citas": {"all": "1,204", "desde_2021": 800}}, {"indice_h": {"all": 12, "desde_2021": 9}}, {"indice_i10": {"all": 15, "desde_2021": 9}}]}}
        self.assertEqual(S.parse_serpapi(body)["metrics"], {"citations": {"all": 1204, "recent": 800}, "h_index": {"all": 12, "recent": 9}, "i10_index": {"all": 15, "recent": 9}, "recent_since": 2021})

    def test_crossref_records(self):
        works = {w["doi"]: w for w in (S.work_from_crossref(i, IDENT) for i in CROSSREF_ITEMS) if w}
        self.assertEqual(sorted(works), sorted(["10.3390/technologies14070430", "10.1016/j.ijmedinf.2026.106811", "10.1007/s44288-026-00759-0", "10.1155/aia/7124711",
                                                "10.1109/iccit68739.2025.11491345", "10.1109/iccit60459.2023.10441010", "10.99999/test.chapter"]))
        tech = works["10.3390/technologies14070430"]
        self.assertEqual((tech["kind"], tech["publisher"], tech["year"], tech["date"], tech["volume"], tech["issue"], tech["pages"], tech["me"]), ("journal", "MDPI", 2026, "2026-07-15", "14", "7", "430", 0))
        self.assertEqual(tech["authors"], ["Rakib Ahammed Diptho", "Safiul Haque Chowdhury", "Md Abdullah Al Mamun"])
        ijmi = works["10.1016/j.ijmedinf.2026.106811"]                     # placed in the 2027 volume, appeared in 2026
        self.assertEqual((ijmi["year"], ijmi["date"], ijmi["me"], ijmi["publisher"], ijmi["article"], "issue" in ijmi), (2026, "2026-11-10", 1, "Elsevier", "106811", False))
        self.assertEqual(works["10.1007/s44288-026-00759-0"]["publisher"], "Springer Nature")
        conf = works["10.1109/iccit68739.2025.11491345"]                    # IEEE deposits no ORCID iD: matched by name
        self.assertEqual((conf["kind"], conf["year"], conf["pages"], conf["publisher"]), ("conference", 2025, "3329-3334", "IEEE"))
        self.assertEqual(works["10.1109/iccit60459.2023.10441010"]["authors"][2], "Sifat-E-Sadakin")
        chapter = works["10.99999/test.chapter"]
        self.assertEqual((chapter["kind"], chapter["title"], chapter["publisher"]), ("conference", "TEST A paper in proceedings that are a book & series", "Springer Nature Singapore"))

    def test_publisher_names(self):
        self.assertEqual(S.short_publisher("Oxford University Press (OUP)"), "Oxford University Press")
        self.assertEqual(S.short_publisher("Some Publisher Ltd."), "Some Publisher")
        self.assertEqual(S.short_publisher("Tech Science Press"), "Tech Science Press")

    def test_datacite_records(self):
        net = Net()
        with mock.patch.object(S.requests, "get", net.get):
            sets = {s["doi"]: s for s in S.datacite_sets(IDENT)}
        self.assertEqual(sorted(sets), ["10.17632/2yhkdcw64t", "10.17632/r32hyd39dj", "10.17632/testonly99", "10.5281/zenodo.24081261"])
        modis = sets["10.17632/r32hyd39dj"]
        self.assertEqual((modis["latest"], modis["version"], modis["host"], modis["year"], modis["me"]), ("10.17632/r32hyd39dj.2", "2", "Mendeley Data", 2026, 0))
        self.assertEqual(modis["dois"], ["10.17632/r32hyd39dj.1", "10.17632/r32hyd39dj.2"])
        self.assertEqual(modis["creators"], ["Rakib Ahammed Diptho", "Safiul Haque Chowdhury", "Pial Ghosh"])       # the list of the latest version
        zen = sets["10.5281/zenodo.24081261"]
        self.assertEqual((zen["latest"], zen["version"], zen["host"], zen["creators"]), ("10.5281/zenodo.24081262", "1", "Zenodo", ["Rakib Ahammed Diptho", "Safiul Haque Chowdhury"]))
        lone = sets["10.17632/testonly99"]                                  # only ".1" came back: still filed under the deposit
        self.assertEqual((lone["latest"], lone["host"]), ("10.17632/testonly99.1", "Mendeley Data"))

    def test_secrets_are_removed_from_messages(self):
        self.assertEqual(S.scrub("GET https://serpapi.com/search.json?engine=x&api_key=" + KEY + "&hl=en failed", KEY), "GET https://serpapi.com/search.json?engine=x&api_key=***&hl=en failed")
        self.assertNotIn(KEY, S.scrub("the key " + KEY + " was refused", KEY))


class Runs(unittest.TestCase):
    def test_refused_without_a_key_keeps_everything(self):
        net = Net(scholar=(403, ""))
        result, data, raw, out = run(net, prev(last_attempt=stamp(30)))
        self.assertEqual((result["status"], result["written"], result["fatal"]), ("blocked", True, False))
        self.assertEqual(data["metrics"], PREVIOUS["metrics"])                       # the confirmed total stays, with its mark
        self.assertEqual(data["publications"], PREVIOUS["publications"])
        self.assertEqual(data["last_success"], "2026-11-10T16:59:19Z")
        self.assertEqual(data["kept_by_hand"], PREVIOUS["kept_by_hand"])            # keys this script does not know survive
        self.assertEqual(net.count(S.BASE), 2)                                       # two direct attempts, as asked
        self.assertEqual(net.count(S.SERPAPI), 0)
        self.assertEqual(data["registry"]["status"], "ok")
        self.assertTrue(raw.endswith("}\n") and '\n  "profile": {' in raw)           # same layout as before: two spaces, final newline
        self.assertEqual(result["message"], "Scholar sync: blocked")

    def test_a_refusal_is_not_written_again_the_same_day(self):
        net = Net(scholar=(429, ""))
        first, data, _, _ = run(net, prev(last_attempt=stamp(30)))
        again, _, _, out = run(Net(scholar=(429, "")), prev(**{**data, "last_attempt": stamp(3)}))
        self.assertEqual((again["status"], again["written"], again["unchanged_on_disk"]), ("blocked", False, True))
        self.assertIn("left as it is", out)
        later, data3, _, _ = run(Net(scholar=(429, "")), prev(**{**data, "last_attempt": stamp(21)}))
        self.assertTrue(later["written"])                                            # once a day the date of the latest check moves on

    def test_captcha_page_counts_as_refused(self):
        result, data, _, _ = run(Net(scholar=(200, "<html>Our systems have detected unusual traffic</html>")), prev(last_attempt=stamp(30)))
        self.assertEqual((result["status"], data["status"]), ("blocked", "blocked"))

    def test_direct_read_replaces_the_confirmed_total(self):
        net = Net(scholar=(200, SCHOLAR_PAGE))
        result, data, _, _ = run(net, prev(last_attempt=stamp(1)))
        self.assertEqual((result["status"], result["written"], data["provider"], data["status"], data["error"]), ("ok", True, "direct", "ok", None))
        self.assertNotIn("confirmed", data["metrics"])
        self.assertEqual(data["metrics"]["citations"], {"all": 28, "recent": 28})
        self.assertEqual(data["publication_count"], 3)
        self.assertEqual(data["last_success"], data["last_attempt"])
        self.assertEqual(result["message"], "Scholar sync: 2 new Scholar records")

    def test_key_reads_through_serpapi_and_is_never_written(self):
        net = Net(serpapi=(200, SERPAPI_ANSWER))
        result, data, raw, out = run(net, prev(last_attempt=stamp(1)), key=KEY)
        self.assertEqual((result["status"], data["provider"], data["metrics"]["citations"]["all"]), ("ok", "serpapi", 29))
        self.assertEqual(net.count(S.BASE), 0)                                       # Scholar itself is not asked
        asked = [p for u, p in net.asked if u == S.SERPAPI]
        self.assertEqual(len(asked), 1)                                              # one search per run
        self.assertEqual((asked[0]["engine"], asked[0]["author_id"], asked[0]["api_key"], asked[0]["num"]), ("google_scholar_author", "SSoTLJoAAAAJ", KEY, 100))
        self.assertNotIn(KEY, raw)
        self.assertNotIn(KEY, out)
        self.assertEqual(result["message"], "Scholar sync: citations 28 → 29, 2 new Scholar records")

    def test_fresh_read_is_not_repeated(self):
        fresh = prev(status="ok", provider="serpapi", last_success=stamp(2), last_attempt=stamp(2), error=None)
        net = Net(serpapi=(200, SERPAPI_ANSWER))
        first, data, _, _ = run(net, fresh, key=KEY)                                 # the registries are new to this file: written once
        self.assertEqual((first["status"], net.count(S.SERPAPI), net.count(S.BASE), first["written"]), ("fresh", 0, 0, True))
        self.assertEqual((data["last_success"], data["metrics"]), (fresh["last_success"], fresh["metrics"]))
        net2 = Net(serpapi=(200, SERPAPI_ANSWER))
        second, _, _, out = run(net2, data, key=KEY)
        self.assertEqual((second["status"], second["written"], second["unchanged_on_disk"], net2.count(S.SERPAPI)), ("fresh", False, True, 0))
        forced, data3, _, _ = run(Net(serpapi=(200, SERPAPI_ANSWER)), data, key=KEY, force=True)
        self.assertEqual((forced["status"], data3["metrics"]["citations"]["all"]), ("ok", 29))
        old = prev(status="ok", provider="serpapi", last_success=stamp(6), last_attempt=stamp(6), error=None)
        due, _, _, _ = run(Net(serpapi=(200, SERPAPI_ANSWER)), old, key=KEY)
        self.assertEqual(due["status"], "ok")                                        # five hours have passed: read again

    def test_every_successful_read_is_written(self):
        same = copy.deepcopy(SERPAPI_ANSWER)
        first, data, _, _ = run(Net(serpapi=(200, same)), prev(last_attempt=stamp(1)), key=KEY)
        data["last_success"] = data["last_attempt"] = stamp(6)
        again, data2, _, _ = run(Net(serpapi=(200, same)), data, key=KEY)
        self.assertEqual((again["status"], again["written"], again["message"]), ("ok", True, "Scholar sync: ok"))
        self.assertNotEqual(data2["last_success"], data["last_success"])             # the date on the site moves with the read

    def test_rejected_key_falls_back_and_asks_for_attention(self):
        net = Net(scholar=(403, ""), serpapi=(401, {"error": "Invalid API key. Your API key should be here: https://serpapi.com/manage-api-key"}))
        result, data, raw, out = run(net, prev(last_attempt=stamp(30)), key=KEY)
        self.assertEqual((result["status"], result["fatal"]), ("blocked", True))
        self.assertIn("SerpApi: Invalid API key", data["error"])
        self.assertEqual(net.count(S.BASE), 1)                                       # one direct try, without the long pauses
        self.assertEqual(data["metrics"], PREVIOUS["metrics"])
        self.assertNotIn(KEY, raw + out)

    def test_used_up_plan_is_a_warning_only(self):
        net = Net(scholar=(403, ""), serpapi=(429, {"error": "Your account has run out of searches."}))
        result, data, _, _ = run(net, prev(last_attempt=stamp(30)), key=KEY)
        self.assertEqual((result["status"], result["fatal"]), ("blocked", False))
        self.assertIn("run out of searches", data["error"])

    def test_network_error_does_not_leak_the_key(self):
        boom = S.requests.ConnectionError("HTTPSConnectionPool(host='serpapi.com'): Max retries exceeded with url: /search.json?api_key=" + KEY)
        result, data, raw, out = run(Net(scholar=(403, ""), serpapi=boom), prev(last_attempt=stamp(30)), key=KEY)
        self.assertEqual(result["status"], "blocked")
        self.assertNotIn(KEY, raw + out)
        self.assertIn("SerpApi could not be reached (ConnectionError)", data["error"])

    def test_answer_without_numbers_is_not_accepted(self):
        net = Net(scholar=(403, ""), serpapi=(200, {"search_metadata": {"status": "Success"}, "author": {"name": "x"}, "articles": []}))
        result, data, _, _ = run(net, prev(last_attempt=stamp(30)), key=KEY)
        self.assertEqual((result["status"], data["metrics"]), ("blocked", PREVIOUS["metrics"]))

    def test_profile_without_records_is_not_accepted(self):
        empty = SCHOLAR_PAGE[:SCHOLAR_PAGE.index('<tr class="gsc_a_tr">')] + "</tbody></table></body></html>"
        result, data, _, _ = run(Net(scholar=(200, empty)), prev(last_attempt=stamp(30)))
        self.assertEqual((result["status"], result["fatal"], data["publication_count"], data["metrics"]), ("error", True, 3, PREVIOUS["metrics"]))

    def test_changed_markup_is_an_error(self):
        result, data, _, _ = run(Net(scholar=(200, "<html><body>Something else entirely</body></html>")), prev(last_attempt=stamp(30)))
        self.assertEqual((result["status"], result["fatal"], data["status"]), ("error", True, "error"))
        self.assertEqual(data["metrics"], PREVIOUS["metrics"])

    def test_first_run_ever(self):
        result, data, _, _ = run(Net(scholar=(403, "")), None)
        self.assertEqual((result["status"], result["written"], data["status"], data["metrics"]), ("never_synced", True, "never_synced", None))
        self.assertEqual(len(data["registry"]["works"]), 7)

    def test_registries(self):
        net = Net(scholar=(403, ""))
        result, data, _, _ = run(net, prev(last_attempt=stamp(30)))
        reg = data["registry"]
        self.assertEqual((reg["status"], reg["error"], len(reg["works"]), len(reg["datasets"])), ("ok", None, 7, 4))
        asked = [p for u, p in net.asked if u == S.CROSSREF]                          # by ORCID iD, then by the name as publishers print it
        self.assertEqual([(a.get("filter"), a.get("query.author")) for a in asked], [("orcid:0009-0007-3062-1034", None), (None, "Rakib Ahammed Diptho")])
        self.assertEqual([p["query"] for u, p in net.asked if u == S.DATACITE], ["creators.familyName:Diptho"])
        self.assertEqual(reg["works"][0]["doi"], "10.1016/j.ijmedinf.2026.106811")       # newest first
        self.assertEqual(reg["last_success"], reg["last_attempt"])

    def test_one_registry_failing_keeps_its_list(self):
        _, data, _, _ = run(Net(scholar=(403, "")), prev(last_attempt=stamp(30)))
        result, data2, _, _ = run(Net(scholar=(403, ""), crossref=None), prev(**{**data, "last_attempt": stamp(2)}))
        reg = data2["registry"]
        self.assertEqual((reg["status"], reg["works"], len(reg["datasets"])), ("partial", data["registry"]["works"], 4))
        self.assertIn("api.crossref.org: HTTP 503", reg["error"])
        self.assertEqual(reg["last_success"], data["registry"]["last_success"])
        self.assertTrue(result["written"])                                           # the status changed
        result3, data3, _, _ = run(Net(scholar=(403, ""), crossref=None, datacite=None), prev(**{**data, "last_attempt": stamp(2)}))
        self.assertEqual((data3["registry"]["status"], data3["registry"]["works"], data3["registry"]["datasets"]), ("error", data["registry"]["works"], data["registry"]["datasets"]))

    def test_empty_registry_answer_keeps_the_list(self):
        _, data, _, _ = run(Net(scholar=(403, "")), prev(last_attempt=stamp(30)))
        _, data2, _, _ = run(Net(scholar=(403, ""), crossref=[], datacite=[]), prev(**{**data, "last_attempt": stamp(2)}))
        self.assertEqual((len(data2["registry"]["works"]), len(data2["registry"]["datasets"]), data2["registry"]["status"]), (7, 4, "error"))

    def test_one_crossref_query_failing_is_enough(self):
        class Half(Net):
            def get(self, url, params=None, **kwargs):
                if url == S.CROSSREF and "filter" in (params or {}):
                    self.asked.append((url, dict(params)))
                    return Answer(500, None)
                return super().get(url, params, **kwargs)
        _, data, _, _ = run(Half(scholar=(403, "")), prev(last_attempt=stamp(30)))
        self.assertEqual((data["registry"]["status"], len(data["registry"]["works"])), ("ok", 7))

    def test_new_registry_record_is_announced(self):
        _, data, _, _ = run(Net(scholar=(403, "")), prev(last_attempt=stamp(30)))
        new = {"DOI": "10.99999/test.new", "type": "journal-article", "title": ["TEST A new article"], "container-title": ["Journal"], "publisher": "MDPI AG",
               "author": [person("Rakib Ahammed", "Diptho", ME, "first")], "issued": {"date-parts": [[2026, 11, 16]]}, "created": {"date-parts": [[2026, 11, 16]]}}
        result, data2, _, _ = run(Net(scholar=(403, ""), crossref=CROSSREF_ITEMS + [new]), prev(**{**data, "last_attempt": stamp(2)}))
        self.assertEqual((result["written"], result["message"], data2["registry"]["works"][0]["doi"]), (True, "Scholar sync: 1 new Crossref record (Scholar blocked)", "10.99999/test.new"))

    def test_registries_can_be_left_out(self):
        net = Net(scholar=(403, ""))
        _, data, _, _ = run(net, prev(last_attempt=stamp(30)), registries=False)
        self.assertNotIn("registry", data)
        self.assertEqual(net.count(S.CROSSREF) + net.count(S.DATACITE), 0)


class CommandLine(unittest.TestCase):
    """The script as the workflow runs it: arguments, commit message file, job summary, exit status."""

    def call(self, net, previous, key=None, extra=()):
        import runpy
        net_ = net

        class Session:
            def __init__(self):
                self.headers, self.proxies = {}, {}

            def get(self, url, **kwargs):
                return net_.session().get(url, **kwargs)

        with tempfile.TemporaryDirectory() as tmp:
            path, msg, summary = os.path.join(tmp, "data", "scholar.json"), os.path.join(tmp, "message.txt"), os.path.join(tmp, "summary.md")
            os.makedirs(os.path.dirname(path))
            with open(path, "w", encoding="utf-8") as fh:
                json.dump(previous, fh, ensure_ascii=False, indent=2)
            env = {"GITHUB_STEP_SUMMARY": summary}
            if key:
                env["SERPAPI_KEY"] = key
            argv = ["sync_scholar.py", "--out", path, "--attempts", "1", "--message-file", msg] + list(extra)
            out = io.StringIO()
            script = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sync_scholar.py")
            with mock.patch("requests.get", net.get), mock.patch("requests.Session", Session), mock.patch("time.sleep", lambda s: None), \
                    mock.patch.dict(os.environ, env, clear=False), mock.patch.object(sys, "argv", argv), contextlib.redirect_stdout(out):
                if not key:
                    os.environ.pop("SERPAPI_KEY", None)
                with self.assertRaises(SystemExit) as stop:
                    runpy.run_path(script, run_name="__main__")
            return stop.exception.code, read_text(msg), read_text(summary), json.loads(read_text(path)), out.getvalue()

    def test_refused_run(self):
        code, message, summary, data, out = self.call(Net(scholar=(403, "")), prev(last_attempt=stamp(30)))
        self.assertEqual((code, message), (0, "Scholar sync: blocked\n"))
        self.assertIn("Result of this run: **blocked**", summary)
        self.assertIn("No `SERPAPI_KEY` secret is set", summary)
        self.assertIn("7 Crossref records, 4 datasets", summary)
        self.assertEqual(data["metrics"]["confirmed"]["date"], "2026-11-17")

    def test_run_with_a_key(self):
        code, message, summary, data, out = self.call(Net(serpapi=(200, SERPAPI_ANSWER)), prev(last_attempt=stamp(30)), key=KEY)
        self.assertEqual((code, message), (0, "Scholar sync: citations 28 \u2192 29, 2 new Scholar records\n"))
        self.assertIn("(serpapi)", summary)
        self.assertNotIn("SERPAPI_KEY", summary)
        self.assertNotIn(KEY, summary + out + json.dumps(data))

    def test_rejected_key_fails_the_job(self):
        code, message, summary, data, out = self.call(Net(scholar=(403, ""), serpapi=(401, {"error": "Invalid API key."})), prev(last_attempt=stamp(30)), key=KEY)
        self.assertEqual(code, 1)
        self.assertIn("SerpApi: Invalid API key.", summary)

    def test_read_now(self):
        fresh = prev(status="ok", provider="serpapi", last_success=stamp(1), last_attempt=stamp(1), error=None)
        net = Net(serpapi=(200, SERPAPI_ANSWER))
        code, message, summary, data, out = self.call(net, fresh, key=KEY, extra=["--force", "--no-registries"])
        self.assertEqual((code, net.count(S.SERPAPI), net.count(S.CROSSREF), data["metrics"]["citations"]["all"]), (0, 1, 0, 29))


if __name__ == "__main__":
    unittest.main(verbosity=1)
