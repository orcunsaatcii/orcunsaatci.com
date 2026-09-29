// src/app/robots.ts — M0 geçici hâli (§15.0.6): her ortamda Disallow: /.
// M3'te §11.4.3'teki ortam kapılı dosyayla birebir değiştirilir.
import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: '*', disallow: '/' }] };
}
