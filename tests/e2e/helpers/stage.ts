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

/** Per-frame rig output and runtime state (window.__stage.live / store, §5.18.1, §5.20.4). */
export type StageLive = {
  /** panel rect in CSS px (untilted layout rect, same box as the static panel) */
  panel: { x: number; y: number; w: number; h: number; visible: boolean };
  /**
   * shown program key ("A>B" while bridging), bridge progress, frozen (paused/idle), drift clock (s, advances only while
   * float runs), damped parallax (−1…1), hot reload played
   */
  kod: {
    key: string;
    mix: number;
    frozen: boolean;
    drift: number;
    parX: number;
    parY: number;
    hot: boolean;
  };
  frames: number;
  lastInput: number;
  scrollY: number;
  quality: { dpr: number; motion: boolean } | null;
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

/** Reads the rig's per-frame output (window.__stage.live) and runtime state (?debug only). */
export async function readLive(page: Page): Promise<StageLive> {
  return page.evaluate(() => {
    type Live = {
      panel: StageLive['panel'];
      kod: StageLive['kod'];
      frames: number;
      lastInput: number;
      scrollY: number;
    };
    type DebugStage = { store: { getState(): Record<string, unknown> }; live: Live };
    const stage = (window as unknown as { __stage?: DebugStage }).__stage;
    if (!stage) throw new Error('window.__stage is missing: open the page with ?debug');
    const s = stage.store.getState();
    const l = stage.live;
    return {
      panel: { ...l.panel },
      kod: {
        key: l.kod.key,
        mix: l.kod.mix,
        frozen: l.kod.frozen,
        drift: l.kod.drift,
        parX: l.kod.parX,
        parY: l.kod.parY,
        hot: l.kod.hot,
      },
      frames: l.frames,
      lastInput: l.lastInput,
      scrollY: l.scrollY,
      quality: (s.quality as StageLive['quality']) ?? null,
      canvasKey: Number(s.canvasKey),
      contextLosses: Number(s.contextLosses),
      paused: Boolean(s.paused),
    };
  });
}

/**
 * Waits until the live panel (rect + program key) stops changing for quietMs: damping, bridges and step decodes have
 * settled (a step decode lasts ≈ 1.2–2.1 s, so quietMs covers only the rect/key, not glyph timing).
 */
export async function waitForPanelStill(page: Page, quietMs = 400): Promise<void> {
  await page.waitForFunction(
    (quiet) =>
      new Promise<boolean>((resolve) => {
        type DebugStage = { live: { panel: unknown; kod: { key: string } } };
        const read = () => {
          const l = (window as unknown as { __stage: DebugStage }).__stage.live;
          return JSON.stringify([l.panel, l.kod.key]);
        };
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
