# Md. Rakib Ahammed Diptho — academic website

Static site for GitHub Pages (one scrolling page, seven sections, no build step), with a scheduled
GitHub Actions job that keeps Google Scholar metrics up to date.

```
index.html                       the page: navigation, seven sections (each with its own banner) and the footer
site.css                         all styles: colour system, navigation, banners, content, form, reveal
site.js                          behaviour: navigation state, scroll reveal, Home light layer, contact form,
                                 Google Scholar panel, certificate lightbox
banners.css                      generated: positions of the banner live effects per breakpoint
assets/banner-<page>-<variant>.jpg   49 precomposed banner images, one per page and breakpoint (see section 4)
assets/photo-diptho.jpg, cert-1..5.jpg   portrait and certificate images (external files, not inlined)
assets/logo.svg (+ png sizes)    the D monogram in the header and the favicon / touch icon
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
   the visitor back to `https://radiptho.github.io/?sent=1`, where the page scrolls to the Contact
   form and shows the confirmation.

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

Each of the seven sections opens with a banner: 280px high on desktop, 250px up to 900px wide. The
banner is **one precomposed image**, chosen by `<picture>` from seven breakpoint variants and drawn
with `object-fit: cover`, centred, at the banner height:

| variant | viewport width | image | composed for |
|---|---|---|---|
| `m`   | ≤ 600px        | 1800×750 (600 CSS px wide at 250px) | 350px: everything inside ±165px of the centre |
| `t`   | 601–900px      | 2700×750 | 601px: inside ±290px |
| `sm`  | 901–1199px     | 2400×560 (1200 CSS px wide at 280px) | 901px: inside ±440px |
| `md`  | 1200–1365px    | 2732×560 | 1200px: inside ±590px |
| `lg`  | 1366–1599px    | 3200×560 | 1366px: inside ±673px |
| `xl`  | 1600–1919px    | 3840×560 | 1600px: inside ±790px |
| `xxl` | ≥ 1920px       | 5120×560 | 1920px: inside ±950px (environment continues to 2560px) |

Because the image is centred and scaled to the banner height only, the position of every object
relative to the banner centre is fixed in CSS pixels for the whole breakpoint range; a wider
viewport only reveals more of the environment at the sides. Nothing depends on CSS background
layers, `background-attachment`, scroll position or JavaScript — the banners are plain images and
look the same with JavaScript disabled. The heading (white, Oswald, 34–62px) and its emerald→teal
underline sit in the centre on desktop and at the top on phones/tablets; the compositions were
fitted to the measured heading and underline rectangles of this page at every breakpoint edge, so
no object is ever behind the text, behind the navigation bar, cut by the viewport edge or by the
banner bottom (verified pixel by pixel on the renders and again on the rendered page, see below).

All imagery is rendered from one three.js stage (headless Chromium): a deep-navy floor with a faint
grid, a cool key light from the front-left, a teal fill, an emerald rim light, soft particles, the
same grade and vignette. Subjects: Home — the AI → ML → DL → RESEARCH progression (an AI core, a
data-to-model panel, a deep network and an open paper with a magnifier on labelled plinths, joined
by a flow line with chevrons; a data pulse travels along it on the page); Research & Expertise — a
laptop with training curves, a processor and laboratory flasks (computational science and
experimentation) and a microscope with a results panel, pen and notebook; Publications — the
supplied book-and-laptop photograph as a framed print (drawn at or below its native 740×494 size,
never upscaled, never animated) with manuscripts, and journal volumes with an open paper;
Datasets — database stacks, a data table, a pipeline, a cube matrix, bar charts and a dashboard;
CV — profile card, graduation cap, medal, certificate with seal, trophy and folder; Service — an
annotated manuscript under review with the reviewer's seal and pen, reviewed stacks, journal
volumes and a magnifier; Contact — an envelope with its letter, a paper plane in flight, an @ sign
and a contact card.

**Live effects** (`banners.css`, generated from the render coordinates) are small CSS-animated
glows and pulses on a layer above the image: node glows and the travelling pulse on Home, data
packets on Datasets, a message in flight on Contact, soft glows on the key objects elsewhere, a slow
light sweep and a few drifting motes. On desktop with a mouse the Home light layer drifts a few
pixels with the pointer; the image never moves. `prefers-reduced-motion` switches the whole layer
off and shows every section at once.

**QA.** A Playwright pass over the rendered page (widths 360, 390, 430, 600, 601, 768, 820, 900,
901, 1024, 1100, 1200, 1280, 1366, 1440, 1536, 1600, 1680, 1920, 2560) checks for every section
that `<picture>` chose the expected variant, that the measured subject bounds clear the viewport
edges, the navigation bar, the heading text and the underline, that the navigation state and the
active link are right, and that nothing overflows; the screenshots and the JavaScript-disabled and
reduced-motion runs are in the delivery package.

## 5. Colour system

One palette, defined as CSS custom properties at the top of `site.css`: deep midnight and navy
(`--ink` #0A1628, `--navy` #0F2440, `--navy-2` #163558) for the navigation bar, banners, headings
and dark panels; research blue (`--blue` #1D4F86, `--blue-2` #2A6AB0) for links and glass panels;
teal and cyan (`--teal` #1B9AAA, `--cyan` #5FD3E6) for blue-teal transitions and data highlights;
emerald (`--green` #0F9D6E, `--green-2` #0C7F58, `--green-bright`, `--green-mint`, `--green-soft`)
as the single accent for underlines, markers, buttons, badges, focus rings and hover states; and
off-white neutrals (`--bg` #F7F9FC, `--surface` #FFFFFF, `--text` #1B2A3B, `--muted` #5A6B80,
`--rule` #DCE3EC) for the content. The banner underline and the small accent bars use the
emerald→teal gradient (`--accent-grad`). Red is reserved for form validation errors.

SECURITY NOTE: CV is deliberately NOT included in this public repository. The CV button links to a restricted Google Drive file. Set Drive General access to Restricted and allow downloads for approved viewers.

CONTACT FORM: delivered by FormSubmit to dipthobracu02@gmail.com; see section 2 for the one-time activation. No secrets are stored in this repository.
