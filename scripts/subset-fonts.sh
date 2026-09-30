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

# Latin-1 + Türkçe + noktalama/oklar/₺ (web);  OG/PDF için daha dar küme
U_WEB="U+0000-00FF,U+0130-0131,U+011E-011F,U+015E-015F,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0300-0308,U+0327,U+2000-206F,U+20AC,U+20BA,U+2122,U+2190-2199,U+2212,U+2215,U+FEFF,U+FFFD"
U_TTF="U+0020-007E,U+00A0-00FF,U+0130-0131,U+011E-011F,U+015E-015F,U+2013-2014,U+2018-201D,U+2022,U+2026,U+2192,U+20AC,U+20BA"

# 1) Web WOFF2: eksenleri kullanılan aralığa kırp (min:default:max), TÜM OpenType özelliklerini koru
"$PYTHON" -m fontTools.varLib.instancer "$SRC/MonaSans[wdth,wght].ttf"    wght=350:400:800 wdth=100:100:125 -q -o "$TMP/MonaSans-trim.ttf"
"$PYTHON" -m fontTools.varLib.instancer "$SRC/MartianMono[wdth,wght].ttf" wght=400:400:500 wdth=87.5:100:100 -q -o "$TMP/MartianMono-trim.ttf"
"$PYTHON" -m fontTools.subset "$TMP/MonaSans-trim.ttf"    --unicodes="$U_WEB" --layout-features='*' --flavor=woff2 --output-file="$OUT_WEB/MonaSans-trim.woff2"
"$PYTHON" -m fontTools.subset "$TMP/MartianMono-trim.ttf" --unicodes="$U_WEB" --layout-features='*' --flavor=woff2 --output-file="$OUT_WEB/MartianMono-trim.woff2"

# 2) Statik TTF (OG görselleri + CV PDF): tüm eksenler sabit, liga YOK
"$PYTHON" -m fontTools.varLib.instancer "$SRC/MonaSans[wdth,wght].ttf"    wdth=125 wght=760 -q -o "$TMP/MonaSans-WideBold.ttf"
"$PYTHON" -m fontTools.varLib.instancer "$SRC/MonaSans[wdth,wght].ttf"    wdth=100 wght=450 -q -o "$TMP/MonaSans-Text.ttf"
"$PYTHON" -m fontTools.varLib.instancer "$SRC/MonaSans[wdth,wght].ttf"    wdth=100 wght=620 -q -o "$TMP/MonaSans-TextSemibold.ttf"
"$PYTHON" -m fontTools.varLib.instancer "$SRC/MartianMono[wdth,wght].ttf" wdth=100 wght=400 -q -o "$TMP/MartianMono-Regular.ttf"
for f in MonaSans-WideBold MonaSans-Text MonaSans-TextSemibold; do
  "$PYTHON" -m fontTools.subset "$TMP/$f.ttf" --unicodes="$U_TTF" --layout-features='kern,locl,tnum,ss01' --output-file="$OUT_TTF/$f.ttf"
done
"$PYTHON" -m fontTools.subset "$TMP/MartianMono-Regular.ttf" --unicodes="$U_TTF" --layout-features='kern,locl' --output-file="$OUT_TTF/MartianMono-Regular.ttf"

# 3) Doğrulama: Türkçe glifler, korunan özellikler, locl TRK, eksen aralıkları, statik TTF'te liga yok
"$PYTHON" - <<'PY'
import sys
from fontTools.ttLib import TTFont
TR = "çÇğĞıİöÖşŞüÜâÂîÎûÛ"
def feats(f):
    return {r.FeatureTag for r in f["GSUB"].table.FeatureList.FeatureRecord} if "GSUB" in f else set()
def langs(f):
    return {l.LangSysTag.strip() for s in f["GSUB"].table.ScriptList.ScriptRecord for l in s.Script.LangSysRecord}
checks = [
    ("src/fonts/MonaSans-trim.woff2",    {"ss01", "ss03", "case", "locl", "tnum"}, {"wdth": (100, 125), "wght": (350, 800)}),
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
if errors:
    print("\n".join(errors), file=sys.stderr); sys.exit(1)
print("fontlar OK")
PY
ls -l "$OUT_WEB"/*.woff2 "$OUT_TTF"/*.ttf
