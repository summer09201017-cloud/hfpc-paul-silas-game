// scripts/pre-push-check.mjs — Claude Code PreToolUse(Bash) hook。
// 只在「這次 Bash 是 git push」時跑 npm test；失敗→exit 2 擋下、其餘一律 exit 0 放行（fail-safe）。
import { execSync } from 'node:child_process'

let raw = ''
process.stdin.on('data', (d) => (raw += d))
process.stdin.on('end', () => {
  let cmd = ''
  try { cmd = JSON.parse(raw)?.tool_input?.command || '' } catch { process.exit(0) }
  if (!/git\s+push/.test(cmd)) process.exit(0) // 不是 push → 放行
  try {
    execSync('npm test', { stdio: 'pipe', cwd: process.env.CLAUDE_PROJECT_DIR || process.cwd() })
    process.exit(0) // 測試綠 → 放行
  } catch (e) {
    console.error('⛔ push 前 npm test 失敗，已擋下這次 push。修好再推。\n' +
      String(e.stdout || e.stderr || e).slice(-800))
    process.exit(2) // exit 2 = 阻止這次工具呼叫
  }
})
// 保險：若沒收到 stdin（理論上不會），1.5s 後放行
setTimeout(() => process.exit(0), 1500)
