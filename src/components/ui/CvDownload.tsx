// src/components/ui/CvDownload.tsx — CV PDF indirme bağlantısı (§7.6.6, §7.9.6). Server.
// Etikette biçim, sayfa ve boyut build'deki gerçek dosyadan; dosya yoksa (dev) yalnız "PDF".
import { fileRoutes, type Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n/get-dictionary';
import { fill, plural } from '@/i18n/text';
import { getCvFile } from '@/lib/content';

export function CvDownload({
  locale,
  label,
  className = 'link-inline type-ui',
}: {
  locale: Locale;
  label?: string;
  className?: string;
}) {
  const dict = getDictionary(locale);
  const file = getCvFile(locale);
  const meta = file
    ? fill(dict.cv.fileMeta, {
        pages: plural(locale, file.pages, dict.cv.pages),
        size: `${Math.ceil(file.bytes / 1024)} KB`,
      })
    : 'PDF';
  return (
    <a
      href={file?.href ?? fileRoutes.cvPdf[locale]}
      download
      type="application/pdf"
      className={className}
    >
      {label ?? dict.cv.download} <span className="type-meta">· {meta}</span>
    </a>
  );
}
