// Phiên học (PLAN.md mục 3.8): bộ sinh số ngẫu nhiên, dựng bài Kiểm tra,
// và máy trạng thái thuần cho Học / Viết / Kiểm tra (nửa dưới file).
// Mọi chỗ cần ngẫu nhiên đều nhận `rng` (hàm trả về số trong [0, 1)); không dùng Math.random.

import { isRight, keyboardMismatch, norm, normVi } from './answers.js';

/**
 * Bộ sinh số ngẫu nhiên có seed (mulberry32). Cùng seed cho cùng dãy số.
 * @param {number} seed
 * @returns {() => number} số trong [0, 1)
 */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Bản sao đã xáo trộn (Fisher–Yates) của `arr`. */
export function shuffled(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Số câu KHÁC tối thiểu giữa hai chiều của cùng một thẻ, với deck `n` thẻ. */
export function minGap(n) {
  return Math.min(8, Math.floor(n / 2));
}

const MIX = ['write', 'mcq', 'tf'];
const other = (dir) => (dir === 'prod' ? 'recog' : 'prod');

/**
 * Dãy `2n` câu `{ cardId, dir }`: mỗi thẻ một `prod` một `recog`, hai câu của một thẻ
 * cách nhau ít nhất `minGap(n)` câu khác.
 */
function fullOrder(cards, rng) {
  const n = cards.length;
  const gap = minGap(n);
  const first = shuffled(cards, rng).map((c) => ({ cardId: c.id, dir: rng() < 0.5 ? 'prod' : 'recog' }));
  // nửa sau cùng thứ tự với nửa đầu: khoảng cách đúng n − 1
  const second = first.map((q) => ({ cardId: q.cardId, dir: other(q.dir) }));
  const firstPos = new Map(first.map((q, i) => [q.cardId, i]));
  // còn đủ khoảng cách không, nếu câu thứ hai của thẻ này nằm ở vị trí `at` của nửa sau
  const okAt = (cardId, at) => n + at - firstPos.get(cardId) - 1 >= gap;
  for (let k = 0; k < n; k++) {
    const i = Math.floor(rng() * n);
    const j = Math.floor(rng() * n);
    if (i !== j && okAt(second[i].cardId, j) && okAt(second[j].cardId, i)) {
      [second[i], second[j]] = [second[j], second[i]];
    }
  }
  return first.concat(second);
}

/**
 * Dựng bài Kiểm tra.
 * - Bài đủ (`opts.full`): mỗi thẻ đúng 2 câu (tính lên mốc).
 * - Bài rút gọn: `opts.count` câu, `opts.answerIn` 'en' (toàn `prod`) | 'vi' (toàn `recog`) | 'both'.
 *   Một chiều thì tối đa `n` câu; 'both' tối đa `2n` (hết thẻ mới hỏi tới chiều còn lại).
 * - Loại câu theo chiều: `opts.typeProd` (mặc định 'write'), `opts.typeRecog` (mặc định 'mcq');
 *   'mix' xoay vòng write, mcq, tf theo chỉ số câu như v1.
 * @param {{ id: string }[]} cards
 * @param {{ full?: boolean, count?: number, answerIn?: 'en' | 'vi' | 'both',
 *           typeProd?: string, typeRecog?: string }} opts
 * @param {() => number} rng
 * @returns {{ cardId: string, dir: 'prod' | 'recog', type: 'write' | 'mcq' | 'tf' }[]}
 */
export function buildTest(cards, opts, rng) {
  const o = opts || {};
  let order;
  if (o.full) {
    order = fullOrder(cards, rng);
  } else {
    const count = Math.max(0, Math.floor(o.count || 0));
    const answerIn = o.answerIn || 'both';
    if (answerIn === 'both') {
      order = fullOrder(cards, rng).slice(0, count);
    } else {
      const dir = answerIn === 'en' ? 'prod' : 'recog';
      order = shuffled(cards, rng)
        .slice(0, count)
        .map((c) => ({ cardId: c.id, dir }));
    }
  }
  const pick = { prod: o.typeProd || 'write', recog: o.typeRecog || 'mcq' };
  return order.map((q, i) => ({
    cardId: q.cardId,
    dir: q.dir,
    type: pick[q.dir] === 'mix' ? MIX[i % 3] : pick[q.dir],
  }));
}

/* ================================================================== */
/* Máy trạng thái phiên: Học, Viết, Kiểm tra (task 2.8)                 */
/* ================================================================== */
// Trạng thái phiên là JSON thuần (lưu được để "Học tiếp"), chỉ giữ id thẻ; danh sách thẻ của deck
// (`cards`) truyền vào ở mỗi lần gọi. Mọi hàm đều thuần và trả về `{ state, cmds, feedback }`:
//   - `cmds`: các lệnh cho kho lệnh (`answer`, `override`, `sessionDone`); nơi gọi đưa vào
//     `dispatch` của phiên (store tự gắn `id`, `day`).
//   - `feedback`: điều giao diện cần hiện sau thao tác (`{ ok, answer }`, `{ keyboard: true }`…), hoặc null.
// Đáp án đúng chỉ xuất hiện trong `feedback`, tức là SAU khi người học trả lời; `sessionQuestion`
// không bao giờ kèm đáp án.

const answerOf = (card, dir) => (dir === 'prod' ? card.term : card.def);
const promptOf = (card, dir) => (dir === 'prod' ? card.def : card.term);
const keyOf = (dir, s) => (dir === 'prod' ? norm(s) : normVi(s));
const findCard = (cards, id) => (cards || []).find((c) => c.id === id) || null;
const NOOP = (state) => ({ state, cmds: [], feedback: null });

/** Đáp án của các thẻ khác dùng làm nhiễu được: không trùng nghĩa đáp án đúng, không trùng nhau. */
function distractors(cards, card, dir, rng) {
  const a = answerOf(card, dir);
  const seen = new Set([keyOf(dir, a)]);
  const out = [];
  for (const c of shuffled(cards.filter((x) => x.id !== card.id), rng)) {
    const o = answerOf(c, dir);
    const k = keyOf(dir, o);
    // bỏ: rỗng, trùng, hoặc "cũng đúng" theo một trong hai phía (một nghĩa của thẻ này là đáp án thẻ kia)
    if (!k || seen.has(k) || isRight(card, dir, o) || isRight(c, dir, a)) continue;
    seen.add(k);
    out.push(o);
  }
  return out;
}

/**
 * Các lựa chọn của một câu trắc nghiệm: đáp án đúng + tối đa 3 đáp án nhiễu, đã xáo.
 * Luôn có đúng 1 lựa chọn đúng.
 * @returns {{ options: string[], correct: number }}
 */
export function mcqOptions(cards, cardId, dir, rng) {
  const card = findCard(cards, cardId);
  const a = answerOf(card, dir);
  const options = shuffled([a, ...distractors(cards, card, dir, rng).slice(0, 3)], rng);
  return { options, correct: options.indexOf(a) };
}

/**
 * Câu đúng/sai: một nửa số lần hiện đáp án đúng, nửa còn lại hiện đáp án của thẻ khác (không trùng nghĩa).
 * @returns {{ shown: string, truth: boolean }}
 */
export function tfItem(cards, cardId, dir, rng) {
  const card = findCard(cards, cardId);
  const a = answerOf(card, dir);
  const wantTrue = rng() < 0.5;
  const others = distractors(cards, card, dir, rng);
  if (wantTrue || !others.length) return { shown: a, truth: true };
  return { shown: others[0], truth: false };
}

/** Bộ sinh số riêng cho câu thứ `n` của phiên: hỏi lại bao nhiêu lần cũng ra cùng lựa chọn. */
const questionRng = (state, n) => mulberry32((state.seed ^ Math.imul(n + 1, 0x9e3779b1)) >>> 0);

/** Thẻ đã đúng ít nhất một chiều hôm nay chưa (cùng điều kiện với `learnedToday`). */
const okToday = (c, today) => ['prod', 'recog'].some((k) => c.st && c.st[k] && c.st[k].last === today && c.st[k].streak >= 1);

/**
 * Mở phiên Học. Mỗi thẻ phải đúng lần lượt các bước đang bật (trắc nghiệm rồi tự luận) mới xong.
 * @param {any[]} cards thẻ của deck
 * @param {{ deckId: string, dir: 'prod' | 'recog', mcq?: boolean, write?: boolean, batch?: number }} opts
 *   `batch` = cỡ mẻ (0 hoặc ≥ số thẻ: cả deck). Mẻ nhỏ hơn deck thì ưu tiên thẻ chưa đúng lần nào hôm nay.
 * @param {string} today ngày học
 * @param {number} seed
 */
export function startLearn(cards, opts, today, seed) {
  const steps = [];
  if (opts.mcq) steps.push('mcq');
  if (opts.write) steps.push('write');
  if (!steps.length) steps.push('write');
  let pool = shuffled(cards, mulberry32(seed));
  if (opts.batch > 0 && opts.batch < pool.length) {
    pool = pool
      .filter((c) => !okToday(c, today))
      .concat(pool.filter((c) => okToday(c, today)))
      .slice(0, opts.batch);
  }
  return {
    kind: 'learn',
    deckId: opts.deckId,
    dir: opts.dir,
    steps,
    seed,
    queue: pool.map((c) => ({ cardId: c.id, got: 0 })),
    total: pool.length,
    mastered: 0,
    tries: 0,
    wrongs: 0,
    phase: 'ask',
    done: pool.length === 0,
  };
}

/**
 * Mở phiên Viết: một lượt qua mọi thẻ; sai phải gõ lại đúng mới đi tiếp; điểm = đúng ngay lần đầu.
 * @param {any[]} cards
 * @param {{ deckId: string, dir: 'prod' | 'recog' }} opts
 * @param {number} seed
 */
export function startWrite(cards, opts, seed) {
  const order = shuffled(cards, mulberry32(seed)).map((c) => c.id);
  return { kind: 'write', deckId: opts.deckId, dir: opts.dir, seed, order, i: 0, correct: 0, retype: false, done: order.length === 0 };
}

/**
 * Mở phiên Kiểm tra. `opts` như `buildTest` (full / count / answerIn / typeProd / typeRecog) cộng `deckId`.
 * @param {any[]} cards
 * @param {any} opts
 * @param {number} seed
 */
export function startTest(cards, opts, seed) {
  const items = buildTest(cards, opts, mulberry32(seed));
  return { kind: 'test', deckId: opts.deckId, full: !!opts.full, seed, items, i: 0, correct: 0, wrong: [], phase: 'ask', done: items.length === 0 };
}

/** Câu đang hỏi: `{ cardId, dir, type, n }` (n = số thứ tự để sinh lựa chọn), hoặc null khi phiên đã xong. */
function current(state) {
  if (!state || state.done) return null;
  if (state.kind === 'learn') {
    const head = state.queue[0];
    return { cardId: head.cardId, dir: state.dir, type: state.steps[Math.min(head.got, state.steps.length - 1)], n: state.tries };
  }
  if (state.kind === 'write') return { cardId: state.order[state.i], dir: state.dir, type: 'write', n: state.i };
  if (state.kind === 'test') return { ...state.items[state.i], n: state.i };
  return null;
}

/**
 * Câu hỏi hiện tại để giao diện vẽ: `{ cardId, dir, type, prompt }`, kèm `options` (trắc nghiệm) hoặc
 * `shown` (đúng/sai); phiên Kiểm tra có thêm `index`, `total`. KHÔNG kèm đáp án.
 * null khi phiên đã xong, hoặc khi thẻ của câu này không còn trong deck.
 */
export function sessionQuestion(state, cards) {
  const cur = current(state);
  const card = cur && findCard(cards, cur.cardId);
  if (!card) return null;
  const q = { cardId: cur.cardId, dir: cur.dir, type: cur.type, prompt: promptOf(card, cur.dir) };
  if (cur.type === 'mcq') q.options = mcqOptions(cards, card.id, cur.dir, questionRng(state, cur.n)).options;
  if (cur.type === 'tf') q.shown = tfItem(cards, card.id, cur.dir, questionRng(state, cur.n)).shown;
  if (state.kind === 'test') {
    q.index = state.i;
    q.total = state.items.length;
  }
  return q;
}

/** Chấm `input` cho câu hiện tại: chuỗi (tự luận), chỉ số lựa chọn (trắc nghiệm), true/false (đúng/sai). */
function grade(state, cards, cur, card, input) {
  if (cur.type === 'mcq') return mcqOptions(cards, card.id, cur.dir, questionRng(state, cur.n)).correct === input;
  if (cur.type === 'tf') return tfItem(cards, card.id, cur.dir, questionRng(state, cur.n)).truth === input;
  return isRight(card, cur.dir, input);
}

const answerCmd = (state, cur, ok, typo = false) => ({ type: 'answer', deckId: state.deckId, cardId: cur.cardId, dir: cur.dir, ok, typo });
const overrideCmd = (state, cur) => ({ type: 'override', deckId: state.deckId, cardId: cur.cardId, dir: cur.dir });
const doneCmd = (state, mode, pct, full) => ({ type: 'sessionDone', deckId: state.deckId, mode, pct, full });

/* ---- Học ---- */

/** Ghi kết quả câu đầu hàng đợi của phiên Học, rồi xếp lại hàng đợi như v1. */
function learnResolve(state, cur, ok, typo) {
  const head = state.queue[0];
  const queue = state.queue.slice(1);
  const requeue = (item, gap) => queue.splice(Math.min(queue.length, gap), 0, item);
  let { mastered, wrongs } = state;
  if (ok) {
    const got = head.got + 1;
    if (got >= state.steps.length) mastered++;
    else requeue({ cardId: head.cardId, got }, 3); // đúng chưa đủ bước: gặp lại sau 3 câu
  } else {
    wrongs++;
    requeue({ cardId: head.cardId, got: 0 }, 2); // sai: về bước đầu, gặp lại sau 2 câu
  }
  const next = { ...state, queue, mastered, wrongs, tries: state.tries + 1, phase: 'ask', done: queue.length === 0 };
  const cmds = [answerCmd(state, cur, ok, typo)];
  if (next.done) cmds.push(doneCmd(state, 'learn', learnPct(next), false));
  return { state: next, cmds };
}
const learnPct = (s) => (s.tries ? Math.round(((s.tries - s.wrongs) / s.tries) * 100) : 100);

/* ---- Viết ---- */

function writeAdvance(state, correct, cmds) {
  const i = state.i + 1;
  const next = { ...state, i, correct, retype: false, done: i >= state.order.length };
  if (next.done) cmds.push(doneCmd(state, 'write', (correct / state.order.length) * 100, false));
  return { state: next, cmds };
}

/* ---- Kiểm tra ---- */

function testAdvance(state, patch, cmds) {
  const i = state.i + 1;
  const next = { ...state, ...patch, i, phase: 'ask', done: i >= state.items.length };
  if (next.done) cmds.push(doneCmd(state, 'test', (next.correct / state.items.length) * 100, state.full));
  return { state: next, cmds };
}

/**
 * Người học trả lời câu hiện tại.
 * `input`: chuỗi gõ vào (tự luận), chỉ số lựa chọn bắt đầu từ 0 (trắc nghiệm), true/false (đúng/sai).
 * - Ô tiếng Anh mà gõ bằng bàn phím tiếng Việt: không chấm, `feedback = { keyboard: true }`.
 * - Học: trắc nghiệm ghi ngay; tự luận sai thì CHƯA ghi, chờ `sessionNext` ("Tiếp", ghi sai) hoặc
 *   `sessionOverride` ("gõ nhầm phím", tính đúng + đếm typo).
 * - Viết: sai thì ghi sai và chuyển sang gõ lại (`retype`); gõ lại đúng mới đi tiếp, không cộng điểm.
 * - Kiểm tra: sai thì ghi sai và DỪNG ở câu đó (`phase: 'wrong'`), chờ `sessionNext` hoặc `sessionOverride`.
 * @returns {{ state: any, cmds: any[], feedback: any }}
 */
export function sessionAnswer(state, cards, input) {
  const cur = current(state);
  const card = cur && findCard(cards, cur.cardId);
  if (!card || state.phase === 'wrong') return NOOP(state);
  if (cur.type === 'write' && keyboardMismatch(cur.dir, input, card)) return { state, cmds: [], feedback: { keyboard: true } };
  const ok = grade(state, cards, cur, card, input);
  const answer = answerOf(card, cur.dir);

  if (state.kind === 'learn') {
    if (!ok && cur.type === 'write') return { state: { ...state, phase: 'wrong' }, cmds: [], feedback: { ok, answer } };
    return { ...learnResolve(state, cur, ok, false), feedback: { ok, answer } };
  }
  if (state.kind === 'write') {
    if (state.retype) {
      if (!ok) return { state, cmds: [], feedback: { ok: false, retry: true, answer } };
      return { ...writeAdvance(state, state.correct, []), feedback: { ok: true, answer } };
    }
    if (!ok) return { state: { ...state, retype: true }, cmds: [answerCmd(state, cur, false)], feedback: { ok, answer } };
    return { ...writeAdvance(state, state.correct + 1, [answerCmd(state, cur, true)]), feedback: { ok, answer } };
  }
  // Kiểm tra
  const cmds = [answerCmd(state, cur, ok)];
  if (!ok) return { state: { ...state, phase: 'wrong' }, cmds, feedback: { ok, answer } };
  return { ...testAdvance(state, { correct: state.correct + 1 }, cmds), feedback: { ok, answer } };
}

/**
 * Nút "Tiếp" sau khi sai. Học (tự luận): ghi câu sai rồi đi tiếp. Kiểm tra: sang câu sau, câu vừa rồi
 * vào danh sách sai. Viết: không có nút này (phải gõ lại đúng). Lúc khác: vô hiệu.
 */
export function sessionNext(state, cards) {
  const cur = current(state);
  if (!cur || state.phase !== 'wrong') return NOOP(state);
  if (state.kind === 'learn') return { ...learnResolve(state, cur, false, false), feedback: null };
  if (state.kind === 'test') {
    return { ...testAdvance(state, { wrong: [...state.wrong, { cardId: cur.cardId, dir: cur.dir }] }, []), feedback: null };
  }
  return NOOP(state);
}

/**
 * Phím `\` sau khi bị chấm sai ở câu TỰ LUẬN. Trắc nghiệm và đúng/sai không có.
 * - Học: "gõ nhầm phím": tính là đúng, đếm typo (câu sai chưa hề được ghi).
 * - Viết, Kiểm tra: "Tôi đã gõ đúng": hoàn lại cú chấm sai (lệnh `override`), cộng lại điểm, đi tiếp.
 */
export function sessionOverride(state, cards) {
  const cur = current(state);
  if (!cur || cur.type !== 'write') return NOOP(state);
  if (state.kind === 'learn' && state.phase === 'wrong') return { ...learnResolve(state, cur, true, true), feedback: null };
  if (state.kind === 'write' && state.retype) return { ...writeAdvance(state, state.correct + 1, [overrideCmd(state, cur)]), feedback: null };
  if (state.kind === 'test' && state.phase === 'wrong') {
    return { ...testAdvance(state, { correct: state.correct + 1 }, [overrideCmd(state, cur)]), feedback: null };
  }
  return NOOP(state);
}

/**
 * Tóm tắt phiên cho thanh tiến độ và màn Kết quả.
 * - Học: `{ kind, done, total, mastered, tries, wrongs, pct, progress }` (pct = độ chính xác)
 * - Viết: `{ kind, done, total, correct, pct, progress }` (pct = đúng ngay lần đầu)
 * - Kiểm tra: `{ kind, done, full, total, correct, pct, progress, wrong: [{ cardId, dir }] }`
 */
export function sessionSummary(state) {
  if (state.kind === 'learn') {
    const { kind, done, total, mastered, tries, wrongs } = state;
    return { kind, done, total, mastered, tries, wrongs, pct: learnPct(state), progress: total ? mastered / total : 1 };
  }
  if (state.kind === 'write') {
    const total = state.order.length;
    return { kind: 'write', done: state.done, total, correct: state.correct, pct: total ? (state.correct / total) * 100 : 0, progress: total ? state.i / total : 1 };
  }
  const total = state.items.length;
  return {
    kind: 'test', done: state.done, full: state.full, total, correct: state.correct,
    pct: total ? (state.correct / total) * 100 : 0, progress: total ? state.i / total : 1, wrong: state.wrong,
  };
}
