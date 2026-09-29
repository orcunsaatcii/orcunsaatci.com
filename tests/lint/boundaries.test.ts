// @vitest-environment node
// tests/lint/boundaries.test.ts — import boundary self-test (§8.2.4).
import { ESLint } from 'eslint';
import { beforeAll, describe, expect, it } from 'vitest';

type Expect =
  | { rule: string; severity: 1 | 2 } // this rule must report at this severity
  | { none: string }; // this rule must not report at all

const RESTRICTED = '@typescript-eslint/no-restricted-imports';

const CASES: Array<[filePath: string, code: string, expected: Expect]> = [
  [
    'src/components/ui/Demo.tsx',
    "import * as THREE from 'three';\nexport const x = THREE;",
    { rule: RESTRICTED, severity: 2 },
  ],
  [
    'src/components/ui/Demo.tsx',
    "import type { Mesh } from 'three';\nexport type X = Mesh;",
    { none: RESTRICTED },
  ],
  [
    'src/stage/gl/Demo.tsx',
    "import { Mesh } from 'three';\nexport const x = Mesh;",
    { none: RESTRICTED },
  ],
  [
    'src/stage/gl/Demo.tsx',
    "import { PerformanceMonitor } from '@react-three/drei';\nexport const x = PerformanceMonitor;",
    { none: RESTRICTED },
  ],
  [
    'src/stage/gl/Demo.tsx',
    "import { OrbitControls } from '@react-three/drei';\nexport const x = OrbitControls;",
    { rule: RESTRICTED, severity: 2 },
  ],
  [
    'src/components/motion/Demo.tsx',
    "import { gsap } from 'gsap';\nexport const x = gsap;",
    { rule: RESTRICTED, severity: 2 },
  ],
  [
    'src/components/motion/Demo.tsx',
    "import type { gsap } from 'gsap';\nexport type X = typeof gsap;",
    { none: RESTRICTED },
  ],
  [
    'src/components/motion/Demo.tsx',
    "import { runtime } from '@/lib/gsap';\nexport const x = runtime;",
    { rule: RESTRICTED, severity: 2 },
  ],
  [
    'src/components/motion/Demo.tsx',
    "export const load = () => import('@/lib/gsap');",
    { none: RESTRICTED },
  ],
  [
    'src/components/motion/LenisProvider.tsx',
    "import 'lenis/dist/lenis.css';",
    { none: RESTRICTED },
  ],
  ['src/lib/gsap.ts', "import { gsap } from 'gsap';\nexport const x = gsap;", { none: RESTRICTED }],
  [
    'src/views/home/Demo.tsx',
    "import { motion } from 'motion/react';\nexport const x = motion;",
    { rule: RESTRICTED, severity: 2 },
  ],
  [
    'src/app/(tr)/Demo.tsx',
    "import { useTranslations } from 'next-intl';\nexport const x = useTranslations;",
    { rule: RESTRICTED, severity: 2 },
  ],
  [
    'src/fonts/Demo.ts',
    "import { Inter } from 'next/font/google';\nexport const x = Inter;",
    { rule: RESTRICTED, severity: 2 },
  ],
  [
    'src/views/home/Demo.tsx',
    "import { allProjects } from 'content-collections';\nexport const x = allProjects;",
    { rule: RESTRICTED, severity: 2 },
  ],
  [
    'src/lib/content/index.ts',
    "import { allProjects } from 'content-collections';\nexport const x = allProjects;",
    { none: RESTRICTED },
  ],
  [
    'src/i18n/format.ts',
    "import { SITE_URL } from '@/i18n/config';\nexport const x = SITE_URL;",
    { rule: RESTRICTED, severity: 2 },
  ],
  [
    'src/components/ui/Demo.tsx',
    "export const x = 'a'.toUpperCase();",
    { rule: 'no-restricted-properties', severity: 1 },
  ],
  [
    'src/components/ui/Demo.tsx',
    'export const X = () => <div tabIndex={2}>x</div>;',
    { rule: 'jsx-a11y/tabindex-no-positive', severity: 2 },
  ],
];

describe('SB1–SB10 import boundaries (§8.2)', () => {
  let eslint: ESLint;
  beforeAll(() => {
    eslint = new ESLint({ cwd: process.cwd() });
  });

  it('has the 19 rows of the §8.2.4 table', () => {
    expect(CASES).toHaveLength(19);
  });

  it.each(CASES)(
    '%s: %s',
    async (filePath, code, expected) => {
      const [result] = await eslint.lintText(code, { filePath });
      const messages = result?.messages ?? [];
      if ('none' in expected) {
        expect(messages.filter((m) => m.ruleId === expected.none)).toEqual([]);
      } else {
        const hits = messages.filter((m) => m.ruleId === expected.rule);
        expect(hits.length, JSON.stringify(messages)).toBeGreaterThan(0);
        expect(hits.every((m) => m.severity === expected.severity)).toBe(true);
      }
    },
    60_000,
  );
});
