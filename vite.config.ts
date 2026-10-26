import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import { fileURLToPath } from 'url'
import { existsSync, readdirSync } from 'node:fs'
//import vueDevTools from 'vite-plugin-vue-devtools'
import viteCompression from 'vite-plugin-compression'
import Components from 'unplugin-vue-components/vite'
import AutoImport from 'unplugin-auto-import/vite'
import ElementPlus from 'unplugin-element-plus/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import tailwindcss from '@tailwindcss/vite'
// import { visualizer } from 'rollup-plugin-visualizer'

export default ({ mode }: { mode: string }) => {
  const root = process.cwd()
  const env = loadEnv(mode, root)
  const systemB = mode === 'system-b'
  const { VITE_VERSION, VITE_PORT, VITE_BASE_URL, VITE_API_PROXY_URL, VITE_WS_PROXY_URL } = env

  return defineConfig({
    define: {
      __APP_VERSION__: JSON.stringify(VITE_VERSION),
      'import.meta.env.VITE_APP_CODE': JSON.stringify(systemB ? 'B' : 'A')
    },
    base: VITE_BASE_URL,
    // A/B 会同时运行，不能让不同 define 配置相互覆盖依赖缓存。
    cacheDir: path.resolve(root, 'node_modules/.vite', systemB ? 'system-b' : 'system-a'),
    server: {
      port: Number(VITE_PORT),
      proxy: {
        '/api': {
          target: VITE_API_PROXY_URL,
          changeOrigin: true
        },
        '/ws': {
          target: VITE_WS_PROXY_URL || VITE_API_PROXY_URL,
          changeOrigin: true,
          ws: true
        }
      },
      host: true
    },
    // 路径别名
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
        '@views': resolvePath('src/views'),
        '@imgs': resolvePath('src/assets/images'),
        '@icons': resolvePath('src/assets/icons'),
        '@utils': resolvePath('src/utils'),
        '@stores': resolvePath('src/store'),
        '@styles': resolvePath('src/assets/styles')
      }
    },
    build: {
      target: 'es2015',
      outDir: systemB ? 'dist-b' : 'dist',
      chunkSizeWarningLimit: 2000,
      minify: 'terser',
      terserOptions: {
        compress: {
          // 生产环境去除 console
          drop_console: true,
          // 生产环境去除 debugger
          drop_debugger: true
        }
      },
      dynamicImportVarsOptions: {
        warnOnError: true,
        exclude: [],
        include: ['src/views/**/*.vue']
      }
    },
    plugins: [
      {
        name: 'system-b-entry',
        transformIndexHtml(html) {
          const tagged = html.replace('<html>', `<html data-application="${systemB ? 'B' : 'A'}">`)
          return systemB
            ? tagged.replace('<title>智能制造管理系统</title>', '<title>正在加载…</title>')
            : tagged
        }
      },
      vue(),
      tailwindcss(),
      // 自动按需导入 API
      AutoImport({
        imports: ['vue', 'vue-router', 'pinia', '@vueuse/core'],
        dts: 'src/types/import/auto-imports.d.ts',
        resolvers: [ElementPlusResolver()],
        eslintrc: {
          enabled: true,
          filepath: './.auto-import.json',
          globalsPropValue: true
        }
      }),
      // 自动按需导入组件
      Components({
        dts: 'src/types/import/components.d.ts',
        resolvers: [ElementPlusResolver()]
      }),
      // 按需定制主题配置
      ElementPlus({
        useSource: true
      }),
      // 压缩
      viteCompression({
        verbose: false, // 是否在控制台输出压缩结果
        disable: false, // 是否禁用
        algorithm: 'gzip', // 压缩算法
        ext: '.gz', // 压缩后的文件名后缀
        threshold: 10240, // 只有大小大于该值的资源会被处理 10240B = 10KB
        deleteOriginFile: false // 压缩后是否删除原文件
      })
      //  vueDevTools()
      // 打包分析
      // visualizer({
      //   open: true,
      //   gzipSize: true,
      //   brotliSize: true,
      //   filename: 'dist/stats.html' // 分析图生成的文件名及路径
      // }),
    ],
    // 启动时完成依赖预构建，禁止首次进入懒加载页面时重新优化并整页刷新。
    optimizeDeps: {
      noDiscovery: true,
      include: [
        'vue',
        'vue-router',
        'pinia',
        'pinia-plugin-persistedstate',
        'vue-i18n',
        '@vue/reactivity',
        '@vueuse/core',
        '@element-plus/icons-vue',
        '@iconify/vue',
        '@wangeditor/editor',
        '@wangeditor/editor-for-vue',
        'axios',
        'mitt',
        'nprogress',
        'ohash',
        'qrcode.vue',
        'vue-draggable-plus',
        'highlight.js',
        'mammoth/mammoth.browser',
        'three',
        'three/examples/jsm/controls/OrbitControls.js',
        'three/examples/jsm/controls/TransformControls.js',
        'three/examples/jsm/postprocessing/EffectComposer.js',
        'three/examples/jsm/postprocessing/OutlinePass.js',
        'three/examples/jsm/postprocessing/RenderPass.js',
        'echarts',
        'echarts/core',
        'echarts/charts',
        'echarts/components',
        'echarts/renderers',
        'xlsx',
        'xgplayer',
        'crypto-js',
        'file-saver',
        'vue-img-cutter',
        'element-plus',
        'element-plus/es',
        'element-plus/es/locale/lang/en',
        'element-plus/es/locale/lang/zh-cn',
        ...elementPlusStyleEntries(root)
      ]
    },
    css: {
      preprocessorOptions: {
        // sass variable and mixin
        scss: {
          additionalData: `
            @use "@styles/core/el-light.scss" as *; 
            @use "@styles/core/mixin.scss" as *;
          `
        }
      },
      postcss: {
        plugins: [
          {
            postcssPlugin: 'internal:charset-removal',
            AtRule: {
              charset: (atRule) => {
                if (atRule.name === 'charset') {
                  atRule.remove()
                }
              }
            }
          }
        ]
      }
    }
  })
}

function resolvePath(paths: string) {
  return path.resolve(__dirname, paths)
}

function elementPlusStyleEntries(root: string): string[] {
  const components = path.resolve(root, 'node_modules/element-plus/es/components')
  // 自动导入插件在页面转换后才补入样式引用，启动扫描看不到这些依赖。
  // 枚举真实入口；无扩展名的通配符在当前包导出规则下没有覆盖这些文件。
  return readdirSync(components, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) =>
      ['css', 'index']
        .filter((style) => existsSync(path.join(components, entry.name, 'style', `${style}.mjs`)))
        .map((style) => `element-plus/es/components/${entry.name}/style/${style}`)
    )
    .sort()
}
