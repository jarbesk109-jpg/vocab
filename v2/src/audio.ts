import { useSyncExternalStore } from 'react';

/** Tắt tiếng toàn cục, nhớ theo máy. Chỉ là một công tắc: không ghi lại thẻ nào học lúc tắt tiếng. */
const MUTE_KEY = 'recall.muted';

let muted = readMuted();
const listeners = new Set<() => void>();

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(next: boolean): void {
  muted = next;
  try {
    localStorage.setItem(MUTE_KEY, next ? '1' : '0');
  } catch {
    /* không lưu được thì chỉ nhớ trong phiên này */
  }
  if (next) stopSpeaking();
  listeners.forEach((fn) => fn());
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useMuted(): boolean {
  return useSyncExternalStore(subscribe, isMuted);
}

/* Đọc bằng Web Speech API. Các mẹo dưới đây chuyển từ v1:
   - cancel() rồi speak() liền nhau thì Chrome hay nuốt mất câu: chờ một nhịp;
   - resume() gỡ trạng thái kẹt sau khi tab nằm nền lâu;
   - giữ tham chiếu utterance (Chrome dọn rác sớm thì im lặng);
   - giọng online lỗi thì đổi sang giọng có sẵn trên máy. */
let voice: SpeechSynthesisVoice | null = null;
let current: SpeechSynthesisUtterance | null = null;

function synth(): SpeechSynthesis | null {
  return typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
}

/** Chọn giọng tiếng Anh: ưu tiên en-US, rồi giọng Google, rồi giọng có sẵn trên máy. */
function pickVoice(preferLocal = false): SpeechSynthesisVoice | null {
  try {
    const all = synth()?.getVoices().filter((v) => /^en[-_]/i.test(v.lang)) ?? [];
    const us = all.filter((v) => /en[-_]US/i.test(v.lang));
    const pool = us.length ? us : all;
    voice =
      (preferLocal ? pool.find((v) => v.localService) : null) ||
      pool.find((v) => /Google/i.test(v.name)) ||
      pool.find((v) => v.localService) ||
      pool[0] ||
      null;
  } catch {
    voice = null;
  }
  return voice;
}

try {
  pickVoice();
  synth()?.addEventListener('voiceschanged', () => pickVoice());
} catch {
  /* trình duyệt không có giọng đọc */
}

export function stopSpeaking(): void {
  try {
    synth()?.cancel();
  } catch {
    /* bỏ qua */
  }
}

/** Đọc một từ tiếng Anh (từ có nhiều cách viết tách bằng `/` thì đọc cách đầu). Đang tắt tiếng thì không làm gì. */
export function speak(text: string, retry = false): void {
  const ss = synth();
  if (muted || !text || !ss) return;
  try {
    if (!voice) pickVoice();
    const say = String(text).split('/')[0].trim();
    if (!say) return;
    const go = () => {
      const u = new SpeechSynthesisUtterance(say);
      if (voice) {
        u.voice = voice;
        u.lang = voice.lang;
      } else u.lang = 'en-US';
      u.rate = 0.9;
      u.onerror = (e) => {
        if (!retry && e.error !== 'interrupted' && e.error !== 'canceled' && voice && !voice.localService) {
          pickVoice(true);
          speak(text, true);
        }
      };
      current = u;
      ss.resume();
      ss.speak(u);
    };
    if (ss.speaking || ss.pending) {
      ss.cancel();
      window.setTimeout(go, 90);
    } else go();
  } catch {
    /* không đọc được thì im lặng, không chặn việc học */
  }
}

/** Dùng cho test: utterance gần nhất. */
export function lastUtterance(): SpeechSynthesisUtterance | null {
  return current;
}
