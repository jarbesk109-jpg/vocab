import { createClient } from '@supabase/supabase-js';

// Cùng project Supabase với v1. Đây là khoá PUBLISHABLE (công khai, v1 cũng để lộ trong app.js):
// ai cũng đọc được nó, nên lớp bảo vệ thật là RLS trong supabase/schema.sql + đăng nhập bằng tài khoản.
const SUPABASE_URL = 'https://quomfkcbbcnuubrpbwpl.supabase.co';
const SUPABASE_KEY = 'sb_publishable_vo-fgRVSsp4wcfECUse7Cw_9obpBZzr';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true, // tải lại trang vẫn đăng nhập
    autoRefreshToken: true,
    detectSessionInUrl: false, // chỉ đăng nhập bằng email + mật khẩu, không có link trong URL
    storageKey: 'recall.auth',
  },
});
