// src/components/ui/SocialLinks.tsx — birincil sosyal profiller (primary, ≤ 4; §12.1.1). Server.
// Görünür metin ağ adı veya label; rel="me"; aynı sekmede açılır; ↗ satır içi SVG (TextLink external).
import type { Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n/get-dictionary';
import { getContact, t } from '@/lib/content';
import { TextLink } from './TextLink';

export function SocialLinks({
  locale,
  className,
  itemClassName,
  linkClassName,
}: {
  locale: Locale;
  className?: string;
  itemClassName?: string;
  linkClassName?: string;
}) {
  const dict = getDictionary(locale);
  const links = getContact().social.filter((s) => s.primary);
  if (links.length === 0) return null;
  return (
    <ul className={className}>
      {links.map((s) => {
        const label = s.label ? t(s.label, locale) : null;
        return (
          <li key={s.url} className={itemClassName}>
            <TextLink
              variant="external"
              href={s.url}
              rel="me"
              lang={label?.fallback ? 'tr' : undefined}
              className={linkClassName}
            >
              {label ? label.text : dict.social[s.network]}
            </TextLink>
          </li>
        );
      })}
    </ul>
  );
}
