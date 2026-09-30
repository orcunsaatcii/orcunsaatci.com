// src/stage/pointer.test.ts — girdi izleme (§4.6.4, §5.6.2): ince işaretçide konum, her girdide lastInput.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { trackInput } from './pointer';
import { live, stageStore } from './store';

// jsdom'da matchMedia yoktur
const media = (fine: boolean) =>
  vi.stubGlobal(
    'matchMedia',
    (q: string) =>
      ({
        matches: fine && q.includes('pointer: fine'),
        media: q,
        addEventListener: () => {},
        removeEventListener: () => {},
      }) as unknown as MediaQueryList,
  );

const pointer = (type: string, init: PointerEventInit) => {
  const e = new MouseEvent(type, { bubbles: true, ...init }) as PointerEvent;
  Object.defineProperty(e, 'pointerType', { value: init.pointerType ?? 'mouse' });
  return e;
};

describe('trackInput (§4.6.4, §5.6.2)', () => {
  const invalidate = vi.fn();
  beforeEach(() => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0);
      return 1;
    });
    stageStore.setState({ invalidate });
    live.lastInput = 0;
    Object.assign(live.pointer, { x: 0, y: 0, px: -1, py: -1, active: false });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    invalidate.mockReset();
  });

  it('ince işaretçi: mouse konumu [-1, 1] aralığına (y yukarı +) yazılır; lastInput ve invalidate', () => {
    media(true);
    const stop = trackInput();
    window.dispatchEvent(
      pointer('pointermove', { clientX: window.innerWidth, clientY: 0, pointerType: 'mouse' }),
    );
    expect(live.pointer).toMatchObject({ x: 1, y: 1, px: window.innerWidth, py: 0, active: true });
    expect(live.lastInput).toBeGreaterThan(0);
    expect(invalidate).toHaveBeenCalled();
    // dokunmatik pointermove konumu değiştirmez
    window.dispatchEvent(pointer('pointermove', { clientX: 0, clientY: 0, pointerType: 'touch' }));
    expect(live.pointer.x).toBe(1);
    // pencereden çıkış
    document.dispatchEvent(pointer('pointerout', { relatedTarget: null }));
    expect(live.pointer.active).toBe(false);
    stop();
  });

  it('kaba işaretçi: konum izlenmez; pointerdown ve kaydırma idle drift’i yeniden başlatır', () => {
    media(false);
    const stop = trackInput();
    window.dispatchEvent(
      pointer('pointermove', { clientX: 10, clientY: 10, pointerType: 'mouse' }),
    );
    expect(live.pointer.active).toBe(false);
    expect(live.lastInput).toBe(0);
    window.dispatchEvent(pointer('pointerdown', { pointerType: 'touch' }));
    const afterDown = live.lastInput;
    expect(afterDown).toBeGreaterThan(0);
    live.lastInput = 0;
    window.dispatchEvent(new Event('scroll'));
    expect(live.lastInput).toBeGreaterThan(0);
    stop();
    live.lastInput = 0;
    window.dispatchEvent(new Event('scroll'));
    expect(live.lastInput, 'temizlikten sonra dinleyici yok').toBe(0);
  });
});
