// src/components/ui/EmailLink.tsx — görünür mailto: bağlantısı (§12.1.1). Metin adresin kendisidir; gizleme YASAK.
// size="display": iletişim bölümündeki büyük e-posta (type-email §6.2.4); yerel kısım ile @ arasında <wbr />.
// display'de data-arc-pulse: hover/odakta açık yay nabzı (§4.14 #8, ScenePreviews) ve manyetik etiket (≤ 6 px).
import { Magnetic } from '@/components/motion/Magnetic';

export function EmailLink({
  email,
  id,
  size = 'inline',
  className,
}: {
  email: string;
  id?: string;
  size?: 'inline' | 'display';
  className?: string;
}) {
  const at = email.indexOf('@');
  const text =
    at > 0 ? (
      <>
        {email.slice(0, at)}
        <wbr />
        {email.slice(at)}
      </>
    ) : (
      email
    );
  const display =
    'text-4xl leading-[1.1] tracking-[-0.02em] font-semibold [font-stretch:100%] [overflow-wrap:anywhere] md:[font-stretch:118%]';
  return (
    <a
      id={id}
      href={`mailto:${email}`}
      translate="no"
      data-arc-pulse={size === 'display' ? '' : undefined}
      className={[size === 'display' ? `${display} link-inline` : 'link-inline', className]
        .filter(Boolean)
        .join(' ')}
    >
      {size === 'display' ? <Magnetic max={6}>{text}</Magnetic> : text}
    </a>
  );
}
