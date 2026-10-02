#!/usr/bin/env sh
# scripts/subset-fonts.sh — tek seferlik font hattı (product.md §6.2.3). Çıktılar commit edilir.
# Gereksinim: Python 3 + fonttools 4.60.2 + brotli   →   python3 -m pip install 'fonttools==4.60.2' brotli
# Kullanım:  npm run fonts          (başka yorumlayıcı: PYTHON=/yol/python3 npm run fonts)
set -eu
PYTHON=${PYTHON:-python3}
SRC=assets/fonts/src
OUT_WEB=src/fonts
OUT_TTF=assets/fonts/ttf
"$PYTHON" -c "import fontTools, brotli" 2>/dev/null || {
  echo "fontTools/brotli yok: $PYTHON -m pip install 'fonttools==4.60.2' brotli" >&2; exit 1; }
mkdir -p "$OUT_WEB" "$OUT_TTF"
TMP=$(mktemp -d)
trap 'rm -rf "${TMP:?}"' EXIT INT TERM

# Web kümesi (M8): ASCII + Türkçe + Batı dillerinin yaygın aksanlı harfleri + sitenin kullandığı noktalama, ok ve
# simgeler. Latin-1'in kullanılmayan simgeleri ve U+2000-206F bloğunun geri kalanı çıkarıldı (kerning sınıfları küçülür).
# İçerikte kümede olmayan karakter `check-content` uyarısıyla bildirilir (src/fonts/coverage.json).
U_WEB="U+0020-007E,U+00A0,U+00A7,U+00A9,U+00AB,U+00AD,U+00B7,U+00BB,U+00D7,U+00DF,U+00C0-00C2,U+00C4,U+00C7-00CF,U+00D1-00D4,U+00D6,U+00D9-00DC,U+00E0-00E2,U+00E4,U+00E7-00EF,U+00F1-00F4,U+00F6,U+00F9-00FC,U+011E-011F,U+0130-0131,U+015E-015F,U+0307,U+2013-2014,U+2018-201E,U+2022,U+2026,U+2039-203A,U+2060,U+20AC,U+20BA,U+2122,U+2190-2199,U+2212,U+2248,U+2260,U+2264-2265,U+2713,U+FEFF,U+FFFD"
# OpenType özellikleri (M8): yalnız sitenin kullandıkları. kern korunur (§6.2.3); ss02, ss04–08, frac, sups, aalt… çıkar.
F_MONA='kern,mark,locl,ccmp,case,ss01,ss03,tnum,liga'
F_MARTIAN='mark,locl,ccmp,case,rvrn'
U_TTF="U+0020-007E,U+00A0-00FF,U+0130-0131,U+011E-011F,U+015E-015F,U+2013-2014,U+2018-201D,U+2022,U+2026,U+2192,U+20AC,U+20BA"

# 1) Web WOFF2: eksenleri kullanılan aralığa kırp (min:default:max; Mona ağırlığı koyu temadaki 380 ile --font-weight-heavy 760 arası)
"$PYTHON" -m fontTools.varLib.instancer "$SRC/MonaSans[wdth,wght].ttf"    wght=380:400:760 wdth=100:100:125 -q -o "$TMP/MonaSans-trim.ttf"
"$PYTHON" -m fontTools.varLib.instancer "$SRC/MartianMono[wdth,wght].ttf" wght=400:400:500 wdth=87.5:100:100 -q -o "$TMP/MartianMono-trim.ttf"
"$PYTHON" -m fontTools.subset "$TMP/MonaSans-trim.ttf"    --unicodes="$U_WEB" --layout-features="$F_MONA"    --flavor=woff2 --output-file="$OUT_WEB/MonaSans-trim.woff2"
"$PYTHON" -m fontTools.subset "$TMP/MartianMono-trim.ttf" --unicodes="$U_WEB" --layout-features="$F_MARTIAN" --flavor=woff2 --output-file="$OUT_WEB/MartianMono-trim.woff2"

# 2) Statik TTF (OG görselleri + CV PDF): tüm eksenler sabit, liga YOK
"$PYTHON" -m fontTools.varLib.instancer "$SRC/MonaSans[wdth,wght].ttf"    wdth=125 wght=760 -q -o "$TMP/MonaSans-WideBold.ttf"
"$PYTHON" -m fontTools.varLib.instancer "$SRC/MonaSans[wdth,wght].ttf"    wdth=100 wght=450 -q -o "$TMP/MonaSans-Text.ttf"
"$PYTHON" -m fontTools.varLib.instancer "$SRC/MonaSans[wdth,wght].ttf"    wdth=100 wght=620 -q -o "$TMP/MonaSans-TextSemibold.ttf"
"$PYTHON" -m fontTools.varLib.instancer "$SRC/MartianMono[wdth,wght].ttf" wdth=100 wght=400 -q -o "$TMP/MartianMono-Regular.ttf"
for f in MonaSans-WideBold MonaSans-Text MonaSans-TextSemibold; do
  "$PYTHON" -m fontTools.subset "$TMP/$f.ttf" --unicodes="$U_TTF" --layout-features='kern,locl,tnum,ss01' --output-file="$OUT_TTF/$f.ttf"
done
"$PYTHON" -m fontTools.subset "$TMP/MartianMono-Regular.ttf" --unicodes="$U_TTF" --layout-features='kern,locl' --output-file="$OUT_TTF/MartianMono-Regular.ttf"

# 3) Doğrulama: Türkçe glifler, korunan özellikler (Mona'da kern), locl TRK, eksen aralıkları, statik TTF'te liga yok
"$PYTHON" - <<'PY'
import sys
from fontTools.ttLib import TTFont
TR = "çÇğĞıİöÖşŞüÜâÂîÎûÛ"
def feats(f):
    return {r.FeatureTag for r in f["GSUB"].table.FeatureList.FeatureRecord} if "GSUB" in f else set()
def langs(f):
    return {l.LangSysTag.strip() for s in f["GSUB"].table.ScriptList.ScriptRecord for l in s.Script.LangSysRecord}
checks = [
    ("src/fonts/MonaSans-trim.woff2",    {"ss01", "ss03", "case", "locl", "tnum"}, {"wdth": (100, 125), "wght": (380, 760)}),
    ("src/fonts/MartianMono-trim.woff2", {"case", "locl"},                         {"wdth": (87.5, 100), "wght": (400, 500)}),
    ("assets/fonts/ttf/MonaSans-WideBold.ttf",     {"locl"}, None),
    ("assets/fonts/ttf/MonaSans-Text.ttf",         {"locl"}, None),
    ("assets/fonts/ttf/MonaSans-TextSemibold.ttf", {"locl"}, None),
    ("assets/fonts/ttf/MartianMono-Regular.ttf",   {"locl"}, None),
]
errors = []
for path, need, axes in checks:
    f = TTFont(path); cmap = f.getBestCmap(); fs = feats(f)
    missing = [c for c in TR if ord(c) not in cmap]
    if missing: errors.append(f"{path}: eksik Türkçe glif {missing}")
    if not need <= fs: errors.append(f"{path}: eksik özellik {sorted(need - fs)}")
    if "TRK" not in langs(f): errors.append(f"{path}: locl TRK dil sistemi yok")
    if axes is None:
        if "liga" in fs: errors.append(f"{path}: statik TTF'te liga kalmış")
        if "fvar" in f: errors.append(f"{path}: statik olmalı (fvar var)")
    else:
        got = {a.axisTag: (a.minValue, a.maxValue) for a in f["fvar"].axes}
        if got != axes: errors.append(f"{path}: eksen aralığı {got} != {axes}")
mona = TTFont("src/fonts/MonaSans-trim.woff2")
if "GPOS" not in mona or "kern" not in {r.FeatureTag for r in mona["GPOS"].table.FeatureList.FeatureRecord}:
    errors.append("src/fonts/MonaSans-trim.woff2: kern yok (§6.2.3 kerning korunur)")
if errors:
    print("\n".join(errors), file=sys.stderr); sys.exit(1)
# 4) Kapsam listesi: check-content içerikte web fontlarında olmayan karakteri bununla bildirir
import json
cov = {k: sorted(TTFont(f"src/fonts/{n}-trim.woff2").getBestCmap()) for k, n in (("mona", "MonaSans"), ("martian", "MartianMono"))}
with open("src/fonts/coverage.json", "w") as out:
    json.dump(cov, out, separators=(",", ":")); out.write("\n")
print("fontlar OK")
PY
ls -l "$OUT_WEB"/*.woff2 "$OUT_TTF"/*.ttf
