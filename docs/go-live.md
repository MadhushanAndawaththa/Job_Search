# Go-Live Runbook — Job Search Lens v1.3.1

Step-by-step guide to ship the extension to the Chrome Web Store. The dev side is done; this file lists only the steps that require your account or identity.

Estimated hands-on submission time: **30–60 minutes**. Google review time varies by item and account.

---

## ✅ Pre-flight (already done for you)

- [x] Code reviewed and the full automated test suite passing.
- [x] No `console.log`, no `debugger`, no `TODO`s left in shipped code.
- [x] Manifest V3 with minimal permissions (`contextMenus`, `storage`, `activeTab`, `scripting`, LinkedIn host access, plus optional all-site access).
- [x] Production `.zip` built at `dist/job-search-lens-v1.3.1.zip` (14 files, no dev assets).
- [x] Popup has a footer with `Website · Help · Privacy · v1.3.1` links pointing at the product site.
- [x] Five Web Store images generated at exact dimensions in `docs/assets/store/`:
  - `small-promo-440x280.png`
  - `marquee-1400x560.png`
  - `store-preview-1280x800.png` (review-queue overview with three feature demonstrations)
  - `popup-screenshot-1280x800.png` (real popup UI composite)
  - `og-image-1200x630.png` (social shares)
- [x] LinkedIn-first messaging applied across all copy.
- [x] All public URLs updated to the new public repo / Pages site.

---

## REPO STRATEGY

You have two repos:

| Repo | Visibility | Contents | Purpose |
|---|---|---|---|
| `Job_Search` (current) | **Private** | The actual extension source — manifest, popup, content scripts, tests, dist zips | Code stays private |
| `jslens` (new) | **Public** | Just the product website (`docs/` folder contents) + an issues tracker | Required because Chrome Web Store needs a publicly reachable privacy policy URL, and users need somewhere to file bugs |

---

## STEP 1 — Push the source repo and prepare the public website repo (~10 min)

### 1a. Push the (private) source repo

```bash
# Make sure your current repo is private in GitHub settings first.
git add -A
git commit -m "v1.3.1: Chrome Web Store release cleanup"
git push origin main
```

### 1b. Create the public website repo

1. Create a **new public repo** on GitHub: `MadhushanAndawaththa/jslens`.
2. Locally, copy the **contents of `docs/`** (everything inside it, including the `assets/` and `marketing/` subfolders) to the root of the new repo:
   ```bash
   # From a fresh clone of jslens:
   cp -r /path/to/Job_Search/docs/* .
   git add -A
   git commit -m "Initial product website"
   git push origin main
   ```
   Result — the new repo's root should contain:
   ```
   index.html
   privacy-policy.html
   support.html
   style.css
   go-live.md          (optional — useful for you, irrelevant to visitors)
   chrome-web-store-submission.txt   (optional)
   marketing/          (HTML sources for image regeneration)
   assets/
     icons/
     store/
   ```

### 1c. Enable GitHub Pages on the public repo

1. In the new repo: **Settings → Pages**.
2. Source: **Deploy from a branch** → Branch: `main` → Folder: `/ (root)`.
3. Save and wait ~2 minutes.
4. Verify these URLs return 200 in a fresh tab:
   - `https://madhushanandawaththa.github.io/jslens/`
   - `https://madhushanandawaththa.github.io/jslens/privacy-policy.html`
   - `https://madhushanandawaththa.github.io/jslens/support.html`

If they 404, fix this before moving on — Step 5 needs the privacy URL to be live.

---

## STEP 2 — Chrome Web Store developer account (~10 min, **one-time $5 fee**)

1. Open <https://chrome.google.com/webstore/devconsole>.
2. Sign in with the Google account you want listed as developer.
3. Accept the developer agreement.
4. Pay the **$5 one-time** registration fee.
5. Complete identity verification if Google prompts for it.
6. Enable **2-Step Verification** on the Google account; Chrome Web Store requires it for publishing and updates.

> Tip: use a Google account you actually plan to maintain. The displayed publisher name is hard to change later.

---

## STEP 3 — Upload the extension (~5 min)

1. From the dev console, click **+ New item**.
2. Drag `dist/job-search-lens-v1.3.1.zip` (from the private source repo). Wait for it to parse.
3. The console auto-fills name, version, description, icons from the manifest. Verify they match.

---

## STEP 4 — Store listing tab (~15 min) — COPY-PASTE READY

### Product details

| Field | Value |
|---|---|
| **Name** | Job Search Lens |
| **Summary** (short, 132 char) | Fade already-seen job listings, see company size faster, and optionally highlight your saved keywords across the web. |
| **Category** | Productivity |
| **Language** | English |

### Detailed description (paste verbatim)

```
Job Search Lens helps you scan job listings faster.

LinkedIn often mixes Viewed, Saved, and Applied listings into the same results. Job Search Lens turns that feed into a clearer review queue by fading processed cards automatically, with a separate switch for each state. It also brings LinkedIn-provided company size and employee count closer to the job title, so you can judge fit before opening the listing.

You can also save the words that matter to you, like skills, job titles, locations, and company names. Those keywords are highlighted on LinkedIn. If you turn on optional all-site access in the popup, the same saved keywords can also be highlighted on other job boards and company career pages.

Everything stays on your device. There is no account, no backend service, no analytics, and no remote code. For people who want to verify that, the installed extension files can be inspected directly in Chrome.

KEY FEATURES
• Fade Viewed, Saved, and Applied listings with separate toggles
• See company size and employee count next to job titles
• Highlight saved keywords on LinkedIn by default, with optional highlighting on other websites from the popup
• Right-click context menu to save selected text as a keyword
• Turn saved keywords on or off without deleting them
• Choose a color for each keyword
• Search, sort, and export your keyword library
• Jump between highlighted matches with Previous and Next controls
• Open the popup with Alt + Shift + J
• Copy a privacy-safe detection report for troubleshooting
• Auto, Light, and Dark popup themes

PRIVACY
• No telemetry, analytics, or tracking pixels
• No accounts, sign-in, or cloud sync
• No remote code execution
• All data stays on your device
• The installed extension files can be inspected directly in Chrome
```

### Assets (upload order)

| Slot | File | Notes |
|---|---|---|
| Store icon (128×128) | `docs/assets/icons/icon128.png` | Auto-filled from manifest |
| **Screenshot 1** (1280×800) | `docs/assets/store/store-preview-1280x800.png` | Review-queue overview with card state, company context, keyword focus, and local-only architecture |
| **Screenshot 2** (1280×800) | `docs/assets/store/popup-screenshot-1280x800.png` | Real popup UI composite |
| **Small promo tile** (440×280) | `docs/assets/store/small-promo-440x280.png` | |
| **Marquee promo** (1400×560) | `docs/assets/store/marquee-1400x560.png` | Recommended even though optional |

### URLs

| Field | Value |
|---|---|
| Homepage URL | `https://madhushanandawaththa.github.io/jslens/` |
| Support URL | `https://madhushanandawaththa.github.io/jslens/support.html` |

---

## STEP 5 — Privacy practices tab (~5 min) — COPY-PASTE READY

### Single purpose

```
Job Search Lens turns LinkedIn job results into a clearer review queue by fading listings already labeled Viewed, Saved, or Applied, showing company context near job titles, and highlighting saved keywords. Keyword highlighting can also be enabled on other websites from the popup.
```

### Permission justifications

| Permission | Justification (paste exactly) |
|---|---|
| `contextMenus` | Adds a right-click "Add to Highlighter" menu item so users can save selected text from any page as a highlight keyword without opening the popup. |
| `storage` | Stores the user's saved keywords, color choices, dim-state toggles, and all-site-highlighting preference locally in chrome.storage.local. The popup theme uses extension localStorage. Nothing is transmitted off the device. |
| `activeTab` | When the user opens the popup, the popup queries the active tab to display status (job-list / job-detail surfaces detected, match count) and to send navigate-match commands. Permission is only granted while the popup is open via user gesture. |
| `scripting` | Registers and injects the optional non-LinkedIn page helper after the user enables all-site highlighting, so highlights start working on future pages automatically. |
| `host_permissions` (`https://www.linkedin.com/*`) | Required so LinkedIn Jobs dimming, company stats, and keyword highlighting work automatically on LinkedIn. |
| `optional_host_permissions` (`http://*/*` and `https://*/*`) | Only requested if the user turns on `Highlight on all websites` in the popup. Used so keyword highlights can run automatically on non-LinkedIn pages. |

### Remote code

Select **"No, I am not using remote code"**.

### Data usage

Do **not** select "No user data is collected." Select **Website content** because the extension reads visible page text locally to provide highlighting and LinkedIn job tools. State clearly that this content is processed transiently on-device, is not retained, and is never transmitted to the developer or a third party. Complete the Limited Use certifications so they match the privacy policy.

### Privacy policy URL

```
https://madhushanandawaththa.github.io/jslens/privacy-policy.html
```

Tick the certification checkbox.

### Reviewer test instructions

Paste the following into the **Test instructions** tab. No credentials are supplied or required for the cross-site highlighter.

1. Open a public text-heavy page, add a visible word in the popup, enable **Highlight on all websites**, accept the optional site-access prompt, and reload once. The word should be highlighted; Previous/Next should navigate its matches.
2. Use the popup to disable/re-enable the keyword, change its color, search the keyword library, and export the library.
3. LinkedIn-specific dimming and company stats require a signed-in LinkedIn account. With the reviewer's own account, open `https://www.linkedin.com/jobs/`, then use the Viewed/Saved/Applied switches to verify card dimming and open a job detail to verify the inline company stats when LinkedIn provides them.
4. All processing is local. The package makes no developer-controlled network requests and contains no remote code.

---

## STEP 6 — Distribution tab (~2 min)

| Field | Value |
|---|---|
| Visibility | **Public** |
| Regions | All regions |
| Pricing | Free |

> Optional: choose **Deferred publishing** the first time so the listing stays unlisted until you click "publish" after review completes.

---

## STEP 7 — Submit for review

1. Save draft on every tab.
2. Hit **Submit for review** in the top right.
3. Review time varies. Watch the developer-account email for questions or required action.
4. You'll get an email with the verdict.

---

## STEP 8 — Day-1 (after Google approves)

1. Copy the public Web Store URL (`https://chrome.google.com/webstore/detail/<extension-id>`).
2. In the **public website repo (`jslens`)**, search-and-replace the placeholder Web Store URL (`https://chrome.google.com/webstore/category/extensions`) with the real listing URL across:
   - `index.html` (two CTA buttons)
3. Commit + push — your "Get the extension" CTAs now go straight to the live listing.
4. Tag the release on the **source repo**:
   ```bash
   git tag -a v1.3.1 -m "First Chrome Web Store release"
   git push origin v1.3.1
   ```

---

## STEP 9 — Soft launch

Low-pressure places:

- **r/ChromeExtensions** — free extensions land well there.
- **r/cscareerquestions** + **r/jobs** — frame as "I made this, free, no signup".
- **Hacker News Show HN** — only post if you can be online for the first 90 min.
- **LinkedIn post** — your audience IS on LinkedIn — this is your best channel. Be honest: "I built a Chrome extension to fix the Viewed/Saved/Applied filter LinkedIn refuses to ship".
- **Twitter/X** with a 20-sec demo gif.

---

## STEP 10 — Maintenance

1. Watch GitHub issues on the **public** repo weekly.
2. Re-run `npm test` before every release in the **source** repo.
3. Bump version in `manifest.json` AND `package.json` AND the README badge on every release.
4. Regenerate marketing assets when copy changes:
   ```bash
   npm run assets:render
   ```
5. Rebuild the zip:
   ```bash
   npm run build:zip
   ```
6. Copy any changes from the source repo's `docs/` folder to the public website repo's root.

---

## Quick reference — files to upload during STEPs 3–4

```
dist/job-search-lens-v1.3.1.zip                          ← STEP 3 (extension package)
docs/assets/store/store-preview-1280x800.png             ← STEP 4 screenshot 1
docs/assets/store/popup-screenshot-1280x800.png          ← STEP 4 screenshot 2
docs/assets/store/small-promo-440x280.png                ← STEP 4 small promo
docs/assets/store/marquee-1400x560.png                   ← STEP 4 marquee
```

Good luck. Ping me after Google's verdict if you want help with the day-1 launch comms.
