// src/components/ui/TextLink.tsx — inline / nav / external / download (§6.6.3). Server uyumlu.
// inline hep altı çizili (link-inline); external sonda satır içi ↗ SVG taşır ve aynı sekmede açılır.
import type { Route } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';

interface CommonProps {
  className?: string;
  hrefLang?: string;
  lang?: string;
  children: ReactNode;
}

interface InternalProps extends CommonProps {
  variant?: 'inline' | 'nav';
  href: Route;
}
interface ExternalProps extends CommonProps {
  variant: 'external';
  href: string;
  /** Yalnız §4/§7'nin açıkça istediği yerde: yeni sekme + görsel olarak gizli ek (dict.a11y.newTab) */
  newTabLabel?: string;
}
interface DownloadProps extends CommonProps {
  variant: 'download';
  href: string;
}

export type TextLinkProps = InternalProps | ExternalProps | DownloadProps;

/** ↗ (U+2197) iki fontta da yok: satır içi SVG (§6.2.7) */
function ExternalIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="0.75em"
      height="0.75em"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
      focusable="false"
      className="ml-1 inline-block align-baseline"
    >
      <path d="M7 17 17 7M9 7h8v8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function TextLink(props: TextLinkProps) {
  const { className, hrefLang, lang, children } = props;
  const cls = [props.variant === 'nav' ? 'link-nav' : 'link-inline', className]
    .filter(Boolean)
    .join(' ');
  if (props.variant === 'external') {
    const newTab = props.newTabLabel !== undefined;
    return (
      <a
        href={props.href}
        className={cls}
        hrefLang={hrefLang}
        lang={lang}
        rel="noopener noreferrer"
        target={newTab ? '_blank' : undefined}
      >
        {children}
        <ExternalIcon />
        {newTab && <span className="sr-only"> {props.newTabLabel}</span>}
      </a>
    );
  }
  if (props.variant === 'download') {
    return (
      <a href={props.href} className={cls} hrefLang={hrefLang} lang={lang} download>
        {children}
      </a>
    );
  }
  return (
    <Link href={props.href} className={cls} hrefLang={hrefLang} lang={lang}>
      {children}
    </Link>
  );
}
