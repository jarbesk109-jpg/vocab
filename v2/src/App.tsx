import { useEffect, useRef, useState, type ReactNode } from 'react';
import { studyDay } from '../../logic/index.js';
import { authErrorText, useSession } from './auth';
import { hrefOf, useRoute, type Route } from './router';
import { Login } from './screens/Login';
import { supabase } from './supabase';
import { useTheme, type ThemeChoice } from './theme';

const NAV: { route: Route; label: string; icon: ReactNode }[] = [
  {
    route: 'today',
    label: 'Hôm nay',
    icon: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="m8.5 12.2 2.4 2.4 4.6-5" />
      </>
    ),
  },
  {
    route: 'decks',
    label: 'Học phần',
    icon: (
      <>
        <rect x="4" y="8" width="16" height="11.5" rx="2.5" />
        <path d="M6.5 5h11" />
      </>
    ),
  },
  {
    route: 'settings',
    label: 'Cài đặt',
    icon: (
      <>
        <path d="M4 7.5h9m4.5 0H20M4 16.5h2.5m4.5 0h9" />
        <circle cx="15.25" cy="7.5" r="2.25" />
        <circle cx="8.75" cy="16.5" r="2.25" />
      </>
    ),
  },
];

const TITLES: Record<Route, string> = {
  today: 'Hôm nay',
  decks: 'Học phần',
  settings: 'Cài đặt',
};

/** '2026-11-15' → 'Chủ nhật, 15/11' (ngày học: ngày mới bắt đầu lúc 4h sáng). */
function formatStudyDay(day: string): string {
  const d = new Date(day + 'T00:00:00Z');
  const weekday = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'][d.getUTCDay()];
  return `${weekday}, ${d.getUTCDate()}/${d.getUTCMonth() + 1}`;
}

function Screen({ route, sub, children }: { route: Route; sub?: string; children: ReactNode }) {
  return (
    <div className="screen">
      <header className="screen-head">
        <h1 className="screen-title" tabIndex={-1}>
          {TITLES[route]}
        </h1>
        {sub && <p className="screen-sub">{sub}</p>}
      </header>
      {children}
    </div>
  );
}

function Empty({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="card empty">
      <strong>{title}</strong>
      <span>{children}</span>
    </div>
  );
}

const THEMES: { value: ThemeChoice; label: string }[] = [
  { value: 'light', label: 'Sáng' },
  { value: 'dark', label: 'Tối' },
  { value: 'system', label: 'Theo máy' },
];

function Account({ email }: { email: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signOut() {
    setBusy(true);
    setError(null);
    // Thành công: useSession nhận phiên rỗng và App tự về màn đăng nhập.
    const { error } = await supabase.auth.signOut().catch(() => ({ error: { message: 'failed to fetch' } }));
    if (error) {
      setError(authErrorText(error).replace('Không đăng nhập được', 'Không đăng xuất được'));
      setBusy(false);
    }
  }

  return (
    <div className="card account">
      <div className="field">
        <span className="field-label">Tài khoản</span>
        <span className="account-email">{email}</span>
      </div>
      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}
      <button className="btn" type="button" onClick={signOut} disabled={busy}>
        {busy ? 'Đang đăng xuất…' : 'Đăng xuất'}
      </button>
    </div>
  );
}

function Settings({ email }: { email: string }) {
  const [theme, setTheme] = useTheme();
  return (
    <>
    <div className="card">
      <fieldset className="field">
        <legend className="field-label">Giao diện</legend>
        <div className="segmented">
          {THEMES.map((t) => (
            <label key={t.value}>
              <input type="radio" name="theme" value={t.value} checked={theme === t.value} onChange={() => setTheme(t.value)} />
              {t.label}
            </label>
          ))}
        </div>
      </fieldset>
    </div>
    <Account email={email} />
    </>
  );
}

/** Cửa vào: chưa đăng nhập thì chỉ thấy màn đăng nhập; đăng nhập rồi mới vào app. */
export function App() {
  const session = useSession();
  // Giữ theme đúng với lựa chọn đã lưu ở mọi màn (kể cả màn đăng nhập, và khi máy đổi sáng/tối).
  useTheme();

  if (session === undefined) return <div className="boot" aria-busy="true" />; // đang đọc phiên đã lưu: chưa vẽ gì để khỏi nháy
  if (session === null) return <Login />;
  return <Shell email={session.user.email ?? ''} />;
}

function Shell({ email }: { email: string }) {
  const route = useRoute();
  const shown = useRef(route);

  // Chuyển màn: đổi tiêu đề tab, đưa focus về tiêu đề màn và cuộn lên đầu (không làm khi vừa mở app).
  // Đặt ở App vì mỗi màn là một <Screen> mới: trạng thái "đã mở app chưa" phải sống lâu hơn từng màn.
  useEffect(() => {
    document.title = route === 'today' ? 'Recall' : `${TITLES[route]} · Recall`;
    if (shown.current === route) return;
    shown.current = route;
    document.querySelector<HTMLElement>('.screen-title')?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }, [route]);

  return (
    <div className="app">
      <nav className="nav" aria-label="Điều hướng chính">
        <div className="nav-brand">
          Re<span>call</span>
        </div>
        <ul className="nav-list">
          {NAV.map((item) => (
            <li key={item.route}>
              <a className="nav-link" href={hrefOf(item.route)} aria-current={route === item.route ? 'page' : undefined}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  {item.icon}
                </svg>
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <main className="main">
        <div className="main-inner">
          {route === 'today' && (
            <Screen route="today" sub={formatStudyDay(studyDay(Date.now()))}>
              <Empty title="Chưa có gì để học">Danh sách hôm nay sẽ hiện ở đây sau khi chuyển dữ liệu từ bản cũ sang.</Empty>
            </Screen>
          )}
          {route === 'decks' && (
            <Screen route="decks">
              <Empty title="Chưa có học phần nào">Các học phần và tiến độ của từng học phần sẽ hiện ở đây.</Empty>
            </Screen>
          )}
          {route === 'settings' && (
            <Screen route="settings">
              <Settings email={email} />
            </Screen>
          )}
        </div>
      </main>
    </div>
  );
}
