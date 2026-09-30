// src/components/ui/CopyEmail.test.tsx — §12.1.4: pano başarı ve hata dalları, 2,000 ms etiket süresi, toast metni.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { COPIED_MS, CopyEmail } from './CopyEmail';

const labels = {
  copy: 'Kopyala',
  copied: 'Kopyalandı',
  copyLabel: 'E-postayı kopyala',
  toast: 'E-posta kopyalandı',
  copyFailed: 'Kopyalanamadı. Adresi seçip kopyalayın.',
  close: 'Kapat',
};
const EMAIL = 'iletisim@orcunsaatci.com';

function setup() {
  render(
    <>
      <a id="email" href={`mailto:${EMAIL}`}>
        {EMAIL}
      </a>
      <CopyEmail email={EMAIL} targetId="email" labels={labels} />
    </>,
  );
  return screen.getByRole('button', { name: labels.copyLabel });
}

describe('CopyEmail', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    Reflect.deleteProperty(navigator, 'clipboard');
  });

  it('başarıda panoya e-postayı yazar, 2,000 ms "Kopyalandı" gösterir ve toast verir', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const button = setup();
    await act(async () => {
      fireEvent.click(button);
    });
    expect(writeText).toHaveBeenCalledWith(EMAIL);
    expect(button).toHaveTextContent(labels.copied);
    expect(screen.getByRole('status')).toHaveTextContent(labels.toast);
    await act(async () => {
      vi.advanceTimersByTime(COPIED_MS - 1);
    });
    expect(button).toHaveTextContent(labels.copied);
    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(button).toHaveTextContent(labels.copy);
  });

  it('pano reddedilince adresi seçer ve yedek toast gösterir', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const button = setup();
    await act(async () => {
      fireEvent.click(button);
    });
    expect(window.getSelection()?.toString()).toBe(EMAIL);
    expect(button).toHaveTextContent(labels.copy);
    expect(screen.getByRole('status')).toHaveTextContent(labels.copyFailed);
  });

  it('Clipboard API yoksa da yedek yola düşer', async () => {
    const button = setup();
    await act(async () => {
      fireEvent.click(button);
    });
    expect(window.getSelection()?.toString()).toBe(EMAIL);
    expect(screen.getByRole('status')).toHaveTextContent(labels.copyFailed);
  });
});
