// 列出相对上游基线的自有改动文件，供每次同步上游后逐项核对，避免合并时丢功能
// 用法：node scripts/fork-files.ts [输出文件] [上游 ref，默认 upstream/master]
import { execFileSync } from 'child_process'
import { writeFileSync } from 'fs'

const OUT_PATH = process.argv[2]
const UPSTREAM_REF = process.argv[3] ?? 'upstream/master'

function git(args: string[]): string {
  return execFileSync('git', args, { encoding: 'utf-8' }).trim()
}

const STATUS_TEXT: Record<string, string> = {
  A: '新增',
  M: '修改',
  D: '删除',
  R: '重命名',
  C: '复制'
}

const mergeBase = git(['merge-base', 'HEAD', UPSTREAM_REF])
const changedFiles = git(['diff', '--name-status', `${mergeBase}..HEAD`])
  .split('\n')
  .filter(Boolean)

const rows = changedFiles.map((line) => {
  const columns = line.split('\t')
  const file = columns[columns.length - 1]
  const upstreamCommits = Number(
    git(['rev-list', '--count', `${mergeBase}..${UPSTREAM_REF}`, '--', file])
  )
  return {
    status: STATUS_TEXT[columns[0][0]] ?? columns[0],
    file,
    upstream: upstreamCommits > 0 ? `${upstreamCommits} 次` : '-'
  }
})

const output = [
  '# Fork 自有改动清单',
  '',
  `基线：\`${UPSTREAM_REF}\` 与 HEAD 的合并点 \`${mergeBase.slice(0, 7)}\``,
  `生成时间：${new Date().toISOString()}`,
  '',
  '「上游是否也改过」= 同一基线上游改动该文件的提交数，数字越大，合并时越需要逐行核对。',
  '',
  '| 状态 | 文件 | 上游是否也改过 |',
  '|---|---|---|',
  ...rows.map((row) => `| ${row.status} | \`${row.file}\` | ${row.upstream} |`)
].join('\n')

if (OUT_PATH) {
  writeFileSync(OUT_PATH, `${output}\n`)
  console.log(`wrote ${OUT_PATH}: ${rows.length} files`)
} else {
  console.log(output)
}
