import { NEED_STEPS, NO_DATA_LABEL } from '@/lib/client/scale';

export default function Legend({ title }: { title: string }) {
  return (
    <div
      className="rounded-2xl border px-3 py-2 text-[0.8125rem] shadow-sm"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--muted)' }}
    >
      <div className="mb-1 font-medium" style={{ color: 'var(--text)' }}>{title}</div>
      <div className="flex items-center gap-2">
        <span>niedrig</span>
        <div className="flex" aria-hidden>
          {NEED_STEPS.map((c) => <span key={c} className="h-3 w-5" style={{ background: c }} />)}
        </div>
        <span>hoch</span>
        <span
          aria-hidden
          className="ml-2 h-3 w-5 border"
          style={{
            borderColor: 'var(--border)',
            backgroundImage: 'repeating-linear-gradient(135deg, rgba(95,103,95,.3) 0 1.5px, transparent 1.5px 6px)',
          }}
        />
        <span>{NO_DATA_LABEL}</span>
      </div>
    </div>
  );
}
