// Thuộc và tiến độ deck (PLAN.md mục 3.7).
// `knownDir`, `cardKnown`, `deckMastery`, `isMastered` chuyển nguyên văn từ v1
// (khác biệt duy nhất: chỉ ĐỌC thẻ, không tự tạo hồ sơ `st` như `cst` của v1).

import { deckStatus } from './schedule.js';

/** Số mốc của một deck: Mới, +1, +3, +7, +16. */
const STAGES = 5;

/** Thuộc một chiều = trả lời đúng 2 lần liên tiếp. */
export function knownDir(card, dir) {
  const st = card && card.st;
  // st kiểu cũ một chiều (st.r là số) coi như chưa có hồ sơ, giống v1
  if (!st || typeof st.r === 'number' || !st[dir]) return false;
  return st[dir].streak >= 2;
}

/** Thuộc thẻ = vững CẢ HAI chiều. */
export function cardKnown(card) {
  return knownDir(card, 'prod') && knownDir(card, 'recog');
}

/**
 * @param {any} set
 * @returns {{ done: number, total: number, pct: number, prod: number, recog: number }}
 *   `done` số thẻ thuộc cả hai chiều; `prod` / `recog` là % thẻ thuộc từng chiều
 */
export function deckMastery(set) {
  const cards = set.cards || [];
  const n = cards.length;
  if (!n) return { done: 0, total: 0, pct: 0, prod: 0, recog: 0 };
  const done = cards.filter(cardKnown).length;
  return {
    done,
    total: n,
    pct: Math.round((done / n) * 100),
    prod: Math.round((cards.filter((c) => knownDir(c, 'prod')).length / n) * 100),
    recog: Math.round((cards.filter((c) => knownDir(c, 'recog')).length / n) * 100),
  };
}

/** Thuộc deck = có thẻ, và mọi thẻ vững cả 2 chiều. */
export function isMastered(set) {
  const cards = set.cards || [];
  return cards.length > 0 && cards.every(cardKnown);
}

const brief = (h) => (h ? { date: h.date, pct: h.pct } : null);

/**
 * MỚI: tiến độ chi tiết của một deck cho màn Học phần.
 * @param {any} set
 * @param {string} today ngày học
 * @param {number} [kpi] KPI đang cài (mặc định 90), để biết bài Kiểm tra nào là "đạt"
 * @returns {{
 *   total: number, known: number, prodPct: number, recogPct: number,
 *   lastTest: { date: string, pct: number } | null,
 *   bestTest: { date: string, pct: number } | null,
 *   lastWrite: { date: string, pct: number } | null,
 *   stagesPassed: { passed: boolean, date: string | null }[],
 *   stageIdx: number, status: any }}
 *   `stagesPassed` có 5 phần tử cho Mới, +1, +3, +7, +16; `date` null khi dữ liệu cũ không ghi.
 */
export function deckProgress(set, today, kpi = 90) {
  const m = deckMastery(set);
  const history = set.history || [];
  const tests = history.filter((h) => h && (h.mode ?? 'test') === 'test');
  const writes = history.filter((h) => h && h.mode === 'write');
  let best = null;
  for (const h of tests) if (!best || h.pct >= best.pct) best = h; // hoà điểm: lấy lần gần nhất
  const stageIdx = set.stageIdx || 0;
  const stagesPassed = [];
  for (let i = 0; i < STAGES; i++) {
    const passed = stageIdx > i;
    let date = null;
    if (passed) {
      // lùi mốc rồi qua lại thì lấy lần qua CUỐI
      const hit = tests.filter((h) => h.stage === i && h.pct >= kpi).at(-1);
      if (hit) date = hit.date;
      if (i === 0 && set.startedAt) date = set.startedAt; // xong Ngày 1 bằng Học thì không có bài Kiểm tra
    }
    stagesPassed.push({ passed, date });
  }
  return {
    total: m.total,
    known: m.done,
    prodPct: m.prod,
    recogPct: m.recog,
    lastTest: brief(tests.at(-1)),
    bestTest: brief(best),
    lastWrite: brief(writes.at(-1)),
    stagesPassed,
    stageIdx,
    status: deckStatus(set, today),
  };
}
