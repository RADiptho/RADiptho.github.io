# Md. Rakib Ahammed Diptho — academic website

Static, single-file site (`index.html`) for GitHub Pages, with a scheduled GitHub Actions
job that keeps Google Scholar metrics up to date.

```
index.html                       the whole site (styles, scripts and most images inlined)
banner-fix.css                   page-banner frame, parallax and per-page banner images
site-reveal-2027.js              scroll-linked banner/image motion
assets/logo.svg (+ png sizes)    the D monogram in the header and the favicon / touch icon
assets/home-banner-desktop.jpg   3840x2160 Home banner used in desktop parallax mode
assets/publications-banner-desktop.jpg, -mobile.jpg   Publications banner (desktop parallax canvas / full picture)
IMG_3282.jpeg, CV_banner_3840x960.jpg   Research and CV banners
data/scholar.json                Google Scholar metrics and records, written by the sync job
scripts/sync_scholar.py          reads the Scholar profile and updates data/scholar.json
.github/workflows/scholar-sync.yml   runs the script twice a day (03:23 and 15:41 UTC) and on demand
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
(citations, h-index, i10-index with the "since" year, the number of indexed records, and
every publication record with its citation count). The Publications page loads that file
and shows:

- a compact tracker (Publications, Citations, h-index, i10-index) placed directly under the
  page note and above "Journal Articles:", with **Last updated: <date, time>** of the last
  successful synchronization, an explicit "(scheduled sync, not live)" label, a warning when
  the latest check was blocked, and a "View Google Scholar Profile" link;
- a "Cited by N" badge next to each curated publication whose title matches a Scholar record;
- an "Also indexed by Google Scholar" list for records that are not in the curated lists.

**How the values are updated.** `.github/workflows/scholar-sync.yml` runs twice a day
(03:23 and 15:41 UTC; GitHub may start scheduled jobs up to a few hours late) and can be
started manually from the repository's **Actions** tab ("Sync Google Scholar" → "Run
workflow"). It commits the updated JSON back to the repository, which redeploys the Pages
site. So the panel is *scheduled and cached*: it is usually within a day of the live profile,
never live.

**Why some runs are blocked, and what happens then.** Google Scholar has no API and refuses a
share of automated requests from GitHub's shared runners (HTTP 403 or a CAPTCHA page); in
practice roughly every other daily attempt was refused. The script therefore tries each page
up to three times with a pause, and when all attempts are refused it keeps the last good data
untouched, records `status: "blocked"`, `last_attempt` and the error, and finishes
successfully with a warning in the job summary. The site then says "Google Scholar blocked
the automated check on <date>; the values shown are from the last successful run", and flags
figures older than a week. The job only *fails* (and emails the owner) for a real problem
such as changed page markup. Nothing is ever fabricated: before the first successful run the
file has `status: "never_synced"` and the site says so instead of showing numbers.

If blocks become persistent, set a repository secret `SCHOLAR_PROXY` with an HTTP(S) proxy
URL; the workflow passes it to the script.

Run locally: `pip install requests beautifulsoup4 && python scripts/sync_scholar.py`.

## 4. Banners and parallax

Above 900px the banner uses `background-attachment: fixed` for the parallax. For a fixed
background the browser sizes the image against the whole viewport, not the 280px banner, so
the 1920x480 image embedded in `index.html` was being upscaled ~2.25x on a 1080p screen and
looked soft. `banner-fix.css` therefore loads `assets/home-banner-desktop.jpg` (3840x2160,
same artwork, sharp key band at the top) for desktop parallax mode, while phones and
reduced-motion browsers keep the embedded image at 1:1. Banner height is unchanged
(280px desktop, 250px up to 900px).

The Publications banner uses the same mechanism with the "documents between two laptops"
picture: `assets/publications-banner-desktop.jpg` (3840x2160; the wide crop sits in the top
band) for desktop parallax mode and `assets/publications-banner-mobile.jpg` (2160x1130, the
whole picture) elsewhere. Both were produced from the supplied 1080x565 image with EDSR x4
super-resolution only (no content changes). Because the picture is light, the Publications
view uses the site's light banner treatment (navy heading and menu).

## 5. Colour system

One palette, defined as CSS custom properties at the top of `index.html`: navy
(`--navy` #0F2A44, `--navy-2` #163B5E) for headings, the header, panels and links; emerald
(`--green` #0E8C57, `--green-2` #0B7449, `--green-soft`, `--green-mint` on dark panels) for
accent bars, buttons, badges, focus rings and hover states; and warm neutrals for text,
rules and backgrounds. Profile buttons keep the official network icons but use the same
navy/emerald treatment as every other control; red is reserved for form validation errors.

SECURITY NOTE: CV is deliberately NOT included in this public repository. The CV button links to a restricted Google Drive file. Set Drive General access to Restricted and allow downloads for approved viewers.

CONTACT FORM: Formspree placeholder YOUR_FORM_ID must be replaced after creating and verifying a Formspree form; until then the page provides an email fallback.
