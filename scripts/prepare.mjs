/**
 * Installs the git hooks -- and never fails the install.
 *
 * `prepare` runs on every `pnpm install`. If it exits non-zero, the whole install
 * fails. That must not happen just because hooks could not be set up: installs from
 * a tarball or a shallow CI checkout have no `.git` directory, and a missing
 * pre-commit hook is an inconvenience, not a broken workspace.
 */
import { spawnSync } from 'node:child_process'
import { delimiter, join } from 'node:path'

const isWindows = process.platform === 'win32'

if (process.env['CI']) {
  console.log('prepare: CI detected, skipping git hook installation')
  process.exit(0)
}

const insideGitRepo =
  spawnSync('git', ['rev-parse', '--git-dir'], { stdio: 'ignore', shell: isWindows }).status === 0

if (!insideGitRepo) {
  console.log('prepare: not a git repository, skipping git hook installation')
  process.exit(0)
}

const result = spawnSync(isWindows ? 'lefthook.cmd' : 'lefthook', ['install'], {
  stdio: 'inherit',
  shell: isWindows,
  env: {
    ...process.env,
    PATH: join(process.cwd(), 'node_modules', '.bin') + delimiter + (process.env['PATH'] ?? ''),
  },
})

if (result.status !== 0) {
  console.warn('prepare: lefthook install did not succeed; git hooks are not active')
}

// Always succeed: hook setup must never block `pnpm install`.
process.exit(0)
