import { useEffect, useRef, useState, type FormEvent } from 'react';
import { authErrorText } from '../auth';
import { supabase } from '../supabase';

/** Màn đăng nhập: chỉ email + mật khẩu. Không có đăng ký (tài khoản tạo tay trong Supabase Dashboard). */
export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    document.title = 'Đăng nhập · Recall';
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    let message: string | null = null;
    try {
      const res = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (res.error) message = authErrorText(res.error);
      // Thành công: useSession nhận phiên mới và App tự chuyển vào trong.
    } catch {
      message = 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.';
    }
    setBusy(false);
    if (message) {
      setError(message);
      // đợi vẽ xong rồi đưa focus tới lỗi để trình đọc màn hình đọc ngay
      requestAnimationFrame(() => errorRef.current?.focus());
    }
  }

  return (
    <main className="login">
      <form className="login-card card" onSubmit={submit} noValidate>
        <header className="login-head">
          <p className="login-brand">
            Re<span>call</span>
          </p>
          <h1 className="screen-title">Đăng nhập</h1>
        </header>

        <label className="field">
          <span className="field-label">Email</span>
          <input
            className="input"
            type="email"
            name="email"
            autoComplete="username"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            inputMode="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>

        <label className="field">
          <span className="field-label">Mật khẩu</span>
          <input
            className="input"
            type="password"
            name="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        {error && (
          <p className="alert" role="alert" tabIndex={-1} ref={errorRef}>
            {error}
          </p>
        )}

        <button className="btn btn-primary" type="submit" disabled={busy || !email.trim() || !password}>
          {busy ? 'Đang đăng nhập…' : 'Đăng nhập'}
        </button>
      </form>
    </main>
  );
}
