// src/lib/content/image-meta.test.ts — build zamanı görsel yoklaması (§7.3.3): boyut, bayt, baskın renk, MDX medya haritası.
// @vitest-environment node
import { mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { bytesOf, imageMeta, mdxMedia, probeImage } from './image-meta';

let root = '';
beforeAll(async () => {
  root = mkdtempSync(path.join(tmpdir(), 'image-meta-'));
  mkdirSync(path.join(root, 'public/media/test'), { recursive: true });
  const red = { r: 200, g: 30, b: 40 };
  await sharp({ create: { width: 40, height: 25, channels: 3, background: red } })
    .png()
    .toFile(path.join(root, 'public/media/test/a.png'));
});
beforeEach(() => void vi.spyOn(process, 'cwd').mockReturnValue(root)); // restoreMocks her testten önce sıfırlar

describe('image-meta', () => {
  it('probeImage: boyut, bayt ve #rrggbb baskın renk', async () => {
    const p = await probeImage('/media/test/a.png');
    expect(p).toMatchObject({ width: 40, height: 25 });
    expect(p.bytes).toBeGreaterThan(0);
    expect(p.dominant).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('imageMeta ref alanlarını korur; eksik dosya build hatasıdır', async () => {
    const ref = { src: '/media/test/a.png', alt: { tr: 'Kırmızı kutu' } };
    expect(await imageMeta(ref)).toMatchObject({ ...ref, width: 40, height: 25 });
    await expect(bytesOf('/media/test/yok.png')).rejects.toThrow(
      'Dosya bulunamadı: public/media/test/yok.png',
    );
  });

  it('mdxMedia: <Figure src> değerleri tekil olarak yoklanır', async () => {
    const mdx =
      '<Figure src="/media/test/a.png" alt="x" />\n\n<Figure src="/media/test/a.png" alt="y" />';
    const media = await mdxMedia(mdx);
    expect(Object.keys(media)).toEqual(['/media/test/a.png']);
    expect(await mdxMedia('## Başlık')).toEqual({});
  });
});
