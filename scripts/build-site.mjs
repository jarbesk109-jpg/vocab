// Dựng thư mục _site/ cho GitHub Pages (PLAN.md task 2.2):
//   _site/        v1 ĐÓNG BĂNG: index.html, app.js, logic/ lấy từ tag ghi trong file V1_TAG
//   _site/v2/     bản build của v2 (chạy `npm run build` trước, ra dist/)
// v1 lấy từ TAG chứ không lấy từ thư mục làm việc, nên sửa logic/ trong Phase 2 không đụng tới v1 đang chạy.
// Dùng chung cho GitHub Actions và máy mình: `npm run build && npm run site`.

import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const V1_PATHS = ['index.html', 'app.js', 'logic'];
const OUT = '_site';
const DIST = 'dist';

const git = (...args) => execFileSync('git', args, { maxBuffer: 64 * 1024 * 1024 });
const fail = (msg) => {
  console.error('LỖI: ' + msg);
  process.exit(1);
};

const tag = readFileSync('V1_TAG', 'utf8').trim();
if (!/^[\w.-]+$/.test(tag)) fail(`V1_TAG không hợp lệ: "${tag}"`);
try {
  git('rev-parse', '--verify', '--quiet', `refs/tags/${tag}^{commit}`);
} catch {
  fail(`không thấy tag "${tag}" (trên GitHub Actions cần checkout với fetch-depth: 0 để có tag)`);
}
if (!existsSync(join(DIST, 'index.html'))) fail(`chưa có ${DIST}/index.html: chạy "npm run build" trước`);

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

// v1: từng file đúng như trong tag (đọc thẳng từ Git, không qua thư mục làm việc)
const files = git('ls-tree', '-r', '--name-only', '-z', tag, '--', ...V1_PATHS)
  .toString('utf8')
  .split('\0')
  .filter(Boolean);
for (const file of files) {
  const dest = join(OUT, file);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, git('show', `${tag}:${file}`));
}

// v2
cpSync(DIST, join(OUT, 'v2'), { recursive: true });
writeFileSync(join(OUT, '.nojekyll'), '');

for (const must of ['index.html', 'app.js', 'logic/index.js', 'v2/index.html']) {
  if (!existsSync(join(OUT, must))) fail(`thiếu ${OUT}/${must}`);
}
const commit = git('rev-parse', '--short', `${tag}^{commit}`).toString().trim();
console.log(`_site/ xong: v1 từ tag ${tag} (${commit}, ${files.length} file) ở /, v2 ở /v2/`);
