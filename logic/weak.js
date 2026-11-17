// Thẻ yếu (Phase 3, Khang 15/11): thẻ còn sai ở lần ôn +16 không xong vòng cùng deck,
// mà tách sang deck "Thẻ yếu" do app tự tạo; deck đó chạy lịch ôn riêng (+1, +3, +7, +16).

/** Tên deck do app tự tạo để chứa thẻ yếu. Deck được nhận ra bằng `kind === 'weak'`, không bằng tên. */
export const WEAK_NAME = 'Thẻ yếu';

/**
 * Thẻ "còn sai" trong ngày `day`: có ít nhất một chiều mà lần trả lời gần nhất là hôm nay và SAI
 * (`last === day`, `streak === 0`). Sai rồi được "Tôi đã gõ đúng" hoàn lại thì không tính.
 * @param {any} card
 * @param {string} day ngày học 'YYYY-MM-DD'
 * @returns {boolean}
 */
export function isWeakCard(card, day) {
  const st = card && card.st;
  if (!st || typeof st.r === 'number') return false; // st kiểu cũ một chiều: coi như chưa có hồ sơ
  return ['prod', 'recog'].some((k) => st[k] && st[k].last === day && (st[k].streak || 0) === 0);
}

/** Thay deck ở vị trí `i`. */
function withDeck(decks, i, deck) {
  const out = decks.slice();
  out[i] = deck;
  return out;
}

/**
 * Gọi ngay sau khi deck `deckId` VỪA QUA mốc +16 (xong vòng) trong ngày `day`.
 * - Deck thường: thẻ còn sai hôm nay chuyển sang deck "Thẻ yếu" (tạo nếu chưa có), kèm `weakFrom` = id deck gốc.
 *   Deck "Thẻ yếu" (kể cả khi đang giữa vòng) quay về mốc +1 tính từ hôm nay: hẹn ôn ngày mai.
 * - Chính deck "Thẻ yếu": thẻ đã đúng trở về deck gốc (nếu deck gốc còn); thẻ còn sai ở lại và deck chạy lại
 *   từ mốc +1. Không còn thẻ sai thì deck ở trạng thái xong vòng (có thể rỗng).
 * Hàm thuần: không sửa `state`; không có gì để làm thì trả lại chính `state`.
 * @param {{ meta: any, decks: any[], deleted?: any[] }} state
 * @param {string} deckId
 * @param {string} day
 * @param {string} cmdId id của lệnh gây ra việc này (để id deck mới giống nhau ở mọi máy)
 */
export function splitWeak(state, deckId, day, cmdId) {
  const i = state.decks.findIndex((d) => d.id === deckId);
  if (i < 0) return state;
  const deck = state.decks[i];
  const cards = deck.cards || [];
  const restart = { stageIdx: 1, anchor: day, rescheduled: false, recovering: false };

  if (deck.kind === 'weak') {
    const homeIds = new Set(state.decks.filter((d) => d.kind !== 'weak').map((d) => d.id));
    const stay = cards.filter((c) => isWeakCard(c, day) || !homeIds.has(c.weakFrom));
    const back = cards.filter((c) => !stay.includes(c));
    const stillWeak = stay.some((c) => isWeakCard(c, day));
    if (!back.length && !stillWeak) return state;
    let decks = withDeck(state.decks, i, { ...deck, cards: stay, ...(stillWeak ? restart : {}) });
    for (const c of back) {
      const h = decks.findIndex((d) => d.id === c.weakFrom);
      const { weakFrom, ...card } = c;
      decks = withDeck(decks, h, { ...decks[h], cards: [...(decks[h].cards || []), card] });
    }
    return { ...state, decks };
  }

  const weak = cards.filter((c) => isWeakCard(c, day));
  if (!weak.length) return state;
  const moved = weak.map((c) => ({ ...c, weakFrom: deck.id }));
  let decks = withDeck(state.decks, i, { ...deck, cards: cards.filter((c) => !weak.includes(c)) });
  const w = decks.findIndex((d) => d.kind === 'weak');
  if (w >= 0) {
    decks = withDeck(decks, w, { ...decks[w], cards: [...(decks[w].cards || []), ...moved], ...restart });
    return { ...state, decks };
  }
  const created = {
    id: 'weak-' + (cmdId || day),
    name: WEAK_NAME,
    kind: 'weak',
    projectId: state.meta.currentProj,
    createdAt: day,
    lastCompleted: null,
    history: [],
    cards: moved,
    ...restart,
  };
  if (created.projectId === undefined) delete created.projectId;
  const order = state.meta.deckOrder || [];
  return { ...state, decks: [...decks, created], meta: { ...state.meta, deckOrder: [...order, created.id] } };
}
