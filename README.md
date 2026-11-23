# Md. Rakib Ahammed Diptho — academic website

Static site for GitHub Pages: one HTML page with seven views, no build step, no framework and no
third-party requests (fonts, icons and scripts are all in this repository). Only one view is on
screen at a time; a tab or link changes the view; a button in the header switches between day
and night. A scheduled GitHub Actions job keeps the Google Scholar figures up to date and brings
in new articles, conference papers and datasets by itself; the contact form posts to a
Cloudflare Worker that lives outside this repository.

```
index.html                 the page: header, the seven views, the viewer (certificates, paper fronts), footer
site.css                   all styles (design tokens at the top, then one block per component)
site.js                    behaviour: view changes, day and night, reveal on scroll, the hero network,
                           filters, Google Scholar panel and new records, contact form, the viewer
404.html                   "page not found"; also sends /publications, /contact … to /#publications, /#contact …
robots.txt, sitemap.xml    for search engines
.nojekyll                  an empty file: GitHub Pages then publishes the files exactly as they are, without
                           running Jekyll over them (nothing here needs it, and an edit to this README can
                           never stop a deployment)
assets/photo-diptho.jpg    the portrait as supplied (kept as the source and for search engines)
assets/portrait-hero.*     the same portrait with its studio backdrop removed: the Home hero
assets/cv-graduation-*.*   the graduation photograph: the stage of the CV view
assets/front-*.*           paper fronts (upper part of an article's first page): the Publications stage
                           (-560: on the stage; -full: in the viewer)
assets/cert-1..7.jpg       certificates of the Service view (three of them are also its stage)
assets/course-1..6.jpg     course certificates (CV view)
assets/grain.png           small noise tile laid over the dark stages
assets/logo.svg (+ png)    the D monogram: header, favicon, touch icon
assets/social-card.jpg     the preview image used when the address is shared (1200×630)
assets/fonts/              Instrument Serif, Inter, JetBrains Mono (self-hosted woff2) and their
                           SIL Open Font License texts
data/scholar.json          Google Scholar metrics and records, and the author's records at Crossref
                           and DataCite, written by the sync job
scripts/sync_scholar.py    reads the three sources and updates data/scholar.json
scripts/test_sync_scholar.py   its tests (offline): python scripts/test_sync_scholar.py
.github/workflows/scholar-sync.yml   runs the script six times a day and on demand
```

## 1. Pages and addresses

The site is a single page. Each view has its own address, and these addresses are stable:

| address | view |
|---|---|
| `/` or `/#home` | Home |
| `/#research` | Research & Expertise |
| `/#publications` | Publications |
| `/#datasets` | Datasets |
| `/#cv` | CV |
| `/#service` | Service |
| `/#contact` | Contact |

An address may also point inside a view, for example `/#interest-med` (that interest on the
Research view) or `/#about` (on Home). The browser's Back and Forward buttons move between the
views that were visited. Without JavaScript all seven views are shown one after another, so
nothing is ever hidden from a reader or a search engine.

Each view is a dark *stage* (title, one sentence, a photograph or a live drawing) and a paper
*sheet* with the content. Home is the hero, a short About and an index of the other views; it
does not repeat their content. Every other view ends with links to the previous and next view.

Publishing is unchanged: **Settings → Pages → Deploy from a branch → `main` / root**. Every
path in `index.html` is relative.

## 2. Editing content

Everything a visitor reads is plain HTML in `index.html`. Numbers are never typed by hand:
the counts on Home, on the interest cards and on the type tabs are counted from the lists when
the page loads (the number beside a group heading appears only while a filter narrows that
group), and Google Scholar figures come from `data/scholar.json`.

**One place for each fact.** Nothing is told twice. When something is added, put it where it
belongs and let the other views point to it:

| what | where it lives | what other views show of it |
|---|---|---|
| role and affiliation | Home, the line above the name | CV lists the appointments, Contact the postal address |
| About me | Home: two short lines, the owner's motto and the research interest; neither repeats the line under the name | – |
| current project: official title, funding, website | Research | the appointment on CV names the sub-project; the dark tile on Home only opens Research |
| research interests | Research | the area filter on Publications, the moving band on Home |
| papers | Publications (new ones arrive by themselves, section 4) | their counts on Home; a thesis title on CV links to its paper |
| Google Scholar metrics | Publications | the total number of citations on Home |
| datasets | Datasets | their count on Home |
| education, appointments, courses | CV | – |
| reviewing, organizing, mentoring | Service | – |
| profile links | the footer of every view | the icons in the Home hero and in the phone menu |

**Publications live in one place.** The Publications view is the only list of papers. Home
shows how many there are; Research shows how many belong to each interest and opens the list
filtered to it. Nothing else needs editing when a paper is added.

**A new paper does not have to be typed in.** Once a publisher has registered it, the sync job
finds it and the page adds it to the right list with its authors, venue and DOI, and moves a
paper from "Accepted" to its list when it is published (section 4). Write the entry by hand
only to give it what no registry records: its research areas and the mark of the
corresponding author. The page then shows the hand-written entry alone.

**Add a publication.** In the Publications view copy one `<li class="pub">` block into the
right list (newest first) and edit it:

```html
<li class="pub" data-type="journal" data-year="2026" data-themes="med xai" data-r>
  <span class="pub-year" aria-hidden="true">2026</span>
  <div class="pub-main">
    <h3 class="pub-title"><a href="https://doi.org/…" target="_blank" rel="noopener">Title</a></h3>
    <p class="pub-authors">First Author*, <b>Rakib Ahammed Diptho</b>, Third Author.</p>
    <p class="pub-venue"><i>Journal</i> (Publisher), 2026. <a class="pub-doi" href="https://doi.org/…" target="_blank" rel="noopener">doi:…</a></p>
  </div>
</li>
```

- `data-type`: `journal`, `accepted` or `conference` (it must match the list the entry is in).
- `data-themes`: any of `cv med xai edge env`, the five research interests, separated by
  spaces. These tags drive the area filter and the counts on the interest cards of the Research
  view. They are an editorial grouping, so change them freely. The areas are not printed under
  each entry: the filter above the list is the one place that names them.

**Add a dataset.** Copy one `<li class="dataset">` block in the Datasets view.
**Add a certificate.** There are two strips: `id="certs"` in the Service view (organizing and
reviewing) and `id="courses"` in the CV view (courses and certifications). Copy one
`<figure class="cert">` block inside the strip it belongs to and give `data-lightbox` the next
number of that strip; a strip scrolls sideways, so any number of certificates fits, and the
viewer steps through the certificates of one strip only. A "Verify" link in the caption must be
the address printed on the certificate, character for character.
**CV.** The CV itself is not in this repository (see the security note below); the CV view
links to the Google Drive file. Change the address in `<a id="cvLink">`.

After an edit, raise the `?v=` number on the `site.css` / `site.js` lines of `index.html` only if
those files changed, and update the "Page updated" month in the footer.

## 3. Contact form

The form posts JSON to the contact service, a Cloudflare Worker (with D1 storage and Resend for
delivery) at `https://radiptho-contact.dipthobracucse.workers.dev/`. The Worker and its secrets
are not part of this repository; nothing secret is stored here.

Request (from `site.js`): `POST`, `Content-Type: application/json`, body
`{ "name", "email", "institution", "purpose", "message" }`.
Reply the page relies on: `{ "ok": true, "stored": true, "emailed": true|false }`.

- `ok` and `stored` → the visitor sees a confirmation (sent, or securely received when the
  message was stored but the email could not be delivered); anything else → an error message
  and the text stays in the form.
- Before anything is sent the page checks: a name, a valid email address, a message of at
  least 20 characters, an empty honeypot field (`_honey`) and a three-second minimum fill time.
  The Send button is locked while the request is running, and the request is abandoned after
  15 seconds.
- If the Worker restricts origins, `https://radiptho.github.io` must stay on its allow list.

## 4. Google Scholar, Crossref and DataCite

`scripts/sync_scholar.py` writes `data/scholar.json` from three sources. Each is read on its
own: when one fails, its previous values stay as they were, with their date. Nothing is ever
estimated, and nothing is typed in.

| source | what it gives | what it needs |
|---|---|---|
| the Google Scholar profile, https://scholar.google.com/citations?user=SSoTLJoAAAAJ | citations, h-index and i10-index with the "since" year, and every record of the profile with its citation count | a SerpApi key to be reliable (below) |
| Crossref | the author's journal articles and conference papers: title, authors in full, journal or proceedings, publisher, volume, pages, DOI | nothing |
| DataCite | the author's datasets (Mendeley Data, Zenodo, …); all versions of one deposit count as one dataset | nothing |

**What the page shows.**

- On **Publications**, a panel with Publications, Citations, h-index and i10-index (the
  "since" value only where it differs from the total), the date and time of the last
  successful read with an explicit "(scheduled sync, not live)" label, a warning when the
  latest check was refused, and a link to the profile.
- A "Cited by N" badge beside each publication and dataset whose title matches a Scholar
  record.
- On **Home**, the total number of citations, labelled with the source and the same date.

**New records are added by themselves** (`site.js`, section 11). When the page loads it
compares the records in `data/scholar.json` with its own lists, by DOI and by title:

- a Crossref article or conference paper that is not in the lists is added to *Journal
  Articles* or *Conference Papers*, newest first, written like the hand-made entries and marked
  "Added automatically from Crossref";
- an entry under *Accepted* whose paper has appeared at Crossref moves to its list: the title
  now opens the DOI and "Accepted for publication" becomes the venue line. Its authors line
  and research areas stay as written;
- a DataCite dataset that is not on **Datasets** becomes the first card there;
- a Google Scholar record that none of these know is added when its venue line reads as a
  journal ("Name 14 (7), 430") or a conference; anything else (a preprint, a thesis) stays in
  the plain list "Also indexed by Google Scholar" under the publications;
- every count follows: the tabs, the group headings, the tiles on Home.

A record is taken from a registry only when it carries a DOI and the author's name (family name
"Diptho" with the ORCID iD or the given name "Rakib"); corrections, reviews and other kinds of
record are ignored. An automatic entry has no research area and no corresponding-author mark,
because no registry records them: to give it both, write the entry by hand (section 2) and the
page shows that one alone. Two switches on `<div id="pubsCurated">` in `index.html`:
`data-auto="off"` adds nothing, and `data-auto-skip="10.1234/abcd | Title of a record"` leaves
those records out (DOIs or titles, separated by `|`).

**Schedule.** `.github/workflows/scholar-sync.yml` runs six times a day (GitHub may start
scheduled jobs late) and can be started from the **Actions** tab ("Sync Google Scholar" → "Run
workflow"), which reads everything at once. It commits the JSON when Google Scholar was read,
when anything changed, and otherwise once a day; a commit redeploys the site. The figures are
therefore *scheduled and cached*, never live.

**Google Scholar needs a key to be reliable.** Google Scholar has no API and refuses almost
every request that comes from GitHub's servers (HTTP 403 or a CAPTCHA page). Without help the
figures on the site can stay a week or more behind the profile. SerpApi reads the same public
profile page through its own network and is not refused. Setting it up takes about two
minutes, once:

1. Create a free account at https://serpapi.com and copy **Your Private API Key** from its
   dashboard.
2. In this repository open **Settings → Secrets and variables → Actions → New repository
   secret**. Name: `SERPAPI_KEY`. Secret: the key. Press **Add secret**.
3. Open **Actions → Sync Google Scholar → Run workflow**. A minute or two later the site shows the
   figures of the profile.

From then on the profile is read three times a day, so the site is never more than about eight
hours behind. One read is one search: about 93 a month, well inside the free plan (250 searches
a month when this was written, November 2026). The key is used only inside the workflow; it is
never printed and never written to the data file. If SerpApi fails, the script falls back to
the direct request; a key that SerpApi rejects fails the job, so that GitHub sends an email.

Without the key the script still asks Google Scholar directly on every run and keeps the last
good figures when it is refused, recording `status: "blocked"` with the date of the attempt;
the page then says that the latest check was blocked and flags figures older than a week.
Before the first successful run the file says `never_synced` and the page says so instead of
showing numbers. A repository secret `SCHOLAR_PROXY` (an HTTP(S) proxy URL) is used for the
direct request when it is set.

**A total confirmed by hand.** While reads are refused, the owner of the profile may confirm
the total himself. Only he does this, with the number his profile shows: in
`data/scholar.json` set `metrics.citations` and add beside it

```json
"confirmed": { "date": "2026-11-17", "what": "total citations", "by": "profile owner" }
```

The page then says "citation total confirmed by the profile owner" with that date and that the
other values are from the last read. The next successful read replaces all of it and removes
the mark.

**Run and test locally.** `pip install requests beautifulsoup4`, then
`python scripts/sync_scholar.py` (add `SERPAPI_KEY=…` in front to read through SerpApi).
`python scripts/test_sync_scholar.py` runs its tests without any network: the parsers on real
Crossref and DataCite records of the author, every way a run can end, and that the key cannot
reach the log or the data file.

## 5. Photographs

Only genuine photographs and documents are used; nothing is generated and there is no stock imagery.

| view | what is shown | file | source |
|---|---|---|---|
| Home | portrait, as the hero itself | `assets/portrait-hero.webp` (+ `-2x.webp`, `.png` fallback) | `assets/photo-diptho.jpg`, 520×726 |
| Publications | the first pages of five articles, laid out like papers on a table | `assets/front-<name>-560.webp` (+ `-560.jpg`), `-full.webp` for the viewer | see "Paper fronts" below |
| CV | graduation photograph, as the stage itself | `assets/cv-graduation-800/1200/1600.webp` (+ `-800.jpg`) | photograph supplied by the owner, 2048×2048 |
| Service | the certificates themselves | `assets/cert-1.jpg`, `cert-2.jpg`, `cert-6.jpg` | the certificate images of the Service view |
| Research, Datasets, Contact | a live line drawing | – | no photograph yet (see below) |

How the Home portrait was prepared: the plain studio backdrop was made transparent with an alpha
matte (closed-form matting, a classical method), so the navy stage, the line of text that travels
behind the head and the live network can sit behind and around the person. That line is an open
orbit, not a frame: it fades out before it reaches the shoulders and the text column, and it
never encloses the face. Inside the outline the picture is the original one;
only the thin edge where hair and shoulders meet the backdrop is recomputed, so that no light
fringe is left. Nothing is retouched or generated. `portrait-hero-2x.webp` is the same picture
resampled (Lanczos) for dense screens; it contains no additional detail. The source portrait is small (520 px wide),
so the hero is laid out around its real size and is never stretched across the window. A larger
original would simply replace these files.

The graduation photograph on CV is only resampled (800, 1200 and 1600 px wide). Everything that
integrates it into the stage is CSS and can be undone: where it sits, the dissolve into the ink
on the title's side and under the header, a soft vignette, a slightly lowered saturation that
returns under the pointer, and a very slow push-in.

**Paper fronts (Publications).** A front is the upper part of the first page of an article (shape
1120 : 1075). The stage lays the fronts out like papers on a table, and all of them are in view at
once on every screen: the fronts of a row lie side by side, and the front row covers only the lower
part (the body of the abstract) of the row behind it, so that the journal, the title and the authors
of every article can be read. Each front is a button. It lifts under the pointer or the keyboard,
and it opens the page in the viewer, 1654 px wide, with a caption and a link to the article. On a
phone and on a tablet held upright the table is a band of its own above the title, and a line under
it says that a page opens.

| front | article | source | note |
|---|---|---|---|
| `front-tech` | *Technologies* (MDPI), 2026 | page 1 of the published PDF | open access (CC BY), copyright the authors |
| `front-ijmi` | *International Journal of Medical Informatics* (Elsevier), 224 (2027) 106811 | page 1 of the published PDF | **not open access** (© Elsevier); shown in full at the owner's decision, see below |
| `front-ndt` | *NDT* (MDPI), 2026 | page 1 of the published PDF | open access (CC BY), copyright the authors |
| `front-aia` | *Advances in Agriculture* (Wiley), 2026 | `Wiley_article_first_page_2x.png` in this repository | open access, copyright the authors |
| `front-dgeo` | *Discover Geoscience* (Springer Nature), 2026 | page 1 of the published PDF | open access (CC BY-NC-ND 4.0), copyright the authors |

In the markup they stand in this order: the first three are the back row, the last two the front
row. Three files belong to a front: `front-<name>-560.webp` and `-560.jpg` (560×538, on the stage)
and `front-<name>-full.webp` (1654×1588, fetched only when the front is opened).

To add a front: render the first page of the PDF (`pdftoppm -r 200 -f 1 -l 1 -png paper.pdf page`),
crop its upper part to 1654×1588 and save it as `assets/front-<name>-full.webp`, save a copy
reduced to 560×538 as `-560.webp` and `-560.jpg`, then add one line inside `<ul class="papers">` in
`index.html` at the place it should take. Raise `data-n` to the new number of fronts (2 to 6:
`site.css` has the places for each number), number `data-lightbox` 0, 1, 2 … in order and correct
the count in the list's `aria-label`:

```html
<li class="paper"><button type="button" class="paper-open" data-lightbox="5" data-full="assets/front-NAME-full.webp" aria-label="Enlarge the first page of the article in JOURNAL"><picture><source type="image/webp" srcset="assets/front-NAME-560.webp"><img src="assets/front-NAME-560.jpg" alt="First page of the article in JOURNAL (PUBLISHER)" width="560" height="538" loading="lazy" decoding="async"></picture></button><p class="paper-cap" hidden>First page of the article in <i>JOURNAL</i> (PUBLISHER). <a href="https://doi.org/…" target="_blank" rel="noopener">Open the article</a></p></li>
```

The link is the one the article has in the list below (its DOI). A first page can be shown freely
when the authors hold the copyright; open-access articles say so on the page. The Elsevier article
is not open access: its typeset page is the publisher's, and it is shown here because the owner,
one of its authors, decided so. Should the publisher object, replace the three `front-ijmi-*` files
by ones in which only the head of the page (journal, title, authors) can be read, or remove its
`<li>` and set `data-n="4"`.

**Put a photograph on the stage of another view** (for example a workshop or laboratory photograph
on Research): save it in `assets/`, about 1600 px wide, and replace that view's
`<div class="stage-art …">` in `index.html` with

```html
<div class="stage-art art-photo" style="--fx: 60%"><div class="art-in">
  <img src="assets/stage-research.jpg" alt="What the photograph shows" width="1600" height="1067" loading="lazy" decoding="async">
</div></div>
```

The photograph fills the right part of the stage, keeps its upper edge in view and dissolves into
the ink on the side of the title. `--fx` is the horizontal point that must stay visible. For a
portrait with head room, as on CV, two more values place it: `--top` (where the upper edge of the
picture sits) and `--fade` (the length of the dissolve below that edge); see `.art-cv` in
`site.css`. Give a real `alt` text, and if other people are in the picture make sure the caption
or alt text does not suggest that one of them is the site's owner.

## 6. Design

- **Type.** Instrument Serif for names and headings (italic for emphasis), Inter for text,
  JetBrains Mono for small labels. All three are served from `assets/fonts/`.
- **Colour.** Warm paper (`--paper` #F5F2EB), deep ink (`--ink` #0B1422) and one emerald
  accent (`--accent` #0E9F6E, `--mint` #6BE8B8 on dark), matching the D monogram. A five-step
  blue-to-mint ramp (`--s1` … `--s5`) is used only for the hero network. Red is reserved for
  form errors. All tokens are at the top of `site.css`.
- **Stages.** Every view opens on a dark stage with its own picture: the portrait on Home, the
  first pages of five articles on Publications, the graduation photograph on CV, the certificates on
  Service, and a line drawing on Research (the hand landmarks of the wheelchair project),
  Datasets and Contact.
  The header is transparent over a stage and turns to paper once the sheet reaches it.
- **Night.** The round button in the header (a moon by day, a sun by night) turns night mode on
  and off. The stages are dark already and do not change; the paper sheet, its cards, the form
  and the footer turn to deep navy with light text and a mint accent. The choice is kept in the
  visitor's browser (`localStorage`, key `rd-theme`) and applied by the small script in
  `<head>` before the page is drawn, so a night visitor never sees a white flash. Day is the
  default for everyone else. In `site.css` the night colours are one block, `html.night { … }`,
  directly under the day tokens: a colour used on the sheet must be one of those tokens, never
  a fixed value, or it will not follow.
- **Identity.** The Home hero carries a small network drawn on a canvas: five layers standing
  over the labels Computer Science → Artificial Intelligence → Machine Learning → Deep
  Learning → Research, with signals travelling left to right. It runs in front of the portrait
  but stays below the face. It reacts to the pointer, pauses when it is off screen or the tab is
  hidden, slows itself down on a weak device and is a still drawing when motion is reduced.
- **Motion.** A short intro on the first visit of a browser session; an ink veil that rises,
  names the destination and leaves when the view changes; masked headline reveals; blocks that
  rise into place as they are scrolled into view; the word-by-word statement on Home; counters;
  the sliding navigation pill; hover fills and pointer-following highlights on cards; a slow
  drift of the stage pictures against the pointer and the scroll. Everything is CSS transitions
  switched by a few classes from `site.js`. `prefers-reduced-motion` turns all of it off, and
  without JavaScript nothing is hidden.

## 7. Publishing and checks

The site is the `main` branch of `RADiptho/RADiptho.github.io`: GitHub Pages serves the root of that
branch at https://radiptho.github.io/ (repository **Settings → Pages → Build and deployment →
Deploy from a branch → main, / (root)**; no custom domain). Every commit on `main` is live a
minute or two later, including the commits of the sync job. There is no build step: what is in
the branch is what is served. `404.html` is picked up by GitHub Pages on its own.


Open the page locally (`python3 -m http.server` in this folder) and look at: each of the seven
addresses above, by day and by night, a phone-width window, the Publications filters, a
certificate, the keyboard (Tab reaches everything, Escape closes the menu and the viewer) and
the browser console (no errors). After a change to the sync script run
`python scripts/test_sync_scholar.py`. Do not test the contact form against the live service more than needed:
every accepted message is stored.

SECURITY NOTE: CV is deliberately NOT included in this public repository. The CV button links to a restricted Google Drive file. Set Drive General access to Restricted and allow downloads for approved viewers.

CONTACT FORM: delivered by the Cloudflare Worker contact service (see section 3). No secrets are stored in this repository.
