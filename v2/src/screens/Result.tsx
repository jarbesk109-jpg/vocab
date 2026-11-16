import { useEffect, useRef } from 'react';
import { OFFSETS, computeStreak, deckStatus } from '../../../logic/index.js';
import type { StoreState } from '../data/useStore';
import { hrefOf } from '../router';
import { leftToday } from './Today';

/** Những gì màn Kết quả cần biết về phiên vừa xong (chụp lúc BẮT ĐẦU phiên + tóm tắt lúc xong). */
export type Finished = {
  mode: 'learn' | 'write' | 'test';
  recording: boolean;
  startName: string;
  wasNew: boolean;
  /** `stageIdx` và `lastCompleted` của deck lúc bắt đầu, `kind` của `deckStatus` lúc bắt đầu. */
  stageFrom: number;
  doneBefore: string | null;
  kindAt: string;
  summary: any;
};

const stageName = (idx: number) => (idx >= OFFSETS.length ? 'xong cả vòng ôn' : idx === 0 ? 'Mới' : `+${OFFSETS[idx]}`);

/** " Lần ôn kế: 18/11." nếu deck đã có ngày hẹn. */
function nextDue(deck: any, today: string): string {
  const st: any = deckStatus(deck, today);
  if (st.kind !== 'scheduled') return '';
  const [, m, d] = String(st.due).split('-');
  return ` Lần ôn kế: ${Number(d)}/${Number(m)}.`;
}

/** Bài Kiểm tra đủ bài: mốc đổi thế nào. So mốc lúc bắt đầu với mốc hiện tại của deck. */
function stageLine(r: Finished, deck: any, today: string, kpi: number): { text: string; tone: 'ok' | 'bad' | 'plain' } {
  const pct = Math.round(r.summary.pct);
  const to = deck.stageIdx || 0;
  if (to > r.stageFrom) {
    return to >= OFFSETS.length
      ? { text: `Lên mốc: học phần đã xong cả vòng ôn (${stageName(r.stageFrom)} → hết).`, tone: 'ok' }
      : { text: `Lên mốc ${stageName(r.stageFrom)} → ${stageName(to)}.${nextDue(deck, today)}`, tone: 'ok' };
  }
  if (to < r.stageFrom) return { text: `Chưa đạt sau khi trễ lâu: lùi mốc ${stageName(r.stageFrom)} → ${stageName(to)}, ôn lại ngày mai.`, tone: 'bad' };
  if (r.doneBefore === today) return { text: 'Hôm nay học phần này đã xong lượt rồi (mỗi ngày tối đa 1 mốc): mốc giữ nguyên.', tone: 'plain' };
  if (r.kindAt === 'scheduled' || r.kindAt === 'graduated') return { text: 'Học phần chưa đến hạn ôn: bài này là học thêm, mốc và lịch giữ nguyên.', tone: 'plain' };
  if (pct >= kpi) return { text: 'Mốc giữ nguyên.', tone: 'plain' };
  if (deck.lastCompleted === today) return { text: `Chưa đạt KPI ${kpi}%: mốc giữ nguyên, ôn lại ngày mai.`, tone: 'bad' };
  return { text: `Chưa đạt KPI ${kpi}%: mốc giữ nguyên ở ${stageName(to)}. Làm lại bài đủ hôm nay vẫn được tính.`, tone: 'bad' };
}

type Props = { deck: any; state: StoreState; today: string; result: Finished; onAgain: () => void };

/** Màn Kết quả (task 2.11): điểm, đạt hay chưa, mốc đổi thế nào, danh sách câu sai, streak. Dùng cho cả Học và Viết. */
export function Result({ deck, state, today, result, onAgain }: Props) {
  const s = result.summary;
  const pct = Math.round(s.pct);
  const cards: any[] = deck.cards || [];
  const kpi: number = state.meta.settings?.kpi ?? 90;
  const streak = computeStreak(state.meta.activity || {}, state.meta.streak?.freezeUsedDays ?? [], today);
  // Thẻ <a> không nhận autoFocus: tự đưa focus vào để Enter về Hôm nay (học chỉ bằng bàn phím).
  const homeRef = useRef<HTMLAnchorElement>(null);
  useEffect(() => homeRef.current?.focus(), []);

  let title: string;
  let sub: string;
  let verdict: { text: string; tone: 'ok' | 'bad' | 'plain' } | null = null;
  const lines: { text: string; tone: 'ok' | 'bad' | 'plain' }[] = [];

  if (result.mode === 'test') {
    title = s.full ? `Kiểm tra xong ${s.total} câu` : `Luyện tập xong ${s.total} câu`;
    sub = `${s.correct}/${s.total} câu đúng`;
    if (s.full) {
      verdict = pct >= kpi ? { text: `Đạt (KPI ${kpi}%)`, tone: 'ok' } : { text: `Chưa đạt (KPI ${kpi}%)`, tone: 'bad' };
      if (result.recording) lines.push(stageLine(result, deck, today, kpi));
    } else {
      lines.push({ text: 'Bài luyện tập: không tính mốc, không tính lượt.', tone: 'plain' });
    }
  } else if (result.mode === 'learn') {
    title = `Xong mẻ ${s.total} thẻ`;
    sub = `chính xác · ${s.tries - s.wrongs}/${s.tries} lượt trả lời đúng`;
  } else {
    title = `Viết xong ${s.total} thẻ`;
    sub = `đúng ngay lần đầu · ${s.correct}/${s.total} thẻ`;
  }

  if (result.recording && result.wasNew && result.mode !== 'test') {
    const left = leftToday(deck, today);
    const renamed = deck.name !== result.startName;
    lines.push({
      text:
        left === 0
          ? `Xong Ngày 1${renamed ? `: học phần đổi tên thành ${deck.name}` : ''}. Mai ôn lần đầu.`
          : `Còn ${left}/${cards.length} thẻ chưa đúng lần nào hôm nay. Học hết thì xong Ngày 1.`,
      tone: 'plain',
    });
  } else if (result.recording && result.mode === 'test' && deck.name !== result.startName) {
    lines.push({ text: `Xong Ngày 1: học phần đổi tên thành ${deck.name}.`, tone: 'plain' });
  }

  const wrong: { cardId: string; dir: 'prod' | 'recog' }[] = result.mode === 'test' ? s.wrong || [] : [];
  const streakText =
    streak.status === 'safe'
      ? `Streak ${streak.count} ngày · hôm nay đã tính.`
      : `Streak ${streak.count} ngày · hôm nay còn thiếu ${streak.needUnits} lượt.`;

  return (
    <section className="card result" aria-label="Kết quả">
      <h2 className="primary-name">{title}</h2>
      <p className="result-score">
        <strong>{pct}%</strong>
        <span className="muted">{sub}</span>
        {verdict && (
          <span className="tag result-verdict" data-kind={verdict.tone === 'ok' ? 'ok' : 'late'}>
            {verdict.text}
          </span>
        )}
      </p>
      {lines.map((l, i) => (
        <p key={i} className={l.tone === 'plain' ? undefined : `result-line-${l.tone}`}>
          {l.text}
        </p>
      ))}
      {!result.recording && <p className="study-offline">Phiên này bắt đầu lúc mất mạng nên không ghi tiến độ.</p>}
      {result.recording && <p className="muted result-streak">{streakText}</p>}

      {wrong.length > 0 && (
        <div className="result-wrong">
          <h3 className="section-title">Câu sai ({wrong.length})</h3>
          <ul>
            {wrong.map((w, i) => {
              const c = cards.find((x) => x.id === w.cardId);
              return (
                <li key={i}>
                  <span className="tag">{w.dir === 'prod' ? 'Việt → Anh' : 'Anh → Việt'}</span>
                  <span className="result-wrong-pair">
                    <strong>{c?.term ?? '(thẻ đã xoá)'}</strong>
                    <span className="muted">{c?.def ?? ''}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="result-actions">
        <a className="btn btn-primary btn-lg" href={hrefOf('today')} ref={homeRef} data-autofocus="">
          Về Hôm nay
        </a>
        <button className="btn btn-lg" type="button" onClick={onAgain}>
          {result.mode === 'learn' ? 'Học mẻ nữa' : 'Làm lại'}
        </button>
      </div>
    </section>
  );
}
