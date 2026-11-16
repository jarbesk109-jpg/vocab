import { useEffect, useMemo, useRef, useState } from 'react';
import { dropDupTerms, findDupTerms, parseCards } from '../../../logic/index.js';
import type { StoreState } from '../data/useStore';
import { deckHref, hrefOf, setLeaveGuard } from '../router';

/** Một dòng đang soạn. `id` có khi là thẻ đã có trong deck; `was` là sao lúc mở màn (để biết sao có đổi không). */
type Row = { key: string; id: string | null; term: string; def: string; starred: boolean; was: boolean };

function uid(prefix: string): string {
  const raw = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Array.from(crypto.getRandomValues(new Uint8Array(16)), (x) => x.toString(16).padStart(2, '0')).join('');
  return prefix + raw.replace(/-/g, '').slice(0, 12);
}

const blank = (): Row => ({ key: uid('r'), id: null, term: '', def: '', starred: false, was: false });

type Props = {
  /** Chuỗi rỗng: tạo học phần mới. */
  deckId: string;
  state: StoreState;
  send: (cmd: Record<string, unknown>) => unknown;
};

/** Soạn học phần (task 2.13b): tạo, sửa, xoá mềm; dán danh sách; cảnh báo từ trùng deck khác; gắn/gỡ sao. Không giới hạn số từ. */
export function DeckEditor({ deckId, state, send }: Props) {
  const existing: any = deckId ? state.decks.find((d: any) => d.id === deckId) : null;
  const [name, setName] = useState<string>(existing?.name ?? '');
  const [rows, setRows] = useState<Row[]>(() =>
    existing
      ? (existing.cards || []).map((c: any) => ({ key: c.id, id: c.id, term: c.term ?? '', def: c.def ?? '', starred: !!c.starred, was: !!c.starred }))
      : [blank(), blank(), blank()],
  );
  const [paste, setPaste] = useState('');
  const [pasteNote, setPasteNote] = useState<{ added: number; badLines: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [dirty, setDirty] = useState(false);
  const focusKey = useRef<string | null>(null);
  const listRef = useRef<HTMLOListElement>(null);

  // Đang soạn dở: đóng tab / tải lại thì trình duyệt hỏi lại; chuyển màn trong app thì app hỏi lại (Khang 17/11).
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    setLeaveGuard('Học phần đang soạn còn thay đổi chưa lưu. Rời màn này thì các thay đổi đó bị bỏ. Vẫn rời?');
    return () => {
      window.removeEventListener('beforeunload', warn);
      setLeaveGuard(null);
    };
  }, [dirty]);

  // Dòng vừa thêm bằng Enter thì nhận focus.
  useEffect(() => {
    if (!focusKey.current) return;
    listRef.current?.querySelector<HTMLInputElement>(`[data-row="${focusKey.current}"] input`)?.focus();
    focusKey.current = null;
  });

  const filled = rows.filter((r) => r.term.trim() || r.def.trim());
  const dups = useMemo(() => findDupTerms(filled.map((r) => ({ term: r.term })), state.decks, deckId || null), [rows, state.decks, deckId]);

  if (deckId && !existing) {
    return (
      <div className="card empty">
        <strong>Không tìm thấy học phần này</strong>
        <span>
          Có thể học phần đã bị xoá. <a href={hrefOf('decks')}>Về Học phần</a>
        </span>
      </div>
    );
  }

  const touch = () => {
    setDirty(true);
    setError(null);
  };
  const patch = (key: string, p: Partial<Row>) => {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...p } : r)));
    touch();
  };
  const addRow = () => {
    const r = blank();
    focusKey.current = r.key;
    setRows((rs) => [...rs, r]);
  };
  const removeRow = (key: string) => {
    setRows((rs) => rs.filter((r) => r.key !== key));
    touch();
  };

  function addPasted() {
    const res = parseCards(paste);
    if (!res.cards.length && !res.bad) return;
    setRows((rs) => [...rs.filter((r) => r.term.trim() || r.def.trim() || r.id), ...res.cards.map((c: { term: string; def: string }) => ({ ...blank(), term: c.term, def: c.def }))]);
    setPasteNote({ added: res.cards.length, badLines: res.badLines });
    setPaste(res.badLines.join('\n')); // dòng lỗi ở lại để sửa rồi thêm tiếp
    if (res.cards.length) touch();
  }

  function dropDups() {
    const keep = new Set(dropDupTerms(filled.map((r) => ({ term: r.term, key: r.key })), dups).map((c: any) => c.key));
    setRows((rs) => rs.filter((r) => keep.has(r.key)));
    touch();
  }

  function save() {
    const title = name.trim();
    if (!title) return setError('Chưa đặt tên học phần.');
    const half = filled.filter((r) => !r.term.trim() || !r.def.trim());
    if (half.length) return setError(`Có ${half.length} thẻ thiếu từ hoặc thiếu nghĩa. Điền nốt hoặc xoá dòng đó.`);
    if (!filled.length) return setError('Học phần cần ít nhất một thẻ.');
    const id = deckId || uid('s');
    const cards = filled.map((r) => {
      const base = { id: r.id ?? uid('c'), term: r.term.trim(), def: r.def.trim() };
      return r.id ? base : { ...base, starred: r.starred }; // thẻ mới mang sao theo; thẻ cũ đổi sao bằng lệnh `star`
    });
    send({ type: 'deckUpsert', deck: { id, name: title, cards } });
    for (const r of filled) if (r.id && r.starred !== r.was) send({ type: 'star', deckId: id, cardId: r.id, starred: r.starred });
    setDirty(false);
    setLeaveGuard(null); // đã lưu: rời màn không hỏi
    window.location.hash = deckHref(id);
  }

  function remove() {
    send({ type: 'deckDelete', deckId });
    setDirty(false);
    setLeaveGuard(null);
    window.location.hash = hrefOf('decks');
  }

  return (
    <form
      className="editor"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <a className="study-exit" href={deckId ? deckHref(deckId) : hrefOf('decks')}>
        ← {deckId ? 'Chi tiết học phần' : 'Học phần'}
      </a>

      <div className="card">
        <label className="field">
          <span className="field-label">Tên học phần</span>
          <input
            className="input"
            type="text"
            value={name}
            autoComplete="off"
            placeholder="Ví dụ: 1811"
            onChange={(e) => {
              setName(e.target.value);
              touch();
            }}
          />
          {!deckId && <span className="muted">Học xong Ngày 1 thì học phần tự đổi tên theo ngày đó (DDMM).</span>}
        </label>
      </div>

      <section className="card editor-cards" aria-label="Các thẻ">
        <h2 className="section-title">
          {filled.length} thẻ
        </h2>
        <ol ref={listRef}>
          {rows.map((r, i) => (
            <li key={r.key} data-row={r.key}>
              <span className="editor-no" aria-hidden="true">
                {i + 1}
              </span>
              <input
                className="input"
                type="text"
                lang="en"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                aria-label={`Thẻ ${i + 1}: từ tiếng Anh`}
                placeholder="Từ tiếng Anh"
                value={r.term}
                onChange={(e) => patch(r.key, { term: e.target.value })}
              />
              <input
                className="input"
                type="text"
                lang="vi"
                aria-label={`Thẻ ${i + 1}: nghĩa tiếng Việt`}
                placeholder="Nghĩa tiếng Việt"
                value={r.def}
                onChange={(e) => patch(r.key, { def: e.target.value })}
                onKeyDown={(e) => {
                  // Enter ở ô nghĩa của dòng cuối: thêm dòng mới (không lưu cả học phần)
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (i === rows.length - 1) addRow();
                    else listRef.current?.querySelectorAll<HTMLInputElement>('li')[i + 1]?.querySelector('input')?.focus();
                  }
                }}
              />
              <button
                className="icon-btn editor-star"
                type="button"
                aria-pressed={r.starred}
                aria-label={r.starred ? `Thẻ ${i + 1}: gỡ sao` : `Thẻ ${i + 1}: gắn sao`}
                title={r.starred ? 'Gỡ sao' : 'Gắn sao'}
                onClick={() => patch(r.key, { starred: !r.starred })}
              >
                {r.starred ? '★' : '☆'}
              </button>
              <button className="icon-btn" type="button" aria-label={`Xoá thẻ ${i + 1}`} title="Xoá thẻ" onClick={() => removeRow(r.key)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
                  <path d="m7 7 10 10M17 7 7 17" />
                </svg>
              </button>
            </li>
          ))}
        </ol>
        <button className="btn" type="button" onClick={addRow}>
          Thêm thẻ
        </button>
      </section>

      <section className="card editor-paste" aria-label="Dán danh sách">
        <label className="field">
          <span className="field-label">Dán danh sách</span>
          <span className="muted">Mỗi dòng một thẻ: “từ: nghĩa”, hoặc “từ⇥nghĩa” (cách nhau bằng Tab, như Quizlet xuất ra).</span>
          <textarea className="input" rows={5} spellCheck={false} value={paste} onChange={(e) => setPaste(e.target.value)} />
        </label>
        {pasteNote && (
          <p className={pasteNote.badLines.length ? 'alert' : 'muted'} role="status">
            Đã thêm {pasteNote.added} thẻ.
            {pasteNote.badLines.length > 0 && ` ${pasteNote.badLines.length} dòng không đọc được (thiếu dấu “:” hoặc Tab, thiếu từ hoặc nghĩa) còn nằm trong ô trên để sửa.`}
          </p>
        )}
        <button className="btn" type="button" onClick={addPasted} disabled={!paste.trim()}>
          Thêm vào danh sách
        </button>
      </section>

      {dups.length > 0 && (
        <div className="alert editor-dups" role="status">
          <p>
            <strong>{dups.length} từ đã có ở học phần khác.</strong> Giữ lại cũng được; muốn bỏ thì bấm nút dưới.
          </p>
          <ul>
            {dups.map((d: { term: string; deck: string }) => (
              <li key={d.term}>
                {d.term} <span className="muted">(đã có ở {d.deck})</span>
              </li>
            ))}
          </ul>
          <button className="btn" type="button" onClick={dropDups}>
            Bỏ {dups.length} từ trùng
          </button>
        </div>
      )}

      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}

      <div className="editor-actions">
        <button className="btn btn-primary btn-lg" type="submit">
          {deckId ? 'Lưu thay đổi' : 'Tạo học phần'}
        </button>
        {deckId &&
          (confirmDelete ? (
            <div className="editor-confirm">
              <span>Xoá học phần “{existing.name}”? Dữ liệu vẫn được giữ trên máy chủ để khôi phục.</span>
              <button className="btn editor-danger" type="button" onClick={remove}>
                Xoá
              </button>
              <button className="btn" type="button" onClick={() => setConfirmDelete(false)}>
                Không xoá
              </button>
            </div>
          ) : (
            <button className="btn editor-danger" type="button" onClick={() => setConfirmDelete(true)}>
              Xoá học phần
            </button>
          ))}
      </div>
    </form>
  );
}
