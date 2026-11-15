import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

/** `undefined` = đang đọc phiên đã lưu (chưa biết); `null` = chưa đăng nhập. */
export type SessionState = Session | null | undefined;

export function useSession(): SessionState {
  const [session, setSession] = useState<SessionState>(undefined);

  useEffect(() => {
    let alive = true;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (alive) setSession(data.session);
      })
      .catch(() => {
        if (alive) setSession(null);
      });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      if (alive) setSession(next);
    });
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return session;
}

/** Lỗi đăng nhập / đăng xuất → câu tiếng Việt cho người dùng. */
export function authErrorText(error: { message?: string; status?: number; code?: string; name?: string }): string {
  const msg = (error.message || '').toLowerCase();
  if (error.code === 'invalid_credentials' || msg.includes('invalid login credentials')) {
    return 'Email hoặc mật khẩu không đúng.';
  }
  if (error.code === 'email_not_confirmed' || msg.includes('email not confirmed')) {
    return 'Tài khoản chưa được xác nhận. Vào Supabase → Authentication → Users để xác nhận.';
  }
  if (error.status === 429 || msg.includes('rate limit')) {
    return 'Thử quá nhiều lần. Đợi một lát rồi thử lại.';
  }
  if (error.name === 'AuthRetryableFetchError' || error.status === 0 || msg.includes('failed to fetch') || msg.includes('network')) {
    return 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.';
  }
  return 'Không đăng nhập được: ' + (error.message || 'lỗi không rõ') + '.';
}
