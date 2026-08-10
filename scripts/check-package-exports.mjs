import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const packagesRoot = path.join(root, 'packages')
const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
const failures = []

const collectTargets = (value, targets = new Set()) => {
  if (typeof value === 'string') {
    if (value.startsWith('./')) {
      targets.add(value.slice(2))
    }
    return targets
  }
  if (value && typeof value === 'object') {
    for (const nested of Object.values(value)) {
      collectTargets(nested, targets)
    }
  }
  return targets
}

const packageDirs = fs
  .readdirSync(packagesRoot, { withFileTypes: true })
  .filter(entry => entry.isDirectory())
  .map(entry => path.join(packagesRoot, entry.name))
  .sort()

const manifests = packageDirs.map(packageDir => ({
  packageDir,
  manifest: JSON.parse(
    fs.readFileSync(path.join(packageDir, 'package.json'), 'utf8')
  ),
}))
const publishedNames = new Set(
  manifests
    .filter(({ manifest }) => !manifest.private)
    .map(({ manifest }) => manifest.name)
)

for (const { packageDir, manifest } of manifests) {
  if (manifest.private) {
    continue
  }

  const result = spawnSync(
    pnpm,
    ['--dir', packageDir, 'pack', '--dry-run', '--json'],
    { encoding: 'utf8' }
  )
  if (result.status !== 0) {
    failures.push(`${manifest.name}: pnpm pack failed: ${result.stderr.trim()}`)
    continue
  }

  let packResult
  try {
    packResult = JSON.parse(result.stdout)
  } catch {
    failures.push(`${manifest.name}: pnpm pack returned invalid JSON`)
    continue
  }

  const packed = Array.isArray(packResult) ? packResult[0] : packResult
  const packedFiles = new Set(
    (packed?.files ?? []).map(file =>
      typeof file === 'string' ? file : file.path
    )
  )
  const publishedManifest = {
    ...manifest,
    ...(manifest.publishConfig ?? {}),
  }
  const targets = collectTargets({
    main: publishedManifest.main,
    module: publishedManifest.module,
    types: publishedManifest.types,
    exports: publishedManifest.exports,
  })

  for (const target of targets) {
    if (target.startsWith('src/')) {
      failures.push(`${manifest.name}: published entry points at ${target}`)
    } else if (!packedFiles.has(target)) {
      failures.push(`${manifest.name}: packed artifact is missing ${target}`)
    }
  }

  for (const dependency of Object.keys(manifest.dependencies ?? {})) {
    if (dependency.startsWith('@latte-js/') && !publishedNames.has(dependency)) {
      failures.push(
        `${manifest.name}: depends on unpublished workspace ${dependency}`
      )
    }
  }
}

if (failures.length > 0) {
  console.error('Package artifact check failed:')
  for (const failure of failures) {
    console.error(`- ${failure}`)
  }
  process.exit(1)
}

console.log(`Package artifact check passed for ${publishedNames.size} packages.`)
