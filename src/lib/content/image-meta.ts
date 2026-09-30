// src/lib/content/image-meta.ts: YALNIZ build sırasında (content-collections.ts) çalışır.
import { stat } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import type { ImageRefInput } from './schemas';

export type ImageProbe = { width: number; height: number; bytes: number; dominant: string };
export type ImageAsset = ImageRefInput & ImageProbe;

const hex = (n: number) => n.toString(16).padStart(2, '0');
const fileOf = (src: string) => path.join(process.cwd(), 'public', src);

export async function bytesOf(src: string): Promise<number> {
  try {
    return (await stat(fileOf(src))).size;
  } catch {
    throw new Error(`Dosya bulunamadı: public${src}`);
  }
}

/** Boyut + baskın renk. Dosya yoksa fırlatır → `content-collections build` exit 1. */
export async function probeImage(src: string): Promise<ImageProbe> {
  const bytes = await bytesOf(src);
  const img = sharp(fileOf(src));
  const meta = await img.metadata();
  const { dominant } = await img.stats();
  return {
    width: meta.autoOrient.width, // EXIF yönü uygulanmış
    height: meta.autoOrient.height,
    bytes,
    dominant: `#${hex(dominant.r)}${hex(dominant.g)}${hex(dominant.b)}`,
  };
}

export async function imageMeta(ref: ImageRefInput): Promise<ImageAsset> {
  return { ...ref, ...(await probeImage(ref.src)) };
}

/** MDX gövdesindeki src="/media/…" değerleri (<Figure>). Video yok (D-48): görsel olmayan dosya sharp'ta düşer. */
const MDX_MEDIA_ATTR = /\bsrc="(\/media\/[^"]+)"/g;

export async function mdxMedia(content: string): Promise<Record<string, ImageProbe>> {
  const out: Record<string, ImageProbe> = {};
  for (const [, src] of content.matchAll(MDX_MEDIA_ATTR)) {
    if (!src || out[src]) continue;
    out[src] = await probeImage(src);
  }
  return out;
}
