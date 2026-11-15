// Phiên học (PLAN.md mục 3.8). Task 2.7: bộ sinh số ngẫu nhiên và dựng bài Kiểm tra.
// Máy trạng thái Học / Viết / Kiểm tra thêm ở task 2.8.
// Mọi chỗ cần ngẫu nhiên đều nhận `rng` (hàm trả về số trong [0, 1)); không dùng Math.random.

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
