// tests/e2e/helpers/stage.ts — the single wrapper around the stage test hooks (§13.3.2, §13.3.3)
import type { Page } from '@playwright/test';

export type StagePhase = 'poster' | 'probing' | 'loading' | 'ready' | 'fallback';

export type StageReading = {
  phase: string;
  tier: string;
  preset: string;
  loop: string;
  paused: boolean;
  values: Record<string, unknown>;
  scrollY: number;
};

/** Per-frame rig output and runtime state (window.__stage.live / rendered / store, §5.18.1). */
export type StageLive = {
  stone: { cx: number; cy: number; r: number; visible: boolean };
  frames: number;
  idleAngle: number;
  lastInput: number;
  scrollY: number;
  /** rendered rotation in degrees: rotYScroll + rotYEvent + idle (§5.9.6) */
  rotY: number;
  rotYScroll: number;
  quality: { dpr: number; ghost: boolean; octaves: number; segments: string } | null;
  canvasKey: number;
  contextLosses: number;
  paused: boolean;
};

/** Waits until #scene-layer[data-phase] reaches one of `phases`. */
export async function waitForStagePhase(
  page: Page,
  phases: readonly StagePhase[],
  timeout = 20_000,
): Promise<StagePhase> {
  const handle = await page.waitForFunction(
    (wanted) => {
      const phase = document.getElementById('scene-layer')?.getAttribute('data-phase');
      return phase && (wanted as string[]).includes(phase) ? phase : null;
    },
    [...phases],
    { timeout },
  );
  return (await handle.jsonValue()) as StagePhase;
}

/**
 * Reads window.__stage (only present with ?debug, §5.18.1).
 * If §5.18 changes, only this file changes.
 */
export async function readStage(page: Page): Promise<StageReading> {
  return page.evaluate(() => {
    type DebugStage = {
      store: { getState(): Record<string, unknown> };
      target: Record<string, unknown>;
      live: { scrollY: number };
    };
    const stage = (window as unknown as { __stage?: DebugStage }).__stage;
    if (!stage) throw new Error('window.__stage is missing: open the page with ?debug');
    const s = stage.store.getState();
    return {
      phase: String(s.phase),
      tier: String(s.tier),
      preset: String(s.preset),
      loop: String(s.loop),
      paused: Boolean(s.paused),
      // GSAP tween'leri hedefe döngüsel `_gsap` alanı ekler: iç alanlar atlanır
      values: JSON.parse(
        JSON.stringify(stage.target, (k, v: unknown) => (k.startsWith('_') ? undefined : v)),
      ) as Record<string, unknown>,
      scrollY: stage.live.scrollY,
    };
  });
}

/** Reads the rig's per-frame output (window.__stage.live, .rendered) and runtime state (?debug only). */
export async function readLive(page: Page): Promise<StageLive> {
  return page.evaluate(() => {
    type Live = {
      stone: StageLive['stone'];
      frames: number;
      idleAngle: number;
      lastInput: number;
      scrollY: number;
    };
    type DebugStage = {
      store: { getState(): Record<string, unknown> };
      rendered: Record<string, number>;
      live: Live;
    };
    const stage = (window as unknown as { __stage?: DebugStage }).__stage;
    if (!stage) throw new Error('window.__stage is missing: open the page with ?debug');
    const s = stage.store.getState();
    const r = stage.rendered;
    const l = stage.live;
    return {
      stone: { ...l.stone },
      frames: l.frames,
      idleAngle: l.idleAngle,
      lastInput: l.lastInput,
      scrollY: l.scrollY,
      rotY: (r.rotYScroll ?? 0) + (r.rotYEvent ?? 0) + l.idleAngle,
      rotYScroll: r.rotYScroll ?? 0,
      quality: (s.quality as StageLive['quality']) ?? null,
      canvasKey: Number(s.canvasKey),
      contextLosses: Number(s.contextLosses),
      paused: Boolean(s.paused),
    };
  });
}

/** Waits until the rendered stone circle (live.stone) stops changing for quietMs (damping has settled). */
export async function waitForStoneStill(page: Page, quietMs = 400): Promise<void> {
  await page.waitForFunction(
    (quiet) =>
      new Promise<boolean>((resolve) => {
        type DebugStage = { live: { stone: unknown } };
        const read = () =>
          JSON.stringify((window as unknown as { __stage: DebugStage }).__stage.live.stone);
        let last = read();
        let since = performance.now();
        const tick = () => {
          const now = read();
          if (now !== last) {
            last = now;
            since = performance.now();
          }
          if (performance.now() - since >= quiet) resolve(true);
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
    quietMs,
    { timeout: 15_000 },
  );
}

/** Waits ms inside the page (page.waitForTimeout is forbidden, §13.1.1 #6). */
export async function pageDelay(page: Page, ms: number): Promise<void> {
  await page.evaluate((wait) => new Promise((resolve) => setTimeout(resolve, wait)), ms);
}
