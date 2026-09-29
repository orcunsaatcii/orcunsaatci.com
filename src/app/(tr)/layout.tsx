// src/app/(tr)/layout.tsx — M0 iskeleti (§2.2.9 madde 2). Tam hâli M2'de §8.4.4 ile değiştirilir.
import '../globals.css';

export const dynamic = 'error';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
