# Md. Rakib Ahammed Diptho — academic website

Static, single-file site (`index.html`) for GitHub Pages, with a scheduled GitHub Actions
job that keeps Google Scholar metrics up to date.

```
index.html                       the whole site (styles, scripts and most images inlined)
banner-fix.css                   page-banner frame, parallax and per-page banner images
site-reveal-2027.js              scroll-linked banner/image motion
assets/logo.svg (+ png sizes)    the D monogram in the header and the favicon / touch icon
assets/home-banner-desktop.jpg   3840x2160 Home banner used in desktop parallax mode
assets/publications-banner.png, -desktop.png   Publications banner (supplied picture / desktop parallax canvas)
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

## 2. Contact form (FormSubmit) — one-time activation (~1 minute)

The Contact page form is a real form: it posts to the FormSubmit AJAX endpoint
`https://formsubmit.co/ajax/dipthobracu02@gmail.com` from the page itself (no mail app,
no page reload) and the message is delivered to that Gmail inbox. FormSubmit is a free
form backend for static sites; it needs no account, no API key and no secret in the
repository — the address in the `action` attribute is the public contact address that is
already shown on the page.

**Activation (once).** FormSubmit delivers to an address only after its owner has confirmed
it. After this version is live:

1. Open https://radiptho.github.io/#contact and send one message through the form
   (any text; this first submission is used by FormSubmit to start the activation and is
   not delivered). The page will show "waiting for a one-time activation by the site owner".
2. FormSubmit emails `dipthobracu02@gmail.com` an activation link ("Activate form"). Click it.
   (Check the spam folder if it does not arrive within a few minutes.)
3. Send one more test message from the live site; it now arrives in the inbox with the
   visitor's address as Reply-To and the chosen purpose in the subject line.

Optional: the activation email also contains a random-looking alias for the address.
Replacing `dipthobracu02@gmail.com` in the form's `action` attribute (one occurrence in
`index.html`) with that alias hides the address from the page source; everything else stays
the same.

**What the page does.** Required fields (name, valid email address, message of at least 20
characters) are checked before anything is sent; the Send button is locked with a
"Sending…" state until FormSubmit answers, so a double click cannot send twice; a message is
reported as sent only when FormSubmit confirms `success: true` — any other answer
(activation pending, service error, no connection) is shown as an error with the direct
email address as the fallback. Spam protection: a hidden honeypot field (`_honey`; a
filled value is discarded both by the page and by FormSubmit) and a three-second minimum
fill time. The reCAPTCHA page is disabled (`_captcha=false`) because the form is submitted
in the background.

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

The Publications banner uses the same mechanism with the supplied "open book and laptop"
photo (740x494) at its native resolution: `assets/publications-banner.png` is the photo
itself, pixel for pixel (phones and reduced-motion browsers; only ever scaled down), and
`assets/publications-banner-desktop.png` is a 1920x1080 canvas holding the photo 1:1,
centred on a navy field with feathered edges, for desktop parallax mode (pixel-for-pixel on
a 1080p screen, scaled down on smaller ones). Nothing is upscaled, sharpened or enhanced.
A wider original (1920px or more) could be dropped in to run edge to edge.

**One treatment for every banner.** All seven page banners share the same overlay — a
single navy gradient (`.banner::after` in `index.html`: stronger behind the menu, light in
the middle, slightly stronger at the foot) — the same white heading with the same shadow
and the same emerald bar (`banner-fix.css`). The per-page black gradients that used to sit
on the Research and CV images and the white "light" treatment of the Publications and
Service banners are gone, so each page keeps its own picture but reads as one system.

## 5. Colour system

One palette, defined as CSS custom properties at the top of `index.html`: navy
(`--navy` #0F2A44, `--navy-2` #163B5E) for headings, the header, panels and links; emerald
(`--green` #0E8C57, `--green-2` #0B7449, `--green-soft`, `--green-mint` on dark panels) for
accent bars, buttons, badges, focus rings and hover states; and warm neutrals for text,
rules and backgrounds. Profile buttons keep the official network icons but use the same
navy/emerald treatment as every other control; red is reserved for form validation errors.

SECURITY NOTE: CV is deliberately NOT included in this public repository. The CV button links to a restricted Google Drive file. Set Drive General access to Restricted and allow downloads for approved viewers.

CONTACT FORM: delivered by FormSubmit to dipthobracu02@gmail.com; see section 2 for the one-time activation. No secrets are stored in this repository.
