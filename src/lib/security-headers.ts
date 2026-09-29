// src/lib/security-headers.ts
// next.config.ts tarafından göreli yolla import edilir. '@/…' alias'ı ve 'server-only' YASAK.

export type HeaderEntry = { key: string; value: string };
export type CspEnv = { nodeEnv: string | undefined; vercelEnv: string | undefined };

/**
 * D-25 yayılım anahtarı.
 * true  → Preview deploy'ları CSP'yi Report-Only gönderir; Production, yerel ve CI zorunlu (enforce) gönderir.
 * false → her ortam zorunlu. Lansman kontrol listesinde false yapılır (§14.7).
 */
export const CSP_REPORT_ONLY_ON_PREVIEW = true;

const VERCEL_TOOLBAR = {
  script: ['https://vercel.live'],
  style: ['https://vercel.live'],
  img: ['https://vercel.live', 'https://vercel.com'],
  font: ['https://vercel.live', 'https://assets.vercel.com'],
  connect: ['https://vercel.live', 'wss://ws-us3.pusher.com'],
  frame: ['https://vercel.live'],
} as const;

export function buildCsp(env: CspEnv, reportOnly: boolean): string {
  const dev = env.nodeEnv === 'development';
  const preview = env.vercelEnv === 'preview';
  const tb = (k: keyof typeof VERCEL_TOOLBAR): readonly string[] =>
    preview ? VERCEL_TOOLBAR[k] : [];

  const directives: ReadonlyArray<readonly [string, readonly string[]]> = [
    ['default-src', ["'self'"]],
    [
      'script-src',
      [
        "'self'",
        "'unsafe-inline'",
        "'wasm-unsafe-eval'",
        ...(dev ? ["'unsafe-eval'"] : []),
        ...tb('script'),
      ],
    ],
    ['style-src', ["'self'", "'unsafe-inline'", ...tb('style')]],
    ['img-src', ["'self'", 'data:', ...tb('img')]],
    ['font-src', ["'self'", ...tb('font')]],
    ['connect-src', ["'self'", ...(dev ? ['ws:'] : []), ...tb('connect')]],
    ['media-src', ["'self'"]],
    ['worker-src', ["'self'", 'blob:']],
    ['frame-src', preview ? [...tb('frame')] : ["'none'"]],
    ['object-src', ["'none'"]],
    ['base-uri', ["'self'"]],
    ['form-action', ["'self'"]],
    ['frame-ancestors', ["'none'"]],
  ];

  const parts = directives.map(([name, values]) => `${name} ${values.join(' ')}`);
  // Report-Only politikada tarayıcılar bu direktifi yok sayar ve konsola uyarı yazar; bu yüzden yalnız zorunlu modda eklenir.
  if (!reportOnly) parts.push('upgrade-insecure-requests');
  return parts.join('; ');
}

export function buildSecurityHeaders(env: CspEnv, reportOnlyOnPreview: boolean): HeaderEntry[] {
  const reportOnly = reportOnlyOnPreview && env.vercelEnv === 'preview';
  return [
    {
      key: reportOnly ? 'Content-Security-Policy-Report-Only' : 'Content-Security-Policy',
      value: buildCsp(env, reportOnly),
    },
    { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    {
      key: 'Permissions-Policy',
      value: 'camera=(), microphone=(), geolocation=(), browsing-topics=(), payment=(), usb=()',
    },
    { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  ];
}

export const securityHeaders: HeaderEntry[] = buildSecurityHeaders(
  { nodeEnv: process.env.NODE_ENV, vercelEnv: process.env.VERCEL_ENV },
  CSP_REPORT_ONLY_ON_PREVIEW,
);
