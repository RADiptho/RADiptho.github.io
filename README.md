# Md. Rakib Ahammed Diptho — academic website

Static, single-file site (`index.html`) for GitHub Pages, with a scheduled GitHub Actions
job that keeps Google Scholar metrics up to date.

```
index.html                       the whole site (styles, scripts and most images inlined)
banner-fix.css                   page-banner frame, parallax and per-page banner images
site-reveal-2027.js              scroll-linked banner/image motion
assets/logo.svg (+ png sizes)    the D monogram in the header and the favicon / touch icon
assets/banner-<page>-desktop.jpg   3840x2160 page banners for desktop parallax mode (one rendered set)
assets/banner-<page>-mobile.jpg    1800x1125 (Publications 1200x750) page banners for phones and tablets
assets/banner-publications-wide.jpg, -medium.jpg   560px-tall Publications strips (>=1340px / 901-1339px)
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

## 2. Contact form (FormSubmit) — one-time activation

The Contact page form is a real form. It is delivered by FormSubmit (https://formsubmit.co), a
form backend for static sites that needs no account, no API key and no secret in the
repository: the only thing in the page is the public contact address, which is already shown
on the page. Two delivery paths are built in, both real submissions from the page itself (no
mail app):

1. **Background (AJAX) submission.** The page posts JSON to
   `https://formsubmit.co/ajax/dipthobracu02@gmail.com` with `Content-Type: application/json`
   and `Accept: application/json`, exactly as FormSubmit documents, and reports FormSubmit's
   JSON answer. The visitor stays on the page.
2. **Normal submission.** If the browser cannot complete that request — FormSubmit answers
   without CORS headers until the address has been activated, and some networks block
   cross-origin requests — the page posts the form the ordinary way to
   `https://formsubmit.co/dipthobracu02@gmail.com`, which every browser allows cross-origin.
   FormSubmit then shows its activation notice (first time only) or, once activated, sends
   the visitor back to `https://radiptho.github.io/?sent=1`, where the page opens Contact and
   shows the confirmation.

Success is reported only after FormSubmit has confirmed it (JSON `success: true`, or the
`?sent=1` return). Everything else — activation pending, a service error, no connection — is
shown as an error with the direct address as the fallback.

**Activation (once).** FormSubmit delivers to an address only after its owner has confirmed it:

1. Open https://radiptho.github.io/#contact and send one message through the form. FormSubmit
   uses this first submission to start the activation (it is not delivered). You will either
   see the page's "waiting for a one-time activation" message or FormSubmit's own page saying
   that an activation email has been sent.
2. Open the email FormSubmit sends to `dipthobracu02@gmail.com` and click **Activate form**
   (check the spam folder if it has not arrived after a few minutes).
3. Send one more message from the live site. It arrives in the inbox with the visitor's address
   as Reply-To and the chosen purpose in the subject line.

Optional: the activation email also contains a random-looking alias for the address. Replacing
`dipthobracu02@gmail.com` in the form's `action` attribute (one occurrence in `index.html`) with
that alias hides the address from the page source; the script derives the AJAX endpoint from it.

**Validation and spam protection.** Name, a valid email address and a message of at least 20
characters are required and checked before anything is sent; the Send button is locked with a
"Sending…" state until the service answers, so a double click cannot send twice. A hidden
honeypot field (`_honey`; a filled value is discarded by the page and by FormSubmit) and a
three-second minimum fill time stop simple bots. The reCAPTCHA page is disabled
(`_captcha=false`) so the normal submission returns to the site without an interstitial.

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

## 4. Banners

All seven page banners are renders of one scene stage (three.js, headless Chromium): the same
navy floor, cool key light from the upper left, emerald rim light and accents, soft particles
and the same grade, each with a subject that belongs to its page — Home: knowledge network;
Research & Expertise: processor with circuit traces and a neural network; Publications: the
supplied book-and-laptop photograph as a framed print beside journal volumes and an open
paper; Datasets: databases, data table, cube lattice and chart; CV: profile card, graduation
cap, medal, certificate and award; Service: review shield, reviewed manuscripts, gears and
people; Contact: envelope, paper plane, message bubbles and location pin. Measured on the
rendered banners, mean brightness, saturation and hue are within a few percent of each other.
The heading treatment (white, same shadow) and the emerald underline are shared in
`banner-fix.css`, and the navy overlay in `index.html` is the same on every page.

Above 900px the banner keeps `background-attachment: fixed` (the parallax). For a fixed
background the browser sizes the image against the whole viewport, so the 3840x2160 desktop
renders are composed with their subjects in the top band, which is what the 280px banner shows.
Phones and tablets draw the 1800x1125 renders (subject centred) to cover the 250px banner.
Reduced-motion browsers get the same desktop render from its top edge without the parallax.
Banner height is unchanged (280px desktop, 250px up to 900px).

Publications is the exception because the supplied photograph has to stay visible in full: its
banner is a 560px-tall strip drawn at the banner height (`background-size: auto 100%`,
attachment `scroll`; the strip's own navy extends to the sides on very wide screens), so the
print is never cropped by the viewport height. From 1340px the print stands left of the
heading (`banner-publications-wide.jpg`); between 901 and 1339px, and on phones, it is centred
(`banner-publications-medium.jpg`, `banner-publications-mobile.jpg`). The photograph itself is
drawn at or below its native 740x494 size everywhere and was not upscaled or enhanced.

## 5. Colour system

One palette, defined as CSS custom properties at the top of `index.html`: navy
(`--navy` #0F2A44, `--navy-2` #163B5E) for headings, the header, panels and links; emerald
(`--green` #0E8C57, `--green-2` #0B7449, `--green-soft`, `--green-mint` on dark panels) for
accent bars, buttons, badges, focus rings and hover states; and warm neutrals for text,
rules and backgrounds. Profile buttons keep the official network icons but use the same
navy/emerald treatment as every other control; red is reserved for form validation errors.

SECURITY NOTE: CV is deliberately NOT included in this public repository. The CV button links to a restricted Google Drive file. Set Drive General access to Restricted and allow downloads for approved viewers.

CONTACT FORM: delivered by FormSubmit to dipthobracu02@gmail.com; see section 2 for the one-time activation. No secrets are stored in this repository.
