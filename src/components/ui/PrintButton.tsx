'use client';
// src/components/ui/PrintButton.tsx — /cv "Yazdır" (§7.6.2): window.print(). JS yoksa gizlidir.
import { Button } from './Button';

export function PrintButton({ label }: { label: string }) {
  return (
    <span className="hidden js:contents">
      <Button variant="secondary" size="sm" onClick={() => window.print()}>
        {label}
      </Button>
    </span>
  );
}
