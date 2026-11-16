import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import {
  deckStatus,
  sessionAnswer,
  sessionNext,
  sessionOverride,
  sessionQuestion,
  sessionSummary,
  startLearn,
  startTest,
  startWrite,
} from '../../../logic/index.js';
import { setMuted, speak, stopSpeaking, useMuted } from '../audio';
import { AnswerInput, ChoiceList, TrueFalse } from '../components/AnswerInput';
import { ProgressBar } from '../components/ProgressBar';
import { QuestionCard } from '../components/QuestionCard';
import type { Store, StoreState } from '../data/useStore';
import { hrefOf } from '../router';
import { Result, type Finished } from './Result';
import { TestSetup, practiceCount, readTestPrefs, writeTestPrefs, type TestPrefs } from './TestSetup';
import { SESSION_KEY } from './Today';

type Mode = 'learn' | 'write' | 'test';
type Dir = 'prod' | 'recog';

/** Phiên dang dở, lưu theo máy để "Học tiếp". `recording` chốt lúc BẮT ĐẦU phiên (mất mạng thì cả phiên không ghi). */
type Saved = Omit<Finished, 'summary'> & { deckId: string; state: any };

type Prefs = { dir: Dir; mcq: boolean; write: boolean; batch: number };
const PREFS_KEY = 'recall.learn.prefs.v1';
const DEFAULT_PREFS: Prefs = { dir: 'prod', mcq: true, write: true, batch: 0 };
const BATCHES = [7, 15, 20, 30];

function readSaved(deckId: string): Saved | null {
  try {
    const v = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
    const ok = v && v.deckId === deckId && (v.mode === 'learn' || v.mode === 'write' || v.mode === 'test') && v.state && !v.state.done;
    return ok ? v : null;
  } catch {
    return null;
  }
}

function writeSaved(s: Saved | null): void {
  try {
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    /* không lưu được: phiên vẫn chạy, chỉ là không "Học tiếp" được sau khi tải lại */
  }
}

function readPrefs(): Prefs {
  try {
    const v = JSON.parse(localStorage.getItem(PREFS_KEY) || 'null') || {};
    return {
      dir: v.dir === 'recog' ? 'recog' : 'prod',
      mcq: v.mcq !== false,
      write: v.write !== false,
      batch: BATCHES.includes(v.batch) ? v.batch : 0,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

function writePrefs(p: Prefs): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {
    /* bỏ qua */
  }
}

type Props = { deckId: string; state: StoreState; store: Store; dispatch: (cmd: Record<string, unknown>) => unknown; today: string };

/** Màn Học, Viết và Kiểm tra (task 2.10, 2.11): thiết lập → phiên → kết quả, tất cả trong `#/study/<id>`. */
export function Learn({ deckId, state, store, dispatch, today }: Props) {
  const deck: any = state.decks.find((d: any) => d.id === deckId);
  const [saved, setSavedState] = useState<Saved | null>(() => readSaved(deckId));
  const [result, setResult] = useState<Finished | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const setSaved = (s: Saved | null) => {
    writeSaved(s);
    setSavedState(s);
  };

  if (!deck) {
    return (
      <div className="card empty">
        <strong>Không tìm thấy học phần này</strong>
        <span>
          Có thể học phần đã bị xoá. <a href={hrefOf('today')}>Về Hôm nay</a>
        </span>
      </div>
    );
  }
  const cards: any[] = deck.cards || [];

  if (result) {
    return (
      <Result
        deck={deck}
        state={state}
        today={today}
        result={result}
        onAgain={() => {
          setResult(null);
          setNotice(null);
        }}
      />
    );
  }

  if (saved) {
    return (
      <Player
        deck={deck}
        saved={saved}
        onStep={(res) => {
          if (saved.recording && res.cmds.length) {
            for (const cmd of res.cmds) dispatch(cmd);
            void store.flush();
          }
          const next = { ...saved, state: res.state };
          // Xong thì gỡ ngay bản lưu (banner "Học tiếp" không còn), nhưng vẫn giữ trên màn tới khi hiện xong phản hồi câu cuối.
          writeSaved(res.state.done ? null : next);
          setSavedState(next);
        }}
        onFinish={() => {
          setResult({ ...saved, summary: sessionSummary(saved.state) });
          setSavedState(null);
        }}
        onBroken={() => {
          setSaved(null);
          setNotice('Thẻ đang hỏi không còn trong học phần (đã bị sửa ở máy khác). Phiên đã dừng; các câu đã trả lời vẫn được ghi.');
        }}
        onSetup={() => {
          setSaved(null);
          setNotice(null);
        }}
      />
    );
  }

  return (
    <Setup
      deck={deck}
      today={today}
      notice={notice}
      onStart={(mode, p, tp) => {
        const seed = Date.now() >>> 0;
        const st =
          mode === 'learn'
            ? startLearn(cards, { deckId, dir: p.dir, mcq: p.mcq, write: p.write, batch: p.batch }, today, seed)
            : mode === 'write'
              ? startWrite(cards, { deckId, dir: p.dir }, seed)
              : startTest(cards, { deckId, full: tp.full, count: practiceCount(tp, cards.length), answerIn: tp.answerIn, typeProd: tp.typeProd, typeRecog: tp.typeRecog }, seed);
        const status: any = deckStatus(deck, today);
        setNotice(null);
        setSaved({
          deckId,
          mode,
          state: st,
          recording: store.startSession().recording,
          startName: deck.name,
          wasNew: status.kind === 'stock' || status.stage === 0,
          stageFrom: deck.stageIdx || 0,
          doneBefore: deck.lastCompleted ?? null,
          kindAt: status.kind,
        });
      }}
    />
  );
}

/* ---------- Thiết lập ---------- */

type SetupProps = { deck: any; today: string; notice: string | null; onStart: (mode: Mode, p: Prefs, tp: TestPrefs) => void };

function Setup({ deck, today, notice, onStart }: SetupProps) {
  const [prefs, setPrefs] = useState<Prefs>(readPrefs);
  const [test, setTestState] = useState<TestPrefs>(readTestPrefs);
  const n = (deck.cards || []).length;
  const sizes = BATCHES.filter((b) => b < n);
  const status: any = deckStatus(deck, today);
  // Deck đã qua Ngày 1 (đang ôn, đã hẹn ngày, đã xong vòng) mặc định Kiểm tra; deck mới mặc định Học. Lúc nào cũng đổi được.
  const reviewing = status.kind !== 'stock' && !(status.kind === 'waiting' && status.stage === 0);
  const [mode, setMode] = useState<Mode>(reviewing ? 'test' : 'learn');
  const setTest = (patch: Partial<TestPrefs>) => {
    const next = { ...test, ...patch };
    setTestState(next);
    writeTestPrefs(next);
  };

  const set = (patch: Partial<Prefs>) => {
    const next = { ...prefs, ...patch };
    // Luôn còn ít nhất một loại câu: tắt cái này thì cái kia tự bật.
    if (!next.mcq && !next.write) {
      if (patch.mcq === false) next.write = true;
      else next.mcq = true;
    }
    setPrefs(next);
    writePrefs(next);
  };

  if (n === 0) {
    return (
      <div className="card empty">
        <strong>Học phần chưa có thẻ nào</strong>
        <span>
          Thêm thẻ rồi quay lại học. <a href={hrefOf('today')}>Về Hôm nay</a>
        </span>
      </div>
    );
  }

  const batch = sizes.includes(prefs.batch) ? prefs.batch : 0;
  const count = mode === 'learn' && batch ? batch : n;
  const steps = [prefs.mcq && 'trắc nghiệm', prefs.write && 'tự luận'].filter(Boolean).join(' rồi ');

  return (
    <form
      className="card setup"
      onSubmit={(e) => {
        e.preventDefault();
        onStart(mode, { ...prefs, batch }, test);
      }}
    >
      {notice && (
        <p className="alert" role="alert">
          {notice}
        </p>
      )}
      <fieldset className="field">
        <legend className="field-label">Chế độ</legend>
        <div className="segmented">
          <label>
            <input type="radio" name="mode" checked={mode === 'learn'} onChange={() => setMode('learn')} />
            Học
          </label>
          <label>
            <input type="radio" name="mode" checked={mode === 'write'} onChange={() => setMode('write')} />
            Viết
          </label>
          <label>
            <input type="radio" name="mode" checked={mode === 'test'} onChange={() => setMode('test')} />
            Kiểm tra
          </label>
        </div>
      </fieldset>

      {mode === 'test' && <TestSetup n={n} prefs={test} onChange={setTest} />}

      {mode !== 'test' && (
      <fieldset className="field">
        <legend className="field-label">Chiều</legend>
        <div className="segmented">
          <label>
            <input type="radio" name="dir" checked={prefs.dir === 'prod'} onChange={() => set({ dir: 'prod' })} />
            Việt → Anh
          </label>
          <label>
            <input type="radio" name="dir" checked={prefs.dir === 'recog'} onChange={() => set({ dir: 'recog' })} />
            Anh → Việt
          </label>
        </div>
      </fieldset>
      )}

      {mode === 'learn' && (
        <fieldset className="field">
          <legend className="field-label">Loại câu</legend>
          <div className="setup-checks">
            <label className="choice">
              <input type="checkbox" checked={prefs.mcq} onChange={(e) => set({ mcq: e.target.checked })} />
              <span>Trắc nghiệm</span>
            </label>
            <label className="choice">
              <input type="checkbox" checked={prefs.write} onChange={(e) => set({ write: e.target.checked })} />
              <span>Tự luận</span>
            </label>
          </div>
        </fieldset>
      )}

      {mode === 'learn' && sizes.length > 0 && (
        <fieldset className="field">
          <legend className="field-label">Cỡ mẻ</legend>
          <div className="segmented setup-batch">
            {sizes.map((b) => (
              <label key={b}>
                <input type="radio" name="batch" checked={batch === b} onChange={() => set({ batch: b })} />
                {b}
              </label>
            ))}
            <label>
              <input type="radio" name="batch" checked={batch === 0} onChange={() => set({ batch: 0 })} />
              Tất cả ({n})
            </label>
          </div>
        </fieldset>
      )}

      <p className="muted">
        {mode === 'learn'
          ? `${count} thẻ. Mỗi thẻ phải đúng ${steps} mới xong; sai thì gặp lại.`
          : mode === 'write'
            ? `Một lượt qua ${n} thẻ. Sai phải gõ lại đúng mới đi tiếp; điểm tính câu đúng ngay lần đầu.`
            : test.full
              ? `${n * 2} câu, mỗi thẻ hỏi cả hai chiều. Sai thì hiện đáp án rồi mới đi tiếp.`
              : `${practiceCount(test, n)} câu luyện tập. Vẫn ghi điểm từng thẻ, nhưng không lên mốc và không tính lượt.`}
        {reviewing && mode !== 'test' && ' Học và Viết là luyện tập: học phần đã qua Ngày 1 chỉ lên mốc bằng bài Kiểm tra đủ bài.'}
      </p>

      <button className="btn btn-primary btn-lg" type="submit" autoFocus>
        Bắt đầu
      </button>
    </form>
  );
}

/* ---------- Phiên ---------- */

/** Phản hồi đang hiện trên câu VỪA trả lời (máy trạng thái đã sang câu sau). */
type Hold = { q: any; key: string; ok: boolean; answer: string; picked?: number | boolean; manual: boolean; ms: number };

type PlayerProps = {
  deck: any;
  saved: Saved;
  onStep: (res: { state: any; cmds: any[] }) => void;
  onFinish: () => void;
  onBroken: () => void;
  onSetup: () => void;
};

function Player({ deck, saved, onStep, onFinish, onBroken, onSetup }: PlayerProps) {
  const sess = saved.state;
  const cards: any[] = deck.cards || [];
  const muted = useMuted();
  const [hold, setHold] = useState<Hold | null>(null);
  const [value, setValue] = useState('');
  const [typed, setTyped] = useState('');
  /** Kiểm tra, trắc nghiệm / đúng-sai SAI: lựa chọn đã bấm (máy trạng thái dừng ở câu đó, không sang câu sau). */
  const [pick, setPick] = useState<number | boolean | null>(null);
  const [hint, setHint] = useState<'keyboard' | 'retry' | null>(null);
  const [shake, setShake] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const liveQ: any = useMemo(() => sessionQuestion(sess, cards), [sess, cards]);
  const liveKey = String(sess.kind === 'learn' ? sess.tries : sess.i);
  const q: any = hold ? hold.q : liveQ;
  const key = hold ? hold.key : liveKey;
  const phase: 'hold' | 'wrong' | 'retype' | 'ask' = hold
    ? 'hold'
    : (sess.kind === 'learn' || sess.kind === 'test') && sess.phase === 'wrong'
      ? 'wrong'
      : sess.kind === 'write' && sess.retype
        ? 'retype'
        : 'ask';
  const card = q ? cards.find((c) => c.id === q.cardId) : null;
  const term: string = card?.term ?? '';
  const answerText: string = card ? (q.dir === 'prod' ? card.term : card.def) : '';
  // Từ tiếng Anh chỉ được nghe khi không làm lộ đáp án: chiều Anh→Việt, hoặc đã trả lời xong.
  const canSpeak = !!q && (q.dir === 'recog' || phase !== 'ask');
  const summary: any = sessionSummary(sess);

  const clear = () => {
    setValue('');
    setTyped('');
    setPick(null);
    setHint(null);
  };
  const release = () => {
    setHold(null);
    clear();
  };

  function run(input: string | number | boolean) {
    if (!q || phase === 'hold' || phase === 'wrong') return;
    const res: any = sessionAnswer(sess, cards, input);
    const fb = res.feedback;
    if (!fb) return;
    if (fb.keyboard) return setHint('keyboard');
    if (fb.retry) {
      setHint('retry');
      setShake((x) => x + 1);
      setValue('');
      return;
    }
    setHint(null);
    if (q.dir === 'prod') speak(term); // Việt→Anh: đọc từ SAU khi trả lời
    onStep(res);
    if (typeof input !== 'string') {
      // Kiểm tra sai: máy trạng thái dừng ở câu này (pha wrong). Học sai: đã sang câu sau, màn hình giữ lại câu cũ.
      if (res.state.phase === 'wrong') setPick(input);
      else setHold({ q, key, ok: fb.ok, answer: fb.answer, picked: input, manual: !fb.ok, ms: 450 });
    } else if (fb.ok) {
      if (phase === 'retype') clear(); // gõ lại đúng: đi tiếp luôn
      else setHold({ q, key, ok: true, answer: fb.answer, manual: false, ms: 800 });
    } else if (sess.kind === 'write') {
      setTyped(input); // Viết: xoá ô để gõ lại
      setValue('');
    }
  }

  function next() {
    onStep(sessionNext(sess, cards));
    clear();
  }

  function override() {
    const res = sessionOverride(sess, cards);
    if (res.state === sess) return;
    onStep(res);
    clear();
  }

  function submit() {
    if (phase === 'hold') return release();
    if (phase === 'wrong') return next();
    if (value.trim()) run(value);
  }

  // Xong phiên (sau khi phản hồi câu cuối đã hiện xong), hoặc thẻ đang hỏi không còn trong deck.
  useEffect(() => {
    if (hold) return;
    if (sess.done) onFinish();
    else if (!liveQ) onBroken();
  });

  // Trả lời đúng: tự qua câu sau một nhịp ngắn (Enter thì qua ngay).
  useEffect(() => {
    if (!hold || hold.manual) return;
    const t = window.setTimeout(release, hold.ms);
    return () => window.clearTimeout(t);
  }, [hold]);

  // Anh→Việt: đọc từ ngay khi câu hỏi hiện.
  useEffect(() => {
    if (!hold && liveQ && liveQ.dir === 'recog') speak(term);
  }, [liveKey, !hold]);

  useEffect(() => {
    if (q?.type === 'write') inputRef.current?.focus();
  }, [key, q?.type, phase]);

  useEffect(() => stopSpeaking, []);

  // Phím tắt (mục 3.8): 1–4 chọn đáp án, Enter đi tiếp, \ = gõ nhầm / tôi đã gõ đúng, Space nghe lại.
  const onKey = useRef<(e: KeyboardEvent) => void>(() => {});
  onKey.current = (e) => {
    if (!q || e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target as HTMLElement;
    const inInput = t === inputRef.current;
    if (e.key === '\\') {
      if (phase === 'wrong' || phase === 'retype') {
        e.preventDefault();
        override();
      }
      return;
    }
    if (e.key === ' ') {
      if (canSpeak && (inInput ? phase === 'hold' || phase === 'wrong' : !t.closest('button, a, summary, input, select, textarea'))) {
        e.preventDefault();
        speak(term);
      }
      return;
    }
    if (e.key === 'Enter') {
      if (t.closest('button, a, summary, input, select, textarea')) return; // để trình duyệt tự xử lý
      if (phase === 'hold') {
        e.preventDefault();
        release();
      } else if (phase === 'wrong') {
        e.preventDefault();
        next();
      }
      return;
    }
    if (phase === 'ask' && q.type === 'mcq' && /^[1-9]$/.test(e.key) && !inInput) {
      const i = Number(e.key) - 1;
      if (i < q.options.length) {
        e.preventDefault();
        run(i);
      }
    }
    if (phase === 'ask' && q.type === 'tf' && (e.key === '1' || e.key === '2') && !inInput) {
      e.preventDefault();
      run(e.key === '1');
    }
  };
  useEffect(() => {
    const h = (e: KeyboardEvent) => onKey.current(e);
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  if (!q) return <div className="study" aria-busy="true" />;

  const keep = (e: ReactMouseEvent) => e.preventDefault(); // bấm nút không lấy focus khỏi ô đáp án (bàn phím điện thoại không đóng)
  const label = sess.kind === 'learn' ? `${summary.mastered}/${summary.total}` : `${Math.min(sess.i + (hold ? 0 : 1), summary.total)}/${summary.total}`;

  return (
    <div className="study study-play">
      <div className="study-bar">
        <a className="study-exit" href={hrefOf('today')} aria-label="Thoát về Hôm nay (phiên được giữ lại)">
          ← Thoát
        </a>
        <span className="study-name">
          {deck.name} · {saved.mode === 'learn' ? 'Học' : saved.mode === 'write' ? 'Viết' : sess.full ? 'Kiểm tra' : 'Luyện tập'}
        </span>
        <button className="icon-btn" type="button" aria-pressed={muted} onClick={() => setMuted(!muted)} onMouseDown={keep} aria-label={muted ? 'Đang tắt tiếng: bấm để bật' : 'Đang bật tiếng: bấm để tắt'} title={muted ? 'Bật tiếng' : 'Tắt tiếng'}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4.5 9.5v5h3.2l4.3 3.5v-12L7.7 9.5Z" />
            {muted ? <path d="m16 9.500 5 5m0-5-5 5" /> : <path d="M15.5 9a4.2 4.2 0 0 1 0 6m2.5-8.500a7.700 7.700 0 0 1 0 11" />}
          </svg>
        </button>
        <button className="study-setup" type="button" onClick={onSetup}>
          Thiết lập
        </button>
      </div>
      <ProgressBar value={summary.progress} label={label} />
      {!saved.recording && <p className="study-offline">Phiên này bắt đầu lúc mất mạng: chỉ là luyện tập, không ghi tiến độ.</p>}

      <div className="study-q" key={key}>
        <QuestionCard dir={q.dir} type={q.type} prompt={q.prompt} onSpeak={canSpeak ? () => speak(term) : undefined} />

        {q.type === 'mcq' ? (
          <ChoiceList
            options={q.options}
            onPick={run}
            picked={hold ? (hold.picked as number) : phase === 'wrong' ? (typeof pick === 'number' ? pick : -1) : undefined}
            correct={hold || phase === 'wrong' ? q.options.indexOf(hold ? hold.answer : answerText) : undefined}
          />
        ) : q.type === 'tf' ? (
          <TrueFalse
            shown={q.shown}
            onPick={run}
            answered={!!hold || phase === 'wrong'}
            picked={hold ? (hold.picked as boolean) : typeof pick === 'boolean' ? pick : undefined}
            truth={q.shown === answerText}
          />
        ) : (
          <AnswerInput
            inputRef={inputRef}
            dir={q.dir}
            value={value}
            onChange={(v) => {
              setValue(v);
              if (hint) setHint(null);
            }}
            onSubmit={submit}
            locked={phase === 'hold' || phase === 'wrong'}
            state={phase === 'hold' ? 'ok' : phase === 'wrong' ? 'bad' : undefined}
            shake={shake > 0 && hint === 'retry'}
            submitLabel={phase === 'hold' || phase === 'wrong' ? 'Tiếp' : phase === 'retype' ? 'Gõ lại' : 'Trả lời'}
          />
        )}

        <div className="feedback" role="status" aria-live="polite">
          {phase === 'hold' && hold!.ok && (
            <p className="fb fb-ok">
              <strong>✓ Đúng</strong>
              {q.type === 'write' && <span>{hold!.answer}</span>}
            </p>
          )}
          {phase === 'hold' && !hold!.ok && (
            <>
              <p className="fb fb-bad">
                <strong>✗ Chưa đúng</strong>
                <span>Đáp án: {hold!.answer}</span>
              </p>
              <div className="fb-actions">
                <button className="btn btn-primary" type="button" onClick={release}>
                  Tiếp <kbd>Enter</kbd>
                </button>
              </div>
            </>
          )}
          {phase === 'wrong' && (
            <>
              <p className="fb fb-bad">
                <strong>✗ Chưa đúng</strong>
                <span>Đáp án: {answerText}</span>
              </p>
              <div className="fb-actions">
                {q.type === 'write' ? (
                  <button className="btn" type="button" onClick={override} onMouseDown={keep}>
                    {sess.kind === 'learn' ? 'Tôi gõ nhầm phím' : 'Tôi đã gõ đúng'} <kbd>\</kbd>
                  </button>
                ) : (
                  <button className="btn btn-primary" type="button" onClick={next}>
                    Tiếp <kbd>Enter</kbd>
                  </button>
                )}
              </div>
            </>
          )}
          {phase === 'retype' && (
            <>
              <p className="fb fb-bad">
                <strong>✗ Chưa đúng{typed ? `: “${typed}”` : ''}</strong>
                <span>Đáp án: {answerText}. Gõ lại cho đúng để đi tiếp.</span>
              </p>
              {hint === 'retry' && <p className="fb-hint">Chưa khớp với đáp án, gõ lại.</p>}
              <div className="fb-actions">
                <button className="btn" type="button" onClick={override} onMouseDown={keep}>
                  Tôi đã gõ đúng <kbd>\</kbd>
                </button>
              </div>
            </>
          )}
          {hint === 'keyboard' && <p className="fb-hint">Bàn phím đang ở tiếng Việt, đổi sang English rồi gõ lại.</p>}
          {phase === 'ask' && q.type === 'write' && hint !== 'keyboard' && (
            <button className="link-btn" type="button" onClick={() => run('')} onMouseDown={keep}>
              Chưa nhớ, xem đáp án
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
