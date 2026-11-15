import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  OFFSETS,
  addDays,
  compareFreshness,
  computeStreak,
  dayDiff,
  emptyState,
  hasStudied,
  isDateStr,
  normalize,
  planToday,
  studyDay,
  summarize,
  toV1,
  toV2,
} from '../logic/index.js';
import { mkCard, mkDeck, mkState, mkStudiedDeck } from './fixtures/small.js';

/* ------------------------------------------------------------------ */
/* File JSON thật: KHÔNG nằm trong repo (xem .gitignore).               */
/* Ở máy mà thiếu file thì phải NÉM LỖI, không được lặng lẽ bỏ qua.     */
/* Trên CI (không có file) thì bỏ qua cả nhóm test dùng file thật.      */
/* ------------------------------------------------------------------ */
const FIXTURE_NAME = 'kingston-vocab-backup-2026-11-11.json';
const FIXTURE = fileURLToPath(new URL('./fixtures/' + FIXTURE_NAME, import.meta.url));
const hasFixture = existsSync(FIXTURE);
if (!hasFixture && !process.env.CI) {
  throw new Error(
    `Thiếu file dữ liệu thật. Chép "${FIXTURE_NAME}" từ thư mục bàn giao ` +
      `(C:\\Kingston\\Vibe-coding\\Vocab-app) vào tests/fixtures/ rồi chạy lại "npm test".`,
  );
}
/** Mỗi lần gọi đọc lại file → mỗi test có một bản riêng, không dính nhau. */
const loadReal = () => JSON.parse(readFileSync(FIXTURE, 'utf8'));
const DIRS = ['prod', 'recog'];

describe('dates (mục 3.1)', () => {
  it('ngày học: 03:59 sáng 13/11 giờ VN vẫn là ngày 12/11', () => {
    expect(studyDay(Date.parse('2026-11-12T20:59:59Z'))).toBe('2026-11-12');
  });
  it('ngày học: đúng 04:00 sáng 13/11 giờ VN là ngày 13/11', () => {
    expect(studyDay(Date.parse('2026-11-12T21:00:00Z'))).toBe('2026-11-13');
  });
  it('ngày học: giữa trưa và sát nửa đêm giờ VN', () => {
    expect(studyDay(Date.parse('2026-11-13T05:00:00Z'))).toBe('2026-11-13'); // 12:00 VN
    expect(studyDay(Date.parse('2026-11-13T16:59:59Z'))).toBe('2026-11-13'); // 23:59 VN
    expect(studyDay(Date.parse('2026-11-13T17:00:00Z'))).toBe('2026-11-13'); // 00:00 VN 14/11, chưa tới 4h
  });
  it('addDays qua năm mới, qua tháng, lùi ngày, năm nhuận', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2026-11-11', 0)).toBe('2026-11-11');
    expect(addDays('2026-11-01', -1)).toBe('2026-10-31');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-10-27', 16)).toBe('2026-11-12');
  });
  it('dayDiff = a − b tính bằng ngày', () => {
    expect(dayDiff('2026-11-13', '2026-11-11')).toBe(2);
    expect(dayDiff('2026-11-11', '2026-11-13')).toBe(-2);
    expect(dayDiff('2026-11-11', '2026-11-11')).toBe(0);
    expect(dayDiff('2027-01-01', '2026-12-31')).toBe(1);
  });
  it('isDateStr chỉ nhận chuỗi YYYY-MM-DD', () => {
    expect(isDateStr('2026-11-11')).toBe(true);
    expect(isDateStr('2026-1-1')).toBe(false);
    expect(isDateStr('')).toBe(false);
    expect(isDateStr(null)).toBe(false);
    expect(isDateStr(20261111)).toBe(false);
  });
});

describe('hasStudied (chuyển nguyên văn daHoc của v1)', () => {
  it('deck chưa đụng tới: chưa học', () => {
    expect(hasStudied(mkDeck('a'))).toBe(false);
    expect(hasStudied(null)).toBe(false);
  });
  it('có lastCompleted: đã học', () => {
    expect(hasStudied(mkDeck('a', { lastCompleted: '2026-01-02' }))).toBe(true);
  });
  it('có history: đã học', () => {
    expect(hasStudied(mkDeck('a', { history: [{ date: '2026-01-02', pct: 50 }] }))).toBe(true);
  });
  it('có thẻ từng trả lời đúng hoặc sai (chiều nào cũng tính): đã học', () => {
    expect(hasStudied(mkDeck('a', { cards: [mkCard('x'), mkCard('y', { prod: { r: 1 } })] }))).toBe(true);
    expect(hasStudied(mkDeck('a', { cards: [mkCard('x', { recog: { w: 1 } })] }))).toBe(true);
  });
  it('thẻ thiếu st không làm sập', () => {
    expect(hasStudied(mkDeck('a', { cards: [{ id: 'x', term: 't', def: 'd' }] }))).toBe(false);
  });
});

describe('normalize / summarize / emptyState với dữ liệu giả', () => {
  const TODAY = '2026-11-13';

  it('emptyState: trống thật, không nhúng deck nào, KPI mặc định 90', () => {
    const e = emptyState();
    expect(e.sets).toEqual([]);
    expect(e.activity).toEqual({});
    expect(e.settings.kpi).toBe(90);
    expect(summarize(e)).toEqual({ sets: 0, cards: 0, answers: 0, last: '' });
    e.sets.push(mkDeck('a'));
    expect(emptyState().sets).toEqual([]); // mỗi lần gọi là một bản mới
  });

  it('normalize: không phải dữ liệu của app thì trả về null', () => {
    expect(normalize(null, TODAY)).toBe(null);
    expect(normalize('abc', TODAY)).toBe(null);
    expect(normalize({}, TODAY)).toBe(null);
    expect(normalize({ sets: {} }, TODAY)).toBe(null);
  });

  it('normalize: dữ liệu lành lặn thì không vá gì', () => {
    const src = mkState([mkStudiedDeck('a', '2026-11-10'), mkDeck('b')]);
    const before = structuredClone(src);
    const out = normalize(src, TODAY);
    expect(out.fixes).toEqual([]);
    expect(out.data).toEqual(before);
  });

  it('normalize: chỉ đắp phần thiếu, báo lại những gì đã vá, chạy lại cho cùng kết quả', () => {
    const src = {
      sets: [
        { name: 'thiếu-hết', cards: [{ term: 5 }, null] },
        { id: 'dup', name: 'x', anchor: '2026-11-01', cards: [] },
        { id: 'dup', name: 'y', anchor: '2026-11-02', cards: [] },
        { id: 'hỏng', name: 'không có thẻ' },
      ],
    };
    const out = normalize(src, TODAY);
    const d = out.data;
    expect(d.sets.map((s) => s.name)).toEqual(['thiếu-hết', 'x', 'y']);
    expect(d.projects.length).toBe(1);
    expect(d.currentProj).toBe(d.projects[0].id);
    expect(d.settings.kpi).toBe(90);
    expect(d.activity).toEqual({});
    expect(d.paragraphs).toEqual([]);
    const s0 = d.sets[0];
    expect(s0.id).toBeTruthy();
    expect(s0.anchor).toBe(TODAY); // ngày truyền vào, không phải giờ máy
    expect(s0.createdAt).toBe(TODAY);
    expect(s0.stageIdx).toBe(0);
    expect(s0.history).toEqual([]);
    expect(s0.lastCompleted).toBe(null);
    expect(s0.projectId).toBe(d.currentProj);
    expect(s0.cards.length).toBe(1);
    expect(s0.cards[0]).toMatchObject({ term: '5', def: '', note: '', st: {} });
    expect(s0.cards[0].id).toBeTruthy();
    expect(new Set(d.sets.map((s) => s.id)).size).toBe(3); // id trùng đã được đổi
    expect(out.fixes.length).toBeGreaterThan(0);

    const again = normalize(structuredClone(d), TODAY);
    expect(again.fixes).toEqual([]);
    expect(again.data).toEqual(d);
  });

  it('normalize: giữ nguyên trường lạ và cài đặt đã có', () => {
    const src = mkState([mkDeck('a', { la: 1, cards: [mkCard('x', { la2: [1, 2] })] })], {
      settings: { kpi: 75, testN: 5, khac: 'x' },
      journeyStart: '2026-10-06',
    });
    const before = structuredClone(src);
    expect(normalize(src, TODAY).data).toEqual(before);
  });

  it('summarize: đếm thẻ, lượt trả lời (r + w, hai chiều), ngày học gần nhất', () => {
    const s = mkState(
      [
        mkDeck('a', {
          lastCompleted: '2026-11-05',
          history: [{ date: '2026-11-07', pct: 90 }],
          cards: [
            mkCard('x', { prod: { r: 2, w: 1, last: '2026-11-06' }, recog: { r: 3, last: '2026-11-04' } }),
            mkCard('y'),
          ],
        }),
        mkDeck('b', { n: 2 }),
      ],
      { activity: { '2026-11-09': { n: 4 }, 'không-phải-ngày': true } },
    );
    expect(summarize(s)).toEqual({ sets: 2, cards: 4, answers: 6, last: '2026-11-09' });
  });
});

describe('toV2 / toV1 với dữ liệu giả (mục 3.9)', () => {
  const src = () =>
    mkState([mkStudiedDeck('a', '2026-11-10', { la: 1 }), mkDeck('b'), mkDeck('c', { n: 0 })], {
      journeyStart: '2026-10-06',
      streak: { freezeUsedDays: ['2026-11-01'] },
      khoaLa: { x: [1, 2] },
    });

  it('toV2: decks = các phần tử sets nguyên vẹn, đúng thứ tự', () => {
    const x = src();
    const { decks } = toV2(x);
    expect(decks).toEqual(x.sets);
    expect(decks.map((d) => d.id)).toEqual(['id-a', 'id-b', 'id-c']);
  });

  it('toV2: meta = mọi khoá cấp cao nhất khác sets + schemaVersion 2, deckOrder, applied rỗng', () => {
    const x = src();
    const { meta } = toV2(x);
    const { sets, ...rest } = x;
    expect(meta).toEqual({ ...rest, schemaVersion: 2, deckOrder: ['id-a', 'id-b', 'id-c'], applied: [] });
    expect('sets' in meta).toBe(false);
  });

  it('toV1(toV2(x)) bằng đúng x; không còn khoá riêng của v2', () => {
    const x = src();
    const { meta, decks } = toV2(x);
    const back = toV1(meta, decks);
    expect(back).toEqual(x);
    expect(Object.keys(back).sort()).toEqual(Object.keys(x).sort());
    for (const k of ['schemaVersion', 'deckOrder', 'applied']) expect(k in back).toBe(false);
  });

  it('toV2 và toV1 không sửa đầu vào', () => {
    const x = src();
    const before = structuredClone(x);
    const v2 = toV2(x);
    expect(x).toEqual(before);
    const v2Before = structuredClone(v2);
    toV1(v2.meta, v2.decks);
    expect(v2).toEqual(v2Before);
  });

  it('toV1 ghép sets theo deckOrder, không theo thứ tự mảng decks', () => {
    const { meta, decks } = toV2(src());
    const back = toV1(meta, [decks[2], decks[0], decks[1]]);
    expect(back.sets.map((s) => s.name)).toEqual(['a', 'b', 'c']);
    const back2 = toV1({ ...meta, deckOrder: ['id-c', 'id-a', 'id-b'] }, decks);
    expect(back2.sets.map((s) => s.name)).toEqual(['c', 'a', 'b']);
  });

  it('toV1 không làm mất deck: deck thiếu trong deckOrder xếp cuối, id thừa trong deckOrder bỏ qua', () => {
    const { meta, decks } = toV2(src());
    const back = toV1({ ...meta, deckOrder: ['id-b', 'id-đã-xoá'] }, decks);
    expect(back.sets.map((s) => s.name)).toEqual(['b', 'a', 'c']);
    const noOrder = { ...meta };
    delete noOrder.deckOrder;
    expect(toV1(noOrder, decks).sets.map((s) => s.name)).toEqual(['a', 'b', 'c']);
  });

  it('app trống: toV2 ra 0 deck, đi về vẫn là app trống', () => {
    const e = emptyState();
    const v2 = toV2(e);
    expect(v2.decks).toEqual([]);
    expect(v2.meta.deckOrder).toEqual([]);
    expect(toV1(v2.meta, v2.decks)).toEqual(emptyState());
  });
});

describe('compareFreshness (mục 3.9): a có cũ hơn b không', () => {
  const card = (r) => mkCard('x', { prod: { r, streak: r, last: '2026-11-10' } });
  const state = (r, over = {}) => mkState([mkDeck('a', { cards: [card(r), mkCard('y')] })], over);

  it('giống hệt → không cảnh báo', () => {
    expect(compareFreshness(state(3), state(3))).toEqual([]);
  });
  it('cùng số thẻ nhưng ít lượt trả lời hơn → cảnh báo answers', () => {
    expect(compareFreshness(state(2), state(5))).toEqual([{ kind: 'answers', a: 2, b: 5 }]);
  });
  it('ngày học gần nhất cũ hơn → cảnh báo last', () => {
    const a = state(3);
    const b = state(3, { activity: { '2026-11-12': { n: 1 } } });
    expect(compareFreshness(a, b)).toEqual([{ kind: 'last', a: '2026-11-10', b: '2026-11-12' }]);
  });
  it('ít thẻ hơn → cảnh báo cards', () => {
    const a = mkState([mkDeck('a', { cards: [card(3)] })]);
    expect(compareFreshness(a, state(3))).toEqual([{ kind: 'cards', a: 1, b: 2 }]);
  });
  it('cũ hơn về mọi mặt → đủ 3 cảnh báo theo thứ tự cards, answers, last', () => {
    const a = mkState([mkDeck('a', { n: 1 })]);
    const b = state(3);
    expect(compareFreshness(a, b).map((w) => w.kind)).toEqual(['cards', 'answers', 'last']);
    expect(compareFreshness(a, b)[2]).toEqual({ kind: 'last', a: '', b: '2026-11-10' });
  });
  it('a MỚI hơn b → không cảnh báo; b chưa học gì → không cảnh báo last', () => {
    expect(compareFreshness(state(5), state(2))).toEqual([]);
    expect(compareFreshness(mkState([mkDeck('a', { n: 2 })]), mkState([mkDeck('b', { n: 2 })]))).toEqual([]);
  });
  it('không sửa đầu vào', () => {
    const a = state(2);
    const b = state(5);
    const before = structuredClone([a, b]);
    compareFreshness(a, b);
    expect([a, b]).toEqual(before);
  });
});

describe.skipIf(!hasFixture)('file JSON thật 11/11 (migration)', () => {
  it('8 deck, 175 thẻ, tên đúng thứ tự', () => {
    const o = loadReal();
    expect(o.sets.length).toBe(8);
    expect(o.sets.reduce((n, s) => n + s.cards.length, 0)).toBe(175);
    expect(o.sets.map((s) => s.name)).toEqual(['1608', '1708', '2008', '2108', '2208', '3108', '0209', '1109']);
  });

  it('số thẻ từng deck (Phụ lục A)', () => {
    const o = loadReal();
    expect(Object.fromEntries(o.sets.map((s) => [s.name, s.cards.length]))).toEqual({
      1608: 19, 1708: 18, 2008: 25, 2108: 25, 2208: 25, 3108: 28, '0209': 20, 1109: 15,
    });
  });

  it('tổng r + w trên mọi thẻ, cả hai chiều = 713; summarize khớp', () => {
    const o = loadReal();
    let total = 0;
    for (const s of o.sets) for (const c of s.cards) for (const k of DIRS) total += c.st[k].r + c.st[k].w;
    expect(total).toBe(713);
    expect(summarize(o)).toEqual({ sets: 8, cards: 175, answers: 713, last: '2026-10-10' });
  });

  it('đúng 27 bản ghi chiều có _prevStreak (3 ở 2008, 24 ở 2108)', () => {
    const o = loadReal();
    const per = {};
    for (const s of o.sets)
      for (const c of s.cards)
        for (const k of DIRS) if (c.st[k] && '_prevStreak' in c.st[k]) per[s.name] = (per[s.name] || 0) + 1;
    expect(per).toEqual({ 2008: 3, 2108: 24 });
  });

  it('normalize: fixes rỗng, dữ liệu bằng đúng đầu vào; chạy lần hai cho cùng kết quả', () => {
    const original = loadReal();
    const first = normalize(loadReal(), '2026-11-13');
    expect(first.fixes).toEqual([]);
    expect(first.data).toEqual(original);
    // so cả chuỗi JSON từng deck: không mất trường nào, không đổi thứ tự thẻ
    expect(first.data.sets.map((s) => JSON.stringify(s))).toEqual(original.sets.map((s) => JSON.stringify(s)));
    const second = normalize(structuredClone(first.data), '2026-11-13');
    expect(second.fixes).toEqual([]);
    expect(second.data).toEqual(original);
  });

  it('settings.kpi = 90, journeyStart = 2026-10-06, activity 8 ngày (Phụ lục A)', () => {
    const o = loadReal();
    expect(o.settings.kpi).toBe(90);
    expect(o.journeyStart).toBe('2026-10-06');
    expect(Object.keys(o.activity).length).toBe(8);
    expect(o.activity['2026-08-19']).toBe(true);
  });

  it('deck đã học và đến hạn đúng 11/11: 1708 (+7), 2008 (+7), 2108 (+3)', () => {
    const o = loadReal();
    const due = o.sets
      .filter((s) => hasStudied(s) && addDays(s.anchor, OFFSETS[s.stageIdx]) === '2026-11-11')
      .map((s) => [s.name, OFFSETS[s.stageIdx]]);
    expect(due).toEqual([
      ['1708', 7],
      ['2008', 7],
      ['2108', 3],
    ]);
  });

  it('deck đã học: 1608, 1708, 2008, 2108; deck chưa học có anchor nhỏ nhất: 2208', () => {
    const o = loadReal();
    expect(o.sets.filter(hasStudied).map((s) => s.name)).toEqual(['1608', '1708', '2008', '2108']);
    const fresh = o.sets.filter((s) => !hasStudied(s)).sort((a, b) => (a.anchor < b.anchor ? -1 : a.anchor > b.anchor ? 1 : 0));
    expect(fresh.map((s) => s.name)).toEqual(['2208', '3108', '0209', '1109']);
    expect(fresh[0].name).toBe('2208');
  });

  // Bảng "Kết quả mong đợi với file JSON thật" của PLAN.md mục 3.2 (chưa học gì sau 10/10).
  const names = (items) => items.map((x) => x.set.name);
  const stageOf = (items) => items.map((x) => [x.set.name, x.status.stage]);

  it('Hôm nay 11/11: ôn 2108 (+3), 1708 (+7), 2008 (+7); mới 2208; onTrack (khẳng định bắt buộc của HANDOVER.md)', () => {
    const p = planToday(loadReal().sets, '2026-11-11');
    expect(stageOf(p.reviews)).toEqual([['2108', 3], ['1708', 7], ['2008', 7]]);
    expect(p.fresh.set.name).toBe('2208');
    expect(p.more).toEqual([]);
    expect(p.done).toEqual([]);
    expect(p.gate).toEqual({ open: true, reason: 'onTrack', lateCount: 0, daysSinceNew: 34 });
    expect(names(p.upcoming)).toEqual(['1608']);
    expect(p.upcoming[0].status).toEqual({ kind: 'scheduled', due: '2026-11-12', days: 1 });
    expect(names(p.stock)).toEqual(['3108', '0209', '1109']);
  });

  it('Hôm nay 12/11: ôn 2108, 1708, 2008; mới 2208; chờ thêm 1608; ceiling (3 deck trễ)', () => {
    const p = planToday(loadReal().sets, '2026-11-12');
    expect(names(p.reviews)).toEqual(['2108', '1708', '2008']);
    expect(p.fresh.set.name).toBe('2208');
    expect(names(p.more)).toEqual(['1608']);
    expect(p.gate).toEqual({ open: true, reason: 'ceiling', lateCount: 3, daysSinceNew: 35 });
    expect(p.upcoming).toEqual([]);
    expect(names(p.stock)).toEqual(['3108', '0209', '1109']);
  });

  it('Hôm nay 13/11: ôn 2108, 1708, 2008; mới 2208; chờ thêm 1608; ceiling (4 deck trễ)', () => {
    const p = planToday(loadReal().sets, '2026-11-13');
    expect(names(p.reviews)).toEqual(['2108', '1708', '2008']);
    expect(p.fresh.set.name).toBe('2208');
    expect(names(p.more)).toEqual(['1608']);
    expect(p.gate).toEqual({ open: true, reason: 'ceiling', lateCount: 4, daysSinceNew: 36 });
    // cả bốn deck đã học đều mang cờ recovering → lượt ôn kế là lượt phục hồi
    expect([...p.reviews, ...p.more].every((x) => x.status.recovery)).toBe(true);
  });

  it('planToday không sửa dữ liệu thật (không còn dời anchor)', () => {
    const o = loadReal();
    planToday(o.sets, '2026-11-13');
    expect(o).toEqual(loadReal());
  });

  it('streak ngày 13/11: 0 ngày, dài nhất 5, không băng, chưa học hôm nay (mục 3.4)', () => {
    const o = loadReal();
    expect(computeStreak(o.activity, o.streak?.freezeUsedDays ?? [], '2026-11-13')).toEqual({
      count: 0, best: 5, freezes: 0, status: 'pending', needUnits: 1,
    });
    expect(o).toEqual(loadReal());
  });

  // Task 2.4: chuyển dữ liệu v1 ⇄ v2 (mục 3.9).
  it('toV1(toV2(x)) bằng đúng x với file thật (so sâu + so chuỗi JSON từng deck)', () => {
    const x = loadReal();
    const { meta, decks } = toV2(loadReal());
    const back = toV1(meta, decks);
    expect(back).toEqual(x);
    expect(Object.keys(back).sort()).toEqual(Object.keys(x).sort());
    expect(back.sets.map((s) => JSON.stringify(s))).toEqual(x.sets.map((s) => JSON.stringify(s)));
  });

  it('toV2 giữ 8 deck, 175 thẻ, 713 lượt, 27 _prevStreak, thứ tự deck', () => {
    const x = loadReal();
    const { meta, decks } = toV2(loadReal());
    expect(decks.length).toBe(8);
    expect(decks.map((d) => d.name)).toEqual(['1608', '1708', '2008', '2108', '2208', '3108', '0209', '1109']);
    expect(meta.deckOrder).toEqual(x.sets.map((s) => s.id));
    expect(decks.reduce((n, d) => n + d.cards.length, 0)).toBe(175);
    let answers = 0;
    let prev = 0;
    for (const d of decks)
      for (const c of d.cards)
        for (const k of DIRS) {
          answers += c.st[k].r + c.st[k].w;
          if ('_prevStreak' in c.st[k]) prev++;
        }
    expect(answers).toBe(713);
    expect(prev).toBe(27);
    expect(meta).toMatchObject({ schemaVersion: 2, applied: [], journeyStart: '2026-10-06' });
    expect(meta.settings).toEqual(x.settings);
    expect(meta.activity).toEqual(x.activity);
    expect('sets' in meta).toBe(false);
  });

  it('planToday trên dữ liệu sau toV2 ở 11/11 ra đúng bảng mục 3.2', () => {
    const { decks } = toV2(loadReal());
    const p = planToday(decks, '2026-11-11');
    expect(stageOf(p.reviews)).toEqual([['2108', 3], ['1708', 7], ['2008', 7]]);
    expect(p.fresh.set.name).toBe('2208');
    expect(p.more).toEqual([]);
    expect(p.gate).toEqual({ open: true, reason: 'onTrack', lateCount: 0, daysSinceNew: 34 });
    expect(names(p.upcoming)).toEqual(['1608']);
    expect(names(p.stock)).toEqual(['3108', '0209', '1109']);
  });

  it('compareFreshness với file thật: giống hệt → không cảnh báo; bớt 1 lượt trả lời → cảnh báo dù vẫn 175 thẻ', () => {
    expect(compareFreshness(loadReal(), loadReal())).toEqual([]);
    const older = loadReal();
    const dir = older.sets.flatMap((s) => s.cards).map((c) => c.st.prod).find((d) => d.r > 0);
    dir.r--;
    expect(summarize(older).cards).toBe(175);
    expect(compareFreshness(older, loadReal())).toEqual([{ kind: 'answers', a: 712, b: 713 }]);
    expect(compareFreshness(loadReal(), older)).toEqual([]);
  });
});
