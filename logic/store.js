// Kho lệnh và hàng chờ gửi (PLAN.md mục 3.9).
// File này vẫn THUẦN theo luật của logic/: nơi lưu (localStorage), backend (Supabase), bộ sinh id,
// ngày học và trạng thái mạng đều được TRUYỀN VÀO `createStore`. Test dùng bản giả trong bộ nhớ.

import { bumpCard, overrideRight } from './answers.js';
import { renameOnDay1 } from './decks.js';
import { emptyState, toV1, toV2 } from './migrate.js';
import { OFFSETS, applySessionResult, availableUnits } from './schedule.js';
import { creditSession, recordAnswer, useFreeze } from './streak.js';
import { splitWeak } from './weak.js';

/** Khoá localStorage của hàng chờ gửi. */
export const OUTBOX_KEY = 'recall.outbox.v1';
/** Khoá localStorage của bản sao server gần nhất (kèm rev). */
export const CACHE_KEY = 'recall.cache.v1';
/** `meta.applied` giữ bấy nhiêu id lệnh gần nhất (để không áp một lệnh hai lần). */
export const APPLIED_MAX = 300;
/** Gặp REV_CONFLICT thì tải lại rồi áp lại, tối đa bấy nhiêu lần mỗi lượt gửi. */
export const MAX_RELOADS = 3;

/* ------------------------------------------------------------------ */
/* applyCommand                                                         */
/* ------------------------------------------------------------------ */

/** Thay deck ở vị trí `i` bằng `deck`; các deck khác giữ nguyên đối tượng. */
function withDeck(state, i, deck) {
  const decks = state.decks.slice();
  decks[i] = deck;
  return { ...state, decks };
}

/** Thay một thẻ của deck ở vị trí `i` bằng kết quả `fn(thẻ)`. Không tìm thấy thì trả về null. */
function withCard(state, deckId, cardId, fn) {
  const i = state.decks.findIndex((d) => d.id === deckId);
  if (i < 0) return null;
  const deck = state.decks[i];
  const ci = (deck.cards || []).findIndex((c) => c.id === cardId);
  if (ci < 0) return null;
  const cards = deck.cards.slice();
  cards[ci] = fn(cards[ci]);
  return withDeck(state, i, { ...deck, cards });
}

/** Các deck đã tính lượt trong ngày `day`. */
function creditedOn(activity, day) {
  const rec = activity && activity[day];
  return rec && Array.isArray(rec.d) ? rec.d : [];
}

/** Thẻ mới do người dùng soạn: đắp các trường mặc định. */
function newCard(c) {
  return { note: '', starred: false, st: {}, ...c };
}

function upsertDeck(state, cmd) {
  const src = cmd.deck;
  if (!src || !src.id) return state;
  const deleted = state.deleted || [];
  const i = state.decks.findIndex((d) => d.id === src.id);
  const di = i < 0 ? deleted.findIndex((d) => d.id === src.id) : -1;
  const existing = i >= 0 ? state.decks[i] : di >= 0 ? deleted[di] : null;
  let deck;
  if (existing) {
    // Deck đã có: chỉ đổi tên và nội dung thẻ. Tiến độ (mốc, lịch, lịch sử, điểm từng thẻ, sao)
    // luôn lấy từ bản đang có, để bản soạn cũ không đè mất kết quả học ở máy khác.
    const old = new Map((existing.cards || []).map((c) => [c.id, c]));
    const cards = Array.isArray(src.cards)
      ? src.cards.map((c) => {
          const o = old.get(c.id);
          return o ? { ...o, term: c.term ?? o.term, def: c.def ?? o.def, note: c.note ?? o.note } : newCard(c);
        })
      : existing.cards;
    deck = { ...existing, name: src.name ?? existing.name, cards };
  } else {
    deck = {
      projectId: state.meta.currentProj,
      anchor: cmd.day,
      createdAt: cmd.day,
      stageIdx: 0,
      lastCompleted: null,
      history: [],
      ...src,
      cards: (src.cards || []).map(newCard),
    };
    if (deck.projectId === undefined) delete deck.projectId;
  }
  if (i >= 0) return withDeck(state, i, deck);
  const order = state.meta.deckOrder || [];
  return {
    ...state,
    decks: [...state.decks, deck],
    deleted: di >= 0 ? deleted.filter((_, j) => j !== di) : deleted,
    meta: { ...state.meta, deckOrder: order.includes(deck.id) ? order : [...order, deck.id] },
  };
}

/**
 * Áp MỘT lệnh lên state. Thuần: không sửa `state`, phần không đổi giữ nguyên đối tượng.
 * Lệnh trỏ tới deck / thẻ không còn (ví dụ máy khác đã xoá) hoặc loại lệnh lạ: trả lại đúng `state`.
 *
 * Các loại lệnh (mọi lệnh có `id`, `day` = ngày học lúc phát sinh):
 * - `answer`      { deckId, cardId, dir, ok, typo? }   một câu trả lời (lật flashcard KHÔNG phát lệnh này)
 * - `override`    { deckId, cardId, dir }              "Tôi đã gõ đúng"
 * - `sessionDone` { deckId, mode, pct, full? }         xong một phiên Học / Viết / Kiểm tra
 * - `useFreeze`   {}                                   bấm "Dùng băng"
 * - `star`        { deckId, cardId, starred }
 * - `deckUpsert`  { deck }                             tạo deck, sửa tên / thẻ, hoặc khôi phục deck đã xoá
 * - `deckDelete`  { deckId }                           xoá mềm
 * - `settings`    { patch }
 *
 * @param {{ meta: any, decks: any[], deleted?: any[] }} state
 * @param {any} cmd
 * @returns {{ meta: any, decks: any[], deleted?: any[] }}
 */
export function applyCommand(state, cmd) {
  const day = cmd.day;
  const meta = state.meta;
  switch (cmd.type) {
    case 'answer': {
      const next = withCard(state, cmd.deckId, cmd.cardId, (c) => bumpCard(c, !!cmd.ok, cmd.dir, !!cmd.typo, day));
      if (!next) return state;
      const activity = meta.activity || {};
      // avail tính SAU khi deck đã cập nhật (mục 3.4)
      const avail = availableUnits(next.decks, day, creditedOn(activity, day));
      return { ...next, meta: { ...meta, activity: recordAnswer(activity, day, cmd.deckId, avail) } };
    }
    case 'override':
      return withCard(state, cmd.deckId, cmd.cardId, (c) => overrideRight(c, cmd.dir, day)) || state;
    case 'star':
      return withCard(state, cmd.deckId, cmd.cardId, (c) => ({ ...c, starred: !!cmd.starred })) || state;
    case 'sessionDone': {
      const i = state.decks.findIndex((d) => d.id === cmd.deckId);
      if (i < 0) return state;
      const kpi = (meta.settings && meta.settings.kpi) ?? 90;
      const res = applySessionResult(state.decks[i], { mode: cmd.mode, pct: cmd.pct, full: !!cmd.full }, day, kpi);
      // mục 3.10: xong Ngày 1 thì đổi tên; so trùng với các deck KHÁC chưa xoá
      const others = state.decks.filter((_, j) => j !== i).map((d) => d.name);
      let deck = renameOnDay1(res, others, day);
      // phiên Viết luôn để lại một dòng trong lịch sử deck (mục 3.7 `lastWrite`), kể cả khi không đổi mốc
      if (cmd.mode === 'write') {
        deck = { ...deck, history: [...(deck.history || []), { date: day, pct: Math.round(cmd.pct), mode: 'write' }] };
      }
      let next = withDeck(state, i, deck);
      // Phase 3: vừa qua mốc +16 (xong vòng) thì thẻ còn sai tách sang deck "Thẻ yếu"
      if (res.advanced && res.stageTo >= OFFSETS.length) next = splitWeak(next, cmd.deckId, day, cmd.id);
      if (!res.credit) return next;
      const activity = meta.activity || {};
      const d = creditedOn(activity, day);
      const credited = d.includes(cmd.deckId) ? d : [...d, cmd.deckId];
      const avail = availableUnits(next.decks, day, credited);
      return { ...next, meta: { ...meta, activity: creditSession(activity, day, cmd.deckId, avail) } };
    }
    case 'useFreeze': {
      const streak = meta.streak || {};
      return { ...state, meta: { ...meta, streak: { ...streak, freezeUsedDays: useFreeze(streak.freezeUsedDays || [], day) } } };
    }
    case 'settings':
      return { ...state, meta: { ...meta, settings: { ...meta.settings, ...cmd.patch } } };
    case 'deckUpsert':
      return upsertDeck(state, cmd);
    case 'deckDelete': {
      const i = state.decks.findIndex((d) => d.id === cmd.deckId);
      if (i < 0) return state;
      return {
        ...state,
        decks: state.decks.filter((_, j) => j !== i),
        deleted: [...(state.deleted || []), state.decks[i]],
        meta: { ...meta, deckOrder: (meta.deckOrder || []).filter((id) => id !== cmd.deckId) },
      };
    }
    default:
      return state;
  }
}

/* ------------------------------------------------------------------ */
/* Bản server ⇄ state                                                   */
/* ------------------------------------------------------------------ */

/**
 * Bản server của một tài khoản chưa có dữ liệu.
 * Hình dạng bản server: `{ meta, metaRev, decks: [{ id, data, rev, deleted }] }`; `metaRev 0` = chưa có dòng meta.
 */
export function emptyServer() {
  return { meta: null, metaRev: 0, decks: [] };
}

/** `meta` của app trống (KPI 90, chưa có deck). */
function emptyMeta() {
  return toV2(emptyState()).meta;
}

/**
 * Bản server → state cho `applyCommand`: deck chưa xoá xếp theo `meta.deckOrder`
 * (deck ngoài danh sách xếp cuối), deck đã xoá mềm nằm riêng trong `deleted`.
 * @returns {{ meta: any, decks: any[], deleted: any[] }}
 */
export function serverToState(server) {
  const meta = server.meta || emptyMeta();
  const rows = server.decks || [];
  const active = new Map(rows.filter((r) => !r.deleted).map((r) => [r.id, r.data]));
  const decks = [];
  for (const id of meta.deckOrder || []) {
    if (active.has(id)) {
      decks.push(active.get(id));
      active.delete(id);
    }
  }
  for (const d of active.values()) decks.push(d);
  return { meta, decks, deleted: rows.filter((r) => r.deleted).map((r) => r.data) };
}

const same = (a, b) => a === b || JSON.stringify(a) === JSON.stringify(b);

/**
 * Các dòng deck cần gửi cho `save_state` để server từ `server` thành `state`:
 * chỉ deck có thay đổi, kèm `rev` đang biết (0 = dòng mới).
 * @returns {{ id: string, data: any, rev: number, deleted: boolean }[]}
 */
export function diffRows(server, state) {
  const byId = new Map((server.decks || []).map((r) => [r.id, r]));
  const rows = [];
  for (const d of state.decks) {
    const r = byId.get(d.id);
    if (!r) rows.push({ id: d.id, data: d, rev: 0, deleted: false });
    else if (r.deleted || !same(r.data, d)) rows.push({ id: d.id, data: d, rev: r.rev, deleted: false });
  }
  for (const d of state.deleted || []) {
    const r = byId.get(d.id);
    // deck tạo rồi xoá ngay, server chưa từng có: không có gì để gửi
    if (r && (!r.deleted || !same(r.data, d))) rows.push({ id: d.id, data: d, rev: r.rev, deleted: true });
  }
  return rows;
}

/** Bản server sau khi `save_state(meta, server.metaRev, rows)` thành công (tính đúng như hàm SQL). */
function afterSave(server, meta, rows) {
  const byId = new Map((server.decks || []).map((r) => [r.id, r]));
  for (const r of rows) {
    byId.set(r.id, r.rev === 0 ? { id: r.id, data: r.data, rev: 1, deleted: false } : { id: r.id, data: r.data, rev: r.rev + 1, deleted: !!r.deleted });
  }
  return { meta, metaRev: server.metaRev === 0 ? 1 : server.metaRev + 1, decks: [...byId.values()] };
}

/* ------------------------------------------------------------------ */
/* createStore                                                          */
/* ------------------------------------------------------------------ */

/**
 * Kho dữ liệu của v2.
 * - Giao diện luôn thấy `áp dụng(bản server, các lệnh còn trong outbox)` qua `getState()`.
 * - `dispatch` chỉ ghi lệnh vào outbox (lưu ngay); `flush` mới gửi. Giao diện gọi `flush` sau mỗi lệnh,
 *   khi có sự kiện `online`, khi cửa sổ được focus, và mỗi 30 giây.
 *
 * @param {object} deps
 * @param {{ load: () => Promise<any>, save: (meta: any, metaRev: number, rows: any[]) => Promise<void>,
 *           snapshot: (reason: string, data: any) => Promise<void> }} deps.backend
 *   `save` ném lỗi có `code === 'REV_CONFLICT'` khi rev không khớp; mọi lỗi khác coi là lỗi mạng.
 * @param {{ getItem: (k: string) => string | null, setItem: (k: string, v: string) => void }} deps.storage
 * @param {() => string} deps.newId id mới cho lệnh (uuid)
 * @param {() => string} deps.today ngày học hiện tại 'YYYY-MM-DD'
 * @param {() => boolean} [deps.isOnline]
 */
export function createStore({ backend, storage, newId, today, isOnline = () => true }) {
  const read = (key, fallback, ok) => {
    try {
      const v = JSON.parse(storage.getItem(key));
      return ok(v) ? v : fallback;
    } catch {
      return fallback;
    }
  };
  const write = (key, value) => {
    try {
      storage.setItem(key, JSON.stringify(value));
    } catch {
      /* hết chỗ lưu: vẫn chạy tiếp bằng bản trong bộ nhớ */
    }
  };

  let server = read(CACHE_KEY, emptyServer(), (v) => v && typeof v === 'object' && Array.isArray(v.decks));
  let outbox = read(OUTBOX_KEY, [], Array.isArray);
  let view = null;
  let flushing = null;
  let error = null;
  const listeners = new Set();

  const emit = () => {
    view = null;
    for (const fn of [...listeners]) fn();
  };
  const setServer = (s) => {
    server = s;
    write(CACHE_KEY, server);
  };
  const setOutbox = (o) => {
    outbox = o;
    write(OUTBOX_KEY, outbox);
  };
  /** Các lệnh trong `cmds` mà server chưa áp. */
  const notApplied = (cmds) => {
    const applied = new Set((server.meta && server.meta.applied) || []);
    return cmds.filter((c) => !applied.has(c.id));
  };
  /** @returns {{ ok: false, error: any }} */
  const fail = (code) => {
    error = code;
    emit();
    return { ok: false, error: code };
  };
  /** @returns {{ ok: true }} */
  const done = () => {
    error = null;
    emit();
    return { ok: true };
  };

  function getState() {
    if (!view) view = notApplied(outbox).reduce(applyCommand, serverToState(server));
    return view;
  }

  function dispatch(cmd) {
    const full = { ...cmd, id: cmd.id || newId(), day: cmd.day || today() };
    setOutbox([...outbox, full]);
    emit();
    return full;
  }

  async function runFlush() {
    let reloads = 0;
    for (;;) {
      const batch = outbox.slice();
      if (!batch.length) return done();
      const ids = new Set(batch.map((c) => c.id));
      const dropBatch = () => setOutbox(outbox.filter((c) => !ids.has(c.id)));
      const todo = notApplied(batch);
      if (!todo.length) {
        // server đã áp hết (lần gửi trước đã ghi nhưng mất phản hồi)
        dropBatch();
        continue;
      }
      const next = todo.reduce(applyCommand, serverToState(server));
      const applied = [...(next.meta.applied || []), ...todo.map((c) => c.id)].slice(-APPLIED_MAX);
      const meta = { ...next.meta, applied };
      const rows = diffRows(server, next);
      try {
        await backend.save(meta, server.metaRev, rows);
      } catch (e) {
        if (!e || e.code !== 'REV_CONFLICT') return fail('network');
        if (reloads >= MAX_RELOADS) return fail('conflict');
        reloads++;
        try {
          setServer(await backend.load());
        } catch {
          return fail('network');
        }
        emit();
        continue;
      }
      setServer(afterSave(server, meta, rows));
      dropBatch();
      emit();
    }
  }

  return {
    /** State giao diện hiển thị: `{ meta, decks, deleted }`. */
    getState,
    /** `pending` số lệnh chờ gửi; `syncing`; `error` null | 'network' | 'conflict'; `empty` tài khoản chưa có dữ liệu. */
    getStatus: () => ({ pending: outbox.length, syncing: !!flushing, error, empty: server.metaRev === 0 }),
    /** Đăng ký nghe thay đổi; trả về hàm huỷ. */
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    /** Tải bản server về (lúc mở app, sau khi đăng nhập). Lỗi mạng thì giữ bản đang có. */
    async load() {
      try {
        setServer(await backend.load());
      } catch {
        return fail('network');
      }
      return done();
    },
    /** Phát một lệnh: gắn `id`, `day`, cho vào outbox. Không tự gửi. */
    dispatch,
    /**
     * Mở một phiên học. Phiên bắt đầu lúc OFFLINE không phát lệnh nào (luyện tập, không ghi tiến độ),
     * kể cả khi mạng có lại giữa phiên. Phiên bắt đầu lúc có mạng thì luôn ghi, rớt mạng vẫn ghi.
     */
    startSession() {
      const recording = !!isOnline();
      return { recording, dispatch: (cmd) => (recording ? dispatch(cmd) : null) };
    },
    /** Gửi mọi lệnh đang chờ. Gọi chồng lên nhau thì chỉ chạy một lượt. */
    flush() {
      if (!flushing) {
        flushing = runFlush().finally(() => {
          flushing = null;
        });
      }
      return flushing;
    },
    /**
     * Thay thế TOÀN BỘ dữ liệu (nhập dữ liệu, xoá sạch). Cần mạng.
     * Tài khoản đã có dữ liệu: ghi một bản sao (dạng v1, gồm cả lệnh đang chờ) trước; ghi không được thì dừng.
     * Deck cũ không có trong dữ liệu mới thành xoá mềm. Lệnh đang chờ bị bỏ cùng dữ liệu cũ.
     * @param {{ meta: any, decks: any[] }} data
     * @param {string} reason 'before-import' | 'before-reset'
     * @returns {Promise<{ ok: true } | { ok: false, error: 'network' | 'snapshot' | 'conflict' }>}
     */
    async replaceAll(data, reason) {
      if (flushing) await flushing;
      try {
        setServer(await backend.load());
      } catch {
        return fail('network');
      }
      view = null;
      if (server.metaRev > 0) {
        const cur = getState();
        try {
          await backend.snapshot(reason, toV1(cur.meta, cur.decks));
        } catch {
          return fail('snapshot');
        }
      }
      const keep = new Set(data.decks.map((d) => d.id));
      const meta = { ...data.meta, deckOrder: data.decks.map((d) => d.id), applied: [] };
      const target = { meta, decks: data.decks, deleted: server.decks.filter((r) => !keep.has(r.id)).map((r) => r.data) };
      const rows = diffRows(server, target);
      try {
        await backend.save(meta, server.metaRev, rows);
      } catch (e) {
        return fail(e && e.code === 'REV_CONFLICT' ? 'conflict' : 'network');
      }
      setServer(afterSave(server, meta, rows));
      setOutbox([]);
      return done();
    },
  };
}
