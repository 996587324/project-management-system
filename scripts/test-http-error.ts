import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import { ApiStatus } from '../src/utils/http/status'

// 执行真实错误处理模块，替换浏览器的翻译和 UI 依赖。
const compiled = ts.transpileModule(
  readFileSync(new URL('../src/utils/http/error.ts', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS } }
).outputText
const exports: { handleError?: (error: unknown) => never } = {}
runInNewContext(compiled, {
  exports,
  console,
  require: (name: string) => (name === './status' ? { ApiStatus } : { $t: (key: string) => key })
})
function message(status: number, msg: unknown) {
  try {
    exports.handleError!({
      response: { status, data: { msg } },
      config: { url: '/test', method: 'post' }
    })
  } catch (error) {
    return (error as Error).message
  }
}
assert.equal(
  message(400, '请完整配置接入类型、设备及SN/求和字段'),
  '请完整配置接入类型、设备及SN/求和字段'
)
assert.equal(message(409, '配置已修改，请刷新'), '配置已修改，请刷新')
assert.equal(message(404, undefined), 'httpMsg.notFound')
assert.equal(message(400, { error: 'bad' }), 'httpMsg.internalServerError')
assert.equal(message(400, '   '), 'httpMsg.internalServerError')
assert.equal(message(500, 'database details'), 'httpMsg.internalServerError')
console.log(
  'PASS: HTTP business validation errors are shown; empty, malformed and server failures use fallback messages.'
)
