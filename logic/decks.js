// Việc trên deck: đổi tên khi xong Ngày 1 (PLAN.md mục 3.10), đọc danh sách dán vào, tìm từ trùng.

import { norm } from './answers.js';

/** Tên để so trùng: bỏ khoảng trắng hai đầu, chữ thường. Không phải chuỗi → ''. */
function nameKey(s) {
  return typeof s === 'string' ? s.trim().toLowerCase() : '';
}

/**
 * Tên deck theo ngày xong Ngày 1: `DDMM` của ngày học `today`.
 * Trùng tên deck khác thì thêm hậu tố trống đầu tiên: b, c, … z, rồi `-27`, `-28`…
 * @param {string} today ngày học 'YYYY-MM-DD'
 * @param {any[]} otherNames tên các deck KHÁC (chưa xoá)
 * @returns {string}
 */
export function day1Name(today, otherNames) {
  const base = today.slice(8, 10) + today.slice(5, 7);
  const taken = new Set((otherNames || []).map(nameKey));
  if (!taken.has(base)) return base;
  for (let k = 2; ; k++) {
    const name = base + (k <= 26 ? String.fromCharCode(96 + k) : '-' + k);
    if (!taken.has(name)) return name;
  }
}

/**
 * Deck vừa xong Ngày 1 (kết quả `applySessionResult` lên mốc từ mốc 0) thì đổi tên theo `day1Name`.
 * Mọi trường hợp khác (ôn, học dở, trượt) trả lại đúng `result.set`. Không sửa đầu vào.
 * @param {{ set: any, advanced: boolean, stageFrom: number }} result kết quả của `applySessionResult`
 * @param {any[]} otherNames tên các deck KHÁC (chưa xoá)
 * @param {string} today ngày học 'YYYY-MM-DD'
 * @returns {any} deck
 */
export function renameOnDay1(result, otherNames, today) {
  if (!result.advanced || result.stageFrom !== 0) return result.set;
  return { ...result.set, name: day1Name(today, otherNames) };
}

/** Deck xong Ngày 1 trên v1 từ ngày này trở đi thì được đổi tên lúc chuyển dữ liệu sang v2 (Khang 15/11). */
export const DAY1_RENAME_FROM = '2026-11-15';

/**
 * Lúc chuyển dữ liệu v1 → v2: v1 không tự đổi tên, nên deck nào xong Ngày 1 trên v1
 * (`startedAt`) từ `fromDay` trở đi thì đổi tên theo ngày xong Ngày 1 THẬT, đúng luật `day1Name`.
 * Xử lý theo thứ tự (`startedAt`, vị trí trong mảng); thứ tự mảng giữ nguyên. Chạy lại cho cùng kết quả.
 * Không sửa đầu vào; deck không đổi tên là chính đối tượng cũ.
 * @param {any[]} sets các deck dạng v1
 * @param {string} [fromDay]
 * @returns {{ sets: any[], renamed: { id: string, from: string, to: string }[] }}
 */
export function renameDay1OnImport(sets, fromDay = DAY1_RENAME_FROM) {
  const out = [...sets];
  const renamed = [];
  const isDay = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
  const todo = out
    .map((s, i) => i)
    .filter((i) => isDay(out[i].startedAt) && out[i].startedAt >= fromDay)
    .sort((a, b) => (out[a].startedAt < out[b].startedAt ? -1 : out[a].startedAt > out[b].startedAt ? 1 : a - b));
  for (const i of todo) {
    const set = out[i];
    const others = out.filter((_, j) => j !== i).map((s) => s.name);
    const name = day1Name(set.startedAt, others);
    if (name === set.name) continue;
    out[i] = { ...set, name };
    renamed.push({ id: set.id, from: set.name, to: name });
  }
  return { sets: out, renamed };
}

/**
 * Đọc danh sách dán vào, mỗi dòng một thẻ: `từ: nghĩa`, hoặc `từ<Tab>nghĩa` (Quizlet xuất ra dùng Tab).
 * Mỗi dòng tự xét: dòng có Tab (sau khi cắt khoảng trắng hai đầu) thì tách ở Tab ĐẦU TIÊN và giữ nguyên
 * dấu `:` bên trong; không có Tab thì tách ở dấu `:` ĐẦU TIÊN.
 * Bỏ dòng trống; dòng không có dấu tách, thiếu từ hoặc thiếu nghĩa là dòng lỗi.
 * Thẻ trả về chỉ có `term`, `def`; nơi gọi tự gắn `id`.
 * @param {string} text
 * @returns {{ cards: { term: string, def: string }[], bad: number, badLines: string[] }}
 */
export function parseCards(text) {
  const cards = [];
  const badLines = [];
  const lines = String(text ?? '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  for (const line of lines) {
    const tab = line.indexOf('\t');
    const idx = tab >= 0 ? tab : line.indexOf(':');
    const term = idx < 0 ? '' : line.slice(0, idx).trim();
    const def = idx < 0 ? '' : line.slice(idx + 1).trim();
    if (term && def) cards.push({ term, def });
    else badLines.push(line);
  }
  return { cards, bad: badLines.length, badLines };
}

/**
 * Các thẻ đang soạn mà từ (`term`) đã có ở deck KHÁC. Chuyển từ v1 (bản vá 13/09): so nguyên chuỗi
 * từ theo `norm`; từ có ở nhiều deck thì báo deck đứng trước; mỗi từ chỉ báo một lần.
 * @param {{ term: string }[]} cards thẻ đang soạn
 * @param {any[]} decks mọi deck chưa xoá
 * @param {string | null} skipDeckId deck đang sửa (bỏ qua chính nó)
 * @returns {{ term: string, deck: string, deckId: string }[]} `deck` là tên deck đã có từ đó
 */
export function findDupTerms(cards, decks, skipDeckId) {
  const owner = new Map();
  for (const d of decks || []) {
    if (d.id === skipDeckId) continue;
    for (const c of d.cards || []) {
      const k = norm(c.term);
      if (k && !owner.has(k)) owner.set(k, d);
    }
  }
  const out = [];
  const seen = new Set();
  for (const c of cards || []) {
    const k = norm(c.term);
    if (k && owner.has(k) && !seen.has(k)) {
      seen.add(k);
      out.push({ term: c.term, deck: owner.get(k).name, deckId: owner.get(k).id });
    }
  }
  return out;
}

/**
 * Bỏ khỏi danh sách đang soạn mọi thẻ có từ nằm trong `dups` (kết quả `findDupTerms`). Không sửa đầu vào.
 * @param {{ term: string }[]} cards
 * @param {{ term: string }[]} dups
 */
export function dropDupTerms(cards, dups) {
  const bad = new Set(dups.map((d) => norm(d.term)));
  return cards.filter((c) => !bad.has(norm(c.term)));
}
