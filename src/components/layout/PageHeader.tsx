// src/components/layout/PageHeader.tsx — derin sayfa baş bloğu: breadcrumb, H1, giriş (okuma modu, §4.13).
// Sağ sütunda isteğe bağlı page-folio çapası (D4 about-page K1, D5 contact-page K5 posteri; §4.16.3). Server.
import type { ReactNode } from 'react';
import type { Locale, PageRef } from '@/i18n/config';
import { StageAnchor } from '@/stage/ScenePoster';
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
  folio?: { preset: keyof typeof PAGE_FOLIO_SIZE; poster?: 'k1' | 'k5' };
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
          poster={folio.poster}
          size={PAGE_FOLIO_SIZE[folio.preset]}
          className="col-span-4 aspect-square max-lg:hidden lg:col-span-5 lg:col-start-8"
        />
      ) : null}
    </header>
  );
}
