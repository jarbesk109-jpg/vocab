import { useMemo, useRef, useState, type ChangeEvent } from 'react';
import { compareFreshness, normalize, renameDay1OnImport, studyDay, summarize, toV1, toV2 } from '../../../logic/index.js';
import type { Store, StoreState } from '../data/useStore';

/** Khoá localStorage của v1 (v1 và v2 cùng origin trên trang thật nên đọc thẳng được). */
const V1_KEY = 'vocabvip.v1';

type Summary = { sets: number; cards: number; answers: number; last: string };
type Renamed = { id: string; from: string; to: string };
type Warn = { kind: 'cards' | 'answers' | 'last'; a: number | string; b: number | string };

/** Một bản dữ liệu v1 đã chuẩn hoá, sẵn sàng để ghi. */
type Candidate = {
  label: string;
  data: any; // dạng v1, tên deck đã đổi bù theo mục 3.10
  summary: Summary;
  fixes: string[];
  renamed: Renamed[];
};

/** '2026-10-10' → '10/10/2026'. */
function formatDay(day: string): string {
  const [y, m, d] = day.split('-');
  return `${d}/${m}/${y}`;
}

function summaryText(s: Summary): string {
  const last = s.last ? `học gần nhất ${formatDay(s.last)}` : 'chưa học lần nào';
  return `${s.sets} học phần · ${s.cards} thẻ · ${s.answers} lượt trả lời · ${last}`;
}

function warnText(w: Warn): string {
  if (w.kind === 'cards') return `Bản sắp nhập có ít thẻ hơn: ${w.a} so với ${w.b} thẻ đang có.`;
  if (w.kind === 'answers') return `Bản sắp nhập có ít lượt trả lời hơn: ${w.a} so với ${w.b} đang có.`;
  const a = typeof w.a === 'string' && w.a ? formatDay(w.a) : 'chưa học';
  return `Bản sắp nhập học gần nhất ${a}, bản đang có là ${formatDay(String(w.b))}.`;
}

/** Chuỗi JSON → bản dữ liệu sẵn sàng nhập, hoặc `null` khi không phải dữ liệu của app. */
function readCandidate(text: string, label: string): Candidate | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  // `normalize` sửa thẳng vào đối tượng: `raw` vừa được parse riêng nên không đụng tới nguồn.
  const n = normalize(raw, studyDay(Date.now()));
  if (!n) return null;
  const { sets, renamed } = renameDay1OnImport(n.data.sets);
  const data = { ...n.data, sets };
  return { label, data, summary: summarize(data), fixes: n.fixes, renamed };
}

function readLocalV1(): Candidate | null {
  try {
    const text = localStorage.getItem(V1_KEY);
    return text ? readCandidate(text, 'Bản cũ trên máy này') : null;
  } catch {
    return null;
  }
}

const ERRORS: Record<string, string> = {
  network: 'Không kết nối được máy chủ nên chưa ghi gì. Kiểm tra mạng rồi bấm lại.',
  snapshot: 'Không lưu được bản sao của dữ liệu đang có nên đã dừng, chưa thay gì. Thử lại sau.',
  conflict: 'Dữ liệu trên máy chủ vừa đổi (máy khác đang dùng?) nên chưa ghi gì. Bấm lại để thử lần nữa.',
};

/**
 * Màn chuyển dữ liệu v1 → v2 (task 2.6).
 * Nguồn 1: `localStorage` của v1 trên máy này. Nguồn 2: file JSON (backup của v1 hoặc "Tải bản sao" của v2).
 * Luôn hiện tóm tắt trước khi ghi. Tài khoản đã có dữ liệu: cảnh báo nếu bản nhập cũ hơn, và
 * `replaceAll` ghi một bản sao (`snapshots`) trước khi thay.
 */
export function Import({ store, state, hasData, onDone }: { store: Store; state: StoreState; hasData: boolean; onDone: () => void }) {
  const local = useMemo(readLocalV1, []);
  const [picked, setPicked] = useState<Candidate | null>(local);
  const [fileError, setFileError] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const current = useMemo(() => (hasData ? toV1(state.meta, state.decks) : null), [hasData, state]);
  const warns: Warn[] = useMemo(() => (picked && current ? compareFreshness(picked.data, current) : []), [picked, current]);
  const needAgree = hasData; // thay thế dữ liệu đang có luôn phải tick xác nhận

  function choose(next: Candidate | null) {
    setPicked(next);
    setAgreed(false);
    setError(null);
  }

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // chọn lại đúng file đó vẫn nhận
    if (!file) return;
    setFileError(null);
    let text: string;
    try {
      text = await file.text();
    } catch {
      setFileError('Không đọc được file.');
      return;
    }
    const next = readCandidate(text, file.name);
    if (!next) {
      setFileError(`"${file.name}" không phải file dữ liệu của app (cần file JSON xuất từ bản cũ).`);
      return;
    }
    choose(next);
  }

  async function submit() {
    if (!picked || busy) return;
    setBusy(true);
    setError(null);
    const res = await store.replaceAll(toV2(picked.data), 'before-import');
    setBusy(false);
    if (res.ok) onDone();
    else setError(ERRORS[res.error] ?? 'Chưa ghi được. Thử lại.');
  }

  return (
    <div className="import">
      {!hasData && (
        <p className="import-lead">
          Tài khoản này chưa có dữ liệu. Chuyển dữ liệu từ bản cũ sang một lần, sau đó mọi máy đăng nhập đều thấy cùng dữ liệu.
        </p>
      )}

      <section className="card import-card" aria-labelledby="import-src">
        <h2 className="section-title" id="import-src">
          Nguồn dữ liệu
        </h2>
        {local ? (
          <label className="choice">
            <input type="radio" name="import-src" checked={picked === local} onChange={() => choose(local)} />
            <span>
              <strong>Bản cũ trên máy này</strong>
              <span className="muted">{summaryText(local.summary)}</span>
            </span>
          </label>
        ) : (
          <p className="muted">Máy này không có dữ liệu của bản cũ. Hãy chọn file JSON đã xuất từ bản cũ (Cài đặt → Xuất backup).</p>
        )}
        {picked && picked !== local && (
          <label className="choice">
            <input type="radio" name="import-src" checked readOnly />
            <span>
              <strong>{picked.label}</strong>
              <span className="muted">{summaryText(picked.summary)}</span>
            </span>
          </label>
        )}
        <input ref={fileRef} className="visually-hidden" type="file" accept=".json,application/json" tabIndex={-1} aria-hidden="true" onChange={onFile} />
        <button className="btn" type="button" onClick={() => fileRef.current?.click()} disabled={busy}>
          {picked && picked !== local ? 'Chọn file khác' : 'Chọn file JSON'}
        </button>
        {fileError && (
          <p className="alert" role="alert">
            {fileError}
          </p>
        )}
      </section>

      {picked && (
        <section className="card import-card" aria-labelledby="import-sum">
          <h2 className="section-title" id="import-sum">
            Sẽ chuyển vào Recall
          </h2>
          <p className="import-summary">{summaryText(picked.summary)}</p>

          {picked.renamed.length > 0 && (
            <div className="import-block">
              <p className="muted">Học phần xong Ngày 1 từ 15/11 được đổi tên theo ngày xong:</p>
              <ul className="import-list">
                {picked.renamed.map((r) => (
                  <li key={r.id}>
                    <code>{r.from}</code> → <code>{r.to}</code>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {picked.fixes.length > 0 && (
            <div className="import-block">
              <p className="muted">File có chỗ thiếu, đã tự đắp:</p>
              <ul className="import-list">
                {picked.fixes.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            </div>
          )}

          {current && (
            <div className="import-block">
              <p className="muted">Đang có trong tài khoản: {summaryText(summarize(current))}</p>
              {warns.length > 0 && (
                <div className="alert" role="alert">
                  <strong>Bản sắp nhập CŨ HƠN dữ liệu đang có.</strong>
                  <ul className="import-list">
                    {warns.map((w) => (
                      <li key={w.kind}>{warnText(w)}</li>
                    ))}
                  </ul>
                </div>
              )}
              <label className="choice">
                <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
                <span>
                  Thay toàn bộ dữ liệu đang có bằng bản này. Recall lưu một bản sao của dữ liệu đang có trước khi thay.
                </span>
              </label>
            </div>
          )}

          {error && (
            <p className="alert" role="alert">
              {error}
            </p>
          )}

          <button className="btn btn-primary" type="button" onClick={submit} disabled={busy || (needAgree && !agreed)}>
            {busy ? 'Đang chuyển…' : hasData ? 'Thay dữ liệu' : 'Chuyển vào Recall'}
          </button>
        </section>
      )}
    </div>
  );
}
