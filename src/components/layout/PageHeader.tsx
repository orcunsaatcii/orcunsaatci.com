// src/components/layout/PageHeader.tsx — derin sayfa baş bloğu: breadcrumb, H1, giriş (okuma modu, §4.13).
// İsteğe bağlı page-folio çapası (§4.13.2, §4.5.6): masaüstünde sağ sütunda k8–12 (panel ≥ 360 px; compact'ta yükseklik
// başlık bloğunu izler, en az 19.5rem: max(100%, 19.5rem)), < 64rem'de başlık bloğunun altında 7 : 6 tam genişlik bant
// (en çok 42 svh, §4.13.5). İçinde sayfanın KOD paneli (§4 KOD).
// Server.
import type { ReactNode } from 'react';
import type { Locale, PageRef } from '@/i18n/config';
import { StageAnchor } from '@/stage/StageAnchor';
import { PAGE_FOLIO_SIZE } from '@/stage/anchors';
import { Breadcrumbs } from './Breadcrumbs';

interface PageHeaderProps {
  pageRef: PageRef;
  locale: Locale;
  title: ReactNode;
  /** proje / alan sayfalarında breadcrumb'ın son öğesi */
  crumbTitle?: string;
  titleLang?: string;
  lede?: ReactNode;
  folio?: {
    preset: keyof typeof PAGE_FOLIO_SIZE;
    /** başlığı kısa sayfalar (/projeler, alan sayfası): kare yerine başlık bloğunun yüksekliği (en az 19.5rem) */
    compact?: boolean;
    /** KOD statik paneli (canlı panel hazır olunca söner, §4 KOD) */
    figure?: ReactNode;
  };
  children?: ReactNode;
}

export function PageHeader({
  pageRef,
  locale,
  title,
  crumbTitle,
  titleLang,
  lede,
  folio,
  children,
}: PageHeaderProps) {
  return (
    <header className="container-page grid-page gap-y-6 pt-block">
      <div className="col-span-4 md:col-span-8 lg:col-span-7">
        <Breadcrumbs pageRef={pageRef} locale={locale} title={crumbTitle} />
        <h1 lang={titleLang} className="mt-stack type-h1 [overflow-wrap:anywhere]">
          {title}
        </h1>
        {lede ? <p className="mt-stack type-lead">{lede}</p> : null}
        {children}
      </div>
      {folio ? (
        <StageAnchor
          id="page-folio"
          size={PAGE_FOLIO_SIZE[folio.preset]}
          className={[
            'col-span-4 aspect-[7/6] max-h-[42svh] w-full md:col-span-8 lg:col-span-5 lg:col-start-8 lg:max-h-none',
            // yükseklik açıkça verilir: yalnız min-height'tan gelen boyutta container query birimleri 0 çözülüyor
            folio.compact ? 'lg:aspect-auto lg:h-[max(100%,19.5rem)]' : 'lg:aspect-square',
          ].join(' ')}
        >
          {folio.figure}
        </StageAnchor>
      ) : null}
    </header>
  );
}
