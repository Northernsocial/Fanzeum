# Fanzeum Investor Deck (Version B)

Investor pitch deck for Fanzeum (November 2026), designed as a self-contained HTML presentation with zero external script or image dependencies.

- **File:** `index.html`
- **Slide Dimensions:** `1920px × 1080px` (16:9 widescreen)
- **Palette:** "After Hours" dark luxury (`#0E0D0B` background, `#F3EDE2` warm ivory text, `#C9A227` / `#B8892B` brass accents)
- **Typography:** Fraunces (headlines & numerals) and Inter (body & small caps)

---

## Exporting to PDF via Headless Chrome

The deck is engineered with CSS print styles (`@page { size: 1920px 1080px; margin: 0; }` and `page-break-after: always;`) so that each slide exports as an exact, unclipped 1080p PDF page.

### 1. Using Google Chrome CLI

Run the following command from the repository root:

```bash
google-chrome \
  --headless \
  --disable-gpu \
  --no-margins \
  --print-to-pdf-no-header \
  --print-to-pdf=docs/investor-deck-b/fanzeum-investor-deck-b.pdf \
  docs/investor-deck-b/index.html
```

Or with Chromium:

```bash
chromium \
  --headless \
  --disable-gpu \
  --no-margins \
  --print-to-pdf-no-header \
  --print-to-pdf=docs/investor-deck-b/fanzeum-investor-deck-b.pdf \
  docs/investor-deck-b/index.html
```

### 2. Using Playwright

If using Playwright, generate the PDF using exact 1920x1080 dimensions:

```javascript
import { chromium } from 'playwright';
import path from 'path';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 2,
  });

  const filePath = path.resolve('docs/investor-deck-b/index.html');
  await page.goto(`file://${filePath}`, { waitUntil: 'networkidle' });

  await page.pdf({
    path: 'docs/investor-deck-b/fanzeum-investor-deck-b.pdf',
    width: '1920px',
    height: '1080px',
    printBackground: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
    pageRanges: '1-14',
  });

  await browser.close();
})();
```

### 3. Printing from Desktop Chrome / Edge

1. Open `docs/investor-deck-b/index.html` in Chrome or Edge.
2. Press `Ctrl + P` (or `Cmd + P` on macOS).
3. Destination: **Save as PDF**.
4. Layout: **Landscape**.
5. Paper size: Select **1920 x 1080** or **Custom** (`20 in × 11.25 in` or `508 mm × 285.75 mm`).
6. Margins: **None**.
7. Options: Ensure **Background graphics** is **checked**.
8. Click **Save**.
