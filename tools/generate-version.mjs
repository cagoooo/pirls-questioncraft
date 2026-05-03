// tools/generate-version.mjs
// 在 next build 之前跑一次：把 git sha + 時戳寫進 public/version.json
// 前端 VersionUpdateBanner 會 poll 這個檔案，發現變動就彈更新提示。

import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function gitShortSha() {
  // GitHub Actions 自帶 GITHUB_SHA env，本機跑 git rev-parse
  const fromEnv = process.env.GITHUB_SHA;
  if (fromEnv) return fromEnv.slice(0, 7);
  try {
    return execSync('git rev-parse --short HEAD', { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString().trim();
  } catch {
    return 'local';
  }
}

const sha = gitShortSha();
const builtAt = new Date().toISOString();
// version 字串：YYYYMMDD-sha 格式，使用者一眼可比對
const version = `${builtAt.slice(0, 10).replace(/-/g, '')}-${sha}`;

const payload = { version, sha, builtAt };
writeFileSync(resolve(ROOT, 'public/version.json'), JSON.stringify(payload, null, 2) + '\n');
console.log(`✓ public/version.json → ${version}`);
