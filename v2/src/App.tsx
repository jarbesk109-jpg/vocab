import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { computeStreak, streakEvents, studyDay, summarize, toV1 } from '../../logic/index.js';
import { authErrorText, useSession } from './auth';
import { Celebration } from './components/Celebration';
import { FlameToast } from './components/Flame';
import { useStore, type StoreState, type StoreStatus } from './data/useStore';
import { hrefOf, useRoute, useStudyDeckId, type Route } from './router';
import { DeckDetail } from './screens/DeckDetail';
import { DeckEditor } from './screens/DeckEditor';
import { Decks } from './screens/Decks';
import { Import } from './screens/Import';
import { Learn } from './screens/Learn';
import { Login } from './screens/Login';
import { Today } from './screens/Today';
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
  deck: 'Học phần',
  deckNew: 'Tạo học phần',
  deckEdit: 'Sửa học phần',
  settings: 'Cài đặt',
  import: 'Chuyển dữ liệu',
  study: 'Học',
  fx: 'Xem thử hiệu ứng',
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

/** Trạng thái gửi dữ liệu, bằng chữ. `null` = mọi thứ đã lưu trên máy chủ. */
function syncText(status: StoreStatus, online: boolean): { text: string; bad: boolean } | null {
  if (status.error === 'conflict') return { text: 'Chưa gửi được: dữ liệu trên máy chủ đang đổi liên tục. Tải lại trang.', bad: true };
  if (status.pending === 0) return null;
  if (!online) return { text: `Mất mạng · ${status.pending} thay đổi đang chờ gửi`, bad: false };
  if (status.error === 'network') return { text: `Chưa gửi được · ${status.pending} thay đổi đang chờ gửi`, bad: false };
  return { text: 'Đang gửi…', bad: false };
}

/** Nhãn nổi ở góc màn: chỉ hiện khi còn thay đổi chưa lên máy chủ. Không chiếm chỗ nên không xê dịch bố cục. */
function SyncPill({ status, online }: { status: StoreStatus; online: boolean }) {
  const s = syncText(status, online);
  return (
    <div className="sync-pill" role="status" aria-live="polite" data-show={s ? '' : undefined} data-bad={s?.bad ? '' : undefined}>
      {s?.text}
    </div>
  );
}

/** '2026-10-10' → '10/10/2026'. */
function formatDay(day: string): string {
  const [y, m, d] = day.split('-');
  return `${d}/${m}/${y}`;
}

function Kpi({ value, onChange }: { value: number; onChange: (kpi: number) => void }) {
  const [draft, setDraft] = useState(String(value));
  // Giá trị đổi từ máy khác (hoặc sau khi gửi) thì ô nhập theo.
  useEffect(() => setDraft(String(value)), [value]);

  function commit() {
    const n = Math.round(Number(draft));
    if (!draft.trim() || !Number.isFinite(n)) return setDraft(String(value));
    const kpi = Math.min(100, Math.max(50, n));
    setDraft(String(kpi));
    if (kpi !== value) onChange(kpi);
  }

  return (
    <label className="field kpi">
      <span className="field-label">KPI bài Kiểm tra (%)</span>
      <input
        className="input"
        type="number"
        inputMode="numeric"
        min={50}
        max={100}
        step={1}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
      />
      <span className="muted">Bài Kiểm tra đạt từ mức này trở lên thì học phần lên mốc.</span>
    </label>
  );
}

type SettingsProps = {
  email: string;
  state: StoreState;
  status: StoreStatus;
  online: boolean;
  send: (cmd: Record<string, unknown>) => unknown;
};

function Settings({ email, state, status, online, send }: SettingsProps) {
  const [theme, setTheme] = useTheme();
  const sum = summarize(toV1(state.meta, state.decks));
  const sync = syncText(status, online);
  return (
    <>
    {!status.empty && (
      <div className="card data-card">
        <Kpi value={state.meta.settings?.kpi ?? 90} onChange={(kpi) => send({ type: 'settings', patch: { kpi } })} />
      </div>
    )}
    <div className="card data-card">
      <div className="field">
        <span className="field-label">Dữ liệu</span>
        <span className="muted">
          {status.empty
            ? 'Tài khoản chưa có dữ liệu.'
            : `${sum.sets} học phần · ${sum.cards} thẻ · ${sum.answers} lượt trả lời · ${sum.last ? 'học gần nhất ' + formatDay(sum.last) : 'chưa học lần nào'}`}
        </span>
        <span className={sync?.bad ? 'sync-line bad' : 'sync-line'}>{sync ? sync.text : 'Đã lưu trên máy chủ.'}</span>
      </div>
      <a className="btn" href={hrefOf('import')}>
        Chuyển dữ liệu từ bản cũ
      </a>
    </div>
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
  // key: đổi tài khoản thì dựng lại toàn bộ (kho dữ liệu là của từng tài khoản)
  return <Shell key={session.user.id} userId={session.user.id} email={session.user.email ?? ''} />;
}

/** Hiệu ứng streak đang hiện: lửa bùng (nhãn nổi) hoặc màn chúc mừng lớn ở mốc. */
type StreakFx = { id: number; count: number; milestone: boolean; freezeEarned: boolean };

/** Xem thử hiệu ứng streak mà không đụng dữ liệu (`#/fx`, không có trên thanh điều hướng). */
function FxPreview({ show }: { show: (fx: StreakFx) => void }) {
  const go = (count: number, milestone: boolean, freezeEarned = false) => show({ id: Date.now(), count, milestone, freezeEarned });
  return (
    <div className="card fx-preview">
      <p className="muted">Các nút dưới đây chỉ chạy hiệu ứng, không ghi gì vào dữ liệu.</p>
      <button className="btn" type="button" onClick={() => go(3, false)}>
        Lửa bùng (streak lên 3)
      </button>
      <button className="btn" type="button" onClick={() => go(21, false, true)}>
        Lửa bùng + nhận băng (streak lên 21)
      </button>
      <button className="btn" type="button" onClick={() => go(10, true)}>
        Mốc 10
      </button>
      <button className="btn" type="button" onClick={() => go(100, true)}>
        Mốc 100
      </button>
    </div>
  );
}

function Shell({ userId, email }: { userId: string; email: string }) {
  const hashRoute = useRoute();
  const studyDeckId = useStudyDeckId();
  const { store, state, status, online, boot, retry } = useStore(userId);
  const [fx, setFx] = useState<StreakFx | null>(null);
  const closeFx = useCallback(() => setFx(null), []);

  // Mọi lệnh của app đi qua đây: so streak ngay TRƯỚC và ngay SAU lệnh (cùng một ngày học) để biết
  // có cần lửa bùng / màn chúc mừng không. Thay đổi tới từ máy khác (tải lại bản server) không đi qua đây
  // nên không gây hiệu ứng.
  const dispatch = useCallback(
    (cmd: Record<string, unknown>) => {
      const day = studyDay(Date.now());
      const streakOf = () => {
        const m = store.getState().meta;
        return computeStreak(m.activity || {}, m.streak?.freezeUsedDays ?? [], day);
      };
      const before = streakOf();
      const full = store.dispatch(cmd);
      const after = streakOf();
      const ev = streakEvents(before, after);
      if (ev.fire || ev.milestone) setFx({ id: Date.now(), count: after.count, milestone: ev.milestone, freezeEarned: ev.freezeEarned });
      return full;
    },
    [store],
  );
  /** Phát một lệnh rồi gửi ngay. */
  const send = useCallback(
    (cmd: Record<string, unknown>) => {
      const full = dispatch(cmd);
      void store.flush();
      return full;
    },
    [dispatch, store],
  );
  // Tài khoản chưa có dữ liệu: mọi màn (trừ Cài đặt, để còn đăng xuất) đều là màn chuyển dữ liệu.
  const route: Route = boot === 'ready' && status.empty && hashRoute !== 'settings' ? 'import' : hashRoute;
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

  if (boot === 'loading') return <div className="boot" aria-busy="true" />;
  if (boot === 'error') {
    return (
      <main className="login">
        <div className="login-card card">
          <h1 className="screen-title">Chưa tải được dữ liệu</h1>
          <p className="muted">Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.</p>
          <button className="btn btn-primary" type="button" onClick={retry}>
            Thử lại
          </button>
        </div>
      </main>
    );
  }

  return (
    <div className="app">
      <nav className="nav" aria-label="Điều hướng chính">
        <div className="nav-brand">
          Re<span>call</span>
        </div>
        <ul className="nav-list">
          {NAV.map((item) => (
            <li key={item.route}>
              <a className="nav-link" href={hrefOf(item.route)} aria-current={hashRoute === item.route || (item.route === 'decks' && (hashRoute === 'deck' || hashRoute === 'deckNew' || hashRoute === 'deckEdit')) ? 'page' : undefined}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  {item.icon}
                </svg>
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <SyncPill status={status} online={online} />
      {fx && !fx.milestone && <FlameToast key={fx.id} count={fx.count} freezeEarned={fx.freezeEarned} onDone={closeFx} />}
      {fx && fx.milestone && <Celebration key={fx.id} count={fx.count} freezeEarned={fx.freezeEarned} onClose={closeFx} />}
      <main className="main">
        <div className="main-inner">
          {route === 'today' && (
            <Screen route="today" sub={formatStudyDay(studyDay(Date.now()))}>
              <Today state={state} today={studyDay(Date.now())} send={send} />
            </Screen>
          )}
          {route === 'decks' && (
            <Screen route="decks">
              <Decks state={state} today={studyDay(Date.now())} />
            </Screen>
          )}
          {route === 'deckNew' && (
            <Screen route="deckNew">
              <DeckEditor key="new" deckId="" state={state} send={send} />
            </Screen>
          )}
          {route === 'deckEdit' && (
            <Screen route="deckEdit" sub={state.decks.find((x: any) => x.id === studyDeckId)?.name}>
              <DeckEditor key={studyDeckId} deckId={studyDeckId} state={state} send={send} />
            </Screen>
          )}
          {route === 'deck' && (
            <Screen route="deck" sub={state.decks.find((x: any) => x.id === studyDeckId)?.name}>
              <DeckDetail key={studyDeckId} deckId={studyDeckId} state={state} today={studyDay(Date.now())} />
            </Screen>
          )}
          {route === 'settings' && (
            <Screen route="settings">
              <Settings email={email} state={state} status={status} online={online} send={send} />
            </Screen>
          )}
          {route === 'study' && (
            <Screen route="study" sub={state.decks.find((x: any) => x.id === studyDeckId)?.name}>
              <Learn key={studyDeckId} deckId={studyDeckId} state={state} store={store} dispatch={dispatch} today={studyDay(Date.now())} />
            </Screen>
          )}
          {route === 'fx' && (
            <Screen route="fx">
              <FxPreview show={setFx} />
            </Screen>
          )}
          {route === 'import' && (
            <Screen route="import" sub={status.empty ? undefined : 'Thay dữ liệu trong tài khoản bằng một bản từ bản cũ hoặc từ file.'}>
              <Import
                store={store}
                state={state}
                hasData={!status.empty}
                onDone={() => {
                  window.location.hash = hrefOf('today');
                }}
              />
            </Screen>
          )}
        </div>
      </main>
    </div>
  );
}
