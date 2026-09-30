// src/components/ui/Button.tsx — primary / secondary / text / icon (§6.6.3). Server uyumlu.
// href varsa <Link> (iç) ya da <a> (dış / indirme), yoksa <button type="button">. Durumlar §6.6.1.
import type { Route } from 'next';
import Link from 'next/link';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'text' | 'icon';

// Basışta ölçek --dur-instant'la iner, bırakınca renkle aynı sürede döner (§6.6.1 active)
const BASE =
  'type-ui inline-flex items-center justify-center gap-2 font-medium transition-[color,background-color,border-color,scale] duration-(--dur-base) ease-standard';
const PRESS = 'active:scale-[0.98] active:duration-(--dur-instant)';

const SHAPE: Record<ButtonVariant, { md: string; sm: string }> = {
  primary: { md: 'min-h-12 rounded-pill px-6', sm: 'min-h-11 rounded-pill px-6' },
  secondary: { md: 'min-h-12 rounded-pill border px-6', sm: 'min-h-11 rounded-pill border px-6' },
  text: { md: 'min-h-11 px-1', sm: 'min-h-11 px-1' },
  icon: { md: 'size-11 rounded-pill', sm: 'size-11 rounded-pill' },
};

const ENABLED: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-on-accent hover:bg-accent-hover',
  // kenarlık dıştaki canvas'a karşı ≥ 3:1 kalır (§6.6.3)
  secondary: 'border-line-strong text-ink hover:bg-raised',
  text: 'text-accent hover:text-accent-hover',
  icon: 'text-ink hover:bg-raised',
};

// disabled: aria-disabled, text-ink-disabled, border-line, hover yok (§6.6.1)
const DISABLED: Record<ButtonVariant, string> = {
  primary: 'border border-line text-ink-disabled',
  secondary: 'border-line text-ink-disabled',
  text: 'text-ink-disabled',
  icon: 'text-ink-disabled',
};

interface CommonProps {
  variant?: ButtonVariant;
  size?: 'md' | 'sm';
  className?: string;
  children: ReactNode;
}

interface InternalLinkProps extends CommonProps {
  href: Route;
  external?: undefined;
  download?: undefined;
  hrefLang?: string;
}
interface ExternalLinkProps extends CommonProps {
  /** dış site veya mailto: — <a>, aynı sekme */
  href: string;
  external: true;
  download?: undefined;
  hrefLang?: string;
}
interface DownloadLinkProps extends CommonProps {
  /** build'de üretilen dosya (fileRoutes) — <a download> */
  href: string;
  download: true;
  external?: undefined;
  hrefLang?: string;
}
interface NativeButtonProps
  extends
    CommonProps,
    Omit<ComponentPropsWithoutRef<'button'>, 'className' | 'children' | 'disabled'> {
  href?: undefined;
  /** 16 px döndürücü + etiket, aria-busy (§6.6.1); azaltılmış harekette döndürücü durur (taban kural) */
  loading?: boolean;
}

export type ButtonProps =
  InternalLinkProps | ExternalLinkProps | DownloadLinkProps | NativeButtonProps;

function cx(...parts: (string | false | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

function Spinner() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="16"
      height="16"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className="shrink-0 motion-on:animate-spin"
    >
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeOpacity="0.3" strokeWidth="1.5" />
      <path
        d="M8 1.5A6.5 6.5 0 0 1 14.5 8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Button(props: ButtonProps) {
  if (props.href !== undefined) {
    const { variant = 'primary', size = 'md', className, children, href, hrefLang } = props;
    const cls = cx(BASE, PRESS, SHAPE[variant][size], ENABLED[variant], className);
    if (props.external || props.download) {
      return (
        <a
          href={href}
          className={cls}
          hrefLang={hrefLang}
          download={props.download || undefined}
          rel={props.external ? 'noopener noreferrer' : undefined}
        >
          {children}
        </a>
      );
    }
    return (
      <Link href={props.href} className={cls} hrefLang={hrefLang}>
        {children}
      </Link>
    );
  }

  const {
    variant = 'primary',
    size = 'md',
    className,
    children,
    loading,
    onClick,
    ...rest
  } = props;
  const disabled = rest['aria-disabled'] === true || rest['aria-disabled'] === 'true';
  const inert = disabled || loading;
  return (
    <button
      type="button"
      {...rest}
      aria-busy={loading || undefined}
      onClick={inert ? undefined : onClick}
      className={cx(
        BASE,
        !inert && PRESS,
        SHAPE[variant][size],
        disabled ? DISABLED[variant] : ENABLED[variant],
        className,
      )}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}
