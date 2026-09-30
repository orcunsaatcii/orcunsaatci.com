// src/lib/on-idle.ts — `load` sonrası boşlukta geri çağırma (§5.12.2) ve boot gecikme sabitleri (§9.2.3).
// Başka hiçbir yerde boot gecikme değeri yazılmaz; tek istisna StageRoot'taki BOOT_TIMEOUT_MS'tir.

export interface IdleOptions {
  afterLoadDelayMs?: number;
  idleTimeoutMs?: number;
  fallbackDelayMs?: number;
}

/** Motion runtime: load sonrası ilk boşlukta; en geç 1 s içinde. Safari'de (rIC yok) load + 50 ms. */
export const MOTION_IDLE: IdleOptions = {
  afterLoadDelayMs: 0,
  idleTimeoutMs: 1000,
  fallbackDelayMs: 50,
};

/** Stage: load + 1 s + boşluk; en geç 2 s içinde. Safari'de load + 1 s + 300 ms. */
export const STAGE_IDLE: IdleOptions = {
  afterLoadDelayMs: 1000,
  idleTimeoutMs: 2000,
  fallbackDelayMs: 300,
};

/** cb'yi `load` olayından (gerekirse afterLoadDelayMs sonra) ilk boşlukta çağırır. Temizlik fonksiyonu döner. */
export function onIdle(cb: () => void, o: IdleOptions = {}): () => void {
  const { afterLoadDelayMs = 0, idleTimeoutMs = 2000, fallbackDelayMs = 300 } = o; // değerler §9.2'de sabitlenir
  const hasRIC =
    typeof (window as { requestIdleCallback?: unknown }).requestIdleCallback === 'function';
  let idle: number | undefined;
  let t1: number | undefined;
  let t2: number | undefined;
  const schedule = () => {
    if (hasRIC) idle = window.requestIdleCallback(() => cb(), { timeout: idleTimeoutMs });
    else t2 = window.setTimeout(cb, fallbackDelayMs);
  };
  const afterLoad = () => {
    t1 = window.setTimeout(schedule, afterLoadDelayMs);
  };
  if (document.readyState === 'complete') afterLoad();
  else window.addEventListener('load', afterLoad, { once: true });
  return () => {
    window.removeEventListener('load', afterLoad);
    if (idle !== undefined) window.cancelIdleCallback(idle);
    if (t1 !== undefined) window.clearTimeout(t1);
    if (t2 !== undefined) window.clearTimeout(t2);
  };
}
