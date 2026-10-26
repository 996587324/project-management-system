import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { parse } from '@vue/compiler-sfc'
import { resolveConfig } from 'vite'

const configA = await resolveConfig({ mode: 'development' }, 'serve')
const configB = await resolveConfig({ mode: 'system-b' }, 'serve')
assert.equal(configA.optimizeDeps.noDiscovery, true)
assert.equal(configB.optimizeDeps.noDiscovery, true)
assert.notEqual(configA.cacheDir, configB.cacheDir, 'A/B dependency caches must be independent')
const included = new Set(configA.optimizeDeps.include)
const imported = new Set<string>()
function add(id: string) {
  if (
    !id.startsWith('.') &&
    !id.startsWith('@/') &&
    !/^@(views|styles|utils|imgs|icons|stores)\//.test(id) &&
    !/\.(css|scss|sass|less|json)$/.test(id)
  )
    imported.add(id)
}
function collect(source: string, file: string) {
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const visit = (node: ts.Node) => {
    if (
      ts.isImportDeclaration(node) &&
      !node.importClause?.isTypeOnly &&
      ts.isStringLiteral(node.moduleSpecifier)
    )
      add(node.moduleSpecifier.text)
    if (
      ts.isExportDeclaration(node) &&
      !node.isTypeOnly &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    )
      add(node.moduleSpecifier.text)
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments[0] &&
      ts.isStringLiteral(node.arguments[0])
    )
      add(node.arguments[0].text)
    ts.forEachChild(node, visit)
  }
  visit(tree)
}
function scan(directory: string) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name)
    if (entry.isDirectory()) scan(file)
    else if (entry.name.endsWith('.vue')) {
      const { descriptor } = parse(readFileSync(file, 'utf8'), { filename: file })
      for (const block of [descriptor.script, descriptor.scriptSetup])
        if (block) collect(block.content, file)
    } else if (/\.[cm]?[jt]sx?$/.test(entry.name) && !entry.name.endsWith('.d.ts'))
      collect(readFileSync(file, 'utf8'), file)
  }
}
scan(path.resolve('src'))
assert.deepEqual(
  [...imported].filter((id) => !included.has(id)),
  [],
  'new browser dependencies must be pre-bundled before disabling discovery'
)
for (const component of [
  'select',
  'tree',
  'date-picker',
  'table',
  'dialog',
  'message',
  'notification'
]) {
  for (const style of ['css', 'index'])
    assert.ok(included.has(`element-plus/es/components/${component}/style/${style}`))
}
console.log(
  `PASS: ${imported.size} source dependency entries covered; injected styles included; runtime discovery disabled; A/B caches isolated.`
)
