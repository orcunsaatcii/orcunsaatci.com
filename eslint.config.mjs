// eslint.config.mjs
import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier';

const TS = '**/*.{ts,tsx}';

/** SB4: hiçbir dosyada kullanılamayan paketler. */
const BANNED_PATHS = [
  { name: 'motion', message: 'D-15: motion/framer-motion YASAK. GSAP (lazy) + CSS kullanın.' },
  { name: 'framer-motion', message: 'D-15: motion/framer-motion YASAK.' },
  { name: 'next-intl', message: 'D-08: i18n iki statik route ağacıyla yapılır; next-intl YASAK.' },
  { name: '@react-three/postprocessing', message: 'D-14: post-processing YASAK.' },
  { name: 'postprocessing', message: 'D-14: post-processing YASAK.' },
  { name: 'r3f-perf', message: 'D-15: r3f-perf YASAK (drei 9 / React 18 peer çakışması).' },
  { name: 'next-view-transitions', message: 'D-32: React <ViewTransition> kullanın.' },
  { name: '@studio-freight/lenis', message: 'D-15: yalnız lenis@1.3.x.' },
  { name: 'gsap/ScrollSmoother', message: 'D-15: ScrollSmoother YASAK.' },
  {
    name: 'next/font/google',
    message: 'D-21: fontlar yalnız src/fonts/index.ts içinde next/font/local ile.',
  },
];
const BANNED_PATTERNS = [
  {
    group: ['motion/*', 'framer-motion/*', 'next-intl/*', 'postprocessing/*'],
    message: 'SB4: yasaklı paket (§8.2).',
  },
];

/** SB1: 3D yalnız src/stage/gl/** içinde. */
const THREE = {
  group: ['three', 'three/*', '@react-three/*', 'maath', 'maath/*'],
  allowTypeImports: true,
  message: 'D-17: three / @react-three/* / maath yalnız src/stage/gl/** içinde import edilir.',
};
/** SB3: motion chunk statik olarak yalnız src/lib/gsap.ts içinde. */
const MOTION = {
  // SPEC-SAPMA: §8.2.2 — desenler gitignore kuralıyla eşleşir: dışlanan bir klasörün (`lenis`,
  // `lenis/dist`) altındaki dosya geri alınamaz. Bu yüzden kök `lenis` desenden çıkarılıp tam ad
  // kuralına (LENIS_ROOT) taşındı, `lenis/dist` geri alınıp içi yeniden dışlandı; yalnız CSS serbesttir.
  group: [
    'gsap',
    'gsap/*',
    '@gsap/react',
    'lenis/*',
    '!lenis/dist',
    'lenis/dist/*',
    '!lenis/dist/lenis.css',
  ],
  allowTypeImports: true,
  message:
    "D-33: gsap/lenis statik import YASAK. Runtime'ı useMotionRuntime()/whenMotion() ile alın (§5.13.2).",
};
const MOTION_ENTRY = {
  group: ['@/lib/gsap', '**/lib/gsap'],
  allowTypeImports: true,
  message: "D-33: @/lib/gsap yalnız import('@/lib/gsap') ile yüklenir (MotionRoot.loadMotion).",
};
/** SB5: üretilen içerik yalnız src/lib/content/index.ts üzerinden. */
const CONTENT = {
  group: ['content-collections', '**/.content-collections/**'],
  allowTypeImports: true,
  message: '§7.2.3: içeriğe yalnız @/lib/content üzerinden erişin.',
};
/** SB7: Node'da tsx ile de çalışan modüller @/ takma adı kullanmaz. */
const NO_ALIAS = {
  group: ['@/*'],
  message: "§7.2.3: bu modül tsx ile Node'da da çalışır; göreli import kullanın.",
};

/** MOTION ile birlikte kullanılan tam ad kuralı: kök `lenis` modülü (bkz. MOTION'daki SPEC-SAPMA). */
const LENIS_ROOT = { name: 'lenis', allowTypeImports: true, message: MOTION.message };
const motionPaths = (patterns) => (patterns.includes(MOTION) ? [LENIS_ROOT] : []);

const restrict = (...patterns) => [
  'error',
  {
    paths: [...BANNED_PATHS, ...motionPaths(patterns)],
    patterns: [...BANNED_PATTERNS, ...patterns],
  },
];
const restrictWith = (paths, ...patterns) => [
  'error',
  {
    paths: [...BANNED_PATHS, ...paths, ...motionPaths(patterns)],
    patterns: [...BANNED_PATTERNS, ...patterns],
  },
];

const GL = ['src/stage/gl/**/*.{ts,tsx}'];
const MOTION_ENTRY_FILE = ['src/lib/gsap.ts'];
const CONTENT_READER = ['src/lib/content/index.ts'];
const NODE_SAFE = [
  'src/lib/content/schemas.ts',
  'src/lib/content/image-meta.ts',
  'src/lib/content/cv.ts',
  'src/i18n/format.ts',
  'src/design/tokens.ts',
];
const BUILD_SCRIPTS = ['content-collections.ts', 'scripts/**/*.{ts,tsx}'];

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    name: 'project/import-boundaries',
    files: [TS],
    rules: {
      'no-restricted-imports': 'off',
      '@typescript-eslint/no-restricted-imports': restrict(THREE, MOTION, MOTION_ENTRY, CONTENT),
    },
  },
  {
    name: 'project/stage-gl',
    files: GL,
    rules: {
      '@typescript-eslint/no-restricted-imports': restrictWith(
        [
          {
            name: '@react-three/drei',
            allowImportNames: ['PerformanceMonitor'],
            message: "D-14: drei'den yalnız PerformanceMonitor.",
          },
        ],
        MOTION,
        MOTION_ENTRY,
        CONTENT,
      ),
    },
  },
  {
    name: 'project/motion-entry',
    files: MOTION_ENTRY_FILE,
    rules: { '@typescript-eslint/no-restricted-imports': restrict(THREE, CONTENT) },
  },
  {
    name: 'project/content-reader',
    files: CONTENT_READER,
    rules: { '@typescript-eslint/no-restricted-imports': restrict(THREE, MOTION, MOTION_ENTRY) },
  },
  {
    name: 'project/node-safe',
    files: NODE_SAFE,
    rules: {
      '@typescript-eslint/no-restricted-imports': restrict(
        THREE,
        MOTION,
        MOTION_ENTRY,
        CONTENT,
        NO_ALIAS,
      ),
    },
  },
  {
    name: 'project/build-scripts',
    files: BUILD_SCRIPTS,
    rules: {
      '@typescript-eslint/no-restricted-imports': restrict(THREE, MOTION, MOTION_ENTRY, NO_ALIAS),
    },
  },
  {
    name: 'project/poster-img',
    files: ['src/stage/ScenePoster.tsx'],
    rules: { '@next/next/no-img-element': 'off' },
  },
  {
    name: 'project/a11y', // eslint-config-next'in jsx-a11y kümesine ekler (§10.3.5)
    files: [TS],
    rules: {
      'jsx-a11y/tabindex-no-positive': 'error',
      'jsx-a11y/no-autofocus': ['error', { ignoreNonDOM: true }],
      'jsx-a11y/anchor-has-content': 'error',
      'jsx-a11y/no-noninteractive-tabindex': [
        'error',
        { tags: [], roles: ['region'], allowExpressionValues: true },
      ],
    },
  },
  {
    name: 'project/turkish-case',
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/i18n/format.ts'],
    rules: {
      'no-restricted-properties': [
        'warn',
        {
          property: 'toUpperCase',
          message: "§3.8: upper(s, locale) kullanın (toLocaleUpperCase('tr-TR')).",
        },
        {
          property: 'toLowerCase',
          message: "§3.8: lower(s, locale) kullanın (toLocaleLowerCase('tr-TR')).",
        },
      ],
    },
  },
  prettier, // biçim kurallarını kapatır; her zaman EN SONDA (§13.7)
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    '.content-collections/**',
    '.schemas/**',
    'public/**',
    'test-results/**',
    'playwright-report/**',
    'blob-report/**',
    '.lighthouseci/**',
    'coverage/**', // SPEC-SAPMA: §8.2.2 — §13.7'deki /coverage/ ESLint'te de yok sayılır
  ]),
]);
