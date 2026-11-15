import type { Ref } from 'react';

type InputProps = {
  inputRef: Ref<HTMLInputElement>;
  dir: 'prod' | 'recog';
  value: string;
  onChange: (v: string) => void;
  /** Enter hoặc nút gửi. Lúc đang hiện phản hồi thì cha hiểu là "đi tiếp". */
  onSubmit: () => void;
  /** Đã chấm: khoá nội dung nhưng KHÔNG disable, để bàn phím điện thoại không đóng mở giữa các câu. */
  locked: boolean;
  state?: 'ok' | 'bad';
  shake?: boolean;
  submitLabel: string;
};

/** Ô gõ đáp án. Tắt mọi tự sửa của bàn phím: người học phải tự gõ đúng từng chữ. */
export function AnswerInput({ inputRef, dir, value, onChange, onSubmit, locked, state, shake, submitLabel }: InputProps) {
  return (
    <form
      className="answer"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <input
        ref={inputRef}
        className="input answer-input"
        data-state={state}
        data-shake={shake ? '' : undefined}
        type="text"
        inputMode="text"
        enterKeyHint="go"
        lang={dir === 'prod' ? 'en' : 'vi'}
        autoCapitalize="off"
        autoCorrect="off"
        autoComplete="off"
        spellCheck={false}
        aria-label={dir === 'prod' ? 'Đáp án tiếng Anh' : 'Đáp án tiếng Việt'}
        placeholder={dir === 'prod' ? 'Gõ từ tiếng Anh' : 'Gõ nghĩa tiếng Việt'}
        value={value}
        onChange={(e) => {
          if (!locked) onChange(e.target.value);
        }}
      />
      <button className="btn btn-primary" type="submit" onMouseDown={(e) => e.preventDefault()}>
        {submitLabel}
      </button>
    </form>
  );
}

type ChoiceProps = {
  options: string[];
  onPick: (i: number) => void;
  /** Đã trả lời: khoá các nút, tô lựa chọn đúng và lựa chọn đã bấm. */
  picked?: number;
  correct?: number;
};

/** Các lựa chọn trắc nghiệm, đánh số 1–4 theo phím tắt. */
export function ChoiceList({ options, onPick, picked, correct }: ChoiceProps) {
  const answered = picked !== undefined;
  return (
    <ol className="options">
      {options.map((text, i) => (
        <li key={i}>
          <button
            className="option"
            type="button"
            disabled={answered}
            data-state={answered ? (i === correct ? 'ok' : i === picked ? 'bad' : undefined) : undefined}
            onClick={() => onPick(i)}
          >
            <kbd aria-hidden="true">{i + 1}</kbd>
            <span>{text}</span>
          </button>
        </li>
      ))}
    </ol>
  );
}
