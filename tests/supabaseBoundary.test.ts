import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import test from 'node:test'

const sourceRoot = join(process.cwd(), 'src')
const allowedRoot = join(sourceRoot, 'api', 'supabase')

const sourceFiles = (directory: string): string[] => readdirSync(directory).flatMap((name) => {
  const path = join(directory, name)
  return statSync(path).isDirectory() ? sourceFiles(path) : /\.tsx?$/.test(name) ? [path] : []
})

test('Supabase client calls stay behind the API boundary', () => {
  const violations = sourceFiles(sourceRoot)
    .filter((path) => !path.startsWith(allowedRoot))
    .filter((path) => /\bsupabase\s*\.|createClient\s*\(/.test(readFileSync(path, 'utf8')))
    .map((path) => relative(process.cwd(), path))

  assert.deepEqual(violations, [])
})
