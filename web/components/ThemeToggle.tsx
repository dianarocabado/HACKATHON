'use client';
// Header button: switches between light and dark. Shows the theme you would switch to.
import { setTheme, useTheme } from '@/lib/client/theme';
import { AppIcon, Icon } from './Icons';
import { useLang } from './LangProvider';

export default function ThemeToggle() {
  const { t } = useLang();
  const theme = useTheme();
  const next = theme === 'dark' ? 'light' : 'dark';
  return (
    <button
      onClick={() => setTheme(next)}
      aria-label={t(next === 'dark' ? 'theme.toDark' : 'theme.toLight')}
      title={t(next === 'dark' ? 'theme.toDark' : 'theme.toLight')}
      className="flex h-11 w-11 items-center justify-center rounded-xl"
      style={{ color: 'var(--text)' }}
    >
      <Icon icon={next === 'dark' ? AppIcon.dark : AppIcon.light} size={22} />
    </button>
  );
}
