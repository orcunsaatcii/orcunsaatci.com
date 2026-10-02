// src/fonts/index.ts — iki root layout'un da kullandığı TEK font tanımı
import localFont from 'next/font/local';

export const mona = localFont({
  src: './MonaSans-trim.woff2',
  variable: '--font-mona',
  weight: '380 760',
  style: 'normal',
  display: 'swap',
  preload: true,
  adjustFontFallback: 'Arial',
  declarations: [{ prop: 'font-stretch', value: '100% 125%' }],
});

export const martian = localFont({
  src: './MartianMono-trim.woff2',
  variable: '--font-martian',
  weight: '400 500',
  style: 'normal',
  display: 'swap',
  preload: true,
  adjustFontFallback: 'Arial',
  declarations: [{ prop: 'font-stretch', value: '87.5% 100%' }],
});

/** <html className={fontVariables}> — §8.4 */
export const fontVariables = `${mona.variable} ${martian.variable}`;
