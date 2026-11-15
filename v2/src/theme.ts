import { useEffect, useState } from 'react';

/** Lựa chọn giao diện: sáng, tối, hoặc theo máy. Nhớ theo từng máy (localStorage), không đồng bộ. */
export type ThemeChoice = 'light' | 'dark' | 'system';

/** Cùng khoá với đoạn script đặt theme trước khi vẽ trong index.html. */
const KEY = 'recall.theme';
const THEME_COLOR = { light: '#F7F7F9', dark: '#0F0F13' } as const;

function readChoice(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

function apply(choice: ThemeChoice): void {
  const dark = choice === 'dark' || (choice === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const theme = dark ? 'dark' : 'light';
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme]);
}

export function useTheme(): [ThemeChoice, (choice: ThemeChoice) => void] {
  const [choice, setChoice] = useState<ThemeChoice>(readChoice);

  useEffect(() => {
    apply(choice);
    if (choice !== 'system') return;
    // "Theo máy": đổi theo khi hệ điều hành đổi sáng/tối
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => apply('system');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [choice]);

  const set = (next: ThemeChoice) => {
    try {
      if (next === 'system') localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, next);
    } catch {
      /* không lưu được thì vẫn đổi cho phiên này */
    }
    setChoice(next);
  };
  return [choice, set];
}
