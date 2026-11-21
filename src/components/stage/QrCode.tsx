import { useMemo } from 'react';
import clsx from 'clsx';
import { encodeQr, qrPath, type QrEcc } from '../../lib/qr';

export interface QrCodeProps {
  /** Text to encode (a URL). */
  value: string;
  /** Accessible name; the code is an image to assistive tech. */
  label: string;
  ecc?: QrEcc;
  className?: string;
}

/**
 * QR code as a crisp SVG (src/lib/qr.ts, no dependency). Always dark on
 * light with a 4-module quiet zone, whatever the theme, so it scans.
 * Renders nothing if the value is too long for version 10.
 */
export function QrCode({ value, label, ecc = 'M', className }: QrCodeProps) {
  const qr = useMemo(() => {
    try {
      return encodeQr(value, { ecc });
    } catch {
      return null;
    }
  }, [value, ecc]);
  if (!qr) return null;
  const n = qr.size + 8;
  return (
    <svg
      className={clsx('qr', className)}
      viewBox={`0 0 ${n} ${n}`}
      role="img"
      aria-label={label}
      data-qr-value={value}
      data-qr-version={qr.version}
      shapeRendering="crispEdges"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width={n} height={n} fill="#FFFFFF" />
      <path d={qrPath(qr, 4)} fill="#0B0416" />
    </svg>
  );
}
