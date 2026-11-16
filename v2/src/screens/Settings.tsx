import { useEffect, useState } from 'react';
import { studyDay, summarize, toV1 } from '../../../logic/index.js';
import { setMuted, useMuted } from '../audio';
import { authErrorText } from '../auth';
import type { StoreState, StoreStatus } from '../data/useStore';
import { hrefOf } from '../router';
import { supabase } from '../supabase';
import { useTheme, type ThemeChoice } from '../theme';

const THEMES: { value: ThemeChoice; label: string }[] = [
  { value: 'light', label: 'Sáng' },
  { value: 'dark', label: 'Tối' },
  { value: 'system', label: 'Theo máy' },
];

/** Trạng thái gửi dữ liệu, bằng chữ. `null` = mọi thứ đã lưu trên máy chủ. */
export function syncText(status: StoreStatus, online: boolean): { text: string; bad: boolean } | null {
  if (status.error === 'conflict') return { text: 'Chưa gửi được: dữ liệu trên máy chủ đang đổi liên tục. Tải lại trang.', bad: true };
  if (status.pending === 0) return null;
  if (!online) return { text: `Mất mạng · ${status.pending} thay đổi đang chờ gửi`, bad: false };
  if (status.error === 'network') return { text: `Chưa gửi được · ${status.pending} thay đổi đang chờ gửi`, bad: false };
  return { text: 'Đang gửi…', bad: false };
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

/** Tài khoản + Đăng xuất. Còn thay đổi chưa gửi thì cảnh báo trước khi đăng xuất. */
function Account({ email, pending }: { email: string; pending: number }) {
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(false);
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
      {asking && pending > 0 ? (
        <div className="alert account-warn" role="alert">
          <p>
            <strong>Còn {pending} thay đổi chưa gửi lên máy chủ.</strong> Đăng xuất bây giờ thì các thay đổi này nằm lại trên máy này: đăng nhập lại
            đúng tài khoản này thì chúng được gửi tiếp, còn nếu tài khoản khác đăng nhập trên máy này thì chúng bị bỏ.
          </p>
          <div className="account-warn-actions">
            <button className="btn" type="button" onClick={() => setAsking(false)} disabled={busy}>
              Ở lại
            </button>
            <button className="btn" type="button" onClick={signOut} disabled={busy}>
              {busy ? 'Đang đăng xuất…' : 'Vẫn đăng xuất'}
            </button>
          </div>
        </div>
      ) : (
        <button className="btn" type="button" onClick={() => (pending > 0 ? setAsking(true) : void signOut())} disabled={busy}>
          {busy ? 'Đang đăng xuất…' : 'Đăng xuất'}
        </button>
      )}
    </div>
  );
}

/** Tải toàn bộ dữ liệu đang có về máy, dạng JSON của v1 (nhập lại được ở màn Chuyển dữ liệu). */
function downloadBackup(state: StoreState): void {
  const json = JSON.stringify(toV1(state.meta, state.decks));
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `recall-backup-${studyDay(Date.now())}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

type Props = {
  email: string;
  state: StoreState;
  status: StoreStatus;
  online: boolean;
  send: (cmd: Record<string, unknown>) => unknown;
};

/** Màn Cài đặt (task 2.15): KPI, tắt tiếng, giao diện, dữ liệu, tài khoản, và mục Nâng cao gập sẵn. */
export function Settings({ email, state, status, online, send }: Props) {
  const [theme, setTheme] = useTheme();
  const muted = useMuted();
  const sum = summarize(toV1(state.meta, state.decks));
  const sync = syncText(status, online);
  const deleted: any[] = state.deleted || [];

  return (
    <>
      {!status.empty && (
        <div className="card data-card">
          <Kpi value={state.meta.settings?.kpi ?? 90} onChange={(kpi) => send({ type: 'settings', patch: { kpi } })} />
        </div>
      )}

      <div className="card">
        <div className="field">
          <span className="field-label">Âm thanh</span>
          <label className="choice">
            <input type="checkbox" checked={muted} onChange={(e) => setMuted(e.target.checked)} />
            <span>
              <span>Tắt tiếng đọc từ</span>
              <span className="muted">Nhớ theo máy này.</span>
            </span>
          </label>
        </div>
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

      <Account email={email} pending={status.pending} />

      {!status.empty && (
        <details className="card fold advanced">
          <summary>Nâng cao</summary>
          <div className="advanced-body">
            <div className="field">
              <span className="field-label">Bản sao</span>
              <span className="muted">Tải toàn bộ học phần và tiến độ đang có về máy thành một file JSON. File này nhập lại được ở “Chuyển dữ liệu từ bản cũ”.</span>
              <button className="btn" type="button" onClick={() => downloadBackup(state)}>
                Tải bản sao
              </button>
            </div>

            <div className="field">
              <span className="field-label">Học phần đã xoá</span>
              {deleted.length === 0 ? (
                <span className="muted">Chưa xoá học phần nào.</span>
              ) : (
                <ul className="deleted-list">
                  {deleted.map((d) => (
                    <li key={d.id}>
                      <span className="deleted-name">
                        <span className="deck-name">{d.name}</span>
                        <span className="muted">{(d.cards || []).length} thẻ</span>
                      </span>
                      <button className="btn" type="button" onClick={() => send({ type: 'deckUpsert', deck: { id: d.id } })}>
                        Khôi phục
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </details>
      )}
    </>
  );
}
