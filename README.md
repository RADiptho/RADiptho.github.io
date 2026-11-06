# Md. Rakib Ahammed Diptho — academic website

Static, single-file site (`index.html`) for GitHub Pages, with a scheduled GitHub Actions
job that keeps Google Scholar metrics up to date.

```
index.html                       the whole site (styles, scripts and most images inlined)
banner-fix.css                   page-banner frame, parallax and per-page banner images
site-reveal-2027.js              scroll-linked banner/image motion
assets/logo.svg (+ png sizes)    the D monogram in the header and the favicon / touch icon
assets/banner-base.jpg           8000x560 shared desktop stage strip (drawn at the 280px banner height)
assets/banner-home-wide.jpg      8000x560 Home strip: the AI > ML > DL > Research progression
assets/banner-<page>-left/right[-s|-m].webp   desktop subject layers (regular, compact, small), transparent WebP
assets/banner-<page>-narrow.jpg  3400x750 phone / tablet / narrow-desktop strips (drawn at the 250px height)
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

All banner imagery is rendered from one scene stage (three.js in headless Chromium): a navy floor, a
cool key light from the upper left, an emerald rim light and emerald accents, soft particles and the
same grade. Each page has its own subject: Home — the AI → ML → DL → Research progression (an AI
core, a data-to-model panel, a deep network and an open paper with a magnifier, on labelled plinths
joined by a flow line); Research & Expertise — computer vision on a lab monitor with its processor,
and a microscope with a results panel and notebook; Publications — the supplied book-and-laptop
photograph as a framed print with manuscripts, and journal volumes with an open paper; Datasets —
database stacks with a data table, and a cube lattice with charts; CV — profile card, graduation cap
and medal, and a certificate with an award and folder; Service — an annotated manuscript under
review with the reviewer's seal and pen, and reviewed manuscripts with journal volumes and a
magnifier; Contact — an envelope with its letter and a paper plane, and an @ sign with a contact
card. The heading treatment (white, same shadow), the emerald underline and the navy overlay are
shared by every page.

**Composed for the banner, never cropped by CSS.** Every image is drawn at the banner height
(`background-size: auto 100%`, attachment `scroll`), was composed for that height with the top 22%
(the navigation bar) kept quiet, and every subject stands fully inside the frame with a margin.
Up to 900px, and for Home below 1090px, each page uses one centred strip
(`assets/banner-<page>-narrow.jpg`). From 901px the desktop banner is composed from three
background layers: a left subject and a right subject (transparent WebP, anchored 2% from the
banner edges, so they use the width at any size) over the shared base strip
(`assets/banner-base.jpg`). Three sizes of the subjects exist — small (`-m`), compact (`-s`) and
regular — and the breakpoints are per page, chosen so that the subjects always clear the heading
text and its underline (headings differ in width; "Research & Expertise" is the widest). Between
901 and 1299px the underline is shortened to 48% of the width for the same reason. Home has no
heading and uses its own full strip from 1090px. The two scroll scripts move only the vertical
position of the background (`background-position-y`), so the layers keep their horizontal anchors.
Banner heights are unchanged: 280px desktop, 250px up to 900px.

The photograph on the Publications page is drawn at or below its native 740x494 size everywhere
and was not upscaled or enhanced.

A rendered-page QA pass (Playwright, widths 360–2560, reduced motion included) checks for every
page that the subjects clear the viewport edges, the navigation zone, the heading text and the
underline; the sheets for the last run are in the delivery package.

## 5. Colour system

One palette, defined as CSS custom properties at the top of `index.html`: navy
(`--navy` #0F2A44, `--navy-2` #163B5E) for headings, the header, panels and links; emerald
(`--green` #0E8C57, `--green-2` #0B7449, `--green-soft`, `--green-mint` on dark panels) for
accent bars, buttons, badges, focus rings and hover states; and warm neutrals for text,
rules and backgrounds. Profile buttons keep the official network icons but use the same
navy/emerald treatment as every other control; red is reserved for form validation errors.

SECURITY NOTE: CV is deliberately NOT included in this public repository. The CV button links to a restricted Google Drive file. Set Drive General access to Restricted and allow downloads for approved viewers.

CONTACT FORM: delivered by FormSubmit to dipthobracu02@gmail.com; see section 2 for the one-time activation. No secrets are stored in this repository.
