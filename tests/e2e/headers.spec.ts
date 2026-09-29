// tests/e2e/headers.spec.ts — §12.5.7 (D-25).
// M0: only "/" and "/yok". M3 extends this to the five paths in §12.5.7 (§15.0.6).
import { expect, test } from './fixtures';

const PATHS = ['/', '/yok'] as const;

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
  for (const path of PATHS) {
    test(`D-25 ${path} sends all seven security headers`, async ({ request }) => {
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
    });
  }
});
