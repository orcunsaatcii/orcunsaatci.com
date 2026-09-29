// content-collections.ts — M0 geçici iskeleti. M3'te §7.3.4'teki dosyayla birebir değiştirilir.
import { defineConfig, defineSingleton } from '@content-collections/core';
import { z } from 'zod';

const site = defineSingleton({
  name: 'site',
  filePath: 'content/site/site.yaml',
  parser: 'yaml',
  schema: z.object({ locales: z.array(z.enum(['tr', 'en'])).min(1) }),
});

export default defineConfig({ content: [site] });
