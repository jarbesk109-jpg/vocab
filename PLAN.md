# Recall — PLAN

Kế hoạch vá v1 và dựng v2 cho app học từ vựng của Khang (tên cũ "Kingston's Vocab", tên mới **Recall**).
Khang duyệt ngày 13/11/2026. Tiến độ sống ở file này và ở Git, không ở trong khung chat.

Mục tiêu số 1: Khang mở app MỖI NGÀY. Thước đo: giữ được streak 100 ngày đầu tiên.

---

## 0. Cách làm việc (đọc trước mỗi phiên)

**Trước một task**
1. Đọc lại `PLAN.md` (mục 0, mục 3 phần liên quan, và task sắp làm).
2. Làm đúng MỘT task: task đầu tiên chưa tick, theo thứ tự.

**Trong task**
- Task có nhãn **[TDD]**: viết test theo đặc tả ở mục 3 trước, chạy thấy ĐỎ, rồi mới viết code tới khi XANH.
- Task có nhãn **[UI]**: không TDD. Làm xong thì tự đi qua "Tiêu chí tay" của task.
- Logic thuần chỉ nằm trong `logic/`. File trong `logic/` không được đụng `document`, `window`, `localStorage`, `fetch`, `Date.now()` (ngày giờ luôn truyền vào qua tham số).
- Không tự đổi luật. Nếu đặc tả mâu thuẫn, hoặc test viết đúng đặc tả mà không thể xanh: DỪNG, ghi vào mục 9 "Câu hỏi mở", hỏi Khang.
- "Ko sửa gì khi ko có sự cho phép": chỉ làm đúng phạm vi task.

**Sau task**
1. Chạy toàn bộ test: `npm test` (phải xanh hết).
2. Tick ô của task trong `PLAN.md`.
3. Commit: một task = một commit, thông điệp dạng `P1.2: logic hàng chờ Hôm nay`.

**Luật an toàn Git (không có ngoại lệ)**
- KHÔNG BAO GIỜ force push (`--force`, `--force-with-lease`), không `reset --hard` lên nhánh đã push, không sửa lịch sử đã push.
- Push bị từ chối thì DỪNG và báo Khang, không tự xử lý.
- Phase 1: làm hết một mạch trên nhánh `phase-1`, KHÔNG push giữa chừng. Xong task 1.7 thì DỪNG. Khang xuất backup v1, thử theo checklist, đồng ý rồi mới làm task 1.8 (push MỘT lần).
- Phase 2: không push cho tới khi xong task 2.2. Task 2.2 và 2.17 (đổi cách trang thật được phục vụ) phải có Khang xác nhận trước khi push.
- Không bao giờ commit: file JSON dữ liệu thật, `HANDOVER.md`, `RULES.md`, `PROMPT_FABLE.md`, `.env*`, `node_modules/`.

**Hai thư mục**
| Thư mục | Vai trò |
|---|---|
| `C:\Kingston\Vibe-coding\Vocab-app` | Bản bàn giao, CHỈ ĐỌC: `HANDOVER.md`, `RULES.md`, `index.html` (v1 + bản vá 11/11), file JSON thật. |
| `C:\Kingston\Vibe-coding\vocab` | Thư mục làm việc: clone của `github.com/jarbesk109-jpg/vocab` (tạo ở task 1.1). Từ task 1.1 trở đi, `PLAN.md` trong thư mục NÀY là bản duy nhất được tick. |

**Lệnh**
- Chạy toàn bộ test: `npm test`
- Chạy v1 ở máy: `python -m http.server 5173 --bind 127.0.0.1` rồi mở `http://127.0.0.1:5173` (không mở file trực tiếp được vì dùng ES modules).
- Chạy v2 ở máy (từ Phase 2): `npm run dev`

**Ngôn ngữ**: trả lời Khang bằng tiếng Việt; thuật ngữ kỹ thuật, tên file, lệnh giữ tiếng Anh. Chữ trên giao diện app: tiếng Việt.

---

## 1. Quyết định đã chốt

| Chủ đề | Quyết định |
|---|---|
| Cách làm | Logic: sửa dần, chuyển từ v1 sang `logic/` có test. Giao diện + đồng bộ: làm lại (v2). |
| Người dùng | Chỉ Khang. |
| Thiết bị | Laptop và điện thoại. ONLINE là chính: tiến độ chỉ ghi khi có mạng. Phiên bắt đầu lúc có mạng mà rớt mạng giữa chừng: giữ kết quả, có mạng thì tự gửi. Luyện offline không ghi tiến độ (Phase 3). |
| Server | GIỮ Supabase (project sẵn có). Supabase Auth email + mật khẩu, bảng mới, RLS `user_id = auth.uid()`. Bỏ đồng bộ bằng mã; khoá bảng `vocab_sync` cũ lúc chuyển hẳn. Giữ `keepalive.yml`. |
| Công nghệ v2 | Vite + React + TypeScript, CSS tay theo design token (chuẩn so: app Track List ở `C:\Kingston\Vibe-coding\Fable-5.2-test\index.html`). Không thư viện giao diện. |
| Test | Vitest. `npm test`. Cần Node 20+. |
| Hosting | GitHub Pages, repo `jarbesk109-jpg/vocab`. Chi phí: 0 đ/năm. Tên miền `.id.vn`: Phase 3. |
| AI API | Không gọi trong v2. |
| Tên | **Recall**: trung tính kiểu công cụ, xanh chàm, gọn. |
| Lên mốc | Phương án (c): deck mới xong qua Học; mọi lượt ôn cần Kiểm tra đạt KPI. |
| KPI | Là cài đặt; giữ 90 của Khang; app trống mặc định 90. |
| Hàng chờ | Tối đa 3 ôn + 1 mới MỌI LÚC, có thứ tự ưu tiên, trần 3 ngày, van an toàn (mục 3.2). |
| Streak | 7 luật của Khang + 5 cách hiểu đã duyệt (mục 3.4). Không tự dùng băng. |
| Kiểm tra | Bài tính lên mốc = đủ thẻ × 2 chiều; hai chiều của một từ cách nhau ít nhất 8 câu. |
| Số từ mỗi deck | Không giới hạn, không cảnh báo. |
| Backup | Một nút "Tải bản sao" khuất trong Cài đặt, không nhắc nhở. App tự lưu bản sao hằng tuần trên server. |
| Dữ liệu thật | Không đưa lên repo public: file JSON nằm trong `.gitignore`; gỡ `SNAPSHOT` khỏi code v1 trước khi commit. |
| ĐỀ XUẤT logic | Chưa áp dụng cái nào trong v2 (xem Phase 3). |

Mâu thuẫn `RULES.md` §11 đã chốt: #1 giữ mốc sau khi gãy nhịp; #2 theo mục 3.2; #3 chỉ chấp nhận học 2 deck/ngày, không lên lịch cho nó; #4 học sớm thì hôm đó là Ngày 1; #5 phương án (c); #6 KPI là cài đặt; #7 tắt tiếng toàn cục, không theo dõi; #8 giữ trường `note`, không đổi định dạng nhập; #9 không có trường từ loại; #10 tên deck tự do, app hiện Ngày 1 thật; #11 đăng nhập bằng tài khoản; #12 bỏ; #13 theo mục 3.4; #14 có khung thời gian + mục "Không làm".

---

## 2. Cấu trúc thư mục (trong clone)

```
index.html            v1: HTML + CSS (script đã tách ra)
app.js                v1: toàn bộ script cũ (classic script, không phải module)
logic/                logic thuần, ES modules, JavaScript + JSDoc. v1 và v2 dùng chung.
  index.js            re-export tất cả
  dates.js  migrate.js  schedule.js  streak.js  pace.js          (Phase 1)
  answers.js  mastery.js  session.js  store.js  decks.js         (Phase 2)
tests/
  *.test.js
  fixtures/kingston-vocab-backup-2026-11-11.json   (KHÔNG commit, nằm trong .gitignore)
  fixtures/small.js                                 (dữ liệu giả nhỏ, có commit)
v2/                   Vite + React + TypeScript (Phase 2)
supabase/schema.sql   bảng, RLS, hàm save_state (Phase 2)
V1_TAG                tên tag Git của bản v1 đang được phục vụ (Phase 2)
.github/workflows/    keepalive.yml (có sẵn), deploy.yml (Phase 2)
package.json  .gitignore  .nojekyll  PLAN.md
```

---

## 3. Đặc tả luật

Khi mục này và code v1 lệch nhau ở chỗ KHÔNG được nhắc tới ở đây, code v1 là đúng: chuyển nguyên văn. Chỗ nào mục này nói khác v1 thì mục này thắng (đó là luật mới Khang đã duyệt).

### 3.1 Ngày học (`logic/dates.js`)

- Mọi "hôm nay" trong app (lịch ôn, hoạt động, streak) là **ngày học**: múi giờ Asia/Bangkok (UTC+7, không đổi giờ), ngày mới bắt đầu lúc **4h sáng**.
- `studyDay(ms)` → `'YYYY-MM-DD'`: `new Date(ms + 3 * 3600000).toISOString().slice(0, 10)` (cộng 7 giờ múi giờ, trừ 4 giờ mốc ngày).
- `addDays(day, n)`, `dayDiff(a, b)` (= a − b, tính bằng ngày), `isDateStr(s)`: tính trên chuỗi ngày bằng UTC, không dùng giờ máy.
- Ngày luôn lưu dạng chuỗi `YYYY-MM-DD`. Không lưu, không so sánh bằng timestamp.

Test bắt buộc: `studyDay(Date.parse('2026-11-12T20:59:59Z'))` = `'2026-11-12'` (03:59 sáng 13/11 giờ VN); `studyDay(Date.parse('2026-11-12T21:00:00Z'))` = `'2026-11-13'`; `addDays('2026-12-31', 1)` = `'2027-01-01'`; `dayDiff('2026-11-13', '2026-11-11')` = 2.

### 3.2 Trạng thái deck và danh sách Hôm nay (`logic/schedule.js`)

Hằng số: `OFFSETS = [0, 1, 3, 7, 16]`, `REV_PER_DAY = 3`, `NEW_PER_DAY = 1`, `NEW_MAX_GAP_DAYS = 3`, `LATE_VALVE = 4`, `RECOVERY_LATE = 2`.

**Không còn dời ngày ôn.** Bỏ hẳn `spreadDecks`, `applyReschedule`, `dayLoads`, trạng thái "broken". Mỗi deck giữ ngày đến hạn thật; Hôm nay chỉ CHỌN ra tối đa 4 deck.

`hasStudied(set)`: chuyển nguyên văn `daHoc` của v1 (có `lastCompleted`, hoặc có `history`, hoặc có thẻ nào `r > 0` hay `w > 0`).

`deckStatus(set, today)` trả về một trong:
| kind | Điều kiện | Trường kèm |
|---|---|---|
| `graduated` | `stageIdx >= 5` | |
| `stock` | `stageIdx === 0` và chưa `hasStudied` (deck mới trong kho; KHÔNG phụ thuộc `anchor`) | |
| `waiting` | `stageIdx === 0` và đã `hasStudied` (deck mới học dở) | `stage: 0`, `late = max(0, dayDiff(today, anchor))`, `gap: 1` |
| `scheduled` | `due > today`, với `due = addDays(anchor, OFFSETS[stageIdx])` | `due`, `days` |
| `waiting` | còn lại (`due <= today`) | `due`, `stage = OFFSETS[stageIdx]`, `late = dayDiff(today, due)`, `gap`, `ratio`, `recovery` |

- `gap` = khoảng cách ôn của mốc hiện tại: `stageIdx <= 1` thì 1; ngược lại `OFFSETS[stageIdx] − OFFSETS[stageIdx − 1]` (2, 4, 9).
- `ratio = late / gap` (trễ so với khoảng cách ôn của chính deck).
- `recovery = set.recovering === true || late > RECOVERY_LATE`.

**Thứ tự ưu tiên của các deck `waiting`** (sắp tăng dần theo bộ khoá):
1. `tier`: `stageIdx <= 1` là 0 (mốc +1 và deck mới học dở luôn đứng đầu: "không bao giờ bỏ mẻ hôm qua"), còn lại là 1.
2. `ratio` giảm dần (trễ nhiều so với khoảng cách ôn thì lên trước).
3. `stageIdx` tăng dần (mốc thấp trước).
4. `anchor` tăng dần, rồi `name` tăng dần.

`startedDay(set)` = `set.startedAt` nếu có; không thì ngày sớm nhất trong `history`; không thì `lastCompleted`; không thì `null`. (`startedAt` là trường MỚI, ghi khi deck xong Ngày 1, xem 3.3.)

`planToday(sets, today)`:
```
done      = các deck có lastCompleted === today
newDone   = số deck trong done có startedAt === today
revDone   = done.length − newDone
waiting   = các deck kind 'waiting' và KHÔNG nằm trong done, đã sắp theo ưu tiên
stockAll  = các deck kind 'stock', sắp theo (anchor, createdAt, name)
lateCount = số deck trong waiting có late >= 1
lastNew   = ngày lớn nhất của startedDay(set) trên các deck đã hasStudied (null nếu không có)
daysSinceNew = lastNew ? dayDiff(today, lastNew) : null

onTrack = lateCount === 0 && waiting.length <= max(0, REV_PER_DAY − revDone)
ceiling = daysSinceNew === null || daysSinceNew > NEW_MAX_GAP_DAYS
valve   = lateCount > LATE_VALVE

Cổng deck mới (xét theo đúng thứ tự này):
  newDone >= NEW_PER_DAY      → đóng, reason 'doneNew'
  stockAll rỗng               → đóng, reason 'emptyStock'
  onTrack                     → MỞ,   reason 'onTrack'
  valve                       → đóng, reason 'valve'
  ceiling                     → MỞ,   reason 'ceiling'
  còn lại                     → đóng, reason lateCount > 0 ? 'late' : 'full'

fresh    = cổng mở ? stockAll[0] : null
revCap   = (fresh || newDone > 0) ? REV_PER_DAY : REV_PER_DAY + NEW_PER_DAY     // 3, hoặc 4 khi hôm nay không có deck mới
revSlots = max(0, revCap − revDone)
reviews  = waiting.slice(0, revSlots)
more     = waiting.slice(revSlots)
stock    = stockAll bỏ fresh
upcoming = các deck kind 'scheduled', sắp theo due
```
Trả về `{ today, done, reviews, fresh, more, stock, upcoming, gate: { open, reason, lateCount, daysSinceNew } }`. Mỗi phần tử deck kèm `status` của nó; phần tử trong `done` kèm `wasNew`.

Ý nghĩa bằng lời:
- Hôm nay hiện tối đa 4 deck: 3 ôn + 1 mới. Khi không có deck mới thì ô thứ 4 là deck ôn kế tiếp.
- Deck mới chỉ được mời khi Khang đang theo kịp (không deck ôn nào trễ, số deck ôn chờ vừa 3 ô).
- **Trần 3 ngày:** quá 3 ngày chưa bắt đầu deck mới nào thì vẫn mời 1 deck mới dù còn bài ôn tồn.
- **Van an toàn:** đang có hơn 4 deck ôn trễ thì tạm bỏ trần 3 ngày.
- `more` và `stock` vẫn học được ("học thêm"), ghi nhận đầy đủ: lên mốc, streak, % thuộc.
- Deck chưa làm không đi đâu cả: nó ở lại hàng chờ, `ratio` tăng dần nên tự leo lên đầu.

`availableUnits(sets, today, creditedIds)` (dùng cho streak, mục 3.4) =
số deck kind `waiting` có `lastCompleted !== today` và id không nằm trong `creditedIds`
+ (nếu có deck nào `startedAt === today` thì 0, ngược lại `min(1, số deck 'stock' không nằm trong creditedIds)`).

**Kết quả mong đợi với file JSON thật** (chưa học gì sau 10/10):
| Ngày | reviews (đúng thứ tự) | fresh | more | gate.reason |
|---|---|---|---|---|
| 2026-11-11 | `2108` (+3), `1708` (+7), `2008` (+7) | `2208` | — | `onTrack` |
| 2026-11-12 | `2108`, `1708`, `2008` | `2208` | `1608` | `ceiling` (lateCount 3) |
| 2026-11-13 | `2108`, `1708`, `2008` | `2208` | `1608` | `ceiling` (lateCount 4) |
Ngày 11/11: `upcoming` = `1608` (đến hạn 12/11), `stock` = `3108`, `0209`, `1109`. Dòng 11/11 chính là khẳng định bắt buộc trong `HANDOVER.md`.

Test bằng dữ liệu giả (`tests/fixtures/small.js`) phải phủ: mốc +1 đúng hạn đứng trước deck +7 trễ 5 ngày; sắp theo `ratio`; hoà thì mốc thấp trước; 5 deck trễ → `valve`, không deck mới, `reviews` có 4; 2 deck trễ và `daysSinceNew = 4` → `ceiling` mở; `daysSinceNew = 3` → đóng `late`; đã xong 1 deck mới hôm nay → `doneNew`; đã xong 2 deck ôn hôm nay → còn 1 ô ôn; deck `stageIdx 0` đã có câu trả lời là `waiting` chứ không phải `stock`; deck `stageIdx 5` là `graduated`; kho rỗng → `emptyStock` và `revCap = 4`.

### 3.3 Lên mốc, phương án (c) (`logic/schedule.js`)

`learnedToday(set, today)`: deck có ít nhất 1 thẻ, và MỌI thẻ có ít nhất một chiều `k` thoả `st[k].last === today && st[k].streak >= 1`. (Học theo mẻ nhỏ cộng dồn được.)

`applySessionResult(set, { mode, pct, full }, today, kpi)` → `{ set, advanced, dropped, credit, stageFrom, stageTo }`. Hàm thuần: trả về bản sao đã sửa, không sửa đầu vào. `mode` ∈ `'flash' | 'learn' | 'write' | 'test'`. `full = true` nghĩa là bài Kiểm tra đủ thẻ × 2 chiều.

Các bước, theo thứ tự:
1. `status = deckStatus(set, today)` tính TRƯỚC mọi thay đổi.
2. Nếu `mode === 'test' && full`: thêm vào `history` phần tử `{ date: today, pct: Math.round(pct), mode: 'test', stage: set.stageIdx }` (luôn thêm, kể cả các bước dưới không đổi gì).
3. Nếu `set.lastCompleted === today`: dừng, không đổi mốc, `credit = false` (mỗi deck tối đa 1 mốc và 1 lượt mỗi ngày).
4. **Deck mới** (`status.kind === 'stock'`, hoặc `'waiting'` với `stageIdx === 0`):
   - `complete` = (`mode === 'test' && full && pct >= kpi`) hoặc (`mode` là `'learn'` hay `'write'` và `learnedToday(set, today)`).
   - `credit` = `complete` hoặc (`mode === 'test' && full`).
   - Nếu `complete`: `anchor = today`, `stageIdx = 1`, `lastCompleted = today`, `startedAt = today`, `rescheduled = false`, `recovering = false`, `advanced = true`.
5. **Deck ôn** (`status.kind === 'waiting'`, `stageIdx >= 1`): chỉ xét khi `mode === 'test' && full`:
   - `credit = true` (làm xong bài là tính lượt, không cần đạt KPI).
   - `pct >= kpi`: `anchor = addDays(anchor, status.late)`, `stageIdx++`, `lastCompleted = today`, `rescheduled = false`, `recovering = false`, `advanced = true`.
   - `pct < kpi` và `status.recovery`: `stageIdx = max(1, stageIdx − 1)`, `anchor = addDays(today, 1 − OFFSETS[stageIdx])` (đến hạn ngày mai), `lastCompleted = today`, `recovering = false`, `dropped = true` nếu mốc có đổi.
   - `pct < kpi` và không phải phục hồi: không đổi gì (deck đứng yên trong hàng chờ).
6. Deck `scheduled` hoặc `graduated`: không đổi mốc, `credit = false` (học thêm deck chưa đến hạn vô hại; điểm từng thẻ vẫn ghi ở chỗ khác).
7. `mode === 'flash'` không bao giờ đổi mốc, không bao giờ `credit`.

Test bắt buộc (`tests/stage.test.js`): deck kho + Học xong đủ thẻ → mốc 1, `anchor = startedAt = today`; Học mới được nửa deck → không đổi, không credit; deck kho + Kiểm tra trượt → không đổi mốc nhưng credit; deck ôn + Học → không đổi, không credit; deck ôn đúng hạn + Kiểm tra đạt → mốc +1, `anchor` giữ; ôn trễ 2 ngày + đạt → `anchor` dời 2 ngày; ôn trễ 5 ngày + trượt → lùi 1 mốc, đến hạn ngày mai, không lùi dưới mốc 1; ôn thường + trượt → đứng yên, credit; đã `lastCompleted === today` → không đổi dù đạt; mốc 4 đạt → `stageIdx 5`; deck `scheduled` + đạt → chỉ thêm `history`; `flash` → không gì cả; đầu vào không bị sửa.

### 3.4 Streak (`logic/streak.js`)

**Luật của Khang**
1. Một ngày được tính khi xong ít nhất 1 lượt học/ôn đến hạn. Hôm nào không có deck đến hạn: tối thiểu 20 câu.
2. Ngày mới bắt đầu lúc 4h sáng (mục 3.1).
3. Băng giữ lửa: nhận 1 băng khi streak chạm 21, 42, 63…; giữ tối đa 1.
4. Lỡ 1 ngày: hôm nay streak "đang nguy". Cứu bằng 1 trong 2 cách, cả hai đều phải học hôm nay: (a) có băng: bấm "Dùng băng" + 1 lượt; (b) học bù gấp đôi: 2 lượt (thiếu deck thì mỗi lượt thiếu = 20 câu), tự lên lại không cần bấm.
5. Lỡ 2 ngày liên tiếp: streak về 0, băng không cứu.
6. Ngày bị lỡ cộng 0; ngày cứu vẫn cộng 1 như ngày thường.
7. Từ streak 3: mỗi lần lên số có hiệu ứng lửa bùng. Mốc 10, 50, 100, 200, 300, 400…: màn chúc mừng lớn (hiệu ứng làm ở Phase 2).

**Cách hiểu đã duyệt**
- Một "lượt" = `credit` của `applySessionResult` (mục 3.3). Mỗi deck tối đa 1 lượt/ngày.
- 20 câu thay cho một lượt thiếu phải là câu NGOÀI các deck đã tính lượt hôm đó. Lật flashcard không tính là câu.
- Đang nguy mà chỉ học 1 lượt và không bấm "Dùng băng": hết ngày chuỗi cũ mất, hôm đó thành ngày 1 của chuỗi mới. App KHÔNG tự dùng băng.

**Dữ liệu**: `activity[day]` có 2 dạng:
- cũ: `true` hoặc `{ n }` (giữ nguyên, không chuyển đổi);
- mới: `{ n, by: { [deckId]: số câu }, d: [deckId đã tính lượt], a: số lượt có thể làm hôm đó }`.

Thêm trường cấp cao nhất `streak: { freezeUsedDays: [] }`.

**Hàm** (đều thuần, trả về bản mới):
- `recordAnswer(activity, day, deckId, avail)`: `n++`, `by[deckId]++`, khởi tạo `d = []` nếu chưa có, đặt `a = d.length + avail`. Bản ghi cũ `true` được coi là `{ n: 20 }` trước khi cộng.
- `creditSession(activity, day, deckId, avail)`: thêm `deckId` vào `d` (không trùng), đặt `a = d.length + avail`.
- `avail` luôn là `availableUnits(sets, today, d)` tính SAU khi đã cập nhật deck.
- `dayUnits(rec, needed)`:
  ```
  rec không có            → 0
  rec === true            → 1
  rec.d === undefined     → rec.n > 0 ? 1 : 0          (ngày kiểu cũ: luật v1, tối đa 1)
  S     = rec.d.length
  extra = rec.n − tổng rec.by[id] với id trong rec.d
  a     = max(rec.a ?? S, S)
  → S + min(floor(extra / 20), max(0, needed − a))
  ```
  `met1 = dayUnits(rec, 1) >= 1`; `met2 = dayUnits(rec, 2) >= 2`.
- `useFreeze(freezeUsedDays, day)`: thêm `day` (không trùng).
- `computeStreak(activity, freezeUsedDays, today)` → `{ count, best, freezes, status, needUnits }`:
  ```
  count = 0; best = 0; freezes = 0; missed = false; status = 'pending'
  inc(): count++; best = max(best, count); nếu count % 21 === 0 thì freezes = min(1, freezes + 1)

  với mỗi ngày từ ngày sớm nhất trong activity tới today (đi từng ngày, kể cả ngày không có bản ghi):
    isToday = (ngày === today); used = freezeUsedDays có ngày này
    nếu !missed:
        met1                  → inc(); status = 'safe'
        không met1, isToday   → status = 'pending'
        không met1, count > 0 → missed = true              (lỡ 1 ngày)
        còn lại               → (count vẫn 0)
    nếu missed:
        met2                          → inc(); missed = false; status = 'safe'
        met1 && used && freezes > 0   → freezes--; inc(); missed = false; status = 'safe'
        isToday                       → status = 'atRisk'  (chưa cứu xong, ngày còn dang dở)
        met1                          → count = 1; best = max(best, 1); missed = false   (chuỗi cũ mất, chuỗi mới ngày 1)
        còn lại                       → count = 0; missed = false                        (lỡ 2 ngày liên tiếp)
  activity rỗng → { count: 0, best: 0, freezes: 0, status: 'pending', needUnits: 1 }
  ```
  `status` chỉ có nghĩa cho `today`: `'safe'` (hôm nay đã tính), `'pending'` (hôm nay chưa đủ, chưa nguy), `'atRisk'` (hôm qua lỡ, hôm nay chưa cứu xong).
  `needUnits`: `safe` → 0; `pending` → `1 − dayUnits(rec, 1)`; `atRisk` → nếu đã bấm băng và còn băng thì `1 − dayUnits(rec, 1)`, ngược lại `2 − dayUnits(rec, 2)`.
- `streakEvents(before, after)` (Phase 2): `{ increased, fire: increased && after.count >= 3, milestone: increased && (after.count === 10 || after.count === 50 || after.count % 100 === 0), freezeEarned }`.

Test bắt buộc (`tests/streak.test.js`): 3 ngày liền → 3; hôm nay chưa học → `pending`, `count` giữ; lỡ 1 ngày rồi 2 lượt → tiếp +1 (ngày lỡ +0); lỡ 1 ngày, 1 lượt, đã bấm băng và có băng → tiếp +1, hết băng; lỡ 1 ngày, 1 lượt, không băng, ngày đã qua → `count = 1`; cùng tình huống nhưng là hôm nay → `atRisk`, `needUnits = 1`; lỡ 2 ngày → 0; băng ở ngày 21, tới ngày 42 vẫn chỉ 1 băng; bấm băng khi không có băng → vô hiệu; đã bấm băng nhưng làm đủ 2 lượt → băng còn nguyên; ngày kiểu cũ `true` và `{ n: 40 }` tính `met1`, không bao giờ `met2`.
`dayUnits`: 1 deck tính lượt → `met1`; `a = 0`, `n = 20` → `met1`; `a = 0`, `n = 19` → không; `a = 1`, 1 lượt, 20 câu ngoài deck đó → `met2`; `a = 1`, 1 lượt, 50 câu đều trong deck đó → không `met2`; `a = 2`, 1 lượt, 100 câu ngoài → không `met2` (phải làm deck thứ hai); `a = 0`, `n = 40` → `met2`.
Với file JSON thật, `today = '2026-11-13'`: `count = 0`, `best = 5`, `freezes = 0`, `status = 'pending'`.

### 3.5 Nhịp học (`logic/pace.js`)

`paceInfo(activity, today)` → `{ pace, everyDays, everyDaysPlus1 }`:
- Cửa sổ: 7 ngày ngay trước `today` (không gồm `today`). Chỉ tính các ngày từ ngày đầu tiên có bản ghi kiểu mới (có `d`). Ít hơn 3 ngày như vậy → `pace = null`.
- `pace` = tổng `d.length` / số ngày tính, làm tròn 1 chữ số thập phân (ngày không có bản ghi tính 0).
- Mỗi deck tốn 5 lượt trong đời nó (mới, +1, +3, +7, +16), nên `everyDays = pace > 0 ? max(1, round(5 / pace)) : null`; `everyDaysPlus1 = max(1, round(5 / (pace + 1)))`.

Chữ trên màn Hôm nay: `Nhịp hiện tại 1,2 lượt/ngày → từ mới cứ 4 ngày một lần. Làm thêm 1 lượt/ngày → 2 ngày một lần.` (`pace = null`: `Chưa đủ dữ liệu để tính nhịp (cần 3 ngày).`)
Test: `pace 1.2` → 4 và 2; `pace 5` → 1 và 1; dưới 3 ngày → `null`; ngày trống tính 0.

### 3.6 Chấm đáp án (`logic/answers.js`, Phase 2; chuyển nguyên văn từ v1)

- `norm(s)`: chữ thường, cắt khoảng trắng hai đầu, gộp khoảng trắng, bỏ dấu câu cuối (`. , ; ! ?`), bỏ `to/a/an/the` đứng đầu.
- Việt→Anh (`prod`): `term` tách theo `/` hoặc `,`; gõ đúng một cái là đúng.
- Anh→Việt (`recog`): `def` tách theo `/` hoặc `,`; gõ đúng MỘT nghĩa (hoặc cả chuỗi) là đúng; bỏ dấu tiếng Việt khi so (NFD, bỏ `\u0300-\u036f`) và xử lý riêng `đ → d`.
- `bumpCard(card, ok, dir, typo, today)`: đúng thì `r++`, `streak++`, có `typo` thì `typo++`; sai thì `_prevStreak = streak`, `w++`, `streak = 0`; luôn `last = today`. Sai thì gắn sao.
- `overrideRight(card, dir, today)` ("Tôi đã gõ đúng", phím `\`): `w--` (không âm), `r++`, `streak = (_prevStreak || 0) + 1`, xoá `_prevStreak`, gỡ sao.
- MỚI `keyboardMismatch(dir, value, card)`: `dir === 'prod'`, đáp án đúng toàn ký tự ASCII, mà `value` có ký tự ngoài ASCII → `true`. Giao diện khi đó KHÔNG chấm sai, chỉ nhắc "Bàn phím đang ở tiếng Việt, đổi sang English rồi gõ lại".

### 3.7 Thuộc và tiến độ deck (`logic/mastery.js`, Phase 2)

- Chuyển nguyên văn: `knownDir` (`streak >= 2`), `cardKnown` (cả 2 chiều), `deckMastery`, `isMastered`.
- MỚI `deckProgress(set, today)` → `{ total, known, prodPct, recogPct, lastTest, bestTest, lastWrite, stagesPassed, stageIdx, status }`:
  - `lastTest` / `bestTest`: từ các phần tử `history` có `(mode ?? 'test') === 'test'`; `lastWrite`: phần tử `history` cuối có `mode === 'write'` (`null` nếu chưa làm).
  - `stagesPassed`: mảng 5 phần tử cho Mới, +1, +3, +7, +16; phần tử thứ `i` là đã qua khi `stageIdx > i`; ngày qua mốc lấy từ `history` có `stage === i` và `pct >= kpi` nếu có, không có thì `null` (dữ liệu cũ không ghi).

### 3.8 Phiên học (`logic/session.js`, Phase 2)

- `mulberry32(seed)`: bộ sinh số ngẫu nhiên truyền vào mọi hàm cần xáo trộn (test dùng seed cố định; app dùng seed từ thời gian).
- `buildTest(cards, opts, rng)` → danh sách `{ cardId, dir, type }`:
  - Bài đủ (`opts.full`): mỗi thẻ đúng 2 câu, một `prod` một `recog`; tổng `2n` câu.
  - Khoảng cách: giữa hai câu của cùng một thẻ có ít nhất `minGap(n) = min(8, floor(n / 2))` câu khác.
  - Cách dựng: nửa đầu = mọi thẻ xáo trộn, mỗi thẻ chọn ngẫu nhiên chiều hỏi trước; nửa sau = cùng thứ tự với nửa đầu (khoảng cách đúng `n − 1`), rồi thử `n` lần đổi chỗ ngẫu nhiên hai vị trí trong nửa sau, chỉ giữ lần đổi nào mà cả hai thẻ vẫn thoả khoảng cách.
  - Loại câu theo chiều: `opts.typeProd`, `opts.typeRecog` ∈ `'write' | 'mcq' | 'tf' | 'mix'` (`mix`: xoay vòng theo chỉ số câu như v1). Mặc định `prod = write`, `recog = mcq`.
  - Bài rút gọn (`opts.full = false`): `opts.count` câu, `opts.answerIn` ∈ `'en' | 'vi' | 'both'`. Là luyện tập: ghi điểm từng thẻ và hoạt động, KHÔNG lên mốc, KHÔNG tính lượt.
- Máy trạng thái thuần cho Học (hàng đợi, bước `mcq` rồi `write` theo công tắc, đúng thì tiến, sai thì về 0 + gắn sao + xếp lại cách 2 câu, đúng chưa đủ bước thì xếp lại cách 3 câu), Viết (một lượt, sai phải gõ lại đúng mới đi tiếp, điểm = đúng ngay lần đầu) và Kiểm tra (tuần tự; sai thì hiện đáp án, không tự nhảy câu, cho "Tôi đã gõ đúng"). Chuyển đúng hành vi v1.
- Mẻ Học nhỏ hơn deck: ưu tiên thẻ chưa đúng lần nào hôm nay.
- Mọi trạng thái phiên tuần tự hoá được thành JSON để "Học tiếp" sau khi bị ngắt.
- Phím: `1–4` chọn đáp án, `Enter` nộp/đi tiếp, `\` = "Tôi đã gõ đúng", `Space` nghe lại. Trắc nghiệm đúng thì tự qua câu.
- Không bao giờ hiện từ và nghĩa cùng lúc trước khi người học trả lời.

Test bắt buộc cho `buildTest`: với `n` từ 1 tới 30 và 50 seed mỗi `n`: đúng `2n` câu, mỗi thẻ đúng một `prod` một `recog`, khoảng cách ≥ `minGap(n)`; cùng seed cho cùng kết quả.

### 3.9 Dữ liệu và an toàn

**v1 (Phase 1)**: giữ nguyên cấu trúc `localStorage` `vocabvip.v1`, chỉ THÊM trường: `set.startedAt`, `history[].mode`, `history[].stage`, `activity[day].by/d/a`, `streak.freezeUsedDays`. Không xoá, không đổi tên trường nào. Đồng bộ Supabase bằng mã của v1 giữ nguyên tới task 2.17.

**Chuyển dữ liệu (`logic/migrate.js`)**
- `normalize(o, today)`, `summarize(o)`: chuyển nguyên văn từ v1.
- `toV2(v1)` → `{ meta, decks }`: `decks` = các phần tử `sets` nguyên vẹn (kể cả trường lạ, kể cả `_prevStreak`); `meta` = mọi khoá cấp cao nhất khác `sets`, cộng `schemaVersion: 2`, `deckOrder: [id…]`, `applied: []`.
- `toV1(meta, decks)` → đối tượng v1: bỏ 3 khoá riêng của v2, ghép `sets` theo `deckOrder`.
- Bắt buộc: `toV1(toV2(x))` bằng đúng `x` (so sâu) với file JSON thật.
- `compareFreshness(a, b)`: so `cards`, `answers`, `last` của `summarize`; trả về các cảnh báo khi `a` cũ hơn `b`. Số thẻ bằng nhau KHÔNG có nghĩa là cùng tiến độ.

**Supabase (Phase 2)**, file `supabase/schema.sql`:
```sql
create table public.decks (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null,
  data jsonb not null,                 -- nguyên đối tượng deck
  rev integer not null default 1,
  deleted_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
create table public.meta (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  data jsonb not null,                 -- settings, activity, streak, deckOrder, applied…
  rev integer not null default 1,
  updated_at timestamptz not null default now()
);
create table public.snapshots (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id bigint generated always as identity,
  reason text not null,                -- 'weekly' | 'before-import' | 'before-reset'
  data jsonb not null,                 -- toàn bộ dữ liệu ở dạng v1 (toV1)
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);
alter table public.decks     enable row level security;
alter table public.meta      enable row level security;
alter table public.snapshots enable row level security;
create policy decks_own on public.decks for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy meta_own on public.meta for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy snapshots_own on public.snapshots for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
```
Ghi nhiều dòng một lúc, chỉ thành công khi không ai ghi chen (so `rev`):
```sql
create or replace function public.save_state(p_meta jsonb, p_meta_rev integer, p_decks jsonb)
returns void language plpgsql security invoker set search_path = public as $$
declare d jsonb; n integer;
begin
  if p_meta_rev = 0 then
    insert into public.meta (user_id, data, rev) values (auth.uid(), p_meta, 1);
  else
    update public.meta set data = p_meta, rev = rev + 1, updated_at = now()
      where user_id = auth.uid() and rev = p_meta_rev;
    get diagnostics n = row_count;
    if n = 0 then raise exception 'REV_CONFLICT meta'; end if;
  end if;
  for d in select * from jsonb_array_elements(coalesce(p_decks, '[]'::jsonb)) loop
    if (d->>'rev')::integer = 0 then
      insert into public.decks (user_id, id, data, rev) values (auth.uid(), d->>'id', d->'data', 1);
    else
      update public.decks
        set data = d->'data', rev = rev + 1, updated_at = now(),
            deleted_at = case when coalesce((d->>'deleted')::boolean, false) then now() else null end
        where user_id = auth.uid() and id = d->>'id' and rev = (d->>'rev')::integer;
      get diagnostics n = row_count;
      if n = 0 then raise exception 'REV_CONFLICT deck %', d->>'id'; end if;
    end if;
  end loop;
end $$;
revoke execute on function public.save_state(jsonb, integer, jsonb) from public, anon;
grant  execute on function public.save_state(jsonb, integer, jsonb) to authenticated;
```
Thân hàm là một transaction: có `REV_CONFLICT` thì không dòng nào được ghi. Người thực thi chạy thử trong SQL Editor; nếu cú pháp cần chỉnh thì chỉnh nhưng giữ đúng hành vi này.

**Kho lệnh (`logic/store.js`, Phase 2)**
- Mọi thay đổi là một lệnh có `id` (uuid) và `day` (ngày học lúc phát sinh): `answer`, `override`, `sessionDone`, `useFreeze`, `star`, `deckUpsert`, `deckDelete`, `settings`.
- `applyCommand(state, cmd)` thuần, `state = { meta, decks }`; bên trong gọi `bumpCard`, `applySessionResult`, `recordAnswer`, `creditSession`…
- Hàng chờ gửi (outbox) lưu ở `localStorage` `recall.outbox.v1`; bản sao server gần nhất (kèm `rev`) ở `recall.cache.v1`.
- Giao diện luôn hiện `áp dụng(bản server, các lệnh còn trong outbox)`.
- Gửi: lấy các lệnh đang chờ → bỏ lệnh có `id` đã nằm trong `meta.applied` → áp lên bản server → gọi `save_state` với `rev` mong đợi → thành công thì cập nhật bản server, xoá lệnh khỏi outbox. `meta.applied` giữ 300 id gần nhất.
- `REV_CONFLICT`: tải lại từ server rồi áp lại (tối đa 3 lần). Lỗi mạng: giữ nguyên outbox, thử lại khi có sự kiện `online`, khi cửa sổ được focus, và mỗi 30 giây.
- Phiên bắt đầu lúc offline không phát lệnh nào.
- Trước mọi thao tác thay thế toàn bộ (nhập dữ liệu vào tài khoản đã có dữ liệu, xoá sạch): ghi một dòng `snapshots` trước, ghi không được thì dừng.
- Xoá deck là xoá mềm (`deleted_at`).

---

## 4. Phase 1 — vá v1 (làm một mạch, không push giữa chừng)

Làm trong `C:\Kingston\Vibe-coding\vocab`, nhánh `phase-1`.

- [x] **1.1 Clone repo thật, dựng bộ test, test migration** — [TDD] — cỡ 45 phút
  - Mục tiêu: có thư mục làm việc nối với repo thật, `npm test` chạy được, test đầu tiên của dự án là test migration.
  - Các bước:
    1. `node -v` phải ≥ 20. Chưa có Node thì DỪNG, nhờ Khang cài Node LTS.
    2. `git clone https://github.com/jarbesk109-jpg/vocab.git C:\Kingston\Vibe-coding\vocab` (thư mục này chưa tồn tại; nếu đã tồn tại thì DỪNG hỏi Khang). `git switch -c phase-1`.
    3. So `index.html` của clone với `index.html` trong thư mục bàn giao (`git diff --no-index`). Chỉ được thấy các đoạn có ghi `FIX 11/11` (hằng `SNAPSHOT`, `normalize`, `summarize`, `load`, nhập/hoàn tác backup). Thấy khác biệt nào khác thì DỪNG hỏi Khang.
    4. Chép `index.html` bàn giao sang clone, rồi sửa đúng một chỗ: thay cả giá trị của `const SNAPSHOT = {…}` bằng `null` (dữ liệu thật không lên repo public; `load()` gặp `null` sẽ tự rơi về app trống). Sửa lời chú thích phía trên cho khớp.
    5. Chép `PLAN.md` sang clone. Chép file JSON thật vào `tests/fixtures/`.
    6. Tạo `.gitignore`: `node_modules/`, `dist/`, `tests/fixtures/*.json`, `HANDOVER.md`, `RULES.md`, `PROMPT_FABLE.md`, `.env*`. Tạo `.nojekyll` (file rỗng).
    7. `npm init -y`, đặt `"type": "module"`, `"private": true`, script `"test": "vitest run"`; `npm i -D vitest`.
    8. Chạy `git status`: file JSON thật KHÔNG được xuất hiện.
  - File: `package.json`, `package-lock.json`, `.gitignore`, `.nojekyll`, `index.html`, `PLAN.md`, `tests/migration.test.js`, `tests/fixtures/small.js`, `logic/dates.js`, `logic/migrate.js`, `logic/schedule.js` (chỉ `OFFSETS`, `hasStudied`), `logic/index.js`.
  - Test viết trước (`tests/migration.test.js`, đọc file JSON thật):
    - 8 deck, 175 thẻ; tên theo thứ tự `1608, 1708, 2008, 2108, 2208, 3108, 0209, 1109`.
    - Tổng `r + w` trên mọi thẻ và cả hai chiều = 713; `summarize` = `{ sets: 8, cards: 175, answers: 713, last: '2026-10-10' }`.
    - Đúng 27 bản ghi chiều có trường `_prevStreak`.
    - `normalize` trả về `fixes` rỗng và dữ liệu bằng đúng đầu vào (so sâu); chạy lần hai cho cùng kết quả.
    - Deck có `addDays(anchor, OFFSETS[stageIdx]) === '2026-11-11'` và đã học: đúng `1708` (mốc 7), `2008` (mốc 7), `2108` (mốc 3). Deck chưa học có `anchor` nhỏ nhất: `2208`.
    - Thiếu file JSON: nếu `process.env.CI` thì bỏ qua cả nhóm test; không thì NÉM LỖI ghi rõ cần chép file vào `tests/fixtures/` (ở máy không được lặng lẽ bỏ qua).
    - Test của `dates.js` theo mục 3.1.
  - Xong khi: `npm test` xanh; `git status` không có file JSON thật; commit trên nhánh `phase-1`.

- [x] **1.2 Logic hàng chờ Hôm nay** — [TDD] — cỡ 60 phút
  - Mục tiêu: `deckStatus`, `startedDay`, `planToday`, `availableUnits` đúng mục 3.2.
  - File: `logic/schedule.js`, `tests/schedule.test.js`, `tests/fixtures/small.js`, `tests/migration.test.js` (thêm bảng 11/11, 12/11, 13/11 của mục 3.2).
  - Test viết trước: toàn bộ danh sách ở cuối mục 3.2.
  - Xong khi: `npm test` xanh.

- [x] **1.3 Tách script v1, nối màn Hôm nay vào hàng chờ** — [UI] — cỡ 75 phút
  - Mục tiêu: v1 dùng `logic/`; Hôm nay hiện tối đa 4 deck theo ưu tiên; không còn dời lịch.
  - Các bước:
    1. Cắt nguyên khối nội dung giữa `<script>` và `</script>` cuối `index.html` sang `app.js` (không sửa gì khi cắt).
    2. Cuối `index.html` thay bằng:
       ```html
       <script type="module">
         import * as Logic from './logic/index.js';
         window.Logic = Logic;
         const s = document.createElement('script');
         s.src = './app.js?v=1';
         document.body.appendChild(s);
       </script>
       ```
       (`app.js` là classic script nên các hàm vẫn là biến toàn cục, các `onclick="…"` trong HTML vẫn chạy.)
    3. Trong `app.js`: `todayStr()` không tham số trả về `Logic.studyDay(Date.now())`; `addDays`, `dayDiff` gọi sang `Logic`. Xoá `spreadDecks`, `dayLoads`, `firstFree`, `applyReschedule` và lời gọi trong `renderToday`. CHƯA xoá `setStatus`, `advanceStage` (task 1.6 mới thay).
    4. `renderToday` dùng `Logic.planToday(S.sets, todayStr())`: các deck `done` (✓ xong hôm nay), `reviews`, `fresh`; bên dưới hai mục gập `<details>`: "Đang chờ thêm (n)" = `more`, "Kho deck mới (n)" = `stock`, mỗi dòng có nút "Học thêm". Nhãn: deck mới `HỌC MỚI`; deck ôn `ÔN +N`; có `late` thì thêm `· trễ Nd`; `stage 0` đã học dở `HỌC TIẾP`.
    5. Một dòng giải thích cổng deck mới theo `gate.reason`: `late` "Deck mới tạm dừng: còn N deck trễ"; `valve` "Deck mới tạm dừng: đang có N deck trễ (hơn 4)"; `ceiling` "Đã quá 3 ngày chưa có deck mới nên mở 1 deck mới dù còn bài ôn"; `doneNew` "Hôm nay đã học 1 deck mới"; `emptyStock` "Kho deck mới đã hết, tạo deck mới để mai có từ học"; `full`, `onTrack`: không hiện gì.
    6. Bỏ hai banner "chưa có học phần MỚI cho ngày mai/ngày kia" (đã thay bằng dòng `emptyStock`).
    7. Màn Học phần và `allCardsToday` dùng `deckStatus`/`planToday` thay cho `setStatus` ở phần HIỂN THỊ (`stock` "Trong kho", `waiting` "Đang chờ ôn +N", `scheduled` "Ôn dd/mm", `graduated` "Xong chu kỳ").
    8. Sửa đoạn chữ "Về lịch ôn" trong Cài đặt cho đúng luật mới (giữ mốc, tối đa 3 ôn + 1 mới mỗi ngày).
  - File: `index.html`, `app.js`.
  - Tiêu chí tay (mở qua `python -m http.server`, nhập file JSON thật bằng Cài đặt → Nhập backup, KHÔNG nhập mã đồng bộ):
    - Console không có lỗi; 5 tab đều mở được.
    - Hôm nay hiện đúng `planToday` của ngày hiện tại (nếu chưa học gì sau 10/10: 3 deck ôn `2108`, `1708`, `2008` + deck mới `2208`; "Đang chờ thêm" có `1608`; kho có `3108`, `0209`, `1109`).
    - Tải lại trang: thứ tự không đổi, không deck nào bị đổi `anchor` (so với file JSON).
    - Bấm "Học thêm" ở một deck trong kho: vào được màn Học.
  - Xong khi: tiêu chí tay đạt, `npm test` xanh.

- [x] **1.4 Logic streak và nhịp học** — [TDD] — cỡ 75 phút
  - Mục tiêu: `logic/streak.js` đúng mục 3.4, `logic/pace.js` đúng mục 3.5.
  - File: `logic/streak.js`, `logic/pace.js`, `logic/index.js`, `tests/streak.test.js`, `tests/pace.test.js`, `tests/migration.test.js` (thêm kết quả streak 13/11).
  - Test viết trước: toàn bộ danh sách cuối mục 3.4 và 3.5.
  - Xong khi: `npm test` xanh.

- [x] **1.5 Logic lên mốc (c)** — [TDD] — cỡ 60 phút
  - Mục tiêu: `learnedToday`, `applySessionResult` đúng mục 3.3.
  - File: `logic/schedule.js`, `tests/stage.test.js`.
  - Test viết trước: toàn bộ danh sách cuối mục 3.3.
  - Xong khi: `npm test` xanh.

- [x] **1.6 Nối streak, nhịp và luật lên mốc vào v1** — [UI] — cỡ 75 phút
  - Mục tiêu: v1 chạy theo luật mới từ đầu tới cuối.
  - Các bước (trong `app.js`):
    1. Thêm một hàm `finishSession(set, mode, pct)`: gọi `Logic.applySessionResult(set, { mode, pct, full: mode === 'test' }, todayStr(), S.settings.kpi)`, chép kết quả vào `set` (`Object.assign`), nếu `credit` thì `S.activity = Logic.creditSession(…)`, rồi `save()`. Trả về kết quả để màn Kết quả dùng.
    2. `finishLearn`, `finishWrite`, cuối `nextTest` gọi `finishSession`. `finishFlash` KHÔNG gọi gì làm đổi mốc. Xoá `advanceStage`, `completeStudy`, `recordTest`, `setStatus`, `markActivity`.
    3. `touchActivity()` thành `S.activity = Logic.recordAnswer(S.activity, todayStr(), session.set.id, avail)` với `avail = Logic.availableUnits(S.sets, todayStr(), d hôm nay)`. Bỏ lời gọi `touchActivity()` trong nút "Sau →" của flashcard (lật thẻ không tính là câu).
    4. `startLearn`: khi mẻ nhỏ hơn deck, đưa các thẻ chưa đúng lần nào hôm nay lên trước rồi mới cắt mẻ.
    5. Số streak ở header lấy từ `Logic.computeStreak(S.activity, S.streak?.freezeUsedDays ?? [], todayStr())`; "Chuỗi dài nhất" lấy `best`. Xoá `currentStreak`, `bestStreak`.
    6. Dòng trạng thái cạnh số streak: `safe` "🔥 hôm nay đã tính"; `pending` "còn thiếu N lượt để tính hôm nay"; `atRisk` banner đỏ "Streak đang nguy: hôm qua lỡ. Hôm nay cần 2 lượt (thiếu deck thì 20 câu thay 1 lượt)" + nút **Dùng băng** khi `freezes > 0` (bấm → `Logic.useFreeze`, banner đổi thành "Đã dùng băng: cần 1 lượt hôm nay"). Hiện "🧊 1 băng" khi có băng.
    7. Màn Hôm nay thêm dòng nhịp học theo mục 3.5.
    8. Chữ ở màn Kết quả theo kết quả thật: lên mốc / lùi mốc / chưa đạt KPI nên chưa lên mốc / "Còn N thẻ chưa đúng lần nào hôm nay, học tiếp để xong Ngày 1".
  - File: `app.js`, `index.html`.
  - Tiêu chí tay: xem Phụ lục B.
  - Xong khi: tiêu chí tay đạt, `npm test` xanh.

- [x] **1.7 Chuẩn bị bàn giao cho Khang rồi DỪNG** — cỡ 20 phút
  - Rà Phụ lục B một lượt trên Chrome laptop và ở bề rộng điện thoại (DevTools). Ghi kết quả vào mục 9.
  - Báo Khang: Phase 1 xong, chưa push. Khang cần (a) mở trang thật hiện tại → Cài đặt → Xuất backup và giữ file; (b) tự thử theo Phụ lục B; (c) trả lời đồng ý.
  - KHÔNG push.

- [x] **1.8 Push một lần (chỉ sau khi Khang đồng ý)** — cỡ 15 phút — đã push `main`, tag `v1-live-1` (commit `f553b30`)
  - `git switch main`, `git merge --ff-only phase-1`, `git push origin main`. Bị từ chối thì DỪNG.
  - `git tag v1-live-1`, `git push origin v1-live-1`.
  - Đợi trang thật cập nhật, tải lại cứng (Ctrl+Shift+R) trên laptop và điện thoại, kiểm tra: dữ liệu còn nguyên, Hôm nay đúng, đồng bộ bằng mã vẫn chạy.

Điểm dừng hợp lệ nếu hết buổi: sau 1.3 (đã có hàng chờ 4 deck) hoặc sau 1.6. Dù dừng ở đâu cũng không push khi chưa qua 1.7.
Để sang Phase 2: hiệu ứng lửa và màn chúc mừng, khoảng cách 8 câu, màn thiết lập Kiểm tra, tiến độ từng deck, tên mới, tài khoản.

---

## 5. Phase 2 — v2 "Recall" dùng hằng ngày (tham khảo: 14/11 → 21/11)

Trong suốt Phase 2, v1 đã vá vẫn là app học hằng ngày của Khang. Học xong hôm đó mới code.

Nhận diện Recall: trung tính kiểu công cụ, gọn; một màu nhấn xanh chàm (sáng `#4F46E5`, tối `#818CF8`); màu ấm duy nhất là cam của ngọn lửa streak; font hệ thống; có sáng/tối.
Chuẩn độ mượt (áp cho mọi task [UI]): bố cục co giãn liên tục bằng `min()`/`clamp()`, không nhảy giật khi kéo cửa sổ; dùng `rem` để zoom trình duyệt 80–200% không vỡ; điểm ngắt 720px; vùng bấm ≥ 44px trên màn cảm ứng; chuyển cảnh 150–250ms với `cubic-bezier(0.22, 1, 0.36, 1)`; tôn trọng `prefers-reduced-motion`; không xê dịch bố cục khi dữ liệu về.

- [ ] **2.1 Khung v2** — [UI] — cỡ 2 giờ
  - Mục tiêu: `v2/` chạy được với Vite + React + TypeScript; design token Recall; khung điều hướng (thanh dưới trên điện thoại, cột trái trên laptop); các màn rỗng: Hôm nay, Học phần, Cài đặt; định tuyến bằng hash.
  - File: `v2/index.html`, `v2/src/main.tsx`, `v2/src/App.tsx`, `v2/src/styles/tokens.css`, `v2/src/styles/base.css`, `vite.config.ts` (`root: 'v2'`, `base: './'`), `tsconfig.json` (`allowJs`, `checkJs` cho `logic/`), `package.json` (script `dev`, `build`).
  - Tiêu chí tay: `npm run dev` mở được; đổi sáng/tối không nháy; kéo cửa sổ từ 320px tới 1600px không vỡ; zoom 200% dùng được; nút Back của trình duyệt đi đúng màn.
  - Xong khi: tiêu chí đạt, `npm test` và `npm run build` xanh. Không push.

- [ ] **2.2 Deploy bằng GitHub Actions** — [UI] — cỡ 1 giờ — CẦN KHANG XÁC NHẬN TRƯỚC KHI PUSH
  - Mục tiêu: trang thật phục vụ v1 ĐÓNG BĂNG theo tag ở `/vocab/` và v2 ở `/vocab/v2/`; sửa `logic/` trong Phase 2 không ảnh hưởng v1 đang chạy.
  - File: `.github/workflows/deploy.yml`, `V1_TAG` (nội dung: `v1-live-1`).
  - Workflow (khi push `main`): checkout đủ tag → Node 20 → `npm ci` → `npm test` (`CI=true`) → `npm run build` → tạo `_site/`: lấy `index.html`, `app.js`, `logic/` từ tag ghi trong `V1_TAG` (`git archive`), chép bản build v2 vào `_site/v2/`, thêm `.nojekyll` → `actions/upload-pages-artifact` → `actions/deploy-pages`.
  - Việc của Khang: repo → Settings → Pages → Source: **GitHub Actions**.
  - Tiêu chí tay: `/vocab/` vẫn là v1 y như trước, dữ liệu còn; `/vocab/v2/` mở được khung v2.
  - Xong khi: cả hai địa chỉ chạy. Từ đây được push sau mỗi task.

- [ ] **2.3 Supabase: tài khoản, bảng mới, RLS, màn đăng nhập** — [UI] — cỡ 1,5 giờ
  - Việc của Khang trong Dashboard: Authentication → Users → Add user (email + mật khẩu, Auto Confirm) → tắt cho phép đăng ký mới; SQL Editor → chạy `supabase/schema.sql`.
  - File: `supabase/schema.sql` (mục 3.9), `v2/src/supabase.ts` (URL + publishable key lấy từ `app.js` của v1; đây là khoá công khai, RLS mới là lớp bảo vệ), `v2/src/screens/Login.tsx`. Thêm `@supabase/supabase-js`.
  - Tiêu chí tay: đăng nhập đúng thì vào app, sai thì báo lỗi rõ; tải lại trang vẫn đăng nhập; Đăng xuất hoạt động; chưa đăng nhập mà `select` bảng `decks` bằng publishable key thì ra 0 dòng và `insert` bị từ chối (thử trong console).
  - Xong khi: tiêu chí đạt.

- [ ] **2.4 Chuyển dữ liệu v1 ⇄ v2** — [TDD] — cỡ 1,5 giờ
  - File: `logic/migrate.js`, `tests/migration.test.js`.
  - Test viết trước: `toV1(toV2(x))` bằng `x` với file thật; `toV2` giữ 8 deck, 175 thẻ, 713, 27 `_prevStreak`, thứ tự deck; `planToday` trên dữ liệu sau `toV2` ở 11/11 ra đúng bảng mục 3.2; `compareFreshness`: cùng số thẻ nhưng ít lượt trả lời hơn → cảnh báo; ngày học gần nhất cũ hơn → cảnh báo; giống hệt → không cảnh báo.
  - Xong khi: `npm test` xanh.

- [ ] **2.5 Kho lệnh và hàng chờ gửi** — [TDD] — cỡ 2 giờ
  - File: `logic/store.js`, `tests/store.test.js` (dùng backend giả trong bộ nhớ có `rev`).
  - Test viết trước: mỗi loại lệnh đổi state đúng; phát lệnh khi backend lỗi mạng → lệnh nằm trong outbox, giao diện vẫn thấy kết quả; mạng về → outbox rỗng, server đúng; gửi trùng một lệnh (đã commit nhưng mất phản hồi) → không cộng hai lần; server đổi `rev` giữa chừng → tải lại, áp lại, không mất thay đổi của bên nào; outbox đọc lại được sau "khởi động lại"; lệnh giữ đúng `day` lúc phát sinh dù gửi muộn; phiên offline không phát lệnh.
  - Xong khi: `npm test` xanh.

- [ ] **2.6 Nối Supabase và màn chuyển dữ liệu lần đầu** — [UI] — cỡ 2 giờ
  - File: `v2/src/data/supabaseBackend.ts` (`load` = `select` hai bảng; `save` = `rpc('save_state')`, ánh xạ lỗi `REV_CONFLICT`), `v2/src/data/useStore.ts`, `v2/src/screens/Import.tsx`.
  - Hành vi: tài khoản chưa có dữ liệu → màn chuyển dữ liệu. Nguồn 1: đọc thẳng `localStorage` `vocabvip.v1` (v1 và v2 cùng origin); nguồn 2: chọn file JSON. Hiện tóm tắt "N deck · N thẻ · N lượt trả lời · học gần nhất …" rồi mới ghi. Tài khoản đã có dữ liệu: so `compareFreshness`, cảnh báo nếu bản nhập cũ hơn, ghi `snapshots` trước khi thay.
  - Tiêu chí tay: nhập file thật → 8 deck, 175 thẻ, 713 lượt; tải lại trang và mở trên điện thoại thấy cùng dữ liệu; tắt mạng (DevTools offline) rồi phát một thay đổi → thấy trạng thái "đang chờ gửi", bật mạng → tự gửi.
  - Xong khi: tiêu chí đạt.

- [ ] **2.7 Chấm đáp án và dựng bài Kiểm tra** — [TDD] — cỡ 1,5 giờ
  - File: `logic/answers.js`, `logic/session.js` (`mulberry32`, `buildTest`), `tests/answers.test.js`, `tests/session.test.js`.
  - Test viết trước: mục 3.6 (`To Reduce.` = `reduce`; `lead to / result in` nhận một trong hai; `chinh phu` = `chính phủ`; `dan den` = `dẫn đến`; gõ một trong hai nghĩa của `thậm chí, ngay cả`; `bumpCard` đúng/sai; `overrideRight` hoàn lại; `keyboardMismatch`) và mục 3.8 (`buildTest`).
  - Xong khi: `npm test` xanh.

- [ ] **2.8 Máy trạng thái phiên Học, Viết, Kiểm tra** — [TDD] — cỡ 2 giờ
  - File: `logic/session.js`, `tests/session.test.js`.
  - Test viết trước: Học với 2 bước: đúng `mcq` rồi đúng `write` mới tính xong; sai thì về bước đầu, gắn sao, gặp lại sau 2 câu; chỉ bật `write` thì 1 bước; mẻ nhỏ ưu tiên thẻ chưa đúng hôm nay; Viết: sai phải gõ lại, điểm tính lần đầu; Kiểm tra: `pct` = đúng / tổng, "Tôi đã gõ đúng" cộng lại điểm; tuần tự hoá rồi khôi phục giữa chừng cho cùng trạng thái; trắc nghiệm có đúng 1 đáp án đúng và các đáp án nhiễu không trùng nghĩa đáp án đúng.
  - Xong khi: `npm test` xanh.

- [ ] **2.9 Màn Hôm nay** — [UI] — cỡ 1,5 giờ
  - File: `v2/src/screens/Today.tsx` + CSS.
  - Hành vi: đầu màn là số streak + trạng thái; MỘT nút chính "Bắt đầu" cho deck đáng làm nhất (kèm số câu); bên dưới các deck còn lại của hôm nay (tối đa 4 tính cả deck chính), deck đã xong có dấu ✓; dòng cổng deck mới; dòng nhịp học; hai mục gập "Đang chờ thêm" và "Kho deck mới"; banner "Học tiếp" khi có phiên dang dở.
  - Tiêu chí tay: khớp `planToday`; xong một deck thì danh sách cập nhật không giật; dùng tốt ở 360px.

- [ ] **2.10 Màn Học và Viết** — [UI] — cỡ 2 giờ
  - File: `v2/src/screens/Learn.tsx`, `v2/src/components/` (thẻ câu hỏi, ô đáp án, thanh tiến độ), `v2/src/audio.ts` (Web Speech API, chọn giọng tiếng Anh, nút tắt tiếng toàn cục nhớ theo máy).
  - Hành vi: thanh tiến độ; bật/tắt Trắc nghiệm và Tự luận ngay trên màn; chọn chiều; chọn cỡ mẻ (7/15/20/30/tất cả); phím tắt mục 3.8; ô đáp án có `autocapitalize="off" autocorrect="off" autocomplete="off" spellcheck="false"`; nhắc đổi bàn phím khi `keyboardMismatch`; Anh→Việt đọc từ khi câu hỏi hiện, Việt→Anh đọc sau khi trả lời.
  - Tiêu chí tay: học hết một deck chỉ bằng bàn phím; thoát giữa chừng rồi "Học tiếp" đúng chỗ; trên điện thoại bàn phím không che câu hỏi; chuyển câu mượt.

- [ ] **2.11 Thiết lập Kiểm tra, Kiểm tra, Kết quả** — [UI] — cỡ 2 giờ
  - File: `v2/src/screens/TestSetup.tsx`, `Test.tsx`, `Result.tsx`.
  - Hành vi: màn thiết lập: số câu ("Đủ bài: N thẻ × 2 chiều, tính lên mốc" hoặc số tuỳ chọn "luyện tập, không tính mốc"), trả lời bằng tiếng nào, loại câu cho từng chiều. Sai thì hiện đáp án + "Tôi đã gõ đúng" / "Tiếp", không tự nhảy. Kết quả: điểm, đạt hay chưa, mốc đổi thế nào, danh sách câu sai, streak.
  - Tiêu chí tay: deck 20 thẻ ra 40 câu; không thấy hai chiều của một từ gần nhau; rớt mạng giữa bài (DevTools offline) vẫn làm tiếp và kết quả tự gửi khi có mạng; đạt KPI thì deck lên mốc và biến khỏi danh sách chờ.

- [ ] **2.12 Tiến độ từng học phần** — [TDD] + [UI] — cỡ 2 giờ
  - File: `logic/mastery.js`, `tests/mastery.test.js`, `v2/src/screens/Decks.tsx`, `DeckDetail.tsx`.
  - Test viết trước: mục 3.7; với file thật: `1608` thuộc cả hai chiều 100%, `stagesPassed` đã qua Mới, +1, +3, +7; `2208` 0% và chưa qua mốc nào.
  - Hành vi: mỗi deck hiện % thuộc chiều Việt→Anh và chiều Anh→Việt (hai thanh riêng), Viết đã làm chưa và bao nhiêu %, Kiểm tra lần gần nhất và cao nhất, dải 5 mốc Mới/+1/+3/+7/+16 đánh dấu mốc đã qua, lần ôn kế. Màn chi tiết có danh sách thẻ kèm trạng thái từng chiều và sao.
  - Từ task này, phiên Viết ghi vào `history` phần tử `{ date, pct, mode: 'write' }`.

- [ ] **2.13 Soạn deck** — [TDD] + [UI] — cỡ 1,5 giờ
  - File: `logic/decks.js` (`parseCards`, `findDupTerms`), `tests/decks.test.js`, `v2/src/screens/DeckEditor.tsx`.
  - Test viết trước: `từ: nghĩa` mỗi dòng một thẻ, tách ở dấu `:` đầu tiên, bỏ dòng trống, đếm dòng lỗi; `findDupTerms` so theo `norm`, bỏ qua chính deck đang sửa.
  - Hành vi: tạo, sửa, xoá mềm; dán danh sách; cảnh báo từ trùng deck khác (cho bỏ từ trùng hoặc giữ); gắn/gỡ sao. Không giới hạn số từ.
  - Có thể dời sang tuần sau: kho còn 4 deck mới.

- [ ] **2.14 Streak: hiệu ứng và màn chúc mừng** — [TDD] + [UI] — cỡ 1,5 giờ
  - File: `logic/streak.js` (`streakEvents`), `tests/streak.test.js`, `v2/src/components/Flame.tsx`, `Celebration.tsx`.
  - Hành vi: từ streak 3, mỗi lần số tăng thì ngọn lửa bùng lên; mốc 10, 50, 100, 200, 300… hiện màn chúc mừng lớn giữa màn hình; trạng thái "đang nguy" + nút "Dùng băng"; hiện băng đang có và còn bao nhiêu ngày tới băng kế.
  - Tiêu chí tay: dùng dữ liệu giả để xem đủ: tăng số, mốc 10, đang nguy, dùng băng; bật `prefers-reduced-motion` thì hiệu ứng rút gọn.

- [ ] **2.15 Cài đặt và bản sao** — [UI] — cỡ 1,5 giờ
  - File: `v2/src/screens/Settings.tsx`.
  - Hành vi: KPI; tắt tiếng; tài khoản + Đăng xuất (outbox còn lệnh thì cảnh báo); mục "Nâng cao" gập sẵn chứa nút **Tải bản sao** (JSON dạng v1, tên `recall-backup-YYYY-MM-DD.json`) và danh sách deck đã xoá để khôi phục. Mở app mà bản `snapshots` gần nhất đã quá 7 ngày thì lặng lẽ ghi bản mới (`reason 'weekly'`), giữ 8 bản gần nhất. Không có bất kỳ lời nhắc backup nào.
  - Tiêu chí tay: file tải về nhập lại được và bằng dữ liệu đang có.

- [ ] **2.16 Rà độ mượt** — [UI] — cỡ 2 giờ
  - Đi qua mọi màn với chuẩn độ mượt ở đầu mục 5, trên laptop (kéo cửa sổ, zoom 80–200%) và điện thoại thật; so cảm giác với Track List. Sửa mọi chỗ giật, vỡ, nháy.

- [ ] **2.17 Chuyển hẳn sang v2** — [UI] — cỡ 1 giờ — CẦN KHANG XÁC NHẬN TRƯỚC KHI PUSH
  - Điều kiện: Khang đã học bằng v2 ở `/v2/` ít nhất 2 ngày liền không lỗi.
  - Các bước: (1) trên máy có dữ liệu v1 mới nhất, chạy màn chuyển dữ liệu lần cuối; (2) tạo bản v1 lưu trữ: thêm banner "Bản cũ, đã chuyển sang Recall" và ẩn khối đồng bộ bằng mã, gắn tag `v1-live-2`, sửa `V1_TAG`; (3) sửa `deploy.yml`: v2 ở `/vocab/`, v1 ở `/vocab/v1/`; (4) Supabase: tạo bảng `keepalive` 1 dòng cho `keepalive.yml` chạm vào, sửa `keepalive.yml` trỏ sang bảng đó; (5) khoá bảng cũ: `alter table public.vocab_sync enable row level security;` và xoá mọi policy của nó (liệt kê bằng `select policyname from pg_policies where tablename = 'vocab_sync'`).
  - SQL cho bước (4):
    ```sql
    create table public.keepalive (id integer primary key check (id = 1), at timestamptz not null default now());
    insert into public.keepalive (id) values (1);
    alter table public.keepalive enable row level security;
    create policy keepalive_read  on public.keepalive for select to anon, authenticated using (true);
    create policy keepalive_touch on public.keepalive for update to anon, authenticated using (id = 1) with check (id = 1);
    ```
  - KHÔNG tắt project Supabase, KHÔNG xoá `keepalive.yml`.
  - Tiêu chí tay: `/vocab/` là Recall; bằng publishable key không đọc, không ghi được `vocab_sync`; workflow keepalive chạy tay ra xanh.

Khối lượng khoảng 29 giờ. Nếu trễ, cắt theo thứ tự: 2.13 → phần "deck đã xoá" và bản sao hằng tuần của 2.15 → chế độ Viết. Mốc tham khảo để dừng thêm tính năng và chỉ làm 2.17: 28/11.

---

## 6. Phase 3 — lâu dài (chưa lên task; mỗi mục cần Khang duyệt trước khi làm)

- Luyện offline: service worker để mở app không cần mạng, xem/học thẻ từ bản lưu sẵn, không ghi tiến độ.
- Tên miền `.id.vn` (kiểm tra phí gia hạn sau kỳ miễn phí).
- Tính năng AI: nút tự điền nghĩa và câu ví dụ, chấm bài dịch. Khi làm phải có: lưu dần + bỏ qua mục đã xong, thử lại khi bị giới hạn tốc độ, API key trong `.env` + `.gitignore`, cách soát khoảng 20 kết quả, ước tính chi phí + hạn mức chi.
- Chuyển từ v1 sang: Dịch đoạn văn, chế độ Thẻ (flashcard), quản lý nhiều project.
- Các ĐỀ XUẤT logic (CHƯA duyệt, chưa áp dụng):
  - **FSRS**: lịch ôn theo TỪNG TỪ bằng thuật toán FSRS thay cho lịch theo deck.
  - **A**: ôn trễ mà vẫn đạt thì nhảy 2 mốc.
  - **C**: trượt thì hôm sau thi lại mới tính lên mốc.
  - **D**: bài ôn trộn hằng tuần cho các deck đã xong +16.
  - **F**: gợi ý "gõ nhầm?" khi đáp án lệch 1 ký tự.
  - **G**: loại câu hỏi nghe rồi gõ.
  - **I**: nhắc giờ học cố định (thông báo).
  - Đã bỏ: B (vòng vá lỗi sau Kiểm tra), E (giới hạn số từ mỗi deck), H (tự dùng băng).

---

## 7. Luật nào nằm ở đâu

| Luật (nguồn: `HANDOVER.md`, `RULES.md`, Khang 13/11) | Code | Test |
|---|---|---|
| Import không mất gì: mọi deck, thẻ, điểm, lịch sử, `_prevStreak` | `logic/migrate.js` | `migration` |
| Không lặng lẽ đè bản mới bằng bản cũ; so lượt trả lời + ngày học, không chỉ số thẻ | `logic/migrate.js` `compareFreshness`, `logic/store.js` (`rev`), SQL `save_state` | `migration`, `store` |
| Luôn có bản sao trước khi thay thế | `logic/store.js`, bảng `snapshots` | `store` |
| "Xoá sạch" phải ra trống thật, không nhúng deck vào code | `logic/migrate.js` (`emptyState`), gỡ `SNAPSHOT` | `migration` |
| Ngày là ngày lịch dạng chuỗi; ngày mới lúc 4h sáng Asia/Bangkok | `logic/dates.js` | `dates` (trong `migration.test.js`) |
| Mốc 0, +1, +3, +7, +16 tính từ `anchor` | `logic/schedule.js` | `schedule` |
| Ôn trễ thì dời `anchor` theo số ngày trễ | `applySessionResult` | `stage` |
| Gãy nhịp không reset: giữ mốc; ôn trễ hơn 2 ngày là lượt phục hồi (đạt thì lên, trượt lùi 1 mốc, không về 0, ôn lại mai) | `deckStatus`, `applySessionResult` | `schedule`, `stage` |
| Tối đa 1 mốc mỗi deck mỗi ngày | `applySessionResult` | `stage` |
| Học sớm deck chưa bắt đầu thì hôm đó là Ngày 1; học thêm deck chưa đến hạn không làm lệch lịch | `applySessionResult` | `stage` |
| Deck đã từng học không bao giờ là "mới" | `hasStudied`, `deckStatus` | `schedule` |
| Tối đa 3 ôn + 1 mới mọi lúc; thứ tự ưu tiên; không bỏ mốc +1 | `planToday` | `schedule` |
| Trần 3 ngày; van an toàn hơn 4 deck trễ | `planToday` | `schedule` |
| Nhịp học và "từ mới cứ N ngày một lần" | `logic/pace.js` | `pace` |
| Lên mốc (c): deck mới qua Học, ôn qua Kiểm tra đạt KPI; flashcard không lên mốc | `applySessionResult`, `learnedToday` | `stage` |
| Thuộc 1 chiều = 2 lần đúng liên tiếp; thuộc thẻ = cả 2 chiều; thuộc deck = mọi thẻ | `logic/mastery.js` | `mastery` |
| Kiểm tra đạt khi ≥ KPI; bài tính mốc = đủ thẻ × 2 chiều | `logic/session.js`, `applySessionResult` | `session`, `stage` |
| Hai chiều của một từ cách nhau ≥ 8 câu | `buildTest` | `session` |
| Người học chọn loại câu cho từng chiều | `buildTest` | `session` |
| Chuẩn hoá đáp án; nhiều đáp án tách `/` `,`; tiếng Việt bỏ dấu, `đ → d`; một nghĩa là đủ | `logic/answers.js` | `answers` |
| Typo đếm riêng; "Tôi đã gõ đúng" hoàn lại; sai thì gắn sao | `logic/answers.js` | `answers` |
| Bàn phím tiếng Việt ở ô tiếng Anh: không chấm sai | `keyboardMismatch` | `answers` |
| Không hiện từ và nghĩa cùng lúc trước khi trả lời | `logic/session.js` + màn Học/Kiểm tra | `session` + tiêu chí tay |
| Lưu sau mỗi câu; thoát giữa chừng không mất; "Học tiếp" | `logic/session.js`, `logic/store.js` | `session`, `store` |
| Chỉ cần bàn phím: `1–4`, `Enter`, `\`, `Space` | màn Học/Kiểm tra | tiêu chí tay |
| Tắt tiếng toàn cục, nhớ theo máy, không theo dõi | `v2/src/audio.ts` | tiêu chí tay |
| Streak: 7 luật + băng + cứu | `logic/streak.js` | `streak` |
| Tiến độ chi tiết từng deck | `deckProgress` | `mastery` |
| Định dạng nhập `từ: nghĩa`; cảnh báo từ trùng deck khác | `logic/decks.js` | `decks` |
| Mỗi người chỉ đọc/ghi dữ liệu của mình | SQL RLS | tiêu chí tay 2.3, 2.17 |

---

## 8. Không làm, rủi ro, mốc thời gian

**Không làm trong v2**: nhiều người dùng; gọi AI API; FastAPI hay backend riêng; game; nút Đẩy lên/Kéo về; nhập xuất JSON bằng tay (trừ lần chuyển dữ liệu và nút "Tải bản sao"); lời nhắc backup; giới hạn số từ mỗi deck; theo dõi thẻ học lúc tắt tiếng; trường từ loại; bất kỳ ĐỀ XUẤT logic nào ở mục 6.

**Rủi ro**
| Rủi ro | Cách giảm |
|---|---|
| Tách `app.js` (1.3) làm hỏng v1 | Cắt nguyên khối, không sửa khi cắt; checklist tay; chưa push nên lùi lại bằng Git dễ dàng. |
| Push Phase 1 làm hỏng dữ liệu thật | Chỉ thêm trường, không đổi trường cũ; Khang xuất backup v1 trước khi push; tag `v1-live-1`. |
| Máy còn code v1 cũ trong cache ghi đè trường mới qua đồng bộ bằng mã | Sau khi push, tải lại cứng trên mọi máy trước khi học. |
| Thử ở máy mà nhập mã đồng bộ thì dữ liệu thử lên mây thật | Checklist ghi rõ: KHÔNG nhập mã đồng bộ khi thử ở `127.0.0.1`. |
| Phase 2 quá tải | Thứ tự cắt ở cuối mục 5; v1 đã vá vẫn dùng tốt nên không có áp lực phải chuyển. |
| Supabase tạm dừng khi nghỉ học hơn 1 tuần và repo im hơn 60 ngày (GitHub tự tắt workflow theo lịch) | Vào Dashboard bấm Restore; dữ liệu không mất. Có bản `snapshots` và nút "Tải bản sao". |
| Bảng `vocab_sync` cũ ai cũng ghi được cho tới 2.17 | Đã tồn tại từ tháng 8; khoá ở 2.17. |
| Làm công cụ thay vì học | Học xong hôm đó mới code. |

**Mốc thời gian (tham khảo)**: Phase 1: 13/11. Phase 2: 14/11 → 21/11, mốc dừng thêm tính năng 28/11. Phase 3: không hạn.

---

## 9. Câu hỏi mở và ghi chú khi làm

(Người thực thi ghi vào đây: chỗ đặc tả chưa rõ, kết quả rà checklist, việc cần Khang quyết.)

**Task 1.1 (13/11)**
- So `index.html` của clone với bản bàn giao: 5 đoạn khác, tất cả là phần THÊM của bản vá 11/11, không có gì ở trang thật mà bản bàn giao thiếu. Bốn đoạn đúng danh sách (`SNAPSHOT`, `normalize`/`summarize`/`load`, nhập backup, hoàn tác). Đoạn thứ năm KHÔNG có nhãn `FIX 11/11`: 2 dòng trong `pullCloud` (kéo từ mây về thì chạy qua `normalize`, hỏng thì báo "Dữ liệu trên mây hỏng"). Người thực thi coi đây là cùng bản vá (lời chú thích của `normalize` ghi rõ nguồn "đám mây") nên làm tiếp. **Khang xem lại trước khi cho push (1.8); nếu không đúng ý thì báo.**
- `emptyState()` trong `logic/migrate.js` đặt KPI mặc định 90 theo mục 1 ("app trống mặc định 90"); `seed()` của v1 trong `index.html` vẫn là 80, chưa đụng. Với file thật không ảnh hưởng (đã có `kpi: 90`).
- Số thẻ từng deck ở Phụ lục A khớp file JSON (đã có test).
- Môi trường: Node 24.22.1, Vitest 5.1.0. Git ở máy này bật `core.autocrlf`, nên có cảnh báo "LF will be replaced by CRLF": vô hại, trong repo vẫn là LF.

**Task 1.3 (13/11)**
- Ngoài 4 hàm ghi trong task, đã xoá thêm `restoreResetDecks` (bản vá một lần 06/10) vì nó gọi `spreadDecks`, tức là cũng dời lịch. Với file thật nó không còn chạy (`fix0610: true`). `repairEarlyLearn` giữ nguyên.
- Trạng thái trung gian tới hết task 1.6: lên mốc vẫn đi qua `setStatus`/`advanceStage` cũ, nên deck trễ hơn 2 ngày (kiểu cũ gọi là "broken") làm xong chưa lên mốc. Task 1.6 thay bằng `applySessionResult`. Không dùng bản ở giữa 1.3 và 1.6 để học thật.
- Màn Học phần: deck `stageIdx 0` đã học dở hiện "Đang học dở" (task chỉ liệt kê 4 nhãn, không có nhãn cho trường hợp này).
- "Lấy từ hôm nay" ở tab Dịch đoạn văn = thẻ của `reviews` + `fresh` (không gồm `more`, `stock`, deck đã xong).
- Tiêu chí tay: người thực thi chạy bằng Chrome headless (nhập file thật qua đúng nút Nhập backup, ngày học 13/11): Hôm nay ra `2108`, `1708`, `2008` + mới `2208`, chờ thêm `1608`, kho `3108`, `0209`, `1109`, dòng cổng `ceiling`; 5 tab mở được; tải lại không đổi thứ tự, `S.sets` bằng đúng file JSON; "Học thêm" deck kho vào được màn Học. Console không có lỗi JavaScript; chỉ có 404 `favicon.ico` (có từ trước, trang chưa bao giờ có favicon).

**Task 1.6 (13/11)**
- **Khang xem lại:** đã xoá thêm `repairEarlyLearn` (bản vá 16/09, không nằm trong danh sách xoá của task). Lý do: nó tự đưa deck `stageIdx 0` lên mốc 1 khi mọi thẻ từng đúng trước `anchor`, tức là một đường lên mốc khác với mục 3.3 (ví dụ deck kho làm Kiểm tra trượt hôm nay thì hôm sau tự lên mốc 1, trái với "deck kho + Kiểm tra trượt → không đổi mốc"). Mục 3 ghi "chỗ nào mục này nói khác v1 thì mục này thắng". Với file thật hàm này không làm gì. Nếu Khang muốn giữ thì báo, khôi phục từ Git được.
- Cũng xoá `finishQuiz` (code chết, chỉ gọi `completeStudy`), `dayCount`, `addAnswer`, `dayFull`, `DAY_FULL` (cách đếm ngày cũ, không còn ai dùng).
- Đổi thứ tự ở 6 chỗ chấm bài: `bumpCard` trước rồi mới `touchActivity`, để `avail` tính SAU khi deck đã cập nhật (mục 3.4).
- **Quan sát, chưa đổi luật:** deck mới học dở (`stageIdx 0`, đã có câu trả lời) tính `late` theo `anchor` cũ đúng như mục 3.2. Ví dụ `2208` (`anchor` 11/11) học 7 thẻ ngày 13/11 thì hiện "HỌC TIẾP · trễ 2d" và được đếm vào số deck trễ, nên dòng cổng đổi thành "đang có 5 deck ôn trễ (hơn 4)". Không ảnh hưởng thứ tự (deck học dở luôn đứng đầu) nhưng chữ hơi lạ. Nếu Khang muốn deck học dở không tính trễ thì cần sửa mục 3.2.
- Banner nhắc xuất backup 7 ngày của v1 vẫn còn (task không yêu cầu bỏ; "không nhắc nhở" là quyết định cho v2). `seed()` của v1 vẫn KPI 80.
- `index.html`: thêm chỗ cho dòng trạng thái streak và "🧊 băng" ở header; 3 chỉnh CSS nhỏ để dòng deck không vỡ chữ ở 375px (`.pill`, `.setrow .meta` không xuống dòng giữa chữ, `.setrow` cho phép xuống hàng).
- Màn Kết quả luôn nói rõ: lên mốc / lùi mốc / chưa đạt KPI / còn N thẻ / deck đã xong lượt hôm nay / deck chưa đến hạn, kèm một dòng streak.

**Task 1.7 (13/11): kết quả rà Phụ lục B**

Cách rà: người thực thi điều khiển Chrome headless (không phải Khang bấm tay), mở `http://127.0.0.1:5173`, nhập file JSON thật qua đúng nút Nhập backup, KHÔNG nhập mã đồng bộ, ngày học 13/11. Mỗi câu hỏi được trả lời qua giao diện thật (bấm đáp án, gõ ô nhập). Rà ở cửa sổ 1100px và ở bề rộng điện thoại 375px. Chưa rà trên điện thoại thật và chưa nghe thử tiếng: phần đó Khang thử.

| # | Mục | Kết quả |
|---|---|---|
| 1 | Console không lỗi; 5 tab mở được | Đạt. Không có lỗi JavaScript. Chỉ có 404 `favicon.ico` (có từ trước). |
| 2 | Hôm nay tối đa 4 deck, thứ tự, dòng giải thích | Đạt: `2108` (+3, trễ 2d), `1708`, `2008` (+7, trễ 2d), mới `2208`; dòng "Đã quá 3 ngày chưa có deck mới nên mở 1 deck mới dù còn bài ôn". |
| 3 | Hai mục gập, nút "Học thêm" | Đạt: "Đang chờ thêm (1)" = `1608`; "Kho deck mới (3)" = `3108`, `0209`, `1109`. |
| 4 | Lật hết flashcard deck đang chờ | Đạt: deck và `activity` hôm nay không đổi gì. |
| 5 | Học hết một deck mới | Đạt: `2208` thành "✓ xong hôm nay", mốc 1, `anchor = startedAt = 13/11`, ôn kế 14/11, streak 0 → 1. |
| 6 | Học mẻ 7 thẻ của deck 25 thẻ | Đạt: deck chưa xong, Kết quả ghi "Còn 18 thẻ chưa đúng lần nào hôm nay". Học tiếp 3 mẻ 7 nữa (18 → 11 → 4 → 0) thì xong Ngày 1. |
| 7 | Kiểm tra deck ôn, đạt KPI | Đạt: `2108` +3 → +7, `anchor` dời 2 ngày (08/11 → 10/11), ôn kế 17/11, rời danh sách chờ, streak được tính. |
| 8 | Kiểm tra deck ôn, cố tình trượt | Đạt: `1708` (đang phục hồi) lùi +7 → +3, hẹn 14/11; `2008` (bỏ cờ phục hồi để thử) đứng yên trong hàng chờ; cả hai đều tính lượt. |

Thử thêm ngoài checklist:
- Thi lại deck đã xong hôm nay: không đổi mốc, chỉ thêm một dòng lịch sử.
- Tải lại trang sau khi học: Hôm nay giữ nguyên, các trường mới (`startedAt`, `history[].mode/stage`, `activity[day].by/d/a`) còn đủ.
- Streak đang nguy (dữ liệu giả 21 ngày rồi lỡ hôm qua): banner đỏ + nút "Dùng băng"; bấm xong đổi thành "Đã dùng băng: cần 1 lượt hôm nay"; làm 1 lượt thì streak 21 → 22, hết băng. Không băng: làm 2 lượt thì 5 → 6.
- Dòng nhịp học: "Chưa đủ dữ liệu để tính nhịp (cần 3 ngày)" với file thật; với dữ liệu giả ra "Nhịp hiện tại 0,9 lượt/ngày → từ mới cứ 6 ngày một lần. Làm thêm 1 lượt/ngày → 3 ngày một lần."
- 375px: không tràn ngang ở Hôm nay, Học phần, Học, Cài đặt.

**Việc của Khang trước task 1.8 (CHƯA push):**
1. Mở trang thật hiện tại → Cài đặt → Xuất backup, giữ file.
2. Tự thử theo Phụ lục B ở máy (`python -m http.server 5173 --bind 127.0.0.1` trong thư mục `vocab`).
3. Xem 3 chỗ người thực thi tự quyết ở trên: 2 dòng `pullCloud` không có nhãn `FIX 11/11` (task 1.1); xoá `restoreResetDecks` (1.3) và `repairEarlyLearn` (1.6); deck học dở hiện "trễ Nd" (1.6).
4. Trả lời đồng ý thì mới làm task 1.8 (push một lần).

**Khang duyệt (13/11, sau task 1.7)**
- Deck mới ĐÃ HỌC DỞ còn tính là trễ (theo `anchor`) cho tới khi xong Ngày 1 theo luật (c): giữ đúng mục 3.2, không đổi luật. Đã thêm 2 test khoá hành vi này trong `tests/schedule.test.js`. Vì số deck trễ có thể gồm deck mới học dở, chữ dòng cổng đổi từ "deck ôn trễ" thành "deck trễ".
- Giữ 2 dòng `normalize` trong `pullCloud`, đã gắn nhãn `FIX 11/11`.
- Đồng ý xoá `restoreResetDecks` và `repairEarlyLearn`.
- Đồng ý push (task 1.8).

---

## Phụ lục A — Sự thật về file JSON thật (để đối chiếu)

- 8 deck, 175 thẻ, 713 lượt trả lời, học gần nhất 2026-10-10, `settings.kpi = 90`, `journeyStart = '2026-10-06'`.
- Số thẻ từng deck: `1608` 19, `1708` 18, `2008` 25, `2108` 25, `2208` 25, `3108` 28, `0209` 20, `1109` 15. (Đếm tay; nếu lệch thì file JSON đúng, sửa con số ở đây và ghi vào mục 9. Ba khẳng định 8 / 175 / 713 thì KHÔNG được lệch.)
- Deck đã học: `1608` (`anchor` 10-27, `stageIdx` 4), `1708` (11-04, 3), `2008` (11-04, 3), `2108` (11-08, 2); cả bốn có `recovering: true`. Deck chưa học: `2208` (`anchor` 11-11), `3108` (11-12), `0209` (11-13), `1109` (11-14).
- `activity`: 8 ngày; `2026-08-19` là kiểu cũ `true`; tổng theo cách đếm của v1 (`true` = 20) là 873, KHÁC 713 vì v1 đếm cả lần lật flashcard. Hai con số độc lập, không suy cái này từ cái kia.
- 27 bản ghi chiều có `_prevStreak` (3 ở `2008`, 24 ở `2108`).
- Ngày lịch sử Kiểm tra sớm nhất: `1608` 08-31, `1708` 09-02, `2008` 10-06, `2108` 10-08 (nên `lastNew` = 2026-10-08).

## Phụ lục B — Checklist tay Phase 1 (Khang thử trước khi cho push)

Chuẩn bị: trên trang thật hiện tại, Cài đặt → Xuất backup, giữ file. Trong thư mục clone chạy `python -m http.server 5173 --bind 127.0.0.1`, mở `http://127.0.0.1:5173`, Cài đặt → Nhập backup → chọn file vừa xuất. KHÔNG nhập mã đồng bộ.

1. Console không lỗi; 5 tab mở được.
2. Hôm nay hiện tối đa 4 deck; thứ tự hợp lý (deck trễ nặng nhất so với mốc của nó đứng trên); có dòng giải thích vì sao có hoặc không có deck mới.
3. "Đang chờ thêm" và "Kho deck mới" mở ra được, mỗi deck có nút "Học thêm".
4. Lật hết flashcard của một deck đang chờ: deck KHÔNG lên mốc, số câu hôm nay không tăng.
5. Học (Trắc nghiệm + Tự luận) hết một deck mới: deck thành "✓ xong hôm nay", mốc kế là +1, streak được tính.
6. Học một mẻ 7 thẻ của deck mới 25 thẻ: deck CHƯA xong, màn Kết quả nói còn bao nhiêu thẻ.
7. Kiểm tra một deck ôn và đạt KPI: deck lên mốc, biến khỏi danh sách chờ, streak được tính.
8. Kiểm tra một deck ôn và cố tình trượt: deck đang phục hồi thì lùi 1 mốc và hẹn mai; deck thường thì đứng yên; cả hai trường hợp streak vẫn được tính.
9. Làm lại bài Kiểm tra của deck vừa lên mốc trong cùng ngày: không lên mốc lần hai.
10. Số streak và dòng trạng thái đúng với những gì vừa làm; "Chuỗi dài nhất" là 5 với dữ liệu cũ.
11. Đổi giờ máy sang 03:30 sáng hôm sau rồi tải lại: app vẫn coi là "hôm nay"; đổi sang 04:30: sang ngày mới. (Nhớ chỉnh giờ máy lại.)
12. Xuất backup từ bản thử, mở file: vẫn 8 deck, 175 thẻ; các trường cũ còn nguyên.
13. Thu cửa sổ về bề rộng điện thoại: Hôm nay và màn Học dùng được.
