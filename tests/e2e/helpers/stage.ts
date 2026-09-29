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
 * If §5.18 changes, only this function changes.
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
      values: JSON.parse(JSON.stringify(stage.target)) as Record<string, unknown>,
      scrollY: stage.live.scrollY,
    };
  });
}
