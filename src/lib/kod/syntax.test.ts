// src/lib/kod/syntax.test.ts — KOD Dart sözdizimi boyama ve jeton yazımı (§5.20.2, §13.2.2).
import { describe, expect, it } from 'vitest';
import { GLYPHS, ROLE, Screen } from './screen';
import { tokenize, writeTokens, type Token } from './syntax';

/** Boşluk jetonları (saydamlık 0) dışarıda: [metin, rol, saydamlık] */
const visible = (toks: Token[]) => toks.filter(([, , a]) => a > 0);

describe('tokenize (§5.20.2, §4.1.3)', () => {
  it('temsilî Dart satırları: yorum subtle, dize accent, @annotation muted, adlandırılmış parametre brass, anahtar sözcük muted, kalanı ink', () => {
    expect(visible(tokenize("import 'package:flutter/material.dart';"))).toEqual([
      ['import', ROLE.muted, 1],
      ["'package:flutter/material.dart'", ROLE.accent, 1],
      [';', ROLE.muted, 0.9],
    ]);
    expect(visible(tokenize('  @override'))).toEqual([['@override', ROLE.muted, 1]]);
    expect(visible(tokenize("      city: 'İzmir',"))).toEqual([
      ['city', ROLE.brass, 1],
      [':', ROLE.muted, 0.9],
      ["'İzmir'", ROLE.accent, 1],
      [',', ROLE.muted, 0.9],
    ]);
    expect(visible(tokenize('    return const Profile(build);'))).toEqual([
      ['return', ROLE.muted, 1],
      ['const', ROLE.muted, 1],
      ['Profile', ROLE.ink, 1], // tür adı: tam opak
      ['(', ROLE.muted, 0.9],
      ['build', ROLE.ink, 0.8], // küçük harfli ad: hafif soluk
      [')', ROLE.muted, 0.9],
      [';', ROLE.muted, 0.9],
    ]);
    expect(visible(tokenize('const ada = Developer( // Hakkımda: not'))).toEqual([
      ['const', ROLE.muted, 1],
      ['ada', ROLE.ink, 0.8],
      ['=', ROLE.muted, 0.9],
      ['Developer', ROLE.ink, 1],
      ['(', ROLE.muted, 0.9],
      ['// Hakkımda: not', ROLE.subtle, 1], // yorum satır sonuna dek tek jeton
    ]);
  });

  it('kaçışlı tırnaklı dize tek jetondur; "::" adlandırılmış parametre değildir', () => {
    expect(visible(tokenize("Text('O\\'Brien')"))).toEqual([
      ['Text', ROLE.ink, 1],
      ['(', ROLE.muted, 0.9],
      ["'O\\'Brien'", ROLE.accent, 1],
      [')', ROLE.muted, 0.9],
    ]);
    expect(visible(tokenize('a::b'))[0]).toEqual(['a', ROLE.ink, 0.8]);
    expect(visible(tokenize('super.key'))[0]).toEqual(['super', ROLE.muted, 1]);
  });

  it('boşluklar saydamlığı 0 olan ink jetonudur; jetonlar kaynağı kayıpsız böler', () => {
    const lines = [
      "import 'package:flutter/material.dart';",
      'void main() => runApp(const Portfolio());',
      '  Widget build(BuildContext context) {',
      "      child: Text('Orçun Saatçi · ₺'),",
      "    'Flutter', 'Dart', 'Kotlin',",
      '  since: 2015,',
      '// yorum   ',
      '',
    ];
    for (const l of lines) {
      const toks = tokenize(l);
      expect(toks.map(([t]) => t).join('')).toBe(l);
      for (const [t, role, a] of toks)
        if (/^\s+$/u.test(t)) expect([role, a]).toEqual([ROLE.ink, 0]);
    }
  });
});

describe('writeTokens (§5.20.2)', () => {
  const at = (s: Screen, x: number, y: number) => y * s.cols + x;

  it('boşluk yazmaz (hücre boş kalır), jetonları rolüyle yazar ve sonraki sütunu döner', () => {
    const s = new Screen();
    const line = "      city: 'İzmir',";
    expect(writeTokens(s, 5, 1, tokenize(line))).toBe(5 + [...line].length);
    for (let x = 5; x < 11; x++) expect([s.g[at(s, x, 1)], s.fa[at(s, x, 1)]]).toEqual([0, 0]);
    expect([GLYPHS[s.g[at(s, 11, 1)] ?? 0], s.fr[at(s, 11, 1)], s.fa[at(s, 11, 1)]]).toEqual([
      'c',
      ROLE.brass,
      1,
    ]);
    expect(s.fr[at(s, 15, 1)]).toBe(ROLE.muted); // ':'
    expect(s.fa[at(s, 16, 1)]).toBe(0); // ':' sonrası boşluk
    expect([GLYPHS[s.g[at(s, 18, 1)] ?? 0], s.fr[at(s, 18, 1)]]).toEqual(['İ', ROLE.accent]);
  });

  it('boşluğun altındaki mevcut hücre korunur (zemin görünür kalır)', () => {
    const s = new Screen();
    s.put(6, 0, 'X', ROLE.brass, 1);
    s.bg(6, 0, 6, 0, ROLE.accent, 0.5);
    writeTokens(s, 5, 0, tokenize('a b'));
    expect([GLYPHS[s.g[at(s, 6, 0)] ?? 0], s.fr[at(s, 6, 0)], s.ba[at(s, 6, 0)]]).toEqual([
      'X',
      ROLE.brass,
      0.5,
    ]);
  });

  it('aMul saydamlığı çarpar, fx yazılan hücrelere geçer; kırpılsa da dönüş sütunu doğrudur', () => {
    const s = new Screen();
    const next = writeTokens(s, 50, 2, tokenize("name: 'Ada Lovelace'"), 0.5, 1);
    expect(next).toBe(50 + 20);
    expect([s.fr[at(s, 50, 2)], s.fa[at(s, 50, 2)], s.fx[at(s, 50, 2)]]).toEqual([
      ROLE.brass,
      0.5,
      1,
    ]);
    expect(s.fa[at(s, 54, 2)]).toBeCloseTo(0.45, 6); // ':' 0.9 × 0.5
    expect(s.fx[at(s, 55, 2)]).toBe(0); // boşluk yazılmadı
    expect(s.g[at(s, 0, 3)]).toBe(0); // alt satıra taşmaz
  });
});
