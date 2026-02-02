import React from 'react';

import { useTheme } from '../theme/ThemeContext.jsx';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      className={
        `relative inline-flex h-6 w-11 items-center rounded-full border transition-colors focus:outline-none focus:ring-2 focus:ring-brand/40 focus:ring-offset-2 focus:ring-offset-transparent ` +
        (isDark
          ? 'bg-brand/25 border-white/10 dark:border-white/10'
          : 'bg-slate-200 border-slate-300')
      }
      role="switch"
      aria-checked={isDark}
      aria-label="Toggle dark mode"
      onClick={toggleTheme}
    >
      <span
        className={
          `inline-block h-5 w-5 transform rounded-full shadow transition-transform ` +
          (isDark ? 'translate-x-5 bg-brand' : 'translate-x-1 bg-white')
        }
      />
    </button>
  );
}
