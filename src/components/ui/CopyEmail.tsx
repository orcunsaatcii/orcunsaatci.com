'use client';
// src/components/ui/CopyEmail.tsx — "Kopyala" (§12.1.4, §6.6.3). JS yokken gizlidir (html.js).
// Başarı: etiket 2,000 ms "Kopyalandı" + ✓, toast. Hata (API yok / reddedildi): adres bağlantısının metni seçilir,
// yedek toast. Erişilebilir ad sabittir (contact.copyLabel); duyuru Toast ile yapılır. Sahne olayı M7'de.
import { useCallback, useEffect, useState } from 'react';
import { Button } from './Button';
import { Toast } from './Toast';

export const COPIED_MS = 2000;

export interface CopyEmailLabels {
  copy: string;
  copied: string;
  copyLabel: string;
  toast: string;
  copyFailed: string;
  close: string;
}

interface CopyEmailProps {
  email: string;
  /** mailto bağlantısının id'si: yedek yolda metni seçilir */
  targetId: string;
  labels: CopyEmailLabels;
  size?: 'md' | 'sm';
}

export function CopyEmail({ email, targetId, labels, size = 'sm' }: CopyEmailProps) {
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), COPIED_MS);
    return () => window.clearTimeout(t);
  }, [copied]);

  const onClick = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard API yok');
      await navigator.clipboard.writeText(email);
      setCopied(true);
      setMessage(labels.toast);
    } catch {
      const el = document.getElementById(targetId);
      const selection = window.getSelection();
      if (el && selection) selection.selectAllChildren(el);
      setMessage(labels.copyFailed);
    }
  };
  const close = useCallback(() => setMessage(null), []);

  return (
    <span className="hidden js:contents">
      <Button variant="secondary" size={size} aria-label={labels.copyLabel} onClick={onClick}>
        {copied ? labels.copied : labels.copy}
        {copied ? (
          <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            aria-hidden="true"
            focusable="false"
          >
            <path d="m5 12.5 4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : null}
      </Button>
      <Toast message={message} onClose={close} closeLabel={labels.close} />
    </span>
  );
}
