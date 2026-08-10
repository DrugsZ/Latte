import { spawnSync } from 'node:child_process'

const isWindows = process.platform === 'win32'
const browserChannel = process.env.PLAYWRIGHT_CHANNEL ?? 'chromium'
const shouldInstallBundledChromium = browserChannel === 'chromium'

const steps = [
  {
    label: 'License metadata',
    command: 'pnpm',
    args: ['run', 'licenses:check'],
  },
  {
    label: 'Lint',
    command: 'pnpm',
    args: ['run', 'lint'],
  },
  {
    label: 'Type check',
    command: 'pnpm',
    args: ['run', 'type-check'],
  },
  {
    label: 'Unit tests',
    command: 'pnpm',
    args: ['run', 'test'],
  },
  {
    label: 'Workspace build',
    command: 'pnpm',
    args: ['run', 'build'],
  },
  {
    label: 'Package artifacts',
    command: 'pnpm',
    args: ['run', 'packages:check'],
  },
  {
    label: 'Security audit',
    command: 'pnpm',
    args: ['run', 'security:check'],
  },
  ...(shouldInstallBundledChromium
    ? [
        {
          label: 'Playwright browser install',
          command: 'pnpm',
          args: [
            'exec',
            'playwright',
            'install',
            '--with-deps',
            '--no-shell',
            'chromium',
          ],
        },
      ]
    : []),
  {
    label: 'Browser smoke / e2e',
    command: 'pnpm',
    args: ['run', 'e2e'],
  },
  {
    label: 'Diff whitespace check',
    command: 'git',
    args: ['diff', '--check'],
  },
]

function executable(command) {
  if (isWindows && command === 'pnpm') {
    return 'pnpm.cmd'
  }
  return command
}

function formatDuration(ms) {
  return `${(ms / 1000).toFixed(1)}s`
}

const startedAt = Date.now()

console.log('[release-gate] Starting release gate')

for (const [index, step] of steps.entries()) {
  const stepStartedAt = Date.now()
  const commandLine = [step.command, ...step.args].join(' ')

  console.log('')
  console.log(`[release-gate] ${index + 1}/${steps.length}: ${step.label}`)
  console.log(`[release-gate] $ ${commandLine}`)

  const result = spawnSync(executable(step.command), step.args, {
    stdio: 'inherit',
  })

  if (result.error) {
    console.error('')
    console.error(`[release-gate] Failed to start: ${commandLine}`)
    console.error(result.error.message)
    process.exit(1)
  }

  if (result.status !== 0) {
    console.error('')
    console.error(
      `[release-gate] Failed at step ${index + 1}/${steps.length}: ${
        step.label
      }`
    )
    process.exit(result.status ?? 1)
  }

  console.log(
    `[release-gate] Completed ${step.label} in ${formatDuration(
      Date.now() - stepStartedAt
    )}`
  )
}

console.log('')
console.log(
  `[release-gate] Passed in ${formatDuration(Date.now() - startedAt)}`
)
