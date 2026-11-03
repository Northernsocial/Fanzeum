# Fanzeum Investor Deck

A self-contained, print-ready HTML pitch deck for Fanzeum.

## Files

- `index.html` — 14 slides at 1920 × 1080 px, designed for PDF export.

## How to print to PDF

Use headless Chrome (or Chromium) so the exact page size and background colours are preserved.

```bash
npx playwright-core chromium \
  --headless \
  --print-to-pdf=docs/investor-deck/fanzeum-investor-deck.pdf \
  --no-pdf-header-footer \
  --run-all-compositor-stages-before-draw \
  docs/investor-deck/index.html
```

Or with Google Chrome directly:

```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --headless \
  --print-to-pdf=docs/investor-deck/fanzeum-investor-deck.pdf \
  --no-pdf-header-footer \
  docs/investor-deck/index.html
```

## Print settings

- Page size: **1920 px × 1080 px**
- Margins: **0**
- Background graphics: **enabled**
- Scale: **100%**

If printing from Chrome's print dialog instead of headless mode, choose **Save as PDF**, set paper size to **1920 × 1080** (or use a custom page size), set margins to **None**, and enable **Background graphics**.
