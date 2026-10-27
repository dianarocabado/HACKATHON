import { barWidths, fmt } from '@/lib/client/impact';

/** Simple labelled horizontal bars (one series), value printed at the end of each bar. */
export default function Bars({ items, unit, label }: { items: { label: string; value: number }[]; unit: string; label: string }) {
  const widths = barWidths(items.map((i) => i.value));
  return (
    <figure aria-label={label} className="space-y-2">
      {items.map((it, k) => (
        <div key={it.label} className="grid grid-cols-[7rem_1fr] items-center gap-2 text-[0.8125rem]">
          <span className="truncate" style={{ color: 'var(--muted)' }}>{it.label}</span>
          <span className="flex items-center gap-2">
            <span
              className="h-4 rounded-r"
              style={{ width: `${widths[k]}%`, minWidth: 2, background: k === 0 ? 'var(--brand)' : 'var(--muted)' }}
            />
            <span className="whitespace-nowrap tabular-nums">{fmt(it.value)}&nbsp;{unit}</span>
          </span>
        </div>
      ))}
    </figure>
  );
}
