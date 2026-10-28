'use client';
// Optional account: sign-up / log-in form when signed out; the person's reports and missions when signed in.
import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { ActivityKind, Profile } from '@contracts/types';
import { AccountError, api } from '@/lib/client/api';
import { locale, type MessageKey } from '@/lib/client/i18n';
import { CATEGORY } from '@/lib/client/missions';
import { sensorSentence } from '@/lib/client/report';
import { setSessionUser, useSession } from '@/lib/client/session';
import { StatusChip } from './Badges';
import { AppIcon, CategoryTile, Icon } from './Icons';
import { useLang } from './LangProvider';

const ERRORS = new Set(['invalid_login', 'email_taken', 'invalid_email', 'invalid_password', 'invalid_name', 'too_many_attempts']);
const errorKey = (err: unknown) =>
  `account.err.${err instanceof AccountError && ERRORS.has(err.code) ? err.code : 'failed'}` as MessageKey;

const field = 'min-h-11 w-full rounded-xl border px-3';
const fieldStyle = { background: 'var(--surface)', borderColor: 'var(--border)' };

function AuthForm() {
  const { t } = useLang();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setSessionUser(mode === 'signup' ? await api.signup(email, password, name) : await api.login(email, password));
    } catch (err) {
      setError(errorKey(err));
      if (err instanceof AccountError && err.code === 'email_taken') setMode('login');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-2xl border p-4" style={fieldStyle}>
      <h2 className="text-xl font-semibold">{t(mode === 'login' ? 'account.login' : 'account.signup')}</h2>
      {mode === 'signup' && (
        <label className="flex flex-col gap-1">
          <span className="text-[0.8125rem]" style={{ color: 'var(--muted)' }}>{t('account.name')}</span>
          <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="nickname" maxLength={40} required className={field} style={fieldStyle} />
        </label>
      )}
      <label className="flex flex-col gap-1">
        <span className="text-[0.8125rem]" style={{ color: 'var(--muted)' }}>{t('account.email')}</span>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required className={field} style={fieldStyle} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[0.8125rem]" style={{ color: 'var(--muted)' }}>{t('account.password')}</span>
        <input
          type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} maxLength={72} required
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'} className={field} style={fieldStyle}
        />
      </label>
      {error && <p role="alert" style={{ color: 'var(--warn)' }}>{t(error)}</p>}
      <button
        disabled={busy}
        className="min-h-12 rounded-xl font-semibold disabled:opacity-50"
        style={{ background: 'var(--brand)', color: 'var(--brand-ink)' }}
      >
        {t(mode === 'login' ? 'account.login' : 'account.signup')}
      </button>
      <button
        type="button"
        onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(null); }}
        className="min-h-11 underline"
        style={{ color: 'var(--brand)' }}
      >
        {t(mode === 'login' ? 'account.toSignup' : 'account.toLogin')}
      </button>
      <p className="text-[0.8125rem]" style={{ color: 'var(--muted)' }}>{t('account.privacy')}</p>
    </form>
  );
}

const ACTION_KEY: Record<Exclude<ActivityKind, 'report'>, MessageKey> = {
  claim: 'account.action.claim', support: 'account.action.support', done: 'account.action.done',
};

function SignedIn() {
  const { t, lang } = useLang();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    api.me().then(setProfile).catch((err) => {
      if (err instanceof AccountError && err.status === 401) setSessionUser(null);
      else setError(true);
    });
  }, []);

  const logout = async () => {
    await api.logout().catch(() => undefined);
    setSessionUser(null);
  };
  const remove = async () => {
    if (!window.confirm(t('account.deleteConfirm'))) return;
    try {
      await api.deleteAccount();
      setSessionUser(null);
    } catch {
      setError(true);
    }
  };

  if (error) return <p role="alert">{t('account.err.failed')}</p>;
  if (!profile) return <p aria-busy style={{ color: 'var(--muted)' }}>{t('account.loading')}</p>;

  const date = new Intl.DateTimeFormat(locale(lang), { dateStyle: 'medium', timeStyle: 'short' });
  const stats: [MessageKey, number][] = [
    ['account.stats.reports', profile.counts.reports], ['account.stats.claimed', profile.counts.claimed],
    ['account.stats.supported', profile.counts.supported], ['account.stats.done', profile.counts.done],
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="flex h-12 w-12 items-center justify-center rounded-full text-xl font-bold"
          style={{ background: 'var(--brand)', color: 'var(--brand-ink)' }}
        >
          {profile.user.name.slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="text-xl font-semibold">{t('account.hello', { name: profile.user.name })}</p>
          <p className="truncate text-[0.8125rem]" style={{ color: 'var(--muted)' }}>{profile.user.email}</p>
        </div>
      </div>

      <dl className="grid grid-cols-4 gap-2">
        {stats.map(([label, n]) => (
          <div key={label} className="flex flex-col-reverse items-center rounded-2xl border px-1 py-3 text-center" style={fieldStyle}>
            <dt className="text-[0.75rem]" style={{ color: 'var(--muted)' }}>{t(label)}</dt>
            <dd className="text-2xl font-bold tabular-nums">{n}</dd>
          </div>
        ))}
      </dl>

      <section>
        <h2 className="mb-2 text-lg font-semibold">{t('account.myMissions')}</h2>
        {profile.missions.length === 0 ? (
          <p style={{ color: 'var(--muted)' }}>{t('account.noMissions')}</p>
        ) : (
          <ul className="space-y-2">
            {profile.missions.map(({ mission: m, actions }) => (
              <li key={m.id}>
                <Link href={`/missions/${m.id}`} className="flex items-start gap-3 rounded-2xl border p-3" style={fieldStyle}>
                  <CategoryTile category={m.category} />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold leading-tight">{m.title}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[0.8125rem]">
                      <StatusChip status={m.state.status} />
                      <span style={{ color: 'var(--muted)' }}>
                        {actions.filter((a): a is keyof typeof ACTION_KEY => a in ACTION_KEY).map((a) => t(ACTION_KEY[a])).join(' · ')}
                      </span>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">{t('account.myReports')}</h2>
        {profile.reports.length === 0 ? (
          <p style={{ color: 'var(--muted)' }}>{t('account.noReports')}</p>
        ) : (
          <ul className="space-y-2">
            {profile.reports.map((r) => (
              <li key={r.id} className="flex items-start gap-3 rounded-2xl border p-3" style={fieldStyle}>
                <CategoryTile category={r.category} />
                <div className="min-w-0 flex-1">
                  <p>{r.summary}</p>
                  <p className="mt-1 text-[0.8125rem]" style={{ color: 'var(--muted)' }}>
                    {t(CATEGORY[r.category].label)} · {date.format(new Date(r.createdAt))}
                  </p>
                  <p className="mt-1 text-[0.8125rem]">{sensorSentence(r.sensorCheck, lang)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex flex-col gap-2 border-t pt-4" style={{ borderColor: 'var(--border)' }}>
        <button onClick={logout} className="flex min-h-11 items-center justify-center gap-2 rounded-xl border font-medium" style={{ borderColor: 'var(--brand)', color: 'var(--brand)' }}>
          <Icon icon={AppIcon.logout} size={18} /> {t('account.logout')}
        </button>
        <button onClick={remove} className="flex min-h-11 items-center justify-center gap-2 rounded-xl font-medium" style={{ color: 'var(--warn)' }}>
          <Icon icon={AppIcon.remove} size={18} /> {t('account.delete')}
        </button>
      </div>
    </div>
  );
}

export default function ProfileView() {
  const { t } = useLang();
  const user = useSession();
  return (
    // pb-10: the raised report button in the bottom bar reaches into the page
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 pb-10 pt-4">
      <h1 className="text-2xl font-semibold">{t('account.title')}</h1>
      {user === undefined ? (
        <p aria-busy style={{ color: 'var(--muted)' }}>{t('account.loading')}</p>
      ) : user === null ? (
        <>
          <p>{t('account.optional')}</p>
          <AuthForm />
        </>
      ) : (
        <SignedIn key={user.id} />
      )}
    </div>
  );
}
