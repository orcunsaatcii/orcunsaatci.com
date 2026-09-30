// src/app/icon.tsx — /icon, 32×32 PNG (§11.2.5). Koyu zemin üzerinde halka + yakut ibre; build'de statik üretilir.
import { ImageResponse } from 'next/og';
import { ICON_DIAL_ANGLE, OG_COLORS, renderDial } from '@/lib/seo/og';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: OG_COLORS.canvas,
      }}
    >
      {renderDial({ size: 32, angleDeg: ICON_DIAL_ANGLE })}
    </div>,
    size,
  );
}
