/** Thiết lập bài Kiểm tra (task 2.11): số câu, trả lời bằng tiếng nào, loại câu cho từng chiều. Nhớ theo máy. */

export type QType = 'write' | 'mcq' | 'tf' | 'mix';
export type TestPrefs = { full: boolean; count: number; answerIn: 'en' | 'vi' | 'both'; typeProd: QType; typeRecog: QType };

const KEY = 'recall.test.prefs.v1';
const DEFAULTS: TestPrefs = { full: true, count: 20, answerIn: 'both', typeProd: 'write', typeRecog: 'mcq' };
const TYPES: { value: QType; label: string }[] = [
  { value: 'write', label: 'Tự luận' },
  { value: 'mcq', label: 'Trắc nghiệm' },
  { value: 'tf', label: 'Đúng / Sai' },
  { value: 'mix', label: 'Trộn' },
];
const isType = (v: unknown): v is QType => TYPES.some((t) => t.value === v);

/** Bài Kiểm tra luôn mặc định là ĐỦ BÀI (tính lên mốc); các lựa chọn còn lại lấy theo lần trước. */
export function readTestPrefs(): TestPrefs {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || 'null') || {};
    return {
      full: true,
      count: Number.isInteger(v.count) && v.count > 0 ? v.count : DEFAULTS.count,
      answerIn: v.answerIn === 'en' || v.answerIn === 'vi' ? v.answerIn : 'both',
      typeProd: isType(v.typeProd) ? v.typeProd : DEFAULTS.typeProd,
      typeRecog: isType(v.typeRecog) ? v.typeRecog : DEFAULTS.typeRecog,
    };
  } catch {
    return DEFAULTS;
  }
}

export function writeTestPrefs(p: TestPrefs): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* bỏ qua */
  }
}

/** Số câu thật sự của bài luyện tập: một chiều thì tối đa n, cả hai chiều thì tối đa 2n. */
export function practiceCount(p: TestPrefs, n: number): number {
  return Math.max(1, Math.min(p.count, p.answerIn === 'both' ? n * 2 : n));
}

function TypePicker({ name, legend, value, onChange }: { name: string; legend: string; value: QType; onChange: (v: QType) => void }) {
  return (
    <fieldset className="field">
      <legend className="field-label">{legend}</legend>
      <div className="segmented setup-types">
        {TYPES.map((t) => (
          <label key={t.value}>
            <input type="radio" name={name} checked={value === t.value} onChange={() => onChange(t.value)} />
            {t.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function TestSetup({ n, prefs, onChange }: { n: number; prefs: TestPrefs; onChange: (patch: Partial<TestPrefs>) => void }) {
  const max = prefs.answerIn === 'both' ? n * 2 : n;
  const showProd = prefs.full || prefs.answerIn !== 'vi';
  const showRecog = prefs.full || prefs.answerIn !== 'en';
  return (
    <>
      <fieldset className="field">
        <legend className="field-label">Số câu</legend>
        <div className="setup-radios">
          <label className="choice">
            <input type="radio" name="full" checked={prefs.full} onChange={() => onChange({ full: true })} />
            <span>
              <strong>
                Đủ bài: {n} thẻ × 2 chiều = {n * 2} câu
              </strong>
              <span className="muted">Tính lên mốc.</span>
            </span>
          </label>
          <label className="choice">
            <input type="radio" name="full" checked={!prefs.full} onChange={() => onChange({ full: false })} />
            <span>
              <strong>Số câu tuỳ chọn</strong>
              <span className="muted">Luyện tập, không tính mốc.</span>
            </span>
          </label>
        </div>
      </fieldset>

      {!prefs.full && (
        <>
          <label className="field setup-count">
            <span className="field-label">Bao nhiêu câu (tối đa {max})</span>
            <input
              className="input"
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              value={prefs.count}
              onChange={(e) => {
                const v = Math.round(Number(e.target.value));
                if (Number.isFinite(v) && v > 0) onChange({ count: v });
              }}
            />
          </label>
          <fieldset className="field">
            <legend className="field-label">Trả lời bằng</legend>
            <div className="segmented">
              <label>
                <input type="radio" name="answerIn" checked={prefs.answerIn === 'en'} onChange={() => onChange({ answerIn: 'en' })} />
                Tiếng Anh
              </label>
              <label>
                <input type="radio" name="answerIn" checked={prefs.answerIn === 'vi'} onChange={() => onChange({ answerIn: 'vi' })} />
                Tiếng Việt
              </label>
              <label>
                <input type="radio" name="answerIn" checked={prefs.answerIn === 'both'} onChange={() => onChange({ answerIn: 'both' })} />
                Cả hai
              </label>
            </div>
          </fieldset>
        </>
      )}

      {showProd && <TypePicker name="typeProd" legend="Loại câu chiều Việt → Anh" value={prefs.typeProd} onChange={(v) => onChange({ typeProd: v })} />}
      {showRecog && <TypePicker name="typeRecog" legend="Loại câu chiều Anh → Việt" value={prefs.typeRecog} onChange={(v) => onChange({ typeRecog: v })} />}
    </>
  );
}
