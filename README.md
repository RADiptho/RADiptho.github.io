# Md. Rakib Ahammed Diptho — academic website

Static, single-file site (`index.html`) for GitHub Pages, with a scheduled GitHub Actions
job that keeps Google Scholar metrics up to date.

```
index.html                       the whole site (styles, scripts and images inlined)
Diptho_CV_2026.pdf               the CV opened by the CV page
data/scholar.json                Google Scholar metrics and records, written by the sync job
scripts/sync_scholar.py          reads the Scholar profile and updates data/scholar.json
.github/workflows/scholar-sync.yml   runs the script every Monday 03:17 UTC (and on demand)
.nojekyll                        tells GitHub Pages to serve the files as they are
```

## 1. Publish on GitHub Pages

1. Create a repository (for a user site name it `<username>.github.io`), add all files above
   at the repository root, commit and push.
2. Repository **Settings → Pages → Build and deployment**: Source "Deploy from a branch",
   branch `main`, folder `/ (root)`. The site appears at `https://<username>.github.io/`
   (or `https://<username>.github.io/<repo>/`) within a minute or two.

All links in `index.html` are relative, so the site works at either address.

## 2. Activate the collaboration form (one-time, ~5 minutes)

The Contact page form posts to Formspree. It is **not active until you add your form ID**;
until then it shows "The contact form is not activated yet" and points visitors to your
public email address.

1. Create a free account at https://formspree.io using `dipthobracucse@gmail.com`
   (or add that address to an existing account) and confirm the verification email.
2. Create a new form and set its recipient to `dipthobracucse@gmail.com`.
3. Copy the endpoint shown, e.g. `https://formspree.io/f/abcdwxyz`.
4. In `index.html` replace the single occurrence of
   `https://formspree.io/f/YOUR_FORM_ID` with that endpoint. Commit and push.
5. Send one test message from the live site and check the Gmail inbox (and the spam folder
   the first time).

Spam protection: Formspree filters on its side; the page adds a hidden honeypot field
(`_gotcha`, submissions with it filled are discarded) and ignores forms submitted in under
three seconds. The sender's address is used as reply-to and the chosen purpose becomes the
subject line. No credentials or API keys are stored in the page; the form ID only identifies
the form and cannot be used to read messages.

## 3. Google Scholar synchronization

`scripts/sync_scholar.py` reads the public profile
https://scholar.google.com/citations?user=SSoTLJoAAAAJ and writes `data/scholar.json`
(citations, h-index, i10-index with the "since" year, and every publication record with its
citation count). The Publications page loads that file and shows:

- a metrics panel with the **date of the last successful synchronization**, labelled as a
  weekly scheduled update, not real-time data;
- a "Cited by N" badge next to each curated publication whose title matches a Scholar record;
- an "Also indexed by Google Scholar" list for records that are not in the curated lists,
  so nothing is duplicated.

The workflow runs automatically every Monday and can be started manually from the
repository's **Actions** tab ("Sync Google Scholar data" → "Run workflow"). It commits the
updated JSON back to the repository, which redeploys the Pages site.

**Blocked requests.** Google Scholar rate-limits automated traffic, and GitHub's runners are
sometimes refused. The script never fabricates data: on a block, CAPTCHA or any other error
it keeps the last valid `data/scholar.json`, records `status: "failed"`, `last_attempt` and
the error message, and the site shows "The most recent attempt on <date> failed; the figures
shown are from the last successful run". The Actions log carries a warning annotation. Before
the first successful run the file has `status: "never_synced"` and the site says so instead
of showing numbers. If blocks persist, set a repository secret `SCHOLAR_PROXY` with an
HTTP(S) proxy URL; the workflow passes it to the script.

Run locally: `pip install requests beautifulsoup4 && python scripts/sync_scholar.py`.


SECURITY NOTE: CV is deliberately NOT included in this public repository. The CV button links to a restricted Google Drive file. Set Drive General access to Restricted and allow downloads for approved viewers.

CONTACT FORM: Formspree placeholder YOUR_FORM_ID must be replaced after creating and verifying a Formspree form; until then the page provides an email fallback.
