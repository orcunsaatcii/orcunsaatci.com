// tests/e2e/headers.spec.ts — §12.5.7 (D-25).
// The five paths in §12.5.7: /, the first project page, /sitemap.xml, /yok (404) and the CV PDF.
import { expect, test } from './fixtures';
import { sitemapPaths } from './helpers/urls';

const REQUIRED = [
  'content-security-policy',
  'strict-transport-security',
  'x-content-type-options',
  'x-frame-options',
  'referrer-policy',
  'permissions-policy',
  'cross-origin-opener-policy',
] as const;

test.describe('D-25 security headers', { tag: ['@desktop-chromium'] }, () => {
  test('D-25 five paths send all seven security headers', async ({ request }) => {
    const project = (await sitemapPaths(request)).find((p) => p.startsWith('/projeler/'));
    expect(project, 'first project page').toBeTruthy();
    for (const path of ['/', project!, '/sitemap.xml', '/yok', '/files/orcun-saatci-cv-tr.pdf']) {
      const res = await request.get(path, { maxRedirects: 0 });
      const headers = res.headers();
      for (const name of REQUIRED) {
        expect.soft(headers[name], `${path}: ${name}`).toBeTruthy();
      }
      // Local and CI builds enforce the policy; only Vercel Preview is Report-Only (§12.5.5).
      expect
        .soft(headers['content-security-policy-report-only'], `${path}: report-only`)
        .toBeUndefined();
      expect.soft(headers['strict-transport-security'], `${path}: HSTS`).not.toContain('preload');
      expect.soft(headers['x-powered-by'], `${path}: x-powered-by`).toBeUndefined();
    }
  });
});
