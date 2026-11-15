import { describe, it, expect } from 'vitest';
import {
  applyCommand,
  buildTest,
  isRight,
  mcqOptions,
  minGap,
  mulberry32,
  sessionAnswer,
  sessionNext,
  sessionOverride,
  sessionQuestion,
  sessionSummary,
  shuffled,
  startLearn,
  startTest,
  startWrite,
  tfItem,
  toV2,
} from '../logic/index.js';
import { mkCard, mkDeck, mkState } from './fixtures/small.js';

const cardsOf = (n) => Array.from({ length: n }, (_, i) => mkCard('c' + (i + 1)));

/** Số câu KHÁC nằm giữa hai câu của cùng một thẻ (nhỏ nhất trên cả bài). */
function smallestGap(qs) {
  const pos = {};
  let min = Infinity;
  qs.forEach((q, i) => {
    if (q.cardId in pos) min = Math.min(min, i - pos[q.cardId] - 1);
    pos[q.cardId] = i;
  });
  return min;
}

describe('mulberry32', () => {
  it('cùng seed cho cùng dãy số; khác seed cho dãy khác; mọi số trong [0, 1)', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const c = mulberry32(43);
    const xs = Array.from({ length: 200 }, () => a());
    expect(Array.from({ length: 200 }, () => b())).toEqual(xs);
    expect(Array.from({ length: 200 }, () => c())).not.toEqual(xs);
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
    expect(new Set(xs).size).toBeGreaterThan(190);
  });
  it('shuffled: hoán vị đủ phần tử, không sửa đầu vào, cùng seed cùng kết quả', () => {
    const src = [1, 2, 3, 4, 5, 6, 7, 8];
    const out = shuffled(src, mulberry32(7));
    expect(src).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect([...out].sort((x, y) => x - y)).toEqual(src);
    expect(shuffled(src, mulberry32(7))).toEqual(out);
  });
});

describe('minGap', () => {
  it('min(8, floor(n / 2))', () => {
    expect([1, 2, 3, 9, 15, 16, 17, 30].map(minGap)).toEqual([0, 1, 1, 4, 7, 8, 8, 8]);
  });
});

describe('buildTest bài đủ (mục 3.8)', () => {
  it('n từ 1 tới 30, 50 seed mỗi n: đúng 2n câu, mỗi thẻ một prod một recog, khoảng cách ≥ minGap(n)', () => {
    for (let n = 1; n <= 30; n++) {
      const cards = cardsOf(n);
      for (let seed = 1; seed <= 50; seed++) {
        const qs = buildTest(cards, { full: true }, mulberry32(seed * 1000 + n));
        expect(qs.length).toBe(2 * n);
        const seen = new Set(qs.map((q) => q.cardId + '|' + q.dir));
        expect(seen.size).toBe(2 * n);
        for (const c of cards) {
          expect(seen.has(c.id + '|prod')).toBe(true);
          expect(seen.has(c.id + '|recog')).toBe(true);
        }
        if (n > 1) expect(smallestGap(qs)).toBeGreaterThanOrEqual(minGap(n));
      }
    }
  });

  it('cùng seed cho cùng kết quả; khác seed cho bài khác', () => {
    const cards = cardsOf(20);
    const a = buildTest(cards, { full: true }, mulberry32(5));
    expect(buildTest(cards, { full: true }, mulberry32(5))).toEqual(a);
    expect(buildTest(cards, { full: true }, mulberry32(6))).not.toEqual(a);
  });

  it('nửa đầu gồm đủ mọi thẻ; chiều hỏi trước là ngẫu nhiên (có cả prod lẫn recog)', () => {
    const qs = buildTest(cardsOf(20), { full: true }, mulberry32(1));
    const first = qs.slice(0, 20);
    expect(new Set(first.map((q) => q.cardId)).size).toBe(20);
    expect(new Set(first.map((q) => q.dir)).size).toBe(2);
  });

  it('nửa sau có được đổi chỗ (không phải lúc nào cũng y thứ tự nửa đầu)', () => {
    let differs = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const qs = buildTest(cardsOf(20), { full: true }, mulberry32(seed));
      const a = qs.slice(0, 20).map((q) => q.cardId).join();
      const b = qs.slice(20).map((q) => q.cardId).join();
      if (a !== b) differs++;
    }
    expect(differs).toBeGreaterThan(15);
  });

  it('loại câu mặc định: prod = write, recog = mcq', () => {
    const qs = buildTest(cardsOf(10), { full: true }, mulberry32(1));
    expect(qs.every((q) => q.type === (q.dir === 'prod' ? 'write' : 'mcq'))).toBe(true);
  });

  it('người học chọn loại câu cho từng chiều', () => {
    const qs = buildTest(cardsOf(10), { full: true, typeProd: 'mcq', typeRecog: 'tf' }, mulberry32(1));
    expect(qs.every((q) => q.type === (q.dir === 'prod' ? 'mcq' : 'tf'))).toBe(true);
  });

  it('mix: xoay vòng write, mcq, tf theo chỉ số câu (như v1)', () => {
    const qs = buildTest(cardsOf(6), { full: true, typeProd: 'mix', typeRecog: 'mix' }, mulberry32(1));
    expect(qs.map((q) => q.type)).toEqual(Array.from({ length: 12 }, (_, i) => ['write', 'mcq', 'tf'][i % 3]));
    const half = buildTest(cardsOf(6), { full: true, typeProd: 'mix', typeRecog: 'mcq' }, mulberry32(1));
    half.forEach((q, i) => expect(q.type).toBe(q.dir === 'recog' ? 'mcq' : ['write', 'mcq', 'tf'][i % 3]));
  });

  it('mỗi câu chỉ có cardId, dir, type; không sửa danh sách thẻ; deck rỗng → bài rỗng', () => {
    const cards = cardsOf(5);
    const before = structuredClone(cards);
    const qs = buildTest(cards, { full: true }, mulberry32(1));
    expect(Object.keys(qs[0]).sort()).toEqual(['cardId', 'dir', 'type']);
    expect(cards).toEqual(before);
    expect(buildTest([], { full: true }, mulberry32(1))).toEqual([]);
  });
});

describe('buildTest bài rút gọn (luyện tập)', () => {
  const cards = cardsOf(10);

  it("answerIn 'en': count câu, toàn chiều prod, không lặp thẻ", () => {
    const qs = buildTest(cards, { full: false, count: 6, answerIn: 'en' }, mulberry32(1));
    expect(qs.length).toBe(6);
    expect(qs.every((q) => q.dir === 'prod')).toBe(true);
    expect(new Set(qs.map((q) => q.cardId)).size).toBe(6);
  });
  it("answerIn 'vi': toàn chiều recog", () => {
    const qs = buildTest(cards, { full: false, count: 4, answerIn: 'vi' }, mulberry32(1));
    expect(qs.length).toBe(4);
    expect(qs.every((q) => q.dir === 'recog')).toBe(true);
  });
  it('một chiều: count lớn hơn số thẻ thì dừng ở số thẻ', () => {
    expect(buildTest(cards, { full: false, count: 50, answerIn: 'en' }, mulberry32(1)).length).toBe(10);
  });
  it("answerIn 'both': count ≤ n thì không lặp thẻ; lớn hơn thì hỏi chiều còn lại, vẫn giữ khoảng cách; tối đa 2n", () => {
    const few = buildTest(cards, { full: false, count: 8, answerIn: 'both' }, mulberry32(3));
    expect(few.length).toBe(8);
    expect(new Set(few.map((q) => q.cardId)).size).toBe(8);
    const many = buildTest(cards, { full: false, count: 15, answerIn: 'both' }, mulberry32(3));
    expect(many.length).toBe(15);
    expect(new Set(many.map((q) => q.cardId + q.dir)).size).toBe(15);
    expect(smallestGap(many)).toBeGreaterThanOrEqual(minGap(10));
    expect(buildTest(cards, { full: false, count: 99, answerIn: 'both' }, mulberry32(3)).length).toBe(20);
  });
  it("mặc định answerIn là 'both'; count thiếu hoặc ≤ 0 → bài rỗng", () => {
    const qs = buildTest(cards, { full: false, count: 10 }, mulberry32(9));
    expect(new Set(qs.map((q) => q.dir)).size).toBe(2);
    expect(buildTest(cards, { full: false, count: 0, answerIn: 'en' }, mulberry32(1))).toEqual([]);
    expect(buildTest(cards, { full: false }, mulberry32(1))).toEqual([]);
  });
  it('loại câu theo chiều và mix vẫn áp dụng; cùng seed cùng kết quả', () => {
    const o = { full: false, count: 9, answerIn: 'en', typeProd: 'mix' };
    const qs = buildTest(cards, o, mulberry32(2));
    expect(qs.map((q) => q.type)).toEqual(['write', 'mcq', 'tf', 'write', 'mcq', 'tf', 'write', 'mcq', 'tf']);
    expect(buildTest(cards, o, mulberry32(2))).toEqual(qs);
  });
});

/* ================================================================== */
/* Task 2.8: máy trạng thái phiên Học, Viết, Kiểm tra                   */
/* ================================================================== */
const T = '2026-11-15';
const answerOf = (card, dir) => (dir === 'prod' ? card.term : card.def);
const cardById = (cards, id) => cards.find((c) => c.id === id);

/** Câu trả lời ĐÚNG cho câu hỏi hiện tại (theo loại câu). */
function rightInput(state, cards) {
  const q = sessionQuestion(state, cards);
  const a = answerOf(cardById(cards, q.cardId), q.dir);
  if (q.type === 'mcq') return q.options.indexOf(a);
  if (q.type === 'tf') return q.shown === a;
  return a;
}
/** Câu trả lời SAI cho câu hỏi hiện tại. */
function wrongInput(state, cards) {
  const q = sessionQuestion(state, cards);
  const a = answerOf(cardById(cards, q.cardId), q.dir);
  if (q.type === 'mcq') return q.options.findIndex((o) => o !== a);
  if (q.type === 'tf') return q.shown !== a;
  return 'zzz';
}
/** Chạy một phiên theo kịch bản: script(i) trả về 'right' | 'wrong-next' | 'wrong-override'. Gom mọi lệnh. */
function play(state, cards, script = () => 'right', cmds = [], from = 0, until = Infinity) {
  let i = from;
  while (!state.done && i < until) {
    const how = script(i);
    let r = sessionAnswer(state, cards, how === 'right' ? rightInput(state, cards) : wrongInput(state, cards));
    cmds.push(...r.cmds);
    state = r.state;
    if (state.phase === 'wrong') {
      r = how === 'wrong-override' ? sessionOverride(state, cards) : sessionNext(state, cards);
      if (r.state === state) r = sessionNext(state, cards); // override không áp dụng (trắc nghiệm) → Tiếp
      cmds.push(...r.cmds);
      state = r.state;
    } else if (state.retype) {
      r = how === 'wrong-override' ? sessionOverride(state, cards) : sessionAnswer(state, cards, rightInput(state, cards));
      cmds.push(...r.cmds);
      state = r.state;
    }
    i++;
  }
  return { state, cmds, i };
}
const kinds = (cmds) => cmds.map((c) => c.type + (c.type === 'answer' ? (c.ok ? '+' : '-') : ''));

describe('mcqOptions / tfItem', () => {
  it('đúng 1 đáp án đúng, tối đa 4 lựa chọn, không lựa chọn nào trùng nhau (nhiều seed)', () => {
    const cards = cardsOf(8);
    for (let seed = 1; seed <= 40; seed++) {
      for (const dir of ['prod', 'recog']) {
        const { options, correct } = mcqOptions(cards, 'c3', dir, mulberry32(seed));
        expect(options.length).toBe(4);
        expect(new Set(options).size).toBe(4);
        expect(options[correct]).toBe(answerOf(cards[2], dir));
        expect(options.filter((o) => isRight(cards[2], dir, o)).length).toBe(1);
      }
    }
  });
  it('đáp án nhiễu không trùng nghĩa đáp án đúng, không trùng nhau', () => {
    const cards = [
      mkCard('a', { term: 'big', def: 'to, lớn' }),
      mkCard('b', { term: 'large', def: 'lớn' }), // trùng một nghĩa với a
      mkCard('c', { term: 'huge', def: 'To,  Lon' }), // trùng cả chuỗi sau khi chuẩn hoá
      mkCard('d', { term: 'small', def: 'nhỏ' }),
      mkCard('e', { term: 'tiny', def: 'Nhỏ.' }), // trùng với d
      mkCard('f', { term: 'the big', def: 'khổng lồ' }), // term trùng a sau khi bỏ "the"
    ];
    for (let seed = 1; seed <= 40; seed++) {
      const recog = mcqOptions(cards, 'a', 'recog', mulberry32(seed));
      expect(recog.options.filter((o) => isRight(cards[0], 'recog', o))).toEqual(['to, lớn']);
      expect(recog.options).not.toContain('lớn');
      expect(recog.options.filter((o) => ['nhỏ', 'Nhỏ.'].includes(o)).length).toBeLessThanOrEqual(1);
      const prod = mcqOptions(cards, 'a', 'prod', mulberry32(seed));
      expect(prod.options).not.toContain('the big');
      expect(prod.options.filter((o) => isRight(cards[0], 'prod', o))).toEqual(['big']);
      // chiều ngược: hỏi "lớn" (thẻ b) thì "to, lớn" cũng không được làm nhiễu
      expect(mcqOptions(cards, 'b', 'recog', mulberry32(seed)).options).not.toContain('to, lớn');
    }
  });
  it('deck ít thẻ: ít lựa chọn hơn, vẫn có đáp án đúng; cùng seed cùng kết quả', () => {
    expect(mcqOptions(cardsOf(1), 'c1', 'prod', mulberry32(1))).toEqual({ options: ['term-c1'], correct: 0 });
    expect(mcqOptions(cardsOf(3), 'c1', 'prod', mulberry32(1)).options.length).toBe(3);
    expect(mcqOptions(cardsOf(9), 'c1', 'recog', mulberry32(5))).toEqual(mcqOptions(cardsOf(9), 'c1', 'recog', mulberry32(5)));
  });
  it('tfItem: lúc hiện đáp án đúng, lúc hiện đáp án thẻ khác (không trùng nghĩa); deck 1 thẻ luôn đúng', () => {
    const cards = cardsOf(6);
    const seen = new Set();
    for (let seed = 1; seed <= 60; seed++) {
      const t = tfItem(cards, 'c2', 'recog', mulberry32(seed));
      seen.add(t.truth);
      expect(t.truth).toBe(t.shown === 'nghĩa-c2');
      expect(cards.some((c) => c.def === t.shown)).toBe(true);
    }
    expect(seen).toEqual(new Set([true, false]));
    for (let seed = 1; seed <= 20; seed++) expect(tfItem(cardsOf(1), 'c1', 'prod', mulberry32(seed))).toEqual({ shown: 'term-c1', truth: true });
    const twins = [mkCard('a', { def: 'lớn' }), mkCard('b', { def: 'Lớn.' })];
    for (let seed = 1; seed <= 20; seed++) expect(tfItem(twins, 'a', 'recog', mulberry32(seed)).truth).toBe(true);
  });
});

describe('phiên Học (mục 3.8)', () => {
  const L = (cards, over = {}, seed = 1) => startLearn(cards, { deckId: 'd', dir: 'prod', mcq: true, write: true, batch: 0, ...over }, T, seed);

  it('2 bước: đúng trắc nghiệm rồi đúng tự luận mới tính xong thẻ', () => {
    const cards = cardsOf(1);
    let s = L(cards);
    expect(s).toMatchObject({ kind: 'learn', total: 1, mastered: 0, done: false, steps: ['mcq', 'write'] });
    expect(sessionQuestion(s, cards)).toMatchObject({ cardId: 'c1', dir: 'prod', type: 'mcq', prompt: 'nghĩa-c1' });
    let r = sessionAnswer(s, cards, rightInput(s, cards));
    expect(r.cmds).toEqual([{ type: 'answer', deckId: 'd', cardId: 'c1', dir: 'prod', ok: true, typo: false }]);
    expect(r.feedback).toEqual({ ok: true, answer: 'term-c1' });
    expect(r.state).toMatchObject({ mastered: 0, done: false });
    s = r.state;
    expect(sessionQuestion(s, cards)).toMatchObject({ cardId: 'c1', type: 'write', prompt: 'nghĩa-c1' });
    r = sessionAnswer(s, cards, 'Term-c1.');
    expect(kinds(r.cmds)).toEqual(['answer+', 'sessionDone']);
    expect(r.cmds[1]).toEqual({ type: 'sessionDone', deckId: 'd', mode: 'learn', pct: 100, full: false });
    expect(r.state).toMatchObject({ mastered: 1, done: true, tries: 2, wrongs: 0 });
    expect(sessionQuestion(r.state, cards)).toBe(null);
  });
  it('chỉ bật tự luận → 1 bước; chỉ bật trắc nghiệm → 1 bước; tắt cả hai → tự luận', () => {
    const cards = cardsOf(2);
    expect(L(cards, { mcq: false }).steps).toEqual(['write']);
    expect(L(cards, { write: false }).steps).toEqual(['mcq']);
    expect(L(cards, { mcq: false, write: false }).steps).toEqual(['write']);
    const { state, cmds } = play(L(cards, { mcq: false }), cards);
    expect(state.done).toBe(true);
    expect(kinds(cmds)).toEqual(['answer+', 'answer+', 'sessionDone']);
  });
  it('đúng chưa đủ bước: xếp lại cách 3 câu; sai: về bước đầu, ghi câu sai, gặp lại sau 2 câu; qua store thì thẻ có sao', () => {
    const cards = cardsOf(5);
    let s = L(cards);
    const order = s.queue.map((x) => x.cardId);
    s = sessionAnswer(s, cards, rightInput(s, cards)).state; // đúng bước 1 → xếp lại cách 3 câu
    expect(s.queue.map((x) => x.cardId)).toEqual([order[1], order[2], order[3], order[0], order[4]]);
    expect(s.queue[3].got).toBe(1);
    const first = s.queue[0].cardId;
    const r = sessionAnswer(s, cards, wrongInput(s, cards)); // sai trắc nghiệm
    expect(r.cmds).toEqual([{ type: 'answer', deckId: 'd', cardId: first, dir: 'prod', ok: false, typo: false }]);
    expect(r.feedback).toEqual({ ok: false, answer: answerOf(cardById(cards, first), 'prod') });
    expect(r.state.queue.map((x) => x.cardId)).toEqual([order[2], order[3], first, order[0], order[4]]);
    expect(r.state.queue[2].got).toBe(0);
    expect(r.state).toMatchObject({ wrongs: 1, tries: 2, phase: 'ask' });
    // lệnh đi qua store → thẻ có sao
    const st = { ...toV2(mkState([mkDeck('x', { id: 'd', cards })])), deleted: [] };
    const after = applyCommand(st, { ...r.cmds[0], id: '1', day: T });
    expect(after.decks[0].cards.find((c) => c.id === first).starred).toBe(true);
  });
  it('sai ở bước 2 thì quay về bước 1 (phải đúng lại cả hai bước)', () => {
    const cards = cardsOf(1);
    let s = L(cards);
    s = sessionAnswer(s, cards, rightInput(s, cards)).state;
    s = sessionAnswer(s, cards, 'zzz').state; // tự luận sai → chờ người học chọn
    s = sessionNext(s, cards).state;
    expect(s.queue).toEqual([{ cardId: 'c1', got: 0 }]);
    expect(sessionQuestion(s, cards).type).toBe('mcq');
  });
  it('tự luận sai: hiện đáp án, CHƯA ghi gì, không tự nhảy; "Tiếp" mới ghi sai', () => {
    const cards = cardsOf(3);
    const s = L(cards, { mcq: false });
    const q = sessionQuestion(s, cards);
    const r = sessionAnswer(s, cards, 'zzz');
    expect(r.cmds).toEqual([]);
    expect(r.feedback).toEqual({ ok: false, answer: answerOf(cardById(cards, q.cardId), 'prod') });
    expect(r.state.phase).toBe('wrong');
    expect(sessionQuestion(r.state, cards)).toEqual(q); // vẫn câu đó
    expect(sessionAnswer(r.state, cards, 'gì đó').state).toBe(r.state); // đang chờ: gõ thêm không có tác dụng
    const n = sessionNext(r.state, cards);
    expect(n.cmds).toEqual([{ type: 'answer', deckId: 'd', cardId: q.cardId, dir: 'prod', ok: false, typo: false }]);
    expect(n.state).toMatchObject({ phase: 'ask', wrongs: 1, tries: 1 });
    expect(n.state.queue[2]).toEqual({ cardId: q.cardId, got: 0 });
  });
  it('tự luận sai rồi bấm "gõ nhầm phím" ( \\ ): tính đúng, đếm typo, không ghi câu sai', () => {
    const cards = cardsOf(3);
    const s = L(cards, { mcq: false });
    const q = sessionQuestion(s, cards);
    const w = sessionAnswer(s, cards, 'zzz').state;
    const r = sessionOverride(w, cards);
    expect(r.cmds).toEqual([{ type: 'answer', deckId: 'd', cardId: q.cardId, dir: 'prod', ok: true, typo: true }]);
    expect(r.state).toMatchObject({ phase: 'ask', wrongs: 0, tries: 1, mastered: 1 });
    expect(sessionOverride(s, cards).state).toBe(s); // không ở trạng thái sai thì vô hiệu
  });
  it('bàn phím tiếng Việt ở ô tiếng Anh: không chấm, chỉ nhắc; chiều Anh→Việt thì chấm bình thường', () => {
    const cards = cardsOf(2);
    const s = L(cards, { mcq: false });
    const r = sessionAnswer(s, cards, 'têrm');
    expect(r.state).toBe(s);
    expect(r.cmds).toEqual([]);
    expect(r.feedback).toEqual({ keyboard: true });
    const vi = L(cards, { mcq: false, dir: 'recog' });
    const q = sessionQuestion(vi, cards);
    expect(q.prompt).toBe('term-' + q.cardId);
    expect(sessionAnswer(vi, cards, 'nghia-' + q.cardId).feedback.ok).toBe(true);
  });
  it('mẻ nhỏ hơn deck: ưu tiên thẻ chưa đúng lần nào hôm nay; mẻ 0 hoặc ≥ số thẻ thì lấy hết', () => {
    const okToday = (id) => mkCard(id, { recog: { r: 1, streak: 1, last: T } });
    const cards = [okToday('a'), okToday('b'), mkCard('c'), okToday('d'), mkCard('e'), mkCard('f', { prod: { r: 1, streak: 1, last: '2026-11-14' } })];
    for (let seed = 1; seed <= 20; seed++) {
      const s = L(cards, { batch: 4 }, seed);
      const ids = s.queue.map((x) => x.cardId);
      expect(ids.length).toBe(4);
      expect(ids.slice(0, 3).sort()).toEqual(['c', 'e', 'f']); // 3 thẻ chưa đúng hôm nay đứng trước
      expect(s.total).toBe(4);
    }
    expect(L(cards, { batch: 0 }).total).toBe(6);
    expect(L(cards, { batch: 30 }).total).toBe(6);
    expect(L(cards, { batch: 2 }).queue.every((x) => ['c', 'e', 'f'].includes(x.cardId))).toBe(true);
  });
  it('độ chính xác gửi kèm sessionDone = (lượt − sai) / lượt, làm tròn', () => {
    const cards = cardsOf(2);
    const { state, cmds } = play(L(cards, { write: false }), cards, (i) => (i === 0 ? 'wrong-next' : 'right'));
    expect(state).toMatchObject({ done: true, tries: 3, wrongs: 1, mastered: 2 });
    expect(cmds.at(-1)).toMatchObject({ type: 'sessionDone', mode: 'learn', pct: 67 });
    expect(sessionSummary(state)).toEqual({ kind: 'learn', done: true, total: 2, mastered: 2, tries: 3, wrongs: 1, pct: 67, progress: 1 });
  });
  it('deck rỗng: phiên xong ngay, không phát lệnh', () => {
    const s = L([]);
    expect(s.done).toBe(true);
    expect(sessionAnswer(s, [], 'x')).toEqual({ state: s, cmds: [], feedback: null });
  });
  it('học hết một deck kho qua máy trạng thái + store → deck xong Ngày 1 (mốc 1, đổi tên)', () => {
    const cards = cardsOf(4);
    let st = { ...toV2(mkState([mkDeck('kho', { id: 'd', cards })])), deleted: [] };
    const { cmds } = play(L(cards), cards, (i) => (i % 3 === 0 ? 'wrong-next' : 'right'));
    cmds.forEach((c, i) => (st = applyCommand(st, { ...c, id: 'c' + i, day: T })));
    expect(st.decks[0]).toMatchObject({ name: '1511', stageIdx: 1, startedAt: T });
    expect(st.meta.activity[T].d).toEqual(['d']);
    expect(st.meta.activity[T].n).toBe(cmds.length - 1);
  });
});

describe('phiên Viết (mục 3.8)', () => {
  const W = (cards, over = {}, seed = 3) => startWrite(cards, { deckId: 'd', dir: 'prod', ...over }, seed);

  it('một lượt qua mọi thẻ; sai phải gõ lại ĐÚNG mới đi tiếp; điểm = đúng ngay lần đầu', () => {
    const cards = cardsOf(3);
    let s = W(cards);
    expect(s).toMatchObject({ kind: 'write', i: 0, correct: 0, retype: false, done: false });
    expect([...s.order].sort()).toEqual(['c1', 'c2', 'c3']);
    // câu 1: đúng ngay
    let q = sessionQuestion(s, cards);
    expect(q).toMatchObject({ type: 'write', dir: 'prod', prompt: 'nghĩa-' + q.cardId });
    let r = sessionAnswer(s, cards, answerOf(cardById(cards, q.cardId), 'prod'));
    expect(kinds(r.cmds)).toEqual(['answer+']);
    expect(r.state).toMatchObject({ i: 1, correct: 1 });
    s = r.state;
    // câu 2: sai → ghi sai, phải gõ lại
    q = sessionQuestion(s, cards);
    r = sessionAnswer(s, cards, 'zzz');
    expect(r.cmds).toEqual([{ type: 'answer', deckId: 'd', cardId: q.cardId, dir: 'prod', ok: false, typo: false }]);
    expect(r.feedback).toEqual({ ok: false, answer: answerOf(cardById(cards, q.cardId), 'prod') });
    expect(r.state).toMatchObject({ i: 1, correct: 1, retype: true });
    s = r.state;
    expect(sessionNext(s, cards).state).toBe(s); // không có nút bỏ qua
    r = sessionAnswer(s, cards, 'van sai');
    expect(r.state).toBe(s);
    expect(r.cmds).toEqual([]);
    expect(r.feedback).toEqual({ ok: false, retry: true, answer: answerOf(cardById(cards, q.cardId), 'prod') });
    r = sessionAnswer(s, cards, answerOf(cardById(cards, q.cardId), 'prod'));
    expect(r.cmds).toEqual([]); // gõ lại đúng không được cộng điểm, không ghi thêm
    expect(r.state).toMatchObject({ i: 2, correct: 1, retype: false });
    s = r.state;
    // câu 3: sai rồi "Tôi đã gõ đúng"
    q = sessionQuestion(s, cards);
    s = sessionAnswer(s, cards, 'zzz').state;
    r = sessionOverride(s, cards);
    expect(r.cmds).toEqual([
      { type: 'override', deckId: 'd', cardId: q.cardId, dir: 'prod' },
      { type: 'sessionDone', deckId: 'd', mode: 'write', pct: (2 / 3) * 100, full: false },
    ]);
    expect(r.state).toMatchObject({ done: true, correct: 2 });
    expect(sessionSummary(r.state)).toMatchObject({ kind: 'write', done: true, total: 3, correct: 2, progress: 1 });
  });
  it('chiều Anh→Việt; nhắc bàn phím ở chiều Việt→Anh không tính là sai', () => {
    const cards = cardsOf(2);
    const s = W(cards);
    const r = sessionAnswer(s, cards, 'đáp án');
    expect(r).toEqual({ state: s, cmds: [], feedback: { keyboard: true } });
    const vi = W(cards, { dir: 'recog' });
    const q = sessionQuestion(vi, cards);
    expect(q.prompt).toBe('term-' + q.cardId);
    expect(kinds(sessionAnswer(vi, cards, 'nghĩa-' + q.cardId).cmds)).toEqual(['answer+']);
  });
  it('override chỉ có tác dụng khi vừa bị chấm sai', () => {
    const cards = cardsOf(2);
    const s = W(cards);
    expect(sessionOverride(s, cards)).toEqual({ state: s, cmds: [], feedback: null });
  });
});

describe('phiên Kiểm tra (mục 3.8)', () => {
  const Tst = (cards, over = {}, seed = 4) => startTest(cards, { deckId: 'd', full: true, ...over }, seed);

  it('bài đủ: 2n câu tuần tự, làm đúng hết → pct 100, sessionDone full', () => {
    const cards = cardsOf(4);
    const s = Tst(cards);
    expect(s).toMatchObject({ kind: 'test', full: true, i: 0, correct: 0, phase: 'ask', done: false });
    expect(s.items).toEqual(buildTest(cards, { full: true }, mulberry32(4)));
    const { state, cmds } = play(s, cards);
    expect(state).toMatchObject({ done: true, correct: 8, wrong: [] });
    expect(kinds(cmds)).toEqual([...Array(8).fill('answer+'), 'sessionDone']);
    expect(cmds.slice(0, 8).map((c) => [c.cardId, c.dir])).toEqual(s.items.map((q) => [q.cardId, q.dir]));
    expect(cmds.at(-1)).toEqual({ type: 'sessionDone', deckId: 'd', mode: 'test', pct: 100, full: true });
  });
  it('câu hỏi theo loại: write có prompt, mcq có options, tf có shown; không bao giờ kèm đáp án', () => {
    const cards = cardsOf(6);
    let s = Tst(cards, { typeProd: 'mix', typeRecog: 'mix' });
    const seen = new Set();
    while (!s.done) {
      const q = sessionQuestion(s, cards);
      const item = s.items[s.i];
      expect(q).toMatchObject({ cardId: item.cardId, dir: item.dir, type: item.type, index: s.i, total: 12 });
      expect(q.prompt).toBe(item.dir === 'prod' ? 'nghĩa-' + item.cardId : 'term-' + item.cardId);
      expect('answer' in q).toBe(false);
      if (q.type === 'write') expect(Object.keys(q).sort()).toEqual(['cardId', 'dir', 'index', 'prompt', 'total', 'type']);
      if (q.type === 'mcq') expect(q.options.length).toBe(4);
      if (q.type === 'tf') expect(typeof q.shown).toBe('string');
      expect(sessionQuestion(s, cards)).toEqual(q); // hỏi lại vẫn y nguyên (đáp án không bị xáo lại)
      seen.add(q.type);
      s = sessionAnswer(s, cards, rightInput(s, cards)).state;
    }
    expect(seen).toEqual(new Set(['write', 'mcq', 'tf']));
    expect(s.correct).toBe(12);
  });
  it('sai: ghi câu sai, hiện đáp án, KHÔNG tự nhảy câu; "Tiếp" mới sang câu sau; pct = đúng / tổng', () => {
    const cards = cardsOf(2); // 4 câu
    const s = Tst(cards);
    const q = sessionQuestion(s, cards);
    let r = sessionAnswer(s, cards, wrongInput(s, cards));
    expect(r.cmds).toEqual([{ type: 'answer', deckId: 'd', cardId: q.cardId, dir: q.dir, ok: false, typo: false }]);
    expect(r.feedback).toEqual({ ok: false, answer: answerOf(cardById(cards, q.cardId), q.dir) });
    expect(r.state).toMatchObject({ i: 0, phase: 'wrong', correct: 0 });
    expect(sessionQuestion(r.state, cards)).toEqual(q);
    expect(sessionAnswer(r.state, cards, rightInput(s, cards)).state).toBe(r.state); // không trả lời lại được
    r = sessionNext(r.state, cards);
    expect(r.cmds).toEqual([]);
    expect(r.state).toMatchObject({ i: 1, phase: 'ask', wrong: [{ cardId: q.cardId, dir: q.dir }] });
    const end = play(r.state, cards);
    expect(end.state).toMatchObject({ done: true, correct: 3 });
    expect(end.cmds.at(-1)).toEqual({ type: 'sessionDone', deckId: 'd', mode: 'test', pct: 75, full: true });
    expect(sessionSummary(end.state)).toEqual({
      kind: 'test', done: true, full: true, total: 4, correct: 3, pct: 75, progress: 1, wrong: [{ cardId: q.cardId, dir: q.dir }],
    });
  });
  it('"Tôi đã gõ đúng" ở câu viết: hoàn lại, cộng lại điểm, bỏ khỏi danh sách sai, sang câu sau', () => {
    const cards = cardsOf(2);
    let s = Tst(cards, { typeProd: 'write', typeRecog: 'write' });
    const q = sessionQuestion(s, cards);
    s = sessionAnswer(s, cards, 'zzz').state;
    const r = sessionOverride(s, cards);
    expect(r.cmds).toEqual([{ type: 'override', deckId: 'd', cardId: q.cardId, dir: q.dir }]);
    expect(r.state).toMatchObject({ i: 1, phase: 'ask', correct: 1, wrong: [] });
    const end = play(r.state, cards);
    expect(end.cmds.at(-1)).toMatchObject({ pct: 100 });
  });
  it('"Tôi đã gõ đúng" không áp dụng cho trắc nghiệm và đúng/sai (chỉ có "Tiếp")', () => {
    const cards = cardsOf(3);
    for (const type of ['mcq', 'tf']) {
      let s = Tst(cards, { typeProd: type, typeRecog: type });
      s = sessionAnswer(s, cards, wrongInput(s, cards)).state;
      expect(s.phase).toBe('wrong');
      expect(sessionOverride(s, cards)).toEqual({ state: s, cmds: [], feedback: null });
    }
  });
  it('câu viết chiều Việt→Anh gõ bằng bàn phím tiếng Việt: không chấm sai', () => {
    const cards = cardsOf(2);
    const s = Tst(cards, { typeProd: 'write', typeRecog: 'write' });
    const q = sessionQuestion(s, cards);
    const r = sessionAnswer(s, cards, 'ô');
    if (q.dir === 'prod') expect(r).toEqual({ state: s, cmds: [], feedback: { keyboard: true } });
    else expect(r.state.phase).toBe('wrong');
  });
  it('bài rút gọn: đúng số câu yêu cầu, sessionDone full false (luyện tập, không lên mốc)', () => {
    const cards = cardsOf(10);
    const s = Tst(cards, { full: false, count: 5, answerIn: 'en' });
    expect(s.items.length).toBe(5);
    const { cmds } = play(s, cards);
    expect(cmds.at(-1)).toEqual({ type: 'sessionDone', deckId: 'd', mode: 'test', pct: 100, full: false });
  });
  it('bài Kiểm tra đủ đạt KPI qua store → deck ôn lên mốc; hai chiều đều được ghi điểm', () => {
    const dirSt = () => ({ r: 1, w: 0, streak: 1, typo: 0, last: '2026-11-01' });
    const cards = cardsOf(5).map((c) => ({ ...c, st: { prod: dirSt(), recog: dirSt() } }));
    const deck = mkDeck('ôn', { id: 'd', cards, stageIdx: 2, anchor: '2026-11-12', lastCompleted: '2026-11-13', history: [{ date: '2026-11-12', pct: 100 }] });
    let st = { ...toV2(mkState([deck])), deleted: [] };
    const { cmds } = play(Tst(cards), cards);
    cmds.forEach((c, i) => (st = applyCommand(st, { ...c, id: 'c' + i, day: T })));
    expect(st.decks[0]).toMatchObject({ name: 'ôn', stageIdx: 3, lastCompleted: T });
    expect(st.decks[0].cards.every((c) => c.st.prod.r === 2 && c.st.recog.r === 2)).toBe(true);
  });
});

describe('phiên: tuần tự hoá để "Học tiếp", và tính thuần', () => {
  const cards = cardsOf(7);
  const script = (i) => (i % 4 === 1 ? 'wrong-next' : i % 5 === 2 ? 'wrong-override' : 'right');
  const starts = {
    learn: () => startLearn(cards, { deckId: 'd', dir: 'recog', mcq: true, write: true, batch: 5 }, T, 11),
    write: () => startWrite(cards, { deckId: 'd', dir: 'prod' }, 12),
    test: () => startTest(cards, { deckId: 'd', full: true, typeProd: 'mix', typeRecog: 'mix' }, 13),
  };
  for (const [kind, start] of Object.entries(starts)) {
    it(`${kind}: lưu thành JSON giữa chừng rồi khôi phục → cùng trạng thái, cùng câu hỏi, cùng kết quả cuối`, () => {
      const straight = play(start(), cards, script);
      expect(straight.state.done).toBe(true);
      const half = play(start(), cards, script, [], 0, 4);
      expect(half.state.done).toBe(false);
      const restored = JSON.parse(JSON.stringify(half.state));
      expect(restored).toEqual(half.state);
      expect(sessionQuestion(restored, cards)).toEqual(sessionQuestion(half.state, cards));
      const resumed = play(restored, cards, script, half.cmds, half.i);
      expect(resumed.state).toEqual(straight.state);
      expect(resumed.cmds).toEqual(straight.cmds);
    });
    it(`${kind}: cùng seed cho cùng phiên; không sửa state và thẻ truyền vào`, () => {
      expect(start()).toEqual(start());
      const freeze = (o) => {
        if (o && typeof o === 'object') {
          Object.values(o).forEach(freeze);
          Object.freeze(o);
        }
        return o;
      };
      const frozenCards = freeze(structuredClone(cards));
      let s = freeze(start());
      let guard = 0;
      while (!s.done && guard++ < 200) {
        const r = sessionAnswer(s, frozenCards, guard % 3 === 0 ? wrongInput(s, frozenCards) : rightInput(s, frozenCards));
        s = freeze(r.state);
        if (s.phase === 'wrong') s = freeze(sessionNext(s, frozenCards).state);
        else if (s.retype) s = freeze(sessionAnswer(s, frozenCards, rightInput(s, frozenCards)).state);
      }
      expect(s.done).toBe(true);
    });
  }
  it('phiên đã xong: mọi thao tác đều vô hiệu; thẻ của câu hiện tại bị xoá giữa phiên: không sập', () => {
    const done = play(starts.write(), cards).state;
    for (const f of [sessionAnswer, sessionNext, sessionOverride]) expect(f(done, cards, 'x')).toEqual({ state: done, cmds: [], feedback: null });
    expect(sessionQuestion(done, cards)).toBe(null);
    const s = starts.write();
    const without = cards.filter((c) => c.id !== s.order[0]);
    expect(sessionQuestion(s, without)).toBe(null);
    expect(sessionAnswer(s, without, 'x')).toEqual({ state: s, cmds: [], feedback: null });
  });
});
