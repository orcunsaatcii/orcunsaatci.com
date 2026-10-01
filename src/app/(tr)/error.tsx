'use client';
// src/app/(tr)/error.tsx — istemci hata sınırı (§3.7, ÖNERİLİR). Next'in boş ekranı yerine ağacın dilinde başlık,
// "Tekrar dene" ve ana sayfa bağlantısı. Next 16.3 reset() yerine retry()'ı önerir (SPEC-SAPMA §3.7).
// Stage hataları buraya ulaşmaz (§5.17).
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { staticRoutes } from '@/i18n/config';
import { errorText } from '@/i18n/dictionaries/error-text';

const t = errorText.tr;

export default function ErrorBoundary({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <div className="container-page pt-block pb-section">
      <h1 className="type-h1">{t.title}</h1>
      <div className="mt-stack flex flex-wrap items-center gap-x-6 gap-y-3">
        <Button onClick={() => retry()}>{t.retry}</Button>
        <Link
          transitionTypes={['nav-forward']}
          href={staticRoutes.home.tr}
          className="inline-flex min-h-11 items-center link-inline type-ui"
        >
          {t.home}
        </Link>
      </div>
    </div>
  );
}
