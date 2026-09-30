// src/app/apple-icon.tsx — /apple-icon, 180×180 PNG (§11.2.5). /icon ile aynı motif, 24 px iç boşluk.
import { ImageResponse } from 'next/og';
import { ICON_DIAL_ANGLE, OG_COLORS, renderDial } from '@/lib/seo/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

const PADDING = 24;

export default function AppleIcon() {
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
      {renderDial({ size: size.width - 2 * PADDING, angleDeg: ICON_DIAL_ANGLE })}
    </div>,
    size,
  );
}
