import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()

const packageLicenses = new Map([
  ['@latte-js/art', 'AGPL-3.0-or-later'],
  ['@latte-js/barista', 'AGPL-3.0-or-later'],
  ['@latte-js/bean', 'MIT'],
  ['@latte-js/counter', 'AGPL-3.0-or-later'],
  ['@latte-js/crema', 'AGPL-3.0-or-later'],
  ['@latte-js/espresso', 'AGPL-3.0-or-later'],
  ['@latte-js/kit', 'MIT'],
  ['@latte-js/milk', 'MIT'],
  ['@latte-js/syrup', 'MIT'],
  ['@latte-js/cafe', 'UNLICENSED'],
])

const licenseMarkers = new Map([
  ['AGPL-3.0-or-later', 'GNU AFFERO GENERAL PUBLIC LICENSE'],
  ['MIT', 'MIT License'],
])

const packageJsonPaths = [
  ...fs.readdirSync(path.join(root, 'packages')).map(name =>
    path.join(root, 'packages', name, 'package.json')
  ),
  path.join(root, 'apps', 'cafe', 'package.json'),
].filter(file => fs.existsSync(file))

const failures = []

for (const packageJsonPath of packageJsonPaths) {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
  const expectedLicense = packageLicenses.get(packageJson.name)

  if (!expectedLicense) {
    failures.push(`${packageJson.name}: missing license policy`)
    continue
  }

  if (packageJson.license !== expectedLicense) {
    failures.push(
      `${packageJson.name}: expected package.json license ` +
        `${expectedLicense}, got ${packageJson.license ?? '(missing)'}`
    )
  }

  if (expectedLicense === 'UNLICENSED') {
    continue
  }

  const licensePath = path.join(path.dirname(packageJsonPath), 'LICENSE')
  if (!fs.existsSync(licensePath)) {
    failures.push(`${packageJson.name}: missing LICENSE file`)
    continue
  }

  const marker = licenseMarkers.get(expectedLicense)
  const text = fs.readFileSync(licensePath, 'utf8')
  if (marker && !text.includes(marker)) {
    failures.push(
      `${packageJson.name}: LICENSE text does not look like ${expectedLicense}`
    )
  }
}

if (failures.length > 0) {
  console.error('License check failed:')
  for (const failure of failures) {
    console.error(`- ${failure}`)
  }
  process.exit(1)
}

console.log('License check passed.')
