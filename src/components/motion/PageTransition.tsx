// src/components/motion/PageTransition.tsx — sayfa içeriği view transition sarmalayıcısı (§5.15.1, D-32). Server.
// Her page.tsx içeriğini sarar, layout'u değil (layout kalıcıdır; enter/exit orada tetiklenmez). Türlü gezinmede
// (nav-forward / nav-back) eski sayfa 150 ms söner, yeni sayfa 150 ms gecikmeyle 210 ms'de girer (opaklık + 16 px);
// tipsiz geçişte (tarayıcı geri/ileri) yalnız opaklık ([SABİT] #13). Sınıflar globals.css §8'dedir.
import { ViewTransition, type ReactNode } from 'react';

const ENTER = { 'nav-forward': 'page-in', 'nav-back': 'page-in', default: 'page-fade-in' } as const;
const EXIT = {
  'nav-forward': 'page-out',
  'nav-back': 'page-out',
  default: 'page-fade-out',
} as const;

export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <ViewTransition enter={ENTER} exit={EXIT} default="none">
      {children}
    </ViewTransition>
  );
}
