const DIR_LABEL = { prod: 'Việt → Anh', recog: 'Anh → Việt' } as const;
const TYPE_LABEL: Record<string, string> = { mcq: 'Trắc nghiệm', write: 'Tự luận', tf: 'Đúng / Sai' };

type Props = {
  dir: 'prod' | 'recog';
  type: string;
  prompt: string;
  /** Có thì hiện nút nghe lại. Chỉ truyền khi từ tiếng Anh đã được phép lộ (Anh→Việt, hoặc đã trả lời). */
  onSpeak?: () => void;
};

/** Thẻ câu hỏi: chỉ hiện MỘT phía của thẻ (đề bài). Đáp án do phần phản hồi hiện sau khi trả lời. */
export function QuestionCard({ dir, type, prompt, onSpeak }: Props) {
  return (
    <section className="card qcard" aria-label="Câu hỏi">
      <div className="qcard-head">
        <span className="tag">
          {DIR_LABEL[dir]} · {TYPE_LABEL[type] ?? type}
        </span>
        {onSpeak && (
          <button
            className="icon-btn"
            type="button"
            onClick={onSpeak}
            onMouseDown={(e) => e.preventDefault() /* không lấy focus khỏi ô đáp án */}
            aria-label="Nghe lại (phím Space)"
            title="Nghe lại (Space)"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4.5 9.5v5h3.2l4.3 3.5v-12L7.700 9.500Z" />
              <path d="M15.500 9a4.200 4.200 0 0 1 0 6m2.500-8.500a7.700 7.700 0 0 1 0 11" />
            </svg>
          </button>
        )}
      </div>
      <p className="q-prompt" lang={dir === 'recog' ? 'en' : 'vi'}>
        {prompt}
      </p>
    </section>
  );
}
