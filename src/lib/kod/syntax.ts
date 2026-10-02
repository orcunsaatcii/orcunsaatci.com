// src/lib/kod/syntax.ts — KOD Dart sözdizimi boyama (§4 KOD): dize = vurgu, adlandırılmış parametre = pirinç,
// anahtar sözcük ve yorum = soluk, kalanı mürekkep. Boşluk yazılmaz (zemin görünür kalır).
import { ROLE, Screen, textLen, type Role } from './screen';

export type Token = readonly [text: string, role: Role, alpha: number];

const KW = new Set([
  'import',
  'void',
  'class',
  'extends',
  'const',
  'return',
  'super',
  'final',
  'true',
  'false',
]);

export function tokenize(src: string): Token[] {
  const out: Token[] = [];
  const re =
    /(\/\/.*$)|('(?:[^'\\]|\\.)*')|(@\w+)|([A-Za-z_]\w*)(?=\s*:(?!:))|([A-Za-z_]\w*)|(\s+)|(\d+(?:\.\d+)?)|(.)/gu;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    if (m[1]) out.push([m[1], ROLE.subtle, 1]);
    else if (m[2]) out.push([m[2], ROLE.accent, 1]);
    else if (m[3]) out.push([m[3], ROLE.muted, 1]);
    else if (m[4]) out.push([m[4], ROLE.brass, 1]);
    else if (m[5])
      out.push([
        m[5],
        KW.has(m[5]) ? ROLE.muted : ROLE.ink,
        KW.has(m[5]) || /^[A-Z]/.test(m[5]) ? 1 : 0.8,
      ]);
    else if (m[6]) out.push([m[6], ROLE.ink, 0]);
    else if (m[7])
      out.push([m[7], ROLE.ink, 1]); // sayı (since: 2023) tam opak
    else if (m[8]) out.push([m[8], ROLE.muted, 0.9]);
  }
  return out;
}

/** Jetonları yazar; saydamlığı 0 olan (boşluk) atlanır. Sonraki sütunu döner. */
export function writeTokens(
  s: Screen,
  x: number,
  y: number,
  toks: readonly Token[],
  aMul = 1,
  fx = 0,
): number {
  let cx = x;
  for (const [txt, role, a] of toks)
    cx = a > 0 ? s.put(cx, y, txt, role, a * aMul, fx) : cx + textLen(txt);
  return cx;
}
