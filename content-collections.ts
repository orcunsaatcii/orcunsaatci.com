// content-collections.ts — M0/M2 geçici iskeleti. M3'te §7.3.4'teki dosyayla birebir değiştirilir.
import { defineConfig, defineSingleton } from '@content-collections/core';
import { z } from 'zod';

const site = defineSingleton({
  name: 'site',
  filePath: 'content/site/site.yaml',
  parser: 'yaml',
  schema: z.object({ locales: z.array(z.enum(['tr', 'en'])).min(1) }),
});

// M2: header markası, footer © satırı ve 404 başlığı için yalnız ad (§3.8, §3.9). Tam şema M3'te (§7.3).
const person = defineSingleton({
  name: 'person',
  filePath: 'content/site/person.yaml',
  parser: 'yaml',
  schema: z.object({ name: z.string().min(1) }),
});

export default defineConfig({ content: [site, person] });
