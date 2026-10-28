'use client';
import { NEED_STEPS } from '@/lib/client/scale';
import { useLang } from './LangProvider';

export default function Legend({ title, info, missions = false }: { title: string; info?: string; missions?: boolean }) {
  const { t } = useLang();
  return (
    <div
      className="rounded-2xl border px-3 py-2 text-[0.8125rem] shadow-sm"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--muted)' }}
    >
      <div className="mb-1 font-medium" style={{ color: 'var(--text)' }}>{title}</div>
      {/* What the layer shows and where the data comes from; narrow so it wraps beside the zoom buttons */}
      {info && <p className="mb-1 max-w-[17rem] text-[0.75rem] leading-snug">{info}</p>}
      <div className="flex items-center gap-2">
        <span>{t('legend.low')}</span>
        <div className="flex" aria-hidden>
          {NEED_STEPS.map((c) => <span key={c} className="h-3 w-5" style={{ background: c }} />)}
        </div>
        <span>{t('legend.high')}</span>
        <span
          aria-hidden
          className="ml-2 h-3 w-5 border"
          style={{
            borderColor: 'var(--border)',
            backgroundImage: 'repeating-linear-gradient(135deg, rgba(95,103,95,.3) 0 1.5px, transparent 1.5px 6px)',
          }}
        />
        <span>{t('legend.noData')}</span>
      </div>
      {missions && (
        <div className="mt-1 flex items-center gap-2">
          {/* Same shape as the pins drawn in HexMap */}
          <svg aria-hidden width="12" height="16" viewBox="0 0 48 64">
            <path d="M24 62C14 46 4 36 4 22A20 20 0 0 1 44 22C44 36 34 46 24 62Z" fill="var(--brand)" stroke="#FFF" strokeWidth="3" />
            <circle cx="24" cy="22" r="7" fill="#FFF" />
          </svg>
          <span>{t('legend.mission')}</span>
        </div>
      )}
    </div>
  );
}
