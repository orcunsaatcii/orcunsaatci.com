// scripts/copy-detect-gpu.mjs — postinstall: detect-gpu benchmark JSON'larını kendi sunucumuzdan servis etmek için kopyalar (§5.11.2)
import { cpSync, existsSync, rmSync } from 'node:fs';

const SRC = 'node_modules/detect-gpu/dist/benchmarks';
const DEST = 'public/detect-gpu';

if (!existsSync(SRC)) {
  console.error(`copy-detect-gpu: ${SRC} bulunamadı (detect-gpu kurulu mu?)`);
  process.exit(1);
}
rmSync(DEST, { recursive: true, force: true });
cpSync(SRC, DEST, { recursive: true });
console.log(`copy-detect-gpu: ${SRC} → ${DEST}`);
