// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { buildCsp, buildSecurityHeaders } from './security-headers';

// §12.5.2: production CSP, character for character.
const PRODUCTION_CSP =
  "default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; media-src 'self'; worker-src 'self' blob:; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests";

const production = { nodeEnv: 'production', vercelEnv: 'production' } as const;
const preview = { nodeEnv: 'production', vercelEnv: 'preview' } as const;
const development = { nodeEnv: 'development', vercelEnv: undefined } as const;

const directive = (csp: string, name: string) =>
  csp
    .split('; ')
    .find((part) => part === name || part.startsWith(`${name} `))
    ?.split(' ')
    .slice(1) ?? [];

describe('security headers (§12.5)', () => {
  it('D-25 production CSP equals the §12.5.2 string exactly', () => {
    expect(buildCsp(production, false)).toBe(PRODUCTION_CSP);
  });

  it('production CSP has no unsafe-eval, toolbar origin, wildcard or stray blob:', () => {
    const csp = buildCsp(production, false);
    // 'wasm-unsafe-eval' is allowed (D-25); the forbidden keyword is 'unsafe-eval' in quotes.
    expect(csp).not.toContain("'unsafe-eval'");
    expect(csp).not.toContain('vercel.live');
    expect(csp).not.toMatch(/(^|\s)\*(\s|;|$)/);
    for (const part of csp.split('; ')) {
      if (!part.startsWith('worker-src')) expect(part).not.toContain('blob:');
    }
    expect(directive(csp, 'script-src')).not.toContain("'unsafe-eval'");
  });

  it('preview with report-only uses the Report-Only header, drops upgrade-insecure-requests, allows the toolbar', () => {
    const headers = buildSecurityHeaders(preview, true);
    const csp = headers.find((h) => h.key.startsWith('Content-Security-Policy'));
    expect(csp?.key).toBe('Content-Security-Policy-Report-Only');
    expect(csp?.value).not.toContain('upgrade-insecure-requests');
    expect(csp?.value).toContain('https://vercel.live');
  });

  it('preview without report-only enforces the policy', () => {
    const headers = buildSecurityHeaders(preview, false);
    expect(headers.map((h) => h.key)).toContain('Content-Security-Policy');
  });

  it('development allows unsafe-eval and the HMR websocket', () => {
    const csp = buildCsp(development, false);
    expect(directive(csp, 'script-src')).toContain("'unsafe-eval'");
    expect(directive(csp, 'connect-src')).toContain('ws:');
  });

  it('HSTS has no preload (D-25)', () => {
    const hsts = buildSecurityHeaders(production, true).find(
      (h) => h.key === 'Strict-Transport-Security',
    );
    expect(hsts?.value).toBe('max-age=63072000; includeSubDomains');
    expect(hsts?.value).not.toContain('preload');
  });

  it('header keys are unique and all seven headers are present', () => {
    const keys = buildSecurityHeaders(production, true).map((h) => h.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toEqual([
      'Content-Security-Policy',
      'Strict-Transport-Security',
      'X-Content-Type-Options',
      'X-Frame-Options',
      'Referrer-Policy',
      'Permissions-Policy',
      'Cross-Origin-Opener-Policy',
    ]);
  });
});
