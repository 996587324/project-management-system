import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createMemoryHistory, createRouter } from 'vue-router'

// 独立验证，不读取真实用户、JWT，也不向业务后端发送请求。
for (const mode of ['development', 'system-b']) {
  const server = await createServer({ mode, server: { middlewareMode: true } })
  const original = {
    fetch: globalThis.fetch,
    window: globalThis.window,
    create: URL.createObjectURL,
    revoke: URL.revokeObjectURL
  }
  try {
    const resource = await server.ssrLoadModule('/src/utils/user-avatar/resource.ts')
    const api = await server.ssrLoadModule('/src/api/user-profile.ts')
    const { staticRoutes } = await server.ssrLoadModule('/src/router/routes/staticRoutes.ts')
    const router = createRouter({ history: createMemoryHistory(), routes: staticRoutes })
    const profile = router.resolve('/account/profile')
    assert.equal(profile.name, 'PersonalProfile')
    assert.equal(profile.meta.requiresAppLogin, true)
    assert.equal(profile.matched.length, 2)
    const fallback = resource.avatarSrc.value
    const revoked = []
    let serial = 0
    URL.createObjectURL = () => `blob:test-${++serial}`
    URL.revokeObjectURL = (url) => revoked.push(url)
    globalThis.window = { __APP_RUNTIME_CONFIG__: { apiBaseUrl: '/test-proxy' } }
    const image = () => new Response(new Blob(['image'], { type: 'image/png' }), { status: 200 })
    let count = 0
    globalThis.fetch = async (url, options) => {
      count++
      assert.ok(url.startsWith('/test-proxy/api/user-profile/avatar?v='))
      assert.equal(options.headers.Authorization, 'Bearer private-token')
      assert.equal(options.cache, 'no-store')
      assert.ok(!url.includes('private-token'))
      return image()
    }
    await resource.loadAvatar('u1', 'private-token', 'version-1')
    assert.equal(resource.avatarSrc.value, 'blob:test-1')
    await resource.loadAvatar('u1', 'private-token', 'version-1')
    assert.equal(count, 1)
    await resource.loadAvatar('u1', 'private-token', 'version-2')
    assert.ok(revoked.includes('blob:test-1'))
    assert.equal(resource.avatarSrc.value, 'blob:test-2')
    let finishOld
    globalThis.fetch = () =>
      new Promise((resolve) => {
        finishOld = resolve
      })
    const oldRequest = resource.loadAvatar('u1', 'private-token', 'version-3')
    resource.clearAvatar()
    finishOld(image())
    await oldRequest
    assert.equal(resource.avatarSrc.value, fallback)
    globalThis.fetch = async () => new Response(null, { status: 204 })
    await resource.loadAvatar('u2', 'another-token', 'version')
    assert.equal(resource.avatarSrc.value, fallback)
    globalThis.fetch = async () => image()
    await resource.loadAvatar('u2', 'another-token', 'version')
    assert.notEqual(resource.avatarSrc.value, fallback)
    resource.avatarLoadError()
    assert.equal(resource.avatarSrc.value, fallback)
    await resource.loadAvatar('u2', 'another-token', null)
    assert.equal(resource.avatarSrc.value, fallback)
    globalThis.fetch = async (url, options) => {
      assert.equal(url, '/test-proxy/api/user-profile/avatar')
      assert.equal(options.method, 'POST')
      assert.equal(options.headers.Authorization, 'Bearer private-token')
      assert.equal(options.headers['Content-Type'], undefined)
      assert.ok(options.body instanceof FormData)
      assert.equal(options.body.get('file').name, 'avatar.png')
      return Response.json({
        code: 200,
        data: { avatar: '/api/user-profile/avatar?v=key', avatarVersion: 'key' }
      })
    }
    const metadata = await api.requestAvatarMetadata(
      'private-token',
      'upload',
      new File(['image'], 'avatar.png', { type: 'image/png' })
    )
    assert.equal(metadata.avatarVersion, 'key')
    resource.clearAvatar()
    console.log(
      `PASS: ${mode} protected profile layout, default/replacement/reset, late-response isolation, authenticated image and multipart prefix.`
    )
  } finally {
    globalThis.fetch = original.fetch
    globalThis.window = original.window
    URL.createObjectURL = original.create
    URL.revokeObjectURL = original.revoke
    await server.close()
  }
}
process.exit(0)
