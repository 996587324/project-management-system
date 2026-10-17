import assert from 'node:assert/strict'
import { transformWithEsbuild } from 'vite'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { parse, compileScript } from 'vue/compiler-sfc'
import { createRenderer, nextTick, reactive } from 'vue'
const testRequire = createRequire(import.meta.url)
const { ElMessageBox } = testRequire('element-plus')

// 无浏览器、无真实接口：直接验证组件状态、选择、拖动和确认后的修改行为。
const renderer = createRenderer({
  createElement: () => ({}),
  createText: () => ({}),
  createComment: () => ({}),
  insert() {},
  remove() {},
  setText() {},
  setElementText() {},
  parentNode: () => null,
  nextSibling: () => null,
  patchProp() {}
})

const file = 'src/views/process-board/components/ProcessFlow.vue'
const { descriptor } = parse(await readFile(file, 'utf8'), { filename: file })
const script = compileScript(descriptor, { id: 'process-flow-test' })
const compiled = await transformWithEsbuild(script.content, 'process-flow-test.ts', {
  loader: 'ts',
  format: 'cjs'
})
const module = { exports: {} }
new Function('require', 'module', 'exports', compiled.code)(testRequire, module, module.exports)

for (const mode of ['A', 'B']) {
  const originalConfirm = ElMessageBox.confirm
  let app
  try {
    const component = module.exports.default
    const definition = reactive({
      id: 1,
      flow: [
        { id: 'a', name: '工序 A', x: 0, y: 0, cardId: 11 },
        { id: 'b', name: '工序 B', x: 220, y: 0 },
        { id: 'c', name: '工序 C', x: 440, y: 0 }
      ],
      edges: [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'c' }
      ]
    })
    const cards = [{ id: 11, name: '参数卡片' }]
    const cardEvents = []
    app = renderer.createApp(
      { ...component, render: () => null },
      { modelValue: definition, cards, editable: true, onCard: (id) => cardEvents.push(id) }
    )
    const vm = app.mount({})
    const state = vm.$.setupState
    assert.equal(typeof state.openNode, 'function')
    const capture = []
    state.canvas = {
      setPointerCapture: (id) => capture.push(id),
      hasPointerCapture: (id) => capture.includes(id),
      releasePointerCapture: (id) => capture.splice(capture.indexOf(id), 1)
    }

    state.startNode({ button: 0, pointerId: 1, clientX: 10, clientY: 10 }, definition.flow[0])
    assert.equal(state.selectedNodeId, 'a')
    assert.equal(capture.length, 0, 'single/double click must not capture to SVG root')
    state.move({ pointerId: 1, clientX: 12, clientY: 10 })
    assert.equal(capture.length, 0)
    state.move({ pointerId: 1, clientX: 30, clientY: 20 })
    assert.deepEqual(capture, [1])
    assert.equal(definition.flow[0].x, 20)
    state.finish()
    assert.equal(capture.length, 0)

    state.editSelected()
    assert.equal(state.nodeDialog, true)
    state.nodeForm.name = '  修改后的工序  '
    state.nodeForm.cardId = undefined
    state.saveNode()
    assert.equal(definition.flow[0].name, '修改后的工序')
    assert.equal(definition.flow[0].cardId, null)
    state.openNode(definition.flow[0])
    state.nodeForm.name = '  '
    state.saveNode()
    assert.equal(state.nodeDialog, true)
    assert.ok(state.nodeError)
    assert.equal(definition.flow[0].name, '修改后的工序')

    state.selectEdge(definition.edges[0])
    state.editSelected()
    assert.equal(state.edgeDialog, true)
    state.edgeForm.to = 'c'
    state.saveEdge()
    assert.deepEqual({ ...definition.edges[0] }, { from: 'a', to: 'c' })
    state.openEdge(definition.edges[0])
    state.edgeForm.from = 'b'
    state.edgeForm.to = 'c'
    state.saveEdge()
    assert.ok(state.edgeError, 'duplicate edge must be rejected')
    assert.equal(state.edgeDialog, true)
    assert.equal(definition.edges[0].from, 'a')

    ElMessageBox.confirm = async () => {
      throw new Error('cancel')
    }
    await state.removeEdge(definition.edges[0])
    assert.equal(definition.edges.length, 2, 'cancel must retain edge')
    ElMessageBox.confirm = async () => 'confirm'
    await state.removeEdge(definition.edges[0])
    assert.equal(definition.edges.length, 1)

    definition.edges.push({ from: 'a', to: 'b' })
    state.from = 'b'
    state.to = 'c'
    state.selectNode(definition.flow[1])
    await state.deleteSelected()
    assert.deepEqual(
      definition.flow.map((node) => node.id),
      ['a', 'c']
    )
    assert.equal(definition.edges.length, 0, 'delete node removes all touching edges')
    assert.equal(cards.length, 1, 'associated parameter card must not be deleted')
    assert.equal(state.from, '')
    assert.equal(state.to, 'c')

    // 切换只读时，已打开弹窗不能继续写入，单击不能出现修改选中态。
    vm.$.props.editable = false
    await nextTick()
    assert.equal(state.nodeDialog, false)
    assert.equal(state.edgeDialog, false)
    assert.equal(state.selectedNodeId, '')
    state.nodeForm.id = 'a'
    state.nodeForm.name = '越权修改'
    state.saveNode()
    state.addNode()
    state.from = 'a'
    state.to = 'c'
    state.addEdge()
    await state.removeNode('a')
    assert.equal(definition.flow.length, 2)
    assert.equal(definition.flow[0].name, '修改后的工序')
    assert.equal(definition.edges.length, 0)
    definition.flow[0].cardId = 11
    state.openNode(definition.flow[0])
    assert.deepEqual(cardEvents, [11], 'read-only double click still opens associated card')
    console.log(
      `PASS: ${mode} flow selection, editing, edge validation, drag capture, confirmed deletion and read-only guards`
    )
  } finally {
    ElMessageBox.confirm = originalConfirm
    app?.unmount()
  }
}
process.exit(0)
