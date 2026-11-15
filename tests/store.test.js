import { describe, it, expect } from 'vitest';
import {
  APPLIED_MAX,
  CACHE_KEY,
  OUTBOX_KEY,
  applyCommand,
  createStore,
  diffRows,
  emptyServer,
  serverToState,
  toV1,
  toV2,
} from '../logic/index.js';
import { mkCard, mkDeck, mkReviewDeck, mkState, mkStudiedDeck } from './fixtures/small.js';

const T = '2026-11-15';
const T2 = '2026-11-16';
const clone = (x) => structuredClone(x);

/* ------------------------------------------------------------------ */
/* Dữ liệu giả                                                          */
/* ------------------------------------------------------------------ */
/** State v2 gồm: deck kho `k` (2 thẻ), deck ôn `r` (mốc 2, đến hạn hôm nay), deck kho `k2`. */
const baseV1 = () => mkState([mkDeck('k', { n: 2 }), mkReviewDeck('r', 2, T), mkDeck('k2', { n: 1 })]);
const baseState = () => ({ ...toV2(baseV1()), deleted: [] });
const deckOf = (state, id) => state.decks.find((d) => d.id === id);
const cardOf = (state, deckId, cardId) => deckOf(state, deckId).cards.find((c) => c.id === cardId);
const cmd = (type, over = {}) => ({ id: 'c-' + Math.random().toString(36).slice(2), day: T, type, ...over });
const answer = (deckId, cardId, over = {}) => cmd('answer', { deckId, cardId, dir: 'prod', ok: true, ...over });

/* ------------------------------------------------------------------ */
/* Backend giả trong bộ nhớ: làm đúng như hàm SQL save_state (mục 3.9)  */
/* ------------------------------------------------------------------ */
function netError() {
  return new Error('Failed to fetch');
}
function conflict(what) {
  const e = new Error('REV_CONFLICT ' + what);
  e.code = 'REV_CONFLICT';
  return e;
}
function fakeBackend() {
  const db = { meta: null, metaRev: 0, decks: new Map(), snapshots: [] };
  const b = {
    db,
    calls: { load: 0, save: 0, snapshot: 0 },
    saves: [], // các lần save đã COMMIT: { meta, rows }
    failNext: [], // 'network' (không ghi) | 'lost' (đã ghi nhưng mất phản hồi) | 'conflict'
    failLoad: false,
    failSnapshot: false,
    beforeSave: null, // chạy một lần ngay trước lần save kế
    async load() {
      b.calls.load++;
      if (b.failLoad) throw netError();
      return clone({
        meta: db.meta,
        metaRev: db.metaRev,
        decks: [...db.decks.entries()].map(([id, r]) => ({ id, data: r.data, rev: r.rev, deleted: r.deleted })),
      });
    },
    async save(meta, metaRev, rows) {
      b.calls.save++;
      if (b.beforeSave) {
        const f = b.beforeSave;
        b.beforeSave = null;
        await f();
      }
      const mode = b.failNext.shift();
      if (mode === 'network') throw netError();
      if (mode === 'conflict') throw conflict('meta');
      // "transaction": kiểm hết rồi mới ghi
      if (metaRev === 0 ? db.meta !== null : db.metaRev !== metaRev) throw conflict('meta');
      for (const r of rows) {
        if (r.rev === 0) {
          if (db.decks.has(r.id)) throw new Error('duplicate key');
        } else if (!db.decks.has(r.id) || db.decks.get(r.id).rev !== r.rev) throw conflict('deck ' + r.id);
      }
      db.meta = clone(meta);
      db.metaRev = metaRev === 0 ? 1 : metaRev + 1;
      for (const r of rows) {
        if (r.rev === 0) db.decks.set(r.id, { data: clone(r.data), rev: 1, deleted: false });
        else db.decks.set(r.id, { data: clone(r.data), rev: r.rev + 1, deleted: !!r.deleted });
      }
      b.saves.push(clone({ meta, rows }));
      if (mode === 'lost') throw netError();
    },
    async snapshot(reason, data) {
      b.calls.snapshot++;
      if (b.failSnapshot) throw netError();
      db.snapshots.push(clone({ reason, data }));
    },
  };
  return b;
}
/** localStorage giả. */
function fakeStorage() {
  const m = new Map();
  return {
    m,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => void m.set(k, String(v)),
    removeItem: (k) => void m.delete(k),
  };
}
/** Ghi sẵn dữ liệu vào server giả (như đã chuyển dữ liệu xong). */
function seed(backend, v1 = baseV1()) {
  const { meta, decks } = toV2(v1);
  backend.db.meta = clone(meta);
  backend.db.metaRev = 1;
  for (const d of decks) backend.db.decks.set(d.id, { data: clone(d), rev: 1, deleted: false });
}
function mkStore(backend, over = {}) {
  let n = 0;
  const env = { day: T, online: true, storage: fakeStorage(), ...over };
  const store = createStore({
    backend,
    storage: env.storage,
    newId: () => (env.prefix || 'id') + '-' + ++n,
    today: () => env.day,
    isOnline: () => env.online,
  });
  return { store, env };
}
async function ready(over) {
  const backend = fakeBackend();
  seed(backend);
  const { store, env } = mkStore(backend, over);
  expect(await store.load()).toEqual({ ok: true });
  return { backend, store, env };
}
const dbDeck = (backend, id) => backend.db.decks.get(id);
const dbCard = (backend, deckId, cardId) => dbDeck(backend, deckId).data.cards.find((c) => c.id === cardId);

/* ================================================================== */
describe('applyCommand: từng loại lệnh (mục 3.9)', () => {
  it('answer đúng: ghi điểm thẻ, ghi hoạt động theo day của lệnh; deck khác giữ nguyên đối tượng', () => {
    const s = baseState();
    const out = applyCommand(s, answer('id-k', 'k-1'));
    expect(cardOf(out, 'id-k', 'k-1').st.prod).toEqual({ r: 1, w: 0, streak: 1, typo: 0, last: T });
    expect(cardOf(out, 'id-k', 'k-2')).toBe(cardOf(s, 'id-k', 'k-2'));
    expect(deckOf(out, 'id-r')).toBe(deckOf(s, 'id-r'));
    // avail: deck ôn r đang chờ (1) + 1 deck kho (k2; k vừa thành học dở → đang chờ) = k, r chờ + 1 kho = 3
    expect(out.meta.activity[T]).toEqual({ n: 1, by: { 'id-k': 1 }, d: [], a: 3 });
  });
  it('answer sai: w++, gắn sao; typo; chiều recog', () => {
    const s = baseState();
    const wrong = applyCommand(s, answer('id-k', 'k-1', { ok: false }));
    expect(cardOf(wrong, 'id-k', 'k-1').st.prod).toMatchObject({ w: 1, streak: 0, _prevStreak: 0 });
    expect(cardOf(wrong, 'id-k', 'k-1').starred).toBe(true);
    const typo = applyCommand(s, answer('id-k', 'k-1', { dir: 'recog', typo: true }));
    expect(cardOf(typo, 'id-k', 'k-1').st.recog).toMatchObject({ r: 1, typo: 1 });
    expect(typo.meta.activity[T].n).toBe(1);
  });
  it('override: hoàn lại cú chấm sai, gỡ sao; KHÔNG cộng thêm câu vào hoạt động', () => {
    const wrong = applyCommand(baseState(), answer('id-k', 'k-1', { ok: false }));
    const out = applyCommand(wrong, cmd('override', { deckId: 'id-k', cardId: 'k-1', dir: 'prod' }));
    expect(cardOf(out, 'id-k', 'k-1').st.prod).toEqual({ r: 1, w: 0, streak: 1, typo: 0, last: T });
    expect(cardOf(out, 'id-k', 'k-1').starred).toBe(false);
    expect(out.meta.activity).toEqual(wrong.meta.activity);
  });
  it('sessionDone: deck mới Học xong đủ thẻ → mốc 1, tính lượt, ĐỔI TÊN theo ngày của lệnh (mục 3.10)', () => {
    let s = baseState();
    s = applyCommand(s, answer('id-k', 'k-1'));
    s = applyCommand(s, answer('id-k', 'k-2'));
    const out = applyCommand(s, cmd('sessionDone', { deckId: 'id-k', mode: 'learn', pct: 100, full: false }));
    expect(deckOf(out, 'id-k')).toMatchObject({ name: '1511', stageIdx: 1, anchor: T, startedAt: T, lastCompleted: T });
    expect(out.meta.activity[T].d).toEqual(['id-k']);
    expect(out.meta.activity[T].n).toBe(2);
    expect(out.meta.deckOrder).toEqual(['id-k', 'id-r', 'id-k2']); // id không đổi, thứ tự không đổi
  });
  it('sessionDone: deck thứ hai xong Ngày 1 cùng ngày → hậu tố b; deck đã xoá mềm không tính trùng', () => {
    const learnAll = (s, id, cardIds) => {
      for (const c of cardIds) s = applyCommand(s, answer(id, c));
      return applyCommand(s, cmd('sessionDone', { deckId: id, mode: 'learn', pct: 100, full: false }));
    };
    let s = learnAll(baseState(), 'id-k', ['k-1', 'k-2']);
    const second = learnAll(s, 'id-k2', ['k2-1']);
    expect(deckOf(second, 'id-k2').name).toBe('1511b');
    // xoá deck 1511 rồi deck kia mới xong Ngày 1 → được tên 1511
    s = applyCommand(s, cmd('deckDelete', { deckId: 'id-k' }));
    expect(deckOf(learnAll(s, 'id-k2', ['k2-1']), 'id-k2').name).toBe('1511');
  });
  it('sessionDone: lệnh gửi muộn vẫn lấy tên và ngày theo day lúc phát sinh', () => {
    let s = baseState();
    s = applyCommand(s, { ...answer('id-k2', 'k2-1'), day: '2026-11-20' });
    const out = applyCommand(s, { ...cmd('sessionDone', { deckId: 'id-k2', mode: 'learn', pct: 100 }), day: '2026-11-20' });
    expect(deckOf(out, 'id-k2')).toMatchObject({ name: '2011', startedAt: '2026-11-20' });
    expect(Object.keys(out.meta.activity)).toEqual(['2026-11-20']);
  });
  it('sessionDone: deck ôn Kiểm tra đủ bài đạt KPI → lên mốc, tính lượt, KHÔNG đổi tên', () => {
    const out = applyCommand(baseState(), cmd('sessionDone', { deckId: 'id-r', mode: 'test', pct: 95, full: true }));
    expect(deckOf(out, 'id-r')).toMatchObject({ name: 'r', stageIdx: 3, lastCompleted: T });
    expect(deckOf(out, 'id-r').history.at(-1)).toEqual({ date: T, pct: 95, mode: 'test', stage: 2 });
    expect(out.meta.activity[T]).toMatchObject({ d: ['id-r'] });
  });
  it('sessionDone: ôn trượt (không phục hồi) → đứng yên nhưng vẫn tính lượt; KPI lấy từ cài đặt', () => {
    const s = baseState();
    const fail = applyCommand(s, cmd('sessionDone', { deckId: 'id-r', mode: 'test', pct: 85, full: true }));
    expect(deckOf(fail, 'id-r')).toMatchObject({ name: 'r', stageIdx: 2, lastCompleted: deckOf(s, 'id-r').lastCompleted });
    expect(fail.meta.activity[T].d).toEqual(['id-r']);
    const easy = { ...s, meta: { ...s.meta, settings: { ...s.meta.settings, kpi: 80 } } };
    const pass = applyCommand(easy, cmd('sessionDone', { deckId: 'id-r', mode: 'test', pct: 85, full: true }));
    expect(deckOf(pass, 'id-r').stageIdx).toBe(3);
  });
  it('sessionDone: bài Kiểm tra rút gọn (full false) và flashcard không lên mốc, không tính lượt', () => {
    const s = baseState();
    for (const c of [
      cmd('sessionDone', { deckId: 'id-r', mode: 'test', pct: 100, full: false }),
      cmd('sessionDone', { deckId: 'id-r', mode: 'flash', pct: 100 }),
    ]) {
      const out = applyCommand(s, c);
      expect(out.decks).toEqual(s.decks);
      expect(out.meta.activity).toEqual({});
    }
  });
  it('useFreeze: ghi ngày của lệnh vào streak.freezeUsedDays (không trùng)', () => {
    let s = applyCommand(baseState(), cmd('useFreeze'));
    s = applyCommand(s, cmd('useFreeze'));
    expect(s.meta.streak).toEqual({ freezeUsedDays: [T] });
  });
  it('star: gắn / gỡ sao một thẻ', () => {
    const on = applyCommand(baseState(), cmd('star', { deckId: 'id-k', cardId: 'k-2', starred: true }));
    expect(cardOf(on, 'id-k', 'k-2').starred).toBe(true);
    const off = applyCommand(on, cmd('star', { deckId: 'id-k', cardId: 'k-2', starred: false }));
    expect(cardOf(off, 'id-k', 'k-2').starred).toBe(false);
  });
  it('settings: đắp phần thay đổi, giữ phần còn lại', () => {
    const out = applyCommand(baseState(), cmd('settings', { patch: { kpi: 85 } }));
    expect(out.meta.settings).toEqual({ kpi: 85, testN: 20 });
  });
  it('deckUpsert deck mới: thêm vào cuối, có trong deckOrder, đủ trường mặc định', () => {
    const deck = { id: 'new', name: 'Mới', cards: [{ id: 'n1', term: 'a', def: 'b' }] };
    const out = applyCommand(baseState(), cmd('deckUpsert', { deck }));
    expect(out.decks.at(-1)).toEqual({
      id: 'new', name: 'Mới', projectId: 'p1', anchor: T, createdAt: T, stageIdx: 0, lastCompleted: null, history: [],
      cards: [{ id: 'n1', term: 'a', def: 'b', note: '', starred: false, st: {} }],
    });
    expect(out.meta.deckOrder).toEqual(['id-k', 'id-r', 'id-k2', 'new']);
  });
  it('deckUpsert deck đã có: chỉ đổi tên và nội dung thẻ; GIỮ tiến độ (mốc, lịch sử, điểm từng thẻ, sao)', () => {
    let s = applyCommand(baseState(), answer('id-r', 'r-1', { ok: false }));
    const before = deckOf(s, 'id-r');
    const edited = {
      id: 'id-r',
      name: 'Tên mới',
      stageIdx: 0, // bản soạn cũ: không được đè tiến độ
      history: [],
      cards: [
        { id: 'r-1', term: 'sửa', def: 'nghĩa sửa', note: 'ghi chú' }, // sửa nội dung
        { id: 'r-3', term: before.cards[2].term, def: before.cards[2].def }, // giữ, đổi thứ tự
        { id: 'r-mới', term: 'x', def: 'y' }, // thêm; r-2 bị bỏ
      ],
    };
    s = applyCommand(s, cmd('deckUpsert', { deck: edited }));
    const d = deckOf(s, 'id-r');
    expect(d).toMatchObject({ name: 'Tên mới', stageIdx: 2, anchor: before.anchor, history: before.history });
    expect(d.cards.map((c) => c.id)).toEqual(['r-1', 'r-3', 'r-mới']);
    expect(d.cards[0]).toMatchObject({ term: 'sửa', def: 'nghĩa sửa', note: 'ghi chú', starred: true });
    expect(d.cards[0].st).toEqual(before.cards[0].st);
    expect(d.cards[1].st).toEqual(before.cards[2].st);
    expect(d.cards[2]).toEqual({ id: 'r-mới', term: 'x', def: 'y', note: '', starred: false, st: {} });
    expect(s.meta.deckOrder).toEqual(['id-k', 'id-r', 'id-k2']);
  });
  it('deckDelete: xoá mềm (chuyển sang deleted, rời deckOrder); deckUpsert cùng id thì khôi phục', () => {
    const s = baseState();
    const del = applyCommand(s, cmd('deckDelete', { deckId: 'id-r' }));
    expect(del.decks.map((d) => d.id)).toEqual(['id-k', 'id-k2']);
    expect(del.deleted).toEqual([deckOf(s, 'id-r')]);
    expect(del.meta.deckOrder).toEqual(['id-k', 'id-k2']);
    const back = applyCommand(del, cmd('deckUpsert', { deck: { id: 'id-r' } }));
    expect(back.deleted).toEqual([]);
    expect(back.decks.at(-1)).toEqual(deckOf(s, 'id-r'));
    expect(back.meta.deckOrder).toEqual(['id-k', 'id-k2', 'id-r']);
  });
  it('lệnh trỏ tới deck / thẻ không còn, hoặc loại lệnh lạ: không đổi gì, không sập', () => {
    const s = baseState();
    expect(applyCommand(s, answer('không-có', 'k-1'))).toBe(s);
    expect(applyCommand(s, answer('id-k', 'không-có'))).toBe(s);
    expect(applyCommand(s, cmd('sessionDone', { deckId: 'không-có', mode: 'test', pct: 100, full: true }))).toBe(s);
    expect(applyCommand(s, cmd('deckDelete', { deckId: 'không-có' }))).toBe(s);
    expect(applyCommand(s, cmd('lạ'))).toBe(s);
  });
  it('không sửa state truyền vào (thử mọi loại lệnh)', () => {
    const s = baseState();
    const before = clone(s);
    const cmds = [
      answer('id-k', 'k-1'),
      answer('id-k', 'k-2', { ok: false }),
      cmd('override', { deckId: 'id-k', cardId: 'k-2', dir: 'prod' }),
      cmd('sessionDone', { deckId: 'id-r', mode: 'test', pct: 100, full: true }),
      cmd('useFreeze'),
      cmd('star', { deckId: 'id-k', cardId: 'k-1', starred: true }),
      cmd('settings', { patch: { kpi: 70 } }),
      cmd('deckUpsert', { deck: { id: 'id-k', name: 'đổi', cards: [] } }),
      cmd('deckDelete', { deckId: 'id-k2' }),
    ];
    let cur = s;
    for (const c of cmds) {
      const prev = clone(cur);
      const next = applyCommand(cur, c);
      expect(cur).toEqual(prev);
      cur = next;
    }
    expect(s).toEqual(before);
  });
});

describe('serverToState / diffRows', () => {
  it('serverToState: deck xếp theo deckOrder, deck đã xoá nằm riêng; tài khoản trống ra app trống', () => {
    const { meta, decks } = toV2(baseV1());
    const server = {
      meta: { ...meta, deckOrder: ['id-k2', 'id-k'] },
      metaRev: 4,
      decks: [
        { id: 'id-k', data: decks[0], rev: 2, deleted: false },
        { id: 'id-r', data: decks[1], rev: 3, deleted: true },
        { id: 'id-k2', data: decks[2], rev: 1, deleted: false },
      ],
    };
    const s = serverToState(server);
    expect(s.decks.map((d) => d.id)).toEqual(['id-k2', 'id-k']);
    expect(s.deleted.map((d) => d.id)).toEqual(['id-r']);
    const empty = serverToState(emptyServer());
    expect(empty.decks).toEqual([]);
    expect(empty.deleted).toEqual([]);
    expect(empty.meta).toMatchObject({ schemaVersion: 2, deckOrder: [], applied: [], settings: { kpi: 90 } });
  });
  it('diffRows: chỉ gửi deck có thay đổi, kèm rev đang biết; deck mới rev 0; xoá mềm deleted true', () => {
    const { meta, decks } = toV2(baseV1());
    const server = { meta, metaRev: 1, decks: decks.map((d, i) => ({ id: d.id, data: d, rev: i + 1, deleted: false })) };
    let s = serverToState(server);
    expect(diffRows(server, s)).toEqual([]);
    s = applyCommand(s, answer('id-r', 'r-1'));
    s = applyCommand(s, cmd('deckUpsert', { deck: { id: 'new', name: 'n', cards: [] } }));
    s = applyCommand(s, cmd('deckDelete', { deckId: 'id-k2' }));
    const rows = diffRows(server, s);
    expect(rows.map((r) => [r.id, r.rev, r.deleted])).toEqual([
      ['id-r', 2, false],
      ['new', 0, false],
      ['id-k2', 3, true],
    ]);
    expect(rows[0].data).toEqual(deckOf(s, 'id-r'));
  });
  it('diffRows: deck tạo rồi xoá ngay (server chưa từng có) thì không gửi gì', () => {
    const server = emptyServer();
    let s = serverToState(server);
    s = applyCommand(s, cmd('deckUpsert', { deck: { id: 'new', name: 'n', cards: [] } }));
    s = applyCommand(s, cmd('deckDelete', { deckId: 'new' }));
    expect(diffRows(server, s)).toEqual([]);
  });
});

/* ================================================================== */
describe('createStore: tải, phát lệnh, gửi', () => {
  it('chưa tải: app trống; load() lấy dữ liệu server và lưu bản sao vào cache', async () => {
    const backend = fakeBackend();
    seed(backend);
    const { store, env } = mkStore(backend);
    expect(store.getState().decks).toEqual([]);
    expect(store.getStatus()).toMatchObject({ pending: 0, empty: true });
    expect(await store.load()).toEqual({ ok: true });
    expect(store.getState().decks.map((d) => d.name)).toEqual(['k', 'r', 'k2']);
    expect(store.getStatus()).toMatchObject({ pending: 0, empty: false });
    expect(JSON.parse(env.storage.getItem(CACHE_KEY)).metaRev).toBe(1);
  });
  it('load() lỗi mạng: báo lỗi, giữ nguyên bản đang có', async () => {
    const { backend, store } = await ready();
    backend.failLoad = true;
    expect(await store.load()).toEqual({ ok: false, error: 'network' });
    expect(store.getState().decks.length).toBe(3);
  });
  it('dispatch: gắn id và day, giao diện thấy ngay kết quả, lệnh nằm trong outbox (đã lưu)', async () => {
    const { backend, store, env } = await ready();
    const c = store.dispatch({ type: 'answer', deckId: 'id-k', cardId: 'k-1', dir: 'prod', ok: true });
    expect(c).toMatchObject({ id: 'id-1', day: T, type: 'answer' });
    expect(cardOf(store.getState(), 'id-k', 'k-1').st.prod.r).toBe(1);
    expect(store.getStatus().pending).toBe(1);
    expect(JSON.parse(env.storage.getItem(OUTBOX_KEY))).toEqual([c]);
    expect(backend.calls.save).toBe(0); // dispatch không tự gửi
    expect(dbCard(backend, 'id-k', 'k-1').st.prod.r).toBe(0);
  });
  it('flush thành công: outbox rỗng, server đúng, rev tăng, chỉ gửi deck đã đổi, id lệnh vào meta.applied', async () => {
    const { backend, store, env } = await ready();
    store.dispatch({ type: 'answer', deckId: 'id-k', cardId: 'k-1', dir: 'prod', ok: true });
    store.dispatch({ type: 'answer', deckId: 'id-k', cardId: 'k-2', dir: 'prod', ok: false });
    expect(await store.flush()).toEqual({ ok: true });
    expect(store.getStatus()).toMatchObject({ pending: 0, error: null });
    expect(JSON.parse(env.storage.getItem(OUTBOX_KEY))).toEqual([]);
    expect(backend.calls.save).toBe(1);
    expect(backend.saves[0].rows.map((r) => r.id)).toEqual(['id-k']);
    expect(dbCard(backend, 'id-k', 'k-1').st.prod.r).toBe(1);
    expect(dbCard(backend, 'id-k', 'k-2').st.prod.w).toBe(1);
    expect(dbDeck(backend, 'id-k').rev).toBe(2);
    expect(dbDeck(backend, 'id-r').rev).toBe(1);
    expect(backend.db.metaRev).toBe(2);
    expect(backend.db.meta.applied).toEqual(['id-1', 'id-2']);
    expect(backend.db.meta.activity[T].n).toBe(2);
    // bản server trong máy khớp server thật → lần gửi sau không xung đột
    store.dispatch({ type: 'settings', patch: { kpi: 80 } });
    expect(await store.flush()).toEqual({ ok: true });
    expect(backend.calls.load).toBe(1);
    expect(backend.db.meta.settings.kpi).toBe(80);
    expect(backend.saves[1].rows).toEqual([]);
  });
  it('flush khi outbox rỗng: không gọi server', async () => {
    const { backend, store } = await ready();
    expect(await store.flush()).toEqual({ ok: true });
    expect(backend.calls.save).toBe(0);
  });
  it('lỗi mạng: lệnh ở lại outbox, giao diện vẫn thấy kết quả; mạng về thì gửi được, outbox rỗng, server đúng', async () => {
    const { backend, store } = await ready();
    store.dispatch({ type: 'answer', deckId: 'id-k', cardId: 'k-1', dir: 'prod', ok: true });
    backend.failNext.push('network');
    expect(await store.flush()).toEqual({ ok: false, error: 'network' });
    expect(store.getStatus()).toMatchObject({ pending: 1, error: 'network' });
    expect(cardOf(store.getState(), 'id-k', 'k-1').st.prod.r).toBe(1);
    expect(dbCard(backend, 'id-k', 'k-1').st.prod.r).toBe(0);
    expect(await store.flush()).toEqual({ ok: true });
    expect(store.getStatus()).toMatchObject({ pending: 0, error: null });
    expect(dbCard(backend, 'id-k', 'k-1').st.prod.r).toBe(1);
  });
  it('gửi trùng: server đã ghi nhưng mất phản hồi → gửi lại KHÔNG cộng hai lần', async () => {
    const { backend, store } = await ready();
    store.dispatch({ type: 'answer', deckId: 'id-k', cardId: 'k-1', dir: 'prod', ok: true });
    store.dispatch({ type: 'sessionDone', deckId: 'id-r', mode: 'test', pct: 100, full: true });
    backend.failNext.push('lost');
    expect(await store.flush()).toEqual({ ok: false, error: 'network' });
    expect(store.getStatus().pending).toBe(2);
    expect(dbCard(backend, 'id-k', 'k-1').st.prod.r).toBe(1); // thật ra đã ghi
    expect(await store.flush()).toEqual({ ok: true });
    expect(store.getStatus().pending).toBe(0);
    expect(dbCard(backend, 'id-k', 'k-1').st.prod.r).toBe(1);
    expect(backend.db.meta.activity[T].n).toBe(1);
    expect(dbDeck(backend, 'id-r').data.stageIdx).toBe(3);
    expect(dbDeck(backend, 'id-r').data.history.filter((h) => h.date === T).length).toBe(1);
    expect(backend.saves.length).toBe(1); // lần hai không ghi gì thêm
    expect(cardOf(store.getState(), 'id-k', 'k-1').st.prod.r).toBe(1);
  });
  it('hai lần flush cùng lúc chỉ gửi một lần', async () => {
    const { backend, store } = await ready();
    store.dispatch({ type: 'answer', deckId: 'id-k', cardId: 'k-1', dir: 'prod', ok: true });
    const [a, b] = await Promise.all([store.flush(), store.flush()]);
    expect([a, b]).toEqual([{ ok: true }, { ok: true }]);
    expect(backend.calls.save).toBe(1);
    expect(dbCard(backend, 'id-k', 'k-1').st.prod.r).toBe(1);
  });
  it('lệnh phát ra GIỮA lúc đang gửi không bị mất và không bị xoá nhầm', async () => {
    const { backend, store } = await ready();
    store.dispatch({ type: 'answer', deckId: 'id-k', cardId: 'k-1', dir: 'prod', ok: true });
    backend.beforeSave = () => store.dispatch({ type: 'answer', deckId: 'id-k', cardId: 'k-2', dir: 'prod', ok: true });
    expect(await store.flush()).toEqual({ ok: true });
    expect(store.getStatus().pending).toBe(0);
    expect(backend.calls.save).toBe(2);
    expect(dbCard(backend, 'id-k', 'k-1').st.prod.r).toBe(1);
    expect(dbCard(backend, 'id-k', 'k-2').st.prod.r).toBe(1);
  });
  it('subscribe: được gọi khi phát lệnh và khi gửi xong; huỷ đăng ký được', async () => {
    const { store } = await ready();
    let n = 0;
    const off = store.subscribe(() => n++);
    store.dispatch({ type: 'settings', patch: { kpi: 80 } });
    expect(n).toBe(1);
    await store.flush();
    expect(n).toBeGreaterThan(1);
    off();
    const seen = n;
    store.dispatch({ type: 'settings', patch: { kpi: 81 } });
    expect(n).toBe(seen);
  });
});

describe('createStore: xung đột rev (thiết bị khác ghi chen)', () => {
  async function twoDevices() {
    const backend = fakeBackend();
    seed(backend);
    const A = mkStore(backend, { prefix: 'A' });
    const B = mkStore(backend, { prefix: 'B' });
    await A.store.load();
    await B.store.load();
    return { backend, a: A.store, b: B.store };
  }
  it('server đổi rev giữa chừng → tải lại, áp lại, không mất thay đổi của bên nào', async () => {
    const { backend, a, b } = await twoDevices();
    b.dispatch({ type: 'answer', deckId: 'id-r', cardId: 'r-1', dir: 'prod', ok: true });
    b.dispatch({ type: 'settings', patch: { kpi: 85 } });
    await b.flush();
    a.dispatch({ type: 'answer', deckId: 'id-k', cardId: 'k-1', dir: 'prod', ok: true });
    expect(await a.flush()).toEqual({ ok: true });
    expect(backend.calls.load).toBe(3); // 2 lần đầu + 1 lần tải lại
    expect(dbCard(backend, 'id-k', 'k-1').st.prod.r).toBe(1); // của A
    expect(dbCard(backend, 'id-r', 'r-1').st.prod.r).toBe(2); // của B (1 có sẵn + 1)
    expect(backend.db.meta.settings.kpi).toBe(85);
    expect(backend.db.meta.activity[T].n).toBe(2);
    expect(backend.db.meta.applied).toEqual(['B-1', 'B-2', 'A-1']);
    // A thấy cả thay đổi của B
    expect(cardOf(a.getState(), 'id-r', 'r-1').st.prod.r).toBe(2);
    expect(a.getState().meta.settings.kpi).toBe(85);
    expect(a.getStatus().pending).toBe(0);
  });
  it('hai máy cùng trả lời MỘT thẻ: cộng dồn cả hai, không đè nhau', async () => {
    const { backend, a, b } = await twoDevices();
    a.dispatch({ type: 'answer', deckId: 'id-k', cardId: 'k-1', dir: 'prod', ok: true });
    b.dispatch({ type: 'answer', deckId: 'id-k', cardId: 'k-1', dir: 'prod', ok: true });
    await b.flush();
    await a.flush();
    expect(dbCard(backend, 'id-k', 'k-1').st.prod).toMatchObject({ r: 2, streak: 2 });
    expect(backend.db.meta.activity[T]).toMatchObject({ n: 2, by: { 'id-k': 2 } });
  });
  it('máy kia xoá deck trong lúc máy này còn lệnh cho deck đó: lệnh thành vô hiệu, không sập, outbox vẫn sạch', async () => {
    const { backend, a, b } = await twoDevices();
    b.dispatch({ type: 'deckDelete', deckId: 'id-k' });
    await b.flush();
    a.dispatch({ type: 'answer', deckId: 'id-k', cardId: 'k-1', dir: 'prod', ok: true });
    expect(await a.flush()).toEqual({ ok: true });
    expect(a.getStatus().pending).toBe(0);
    expect(dbDeck(backend, 'id-k').deleted).toBe(true);
    expect(a.getState().decks.map((d) => d.id)).toEqual(['id-r', 'id-k2']);
  });
  it('xung đột liên tục: tải lại tối đa 3 lần rồi dừng, lệnh vẫn nằm trong outbox', async () => {
    const { backend, store } = await ready();
    store.dispatch({ type: 'answer', deckId: 'id-k', cardId: 'k-1', dir: 'prod', ok: true });
    backend.failNext.push('conflict', 'conflict', 'conflict', 'conflict', 'conflict');
    expect(await store.flush()).toEqual({ ok: false, error: 'conflict' });
    expect(backend.calls.save).toBe(4); // lần đầu + 3 lần sau khi tải lại
    expect(backend.calls.load).toBe(1 + 3);
    expect(store.getStatus()).toMatchObject({ pending: 1, error: 'conflict' });
    backend.failNext.length = 0;
    expect(await store.flush()).toEqual({ ok: true });
    expect(dbCard(backend, 'id-k', 'k-1').st.prod.r).toBe(1);
  });
  it('xung đột rồi tải lại bị lỗi mạng: dừng, giữ outbox', async () => {
    const { backend, store } = await ready();
    store.dispatch({ type: 'answer', deckId: 'id-k', cardId: 'k-1', dir: 'prod', ok: true });
    backend.failNext.push('conflict');
    backend.failLoad = true;
    expect(await store.flush()).toEqual({ ok: false, error: 'network' });
    expect(store.getStatus().pending).toBe(1);
  });
});

describe('createStore: khởi động lại, ngày của lệnh, phiên offline', () => {
  it('outbox và bản server đọc lại được sau "khởi động lại"; gửi tiếp bình thường', async () => {
    const { backend, store, env } = await ready();
    store.dispatch({ type: 'answer', deckId: 'id-k', cardId: 'k-1', dir: 'prod', ok: true });
    backend.failNext.push('network');
    await store.flush();
    const seen = clone(store.getState());
    // "tắt app, mở lại": store mới, cùng localStorage, chưa gọi load()
    const again = mkStore(backend, { storage: env.storage, prefix: 'again' }).store;
    expect(again.getState()).toEqual(seen);
    expect(again.getStatus()).toMatchObject({ pending: 1, empty: false });
    expect(await again.flush()).toEqual({ ok: true });
    expect(dbCard(backend, 'id-k', 'k-1').st.prod.r).toBe(1);
    expect(again.getStatus().pending).toBe(0);
  });
  it('cache hoặc outbox hỏng (không phải JSON): coi như trống, không sập', () => {
    const storage = fakeStorage();
    storage.setItem(CACHE_KEY, '{hỏng');
    storage.setItem(OUTBOX_KEY, 'cũng hỏng');
    const { store } = mkStore(fakeBackend(), { storage });
    expect(store.getState().decks).toEqual([]);
    expect(store.getStatus().pending).toBe(0);
  });
  it('lệnh giữ đúng day lúc phát sinh dù gửi muộn (qua ngày hôm sau mới có mạng)', async () => {
    const { backend, store, env } = await ready();
    store.dispatch({ type: 'answer', deckId: 'id-k2', cardId: 'k2-1', dir: 'prod', ok: true });
    store.dispatch({ type: 'sessionDone', deckId: 'id-k2', mode: 'learn', pct: 100, full: false });
    backend.failNext.push('network');
    await store.flush();
    env.day = T2; // sang ngày mới rồi mới gửi được
    expect(await store.flush()).toEqual({ ok: true });
    expect(Object.keys(backend.db.meta.activity)).toEqual([T]);
    expect(backend.db.meta.activity[T].d).toEqual(['id-k2']);
    expect(dbDeck(backend, 'id-k2').data).toMatchObject({ name: '1511', startedAt: T, anchor: T, lastCompleted: T });
    expect(dbCard(backend, 'id-k2', 'k2-1').st.prod.last).toBe(T);
  });
  it('phiên bắt đầu lúc OFFLINE không phát lệnh nào (luyện tập, không ghi tiến độ)', async () => {
    const { store, env } = await ready();
    env.online = false;
    const sess = store.startSession();
    expect(sess.recording).toBe(false);
    expect(sess.dispatch({ type: 'answer', deckId: 'id-k', cardId: 'k-1', dir: 'prod', ok: true })).toBe(null);
    env.online = true; // có mạng lại giữa phiên: phiên này vẫn không ghi
    expect(sess.dispatch({ type: 'sessionDone', deckId: 'id-k', mode: 'learn', pct: 100 })).toBe(null);
    expect(store.getStatus().pending).toBe(0);
    expect(cardOf(store.getState(), 'id-k', 'k-1').st.prod.r).toBe(0);
  });
  it('phiên bắt đầu lúc CÓ MẠNG rồi rớt mạng giữa chừng: vẫn ghi, có mạng thì gửi', async () => {
    const { backend, store, env } = await ready();
    const sess = store.startSession();
    expect(sess.recording).toBe(true);
    env.online = false;
    expect(sess.dispatch({ type: 'answer', deckId: 'id-k', cardId: 'k-1', dir: 'prod', ok: true })).toMatchObject({ day: T });
    backend.failNext.push('network');
    await store.flush();
    expect(store.getStatus().pending).toBe(1);
    env.online = true;
    await store.flush();
    expect(dbCard(backend, 'id-k', 'k-1').st.prod.r).toBe(1);
  });
  it(`meta.applied chỉ giữ ${APPLIED_MAX} id gần nhất`, async () => {
    const { backend, store } = await ready();
    for (let i = 0; i < APPLIED_MAX + 5; i++) store.dispatch({ type: 'star', deckId: 'id-k', cardId: 'k-1', starred: i % 2 === 0 });
    await store.flush();
    expect(backend.db.meta.applied.length).toBe(APPLIED_MAX);
    expect(backend.db.meta.applied[0]).toBe('id-6');
    expect(backend.db.meta.applied.at(-1)).toBe('id-' + (APPLIED_MAX + 5));
  });
});

describe('createStore: xoá mềm và thay thế toàn bộ', () => {
  it('xoá deck: dòng trên server còn nguyên, chỉ đánh dấu deleted; khôi phục thì bỏ dấu', async () => {
    const { backend, store } = await ready();
    store.dispatch({ type: 'deckDelete', deckId: 'id-r' });
    await store.flush();
    expect(dbDeck(backend, 'id-r')).toMatchObject({ deleted: true, rev: 2 });
    expect(dbDeck(backend, 'id-r').data.cards.length).toBe(3);
    expect(store.getState().deleted.map((d) => d.id)).toEqual(['id-r']);
    store.dispatch({ type: 'deckUpsert', deck: { id: 'id-r' } });
    await store.flush();
    expect(dbDeck(backend, 'id-r')).toMatchObject({ deleted: false, rev: 3 });
    expect(store.getState().decks.map((d) => d.id)).toEqual(['id-k', 'id-k2', 'id-r']);
  });
  it('tạo deck mới: dòng mới trên server (rev 1)', async () => {
    const { backend, store } = await ready();
    store.dispatch({ type: 'deckUpsert', deck: { id: 'new', name: 'Mới', cards: [{ id: 'n1', term: 'a', def: 'b' }] } });
    await store.flush();
    expect(dbDeck(backend, 'new')).toMatchObject({ rev: 1, deleted: false });
    expect(backend.db.meta.deckOrder).toEqual(['id-k', 'id-r', 'id-k2', 'new']);
  });

  const incoming = () => toV2(mkState([mkStudiedDeck('nhập', '2026-11-10'), mkDeck('k', { n: 5 })]));

  it('replaceAll vào tài khoản TRỐNG: ghi thẳng, không cần bản sao', async () => {
    const backend = fakeBackend();
    const { store } = mkStore(backend);
    await store.load();
    const data = incoming();
    expect(await store.replaceAll(data, 'before-import')).toEqual({ ok: true });
    expect(backend.calls.snapshot).toBe(0);
    expect(store.getState().decks.map((d) => d.name)).toEqual(['nhập', 'k']);
    expect(store.getStatus()).toMatchObject({ empty: false, pending: 0 });
    expect(toV1(backend.db.meta, [...backend.db.decks.values()].map((r) => r.data))).toEqual(toV1(data.meta, data.decks));
  });
  it('replaceAll vào tài khoản đã có dữ liệu: ghi bản sao (dạng v1, gồm cả lệnh đang chờ) TRƯỚC, rồi mới thay', async () => {
    const { backend, store } = await ready();
    store.dispatch({ type: 'answer', deckId: 'id-k', cardId: 'k-1', dir: 'prod', ok: true });
    backend.failNext.push('network');
    await store.flush(); // lệnh còn kẹt trong outbox
    backend.beforeSave = () => expect(backend.db.snapshots.length).toBe(1); // bản sao có trước khi ghi
    expect(await store.replaceAll(incoming(), 'before-import')).toEqual({ ok: true });
    const snap = backend.db.snapshots[0];
    expect(snap.reason).toBe('before-import');
    expect(snap.data.sets.map((s) => s.name)).toEqual(['k', 'r', 'k2']);
    expect(snap.data.sets[0].cards[0].st.prod.r).toBe(1);
    expect('schemaVersion' in snap.data).toBe(false);
    // dữ liệu mới thay hẳn; deck cũ không có trong bản nhập thành xoá mềm; deck trùng id được ghi đè
    expect(store.getState().decks.map((d) => d.name)).toEqual(['nhập', 'k']);
    expect(dbDeck(backend, 'id-k')).toMatchObject({ deleted: false, rev: 2 });
    expect(dbDeck(backend, 'id-k').data.cards.length).toBe(5);
    expect(dbDeck(backend, 'id-r').deleted).toBe(true);
    expect(dbDeck(backend, 'id-k2').deleted).toBe(true);
    expect(dbDeck(backend, 'id-nhập')).toMatchObject({ deleted: false, rev: 1 });
    expect(store.getStatus().pending).toBe(0); // lệnh cũ bị bỏ cùng dữ liệu cũ
    expect(backend.db.meta.applied).toEqual([]);
  });
  it('replaceAll: ghi bản sao KHÔNG được thì dừng, không thay gì', async () => {
    const { backend, store } = await ready();
    store.dispatch({ type: 'settings', patch: { kpi: 80 } });
    backend.failSnapshot = true;
    expect(await store.replaceAll(incoming(), 'before-reset')).toEqual({ ok: false, error: 'snapshot' });
    expect(backend.calls.save).toBe(0);
    expect(store.getState().decks.map((d) => d.name)).toEqual(['k', 'r', 'k2']);
    expect(store.getStatus().pending).toBe(1);
    expect(dbDeck(backend, 'id-r').deleted).toBe(false);
  });
  it('replaceAll: lỗi mạng hoặc xung đột lúc ghi thì báo lỗi, dữ liệu cũ còn nguyên', async () => {
    const { backend, store } = await ready();
    backend.failNext.push('network');
    expect(await store.replaceAll(incoming(), 'before-import')).toEqual({ ok: false, error: 'network' });
    backend.failNext.push('conflict');
    expect(await store.replaceAll(incoming(), 'before-import')).toEqual({ ok: false, error: 'conflict' });
    expect(store.getState().decks.map((d) => d.name)).toEqual(['k', 'r', 'k2']);
    backend.failLoad = true;
    expect(await store.replaceAll(incoming(), 'before-import')).toEqual({ ok: false, error: 'network' });
  });
  it('replaceAll lấy bản server MỚI NHẤT trước khi thay (máy kia vừa ghi thêm)', async () => {
    const { backend, store } = await ready();
    const other = mkStore(backend, { prefix: 'B' }).store;
    await other.load();
    other.dispatch({ type: 'answer', deckId: 'id-r', cardId: 'r-1', dir: 'prod', ok: true });
    await other.flush();
    expect(await store.replaceAll(incoming(), 'before-import')).toEqual({ ok: true });
    expect(backend.db.snapshots[0].data.sets[1].cards[0].st.prod.r).toBe(2); // bản sao có thay đổi của máy kia
  });
});
