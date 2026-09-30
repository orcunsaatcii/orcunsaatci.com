// src/app/manifest.ts — /manifest.webmanifest (§11.2.5). PWA hedeflenmez.
// Renk etkin paletin koyu canvas'ıdır (tokens.ts); ad içerikten (§7.1 kural 1, §6.12 onaltılık renk taraması).
import type { MetadataRoute } from 'next';
import { themeColors } from '@/design/tokens';
import { getExperienceProfile } from '@/experience/profile';
import { getPerson, getSite } from '@/lib/content';

export default function manifest(): MetadataRoute.Manifest {
  const name = getPerson().name;
  const canvas = themeColors(getExperienceProfile(getSite().persona).palette, 'dark').canvas;
  return {
    name,
    short_name: name,
    start_url: '/',
    display: 'browser',
    lang: 'tr',
    dir: 'ltr',
    background_color: canvas,
    theme_color: canvas,
    icons: [
      { src: '/icon', sizes: '32x32', type: 'image/png' },
      { src: '/apple-icon', sizes: '180x180', type: 'image/png' },
    ],
  };
}
