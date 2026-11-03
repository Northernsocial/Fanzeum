# Fanzeum Investor Deck v2

Version 2.0 investor pitch deck for Fanzeum (November 2026), built as a self-contained, high-fidelity HTML presentation designed for 1080p widescreen displays and pixel-perfect PDF export.

- **File location:** `docs/investor-deck-v2/index.html`
- **Slide Dimensions:** `1920px × 1080px` (16:9 widescreen)
- **Slide Count:** 24 slides (one slide per printed page)
- **Palette:** Near-black `#0E0D0B` and warm charcoal `#171512` backgrounds, ivory text `#F3EDE2`, brass accents `#C9A227`, and logo red `#B20100` for high-impact emphasis
- **Brand Assets:** Vector SVG logo (`../../public/brand/fanzeum-logo.svg`) and high-resolution demo collectible imagery (`../../public/images/demo/`)
- **Typography:** Fraunces (headlines, numerals) and Inter (body copy, metadata) with Georgia and Helvetica fallbacks
- **Dependencies:** Self-contained HTML and CSS, zero JavaScript, inline SVG charts with explicit fill and stroke colours (compatible with both headless Chrome and WeasyPrint)

---

## Exporting to PDF via Headless Chrome / Chromium

The deck uses exact CSS page and slide directives:
```css
@page {
  size: 1920px 1080px;
  margin: 0;
}
.slide {
  width: 1920px;
  height: 1080px;
  page-break-after: always;
  break-after: page;
  overflow: hidden;
}
```

### 1. Using Google Chrome / Chromium CLI

To generate a 24-page 1080p presentation PDF directly from the terminal, execute from the repository root:

```bash
google-chrome \
  --headless \
  --disable-gpu \
  --no-margins \
  --print-to-pdf-no-header \
  --print-to-pdf=docs/investor-deck-v2/fanzeum-investor-deck-v2.pdf \
  docs/investor-deck-v2/index.html
```

Or with Chromium:

```bash
chromium \
  --headless \
  --disable-gpu \
  --no-margins \
  --print-to-pdf-no-header \
  --print-to-pdf=docs/investor-deck-v2/fanzeum-investor-deck-v2.pdf \
  docs/investor-deck-v2/index.html
```

### 2. Printing to PDF from Desktop Chrome / Edge

1. Open `docs/investor-deck-v2/index.html` in Google Chrome, Microsoft Edge, or Brave.
2. Press **Cmd + P** (macOS) or **Ctrl + P** (Windows/Linux).
3. Set **Destination** to **Save as PDF**.
4. Set **Layout** to **Landscape**.
5. Under **More settings**:
   - Set **Margins** to **None**.
   - Check **Background graphics** (this ensures the After Hours dark backgrounds and charts render).
   - Set **Scale** to **Default** (100%).
   - Set **Paper size** to **1920 x 1080** or **Custom** (`20 in × 11.25 in` / `508 mm × 285.75 mm`).
6. Click **Save**.

### 3. Using Playwright / Puppeteer

```javascript
import { chromium } from 'playwright';
import path from 'path';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 2,
  });

  const filePath = path.resolve('docs/investor-deck-v2/index.html');
  await page.goto(`file://${filePath}`, { waitUntil: 'networkidle' });

  await page.pdf({
    path: 'docs/investor-deck-v2/fanzeum-investor-deck-v2.pdf',
    width: '1920px',
    height: '1080px',
    printBackground: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
    pageRanges: '1-24',
  });

  await browser.close();
})();
```
