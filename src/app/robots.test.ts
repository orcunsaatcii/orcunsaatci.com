// src/app/robots.test.ts — §11.4.3: yalnız production + SITE_INDEXABLE=true iken izin; diğer her durumda Disallow: /.
import { describe, expect, it, vi } from 'vitest';
import robots from './robots';

describe('robots', () => {
  it('yerel / CI / preview: Disallow: /', () => {
    vi.stubEnv('VERCEL_ENV', '');
    vi.stubEnv('SITE_INDEXABLE', 'true');
    expect(robots()).toEqual({ rules: [{ userAgent: '*', disallow: '/' }] });
    vi.stubEnv('VERCEL_ENV', 'preview');
    expect(robots()).toEqual({ rules: [{ userAgent: '*', disallow: '/' }] });
  });

  it('production ama SITE_INDEXABLE kapalı: Disallow: /', () => {
    vi.stubEnv('VERCEL_ENV', 'production');
    vi.stubEnv('SITE_INDEXABLE', 'false');
    expect(robots()).toEqual({ rules: [{ userAgent: '*', disallow: '/' }] });
  });

  it('production + SITE_INDEXABLE=true: Allow /, Disallow /lab ve mutlak Sitemap', () => {
    vi.stubEnv('VERCEL_ENV', 'production');
    vi.stubEnv('SITE_INDEXABLE', 'true');
    expect(robots()).toEqual({
      rules: [{ userAgent: '*', allow: '/', disallow: ['/lab'] }],
      sitemap: 'https://www.orcunsaatci.com/sitemap.xml',
    });
  });
});
