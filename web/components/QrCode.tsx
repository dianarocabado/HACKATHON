import qrcode from 'qrcode-generator';

/** QR code as plain SVG rects (no innerHTML). Used on /screen and the /qr posters. */
export default function QrCode({ value, size = 200, label }: { value: string; size?: number; label: string }) {
  const qr = qrcode(0, 'M');
  qr.addData(value);
  qr.make();
  const n = qr.getModuleCount();
  const margin = 2;
  const cells: string[] = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) if (qr.isDark(r, c)) cells.push(`M${c + margin} ${r + margin}h1v1h-1z`);
  }
  return (
    <svg
      viewBox={`0 0 ${n + 2 * margin} ${n + 2 * margin}`}
      width={size}
      height={size}
      role="img"
      aria-label={label}
      shapeRendering="crispEdges"
    >
      <rect width="100%" height="100%" fill="#fff" />
      <path d={cells.join('')} fill="#000" />
    </svg>
  );
}
