// Chấm đáp án và ghi điểm từng thẻ (PLAN.md mục 3.6).
// `norm`, `accepts`, `normVi`, `acceptsVi`, `isRight` chuyển NGUYÊN VĂN từ v1.
// `bumpCard`, `overrideRight` giữ đúng phép tính của v1 nhưng THUẦN: trả về thẻ mới,
// ngày truyền vào qua tham số, và thẻ sai được gắn sao ngay tại đây.

/** Chuẩn hoá một đáp án: chữ thường, gộp khoảng trắng, bỏ dấu câu cuối, bỏ to/a/an/the đứng đầu. */
export function norm(s) {
  return (s || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[.,;!?]+$/, '')
    .replace(/^(to|a|an|the)\s+/, '');
}

/** Các đáp án chấp nhận cho chiều Việt→Anh (`prod`): `term` tách theo `/` hoặc `,`. */
export function accepts(card) {
  return card.term
    .split(/[\/,]/)
    .map((x) => norm(x))
    .filter(Boolean);
}

/** Như `norm` nhưng bỏ dấu tiếng Việt và đổi `đ → d`. */
export function normVi(x) {
  return norm(x)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd');
}

/** Các đáp án chấp nhận cho chiều Anh→Việt (`recog`): từng nghĩa của `def`, và cả chuỗi. */
export function acceptsVi(card) {
  return card.def
    .split(/[\/,]/)
    .map(normVi)
    .filter(Boolean)
    .concat([normVi(card.def)]);
}

/**
 * Câu trả lời gõ vào có đúng không.
 * @param {any} card
 * @param {'prod' | 'recog'} dir
 * @param {string} val
 */
export function isRight(card, dir, val) {
  return dir === 'prod' ? accepts(card).includes(norm(val)) : acceptsVi(card).includes(normVi(val));
}

/** Bản sao thẻ với hồ sơ chiều `dir` sẵn sàng để sửa (như `cst` của v1, nhưng không đụng thẻ gốc). */
function withDir(card, dir) {
  // v1: st kiểu cũ một chiều (st.r là số) thì bỏ, tạo lại
  const st = !card.st || typeof card.st.r === 'number' ? {} : { ...card.st };
  st[dir] = st[dir] ? { ...st[dir] } : { r: 0, w: 0, streak: 0, typo: 0, last: null };
  return { ...card, st };
}

/**
 * Ghi một câu trả lời vào thẻ. Sai thì gắn sao.
 * @param {any} card
 * @param {boolean} ok
 * @param {'prod' | 'recog'} dir
 * @param {boolean} typo đúng nhưng người học bấm "gõ nhầm"
 * @param {string} today ngày học 'YYYY-MM-DD'
 * @returns {any} thẻ mới
 */
export function bumpCard(card, ok, dir, typo, today) {
  const out = withDir(card, dir);
  const s = out.st[dir];
  if (ok) {
    s.r++;
    s.streak++;
    if (typo) s.typo++;
  } else {
    s._prevStreak = s.streak;
    s.w++;
    s.streak = 0;
    out.starred = true;
  }
  s.last = today;
  return out;
}

/**
 * "Tôi đã gõ đúng": hoàn lại cú chấm sai vừa rồi, ghi thành đúng, gỡ sao.
 * @param {any} card
 * @param {'prod' | 'recog'} dir
 * @param {string} today
 * @returns {any} thẻ mới
 */
export function overrideRight(card, dir, today) {
  const out = withDir(card, dir);
  const s = out.st[dir];
  if (s.w > 0) s.w--;
  s.r++;
  s.streak = (s._prevStreak || 0) + 1;
  delete s._prevStreak;
  s.last = today;
  out.starred = false;
  return out;
}

const NON_ASCII = /[^\x00-\x7f]/;

/**
 * MỚI: ô tiếng Anh (chiều `prod`) mà đáp án đúng toàn ASCII, người học lại gõ ra ký tự ngoài ASCII
 * → bàn phím đang ở tiếng Việt. Giao diện khi đó KHÔNG chấm sai, chỉ nhắc đổi bàn phím.
 * @param {'prod' | 'recog'} dir
 * @param {string} value
 * @param {any} card
 */
export function keyboardMismatch(dir, value, card) {
  return dir === 'prod' && !NON_ASCII.test(card.term) && NON_ASCII.test(value || '');
}
