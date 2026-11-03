import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const htmlPath = path.resolve(import.meta.dirname, 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

describe('investor deck', () => {
  it('has exactly 14 slides', () => {
    const matches = html.match(/<section[^>]*class="slide"/g);
    expect(matches?.length).toBe(14);
  });

  it('uses the required 1920x1080 slide dimensions', () => {
    expect(html).toContain('width: 1920px');
    expect(html).toContain('height: 1080px');
  });

  it('sets the print page size to 1920px by 1080px with zero margins', () => {
    expect(html).toContain('@page {');
    expect(html).toContain('size: 1920px 1080px');
    expect(html).toContain('margin: 0');
  });

  it('uses the After Hours palette and typography', () => {
    expect(html).toContain('--bg: #0E0D0B');
    expect(html).toContain('--brass: #C9A227');
    expect(html).toContain("Fraunces");
    expect(html).toContain("Inter");
  });

  it('includes required content sections', () => {
    expect(html).toContain('Every collection deserves an audience');
    expect(html).toContain('The Problem');
    expect(html).toContain('Fanzeum, a collectors');
    expect(html).toContain('How It Works');
    expect(html).toContain('Market Size');
    expect(html).toContain('Insurance Opportunity');
    expect(html).toContain('Business Model');
    expect(html).toContain('Proof It Works');
    expect(html).toContain('Roadmap');
    expect(html).toContain('Illustrative projections, not forecasts');
    expect(html).toContain('Join us early');
    expect(html).toContain('Where collections come to life');
  });

  it('includes source citations on the correct slides', () => {
    expect(html).toContain('Sources: Grand View Research');
    expect(html).toContain('Sources: Aviva, 2026; Jewelers Mutual');
    expect(html).toContain('Sources: Aviva, 2026; Ecclesiastical; Chubb');
    expect(html).toContain('Sources: TechCrunch, 2025; Technical.ly');
  });

  it('contains no external image references', () => {
    expect(html).not.toMatch(/<img[^>]+src=["']https?:\/\//);
  });

  it('has a footer on every slide', () => {
    const footerMatches = html.match(/Fanzeum · Confidential · Nov 2026/g);
    expect(footerMatches?.length).toBe(14);
  });
});
