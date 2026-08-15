import {
  readFileSync, writeFileSync, mkdirSync, rmSync, renameSync, existsSync,
  readdirSync, openSync, writeSync, closeSync, chmodSync
} from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { homedir } from 'node:os'

// ---------------------------------------------------------------------------
// Migrate a DeepSeek Harness conversation from another project into this one.
//
// Usage:
//   node scripts/migrate-session.mjs <sessionId> [--to <abs project path>] [options]
//
// Options:
//   --to <path>            target project cwd (default: process.cwd())
//   --keep-source          copy instead of move (WARNING: the harness rejects
//                          duplicate session ids across a root, so a kept
//                          source will break session listing)
//   --include-descendants  also migrate subagent children (parentSession links)
//   --dry-run              print the plan and verify sources without writing
//   --home <path>          DSH home override (default: $DSH_HOME or ~/.dsh)
//
// Why this is needed: the web GUI has no "import conversation" feature
// (only /export, a browser ZIP download). Conversations live per project at
// <DSH_HOME>/sessions/--<encoded-cwd>--/<sessionId>/session.jsonl.zstd, and
// the backend validates that the log's header line (cwd + id) derives the
// transcript path. Migration = move the session directory + rewrite the
// header cwd + re-encode the zstd frames (frame 1 must contain exactly the
// header line; the rest stays verbatim in frame 2+). Attachments live in a
// global content-addressed store and need no copy. After migrating, restart
// the web app so the workspace bootstrap re-groups the session into the
// target project. Verified against the harness's own persistence backend.
// ---------------------------------------------------------------------------

const SESSION_LOG = 'session.jsonl.zstd'

function fail(msg) {
  console.error('[migrate-session] ERROR: ' + msg)
  process.exit(1)
}

function readdirSafe(p) {
  try { return readdirSync(p) } catch { return [] }
}

// projectKey mirrors @deepseek-ai/dsh-session-persistence-jsonl
function projectKey(cwd) {
  if (!cwd.length) fail('empty project path')
  let readable = ''
  let separatorRun = false
  for (let i = 0; i < cwd.length; i++) {
    const code = cwd.charCodeAt(i)
    const ch = String.fromCharCode(code)
    if (ch === '/' || ch === '\\' || ch === ':') {
      if (!separatorRun) readable += '-'
      separatorRun = true
    } else if (ch !== '~' && /^[A-Za-z0-9._-]$/.test(ch)) {
      readable += ch
      separatorRun = false
    } else {
      readable += '~' + code.toString(16).toUpperCase().padStart(4, '0')
      separatorRun = false
    }
  }
  return '--' + (readable.replace(/^-+/, '') || 'root').slice(0, 251) + '--'
}

function encodeSegment(id) {
  // injective escaping of the unvalidated id to one safe path segment
  let out = ''
  for (const ch of id) {
    out += /^[A-Za-z0-9._-]$/.test(ch) ? ch : '~' + ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')
  }
  return out || '~'
}

function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, { encoding: 'utf8', ...opts })
  if (res.status !== 0) {
    fail(cmd + ' ' + args.join(' ') + ' exited ' + res.status + ': ' + (res.stderr || res.stdout || '').trim())
  }
  return res.stdout
}

function parseArgs(argv) {
  const opts = {
    to: process.cwd(), keepSource: false, descendants: false, dryRun: false,
    home: process.env.DSH_HOME || join(homedir(), '.dsh'),
  }
  const ids = []
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--to') opts.to = argv[++i]
    else if (a === '--keep-source') opts.keepSource = true
    else if (a === '--include-descendants') opts.descendants = true
    else if (a === '--dry-run') opts.dryRun = true
    else if (a === '--home') opts.home = argv[++i]
    else if (a.startsWith('--')) fail('unknown option: ' + a)
    else ids.push(a)
  }
  if (!ids.length) fail('missing <sessionId>')
  opts.ids = ids
  return opts
}

function findSessionDir(home, id) {
  const sessionsRoot = join(home, 'sessions')
  if (!existsSync(sessionsRoot)) fail('no sessions root at ' + sessionsRoot)
  const encoded = encodeSegment(id)
  const matches = []
  for (const project of readdirSafe(sessionsRoot)) {
    const dir = join(sessionsRoot, project, encoded)
    if (existsSync(join(dir, SESSION_LOG))) matches.push({ project, dir })
  }
  if (!matches.length) fail('session ' + id + ' not found under ' + sessionsRoot)
  if (matches.length > 1) fail('session ' + id + ' found in multiple project dirs: ' + matches.map(m => m.project).join(', '))
  return matches[0]
}

function readHeaderLine(zstdPath) {
  const text = run('zstd', ['-d', '-c', zstdPath])
  return JSON.parse(text.split('\n', 1)[0])
}

function migrateOne(home, id, targetCwd, keepSource, dryRun) {
  const { project: srcProject, dir: srcDir } = findSessionDir(home, id)
  const srcFile = join(srcDir, SESSION_LOG)
  const header = readHeaderLine(srcFile)
  if (header.id !== id) fail('header id mismatch in ' + srcFile)
  const targetKey = projectKey(targetCwd)
  const targetDir = join(home, 'sessions', targetKey, encodeSegment(id))
  const targetFile = join(targetDir, SESSION_LOG)
  if (existsSync(targetFile)) fail('target already exists: ' + targetFile)

  console.log('session     : ' + id)
  console.log('from project: ' + srcProject + '  (header cwd: ' + header.cwd + ')')
  console.log('to project  : ' + targetKey + '  (' + targetCwd + ')')
  if (dryRun) {
    console.log('[dry-run] no changes written')
    return
  }

  // 1. decompress the full multi-frame log (zstd CLI handles concatenated frames)
  const plain = run('zstd', ['-d', '-c', srcFile])
  const nl = plain.indexOf('\n')
  if (nl < 0) fail('log has no newline after header')
  const headerLine = plain.slice(0, nl)
  const rest = plain.slice(nl + 1)
  const newHeader = JSON.stringify({ ...JSON.parse(headerLine), cwd: targetCwd })

  // 2. encode: frame 1 = exactly the header line + '\n'; frame 2 = rest verbatim
  mkdirSync(targetDir, { recursive: true, mode: 0o700 })
  const tmp = srcFile + '.migrating'
  const hdrFile = tmp + '.hdr'
  const restFile = tmp + '.rest'
  writeFileSync(hdrFile, newHeader + '\n', { mode: 0o600 })
  writeFileSync(restFile, rest, { mode: 0o600 })
  run('zstd', ['-f', '-3', '-o', tmp, hdrFile])
  const restFrame = run('zstd', ['-f', '-3', '-c', restFile])
  const fd = openSync(tmp, 'a')
  writeSync(fd, restFrame)
  closeSync(fd)
  rmSync(hdrFile)
  rmSync(restFile)
  renameSync(tmp, targetFile)
  try { chmodSync(targetFile, 0o600) } catch {}

  // 3. verify roundtrip + header
  const back = run('zstd', ['-d', '-c', targetFile])
  if (back !== newHeader + '\n' + rest) fail('roundtrip verification failed for ' + id)
  const backHeader = JSON.parse(back.split('\n', 1)[0])
  if (backHeader.cwd !== targetCwd || backHeader.id !== id) fail('header verification failed for ' + id)

  // 4. remove source (move semantics: the harness rejects duplicate ids)
  if (keepSource) {
    console.log('source kept at ' + srcFile + '  (WARNING: duplicate id may break session listing)')
  } else {
    rmSync(srcDir, { recursive: true, force: true })
    console.log('source removed: ' + srcDir)
  }
  console.log('migrated     : ' + targetFile)
}

const opts = parseArgs(process.argv.slice(2))
if (!existsSync(opts.to)) fail('target path does not exist: ' + opts.to)
const targetCwd = run('node', ['-e',
  'process.stdout.write(require("node:fs").realpathSync(process.argv[1]))', opts.to]).trim()

const queue = [...opts.ids]
const seen = new Set()
while (queue.length) {
  const id = queue.shift()
  if (seen.has(id)) continue
  seen.add(id)
  migrateOne(opts.home, id, targetCwd, opts.keepSource, opts.dryRun)
  if (opts.descendants) {
    const root = join(opts.home, 'sessions')
    for (const project of readdirSafe(root)) {
      for (const seg of readdirSafe(join(root, project))) {
        const f = join(root, project, seg, SESSION_LOG)
        if (!existsSync(f)) continue
        let h
        try { h = readHeaderLine(f) } catch { continue }
        if (h.parentSession === id && !seen.has(h.id)) queue.push(h.id)
      }
    }
  }
}
console.log('[migrate-session] done: ' + seen.size + ' session(s)')
