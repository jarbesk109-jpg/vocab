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
  /** Đã trả lời: khoá các nút, tô lựa chọn đúng và lựa chọn đã bấm (-1: không rõ đã bấm gì). */
  picked?: number;
  correct?: number;
};

type TrueFalseProps = {
  /** Đáp án được đưa ra để người học phán đúng hay sai. */
  shown: string;
  onPick: (v: boolean) => void;
  /** Đã trả lời: `answered` khoá nút; `picked` là lựa chọn đã bấm (nếu biết), `truth` là đáp án đúng. */
  answered: boolean;
  picked?: boolean;
  truth?: boolean;
};

/** Câu Đúng / Sai: phím 1 = Đúng, 2 = Sai. */
export function TrueFalse({ shown, onPick, answered, picked, truth }: TrueFalseProps) {
  const stateOf = (v: boolean) => (answered ? (v === truth ? 'ok' : v === picked ? 'bad' : undefined) : undefined);
  return (
    <div className="tf">
      <p className="tf-shown">
        <span className="muted">Đáp án này đúng hay sai?</span>
        <strong>{shown}</strong>
      </p>
      <ol className="options tf-options">
        {[true, false].map((v, i) => (
          <li key={i}>
            <button className="option" type="button" disabled={answered} data-state={stateOf(v)} onClick={() => onPick(v)}>
              <kbd aria-hidden="true">{i + 1}</kbd>
              <span>{v ? 'Đúng' : 'Sai'}</span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

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
