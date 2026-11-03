import { describe, expect, it } from 'vitest';
import {
  FANZEUM_FAVICON_SRC,
  FANZEUM_ICON_MASKABLE_SRC,
  FANZEUM_ICON_SRC,
  FANZEUM_LOGO_ALT,
  FANZEUM_LOGO_SRC,
} from './brand';

describe('brand assets', () => {
  it('uses the official logo asset with correct alt text', () => {
    expect(FANZEUM_LOGO_SRC).toBe('/brand/fanzeum-logo.png');
    expect(FANZEUM_LOGO_ALT).toBe('Fanzeum');
  });

  it('exposes square icon assets for PWA manifest and favicon', () => {
    expect(FANZEUM_ICON_SRC).toBe('/brand/fanzeum-icon.svg');
    expect(FANZEUM_ICON_MASKABLE_SRC).toBe('/brand/fanzeum-icon-maskable.svg');
    expect(FANZEUM_FAVICON_SRC).toBe('/brand/fanzeum-icon.svg');
  });

  it('keeps all brand assets under /brand/', () => {
    expect(FANZEUM_LOGO_SRC.startsWith('/brand/')).toBe(true);
    expect(FANZEUM_ICON_SRC.startsWith('/brand/')).toBe(true);
    expect(FANZEUM_ICON_MASKABLE_SRC.startsWith('/brand/')).toBe(true);
    expect(FANZEUM_FAVICON_SRC.startsWith('/brand/')).toBe(true);
  });
});
