import { AppRouteRecordRaw } from '@/utils/router'

/**
 * 固定路由配置（公开页面，以及 requiresAppLogin 标识的个人页面）
 *
 * 属性说明：
 * isHideTab: true 表示不在标签页中显示
 *
 * 注意事项：
 * 1、path、name 不要和动态路由冲突，否则会导致路由冲突无法访问
 * 2、requiresAppLogin 页面仍验证当前系统登录，其余页面按公开路由处理
 */
export const staticRoutes: AppRouteRecordRaw[] = [
  {
    path: '/public/hourly-production/:boardCode',
    name: 'PublicHourlyProduction',
    component: () => import('@views/hourly-production/board/index.vue'),
    meta: { title: '小时产量看板', isHideTab: true, isFullPage: true, publicReadOnly: true }
  },
  {
    path: '/account',
    name: 'PersonalAccountLayout',
    redirect: '/account/profile',
    component: () => import('@views/index/index.vue'),
    meta: { title: '个人中心', requiresAppLogin: true },
    children: [
      {
        path: '/account/profile',
        name: 'PersonalProfile',
        component: () => import('@views/system/user-center/index.vue'),
        meta: { title: '个人中心', requiresAppLogin: true }
      }
    ]
  },
  {
    path: '/auth/entry',
    name: 'ApplicationEntry',
    component: () => import('@views/auth/application-entry.vue'),
    meta: { title: '进入系统', isHideTab: true }
  },
  {
    path: '/portal',
    name: 'ApplicationPortal',
    component: () => import('@views/auth/portal/index.vue'),
    meta: { title: '系统控制台', isHideTab: true }
  },
  // 不需要登录就能访问的路由示例
  // {
  //   path: '/welcome',
  //   name: 'WelcomeStatic',
  //   component: () => import('@views/dashboard/console/index.vue'),
  //   meta: { title: 'menus.dashboard.title' }
  // },
  {
    path: '/auth/login',
    name: 'Login',
    component: () => import('@views/auth/login/index.vue'),
    meta: { title: 'menus.login.title', isHideTab: true }
  },
  {
    path: '/auth/register',
    name: 'Register',
    component: () => import('@views/auth/register/index.vue'),
    meta: { title: 'menus.register.title', isHideTab: true }
  },
  {
    path: '/auth/forget-password',
    name: 'ForgetPassword',
    component: () => import('@views/auth/forget-password/index.vue'),
    meta: { title: 'menus.forgetPassword.title', isHideTab: true }
  },
  {
    path: '/public/production-dashboard',
    name: 'PublicProductionDashboard',
    component: () => import('@views/production-dashboard/board/index.vue'),
    meta: {
      title: '生产监控看板',
      isHideTab: true,
      isFullPage: true,
      publicReadOnly: true
    }
  },
  {
    path: '/403',
    name: 'Exception403',
    component: () => import('@views/exception/403/index.vue'),
    meta: { title: '403', isHideTab: true }
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'Exception404',
    component: () => import('@views/exception/404/index.vue'),
    meta: { title: '404', isHideTab: true }
  },
  {
    path: '/500',
    name: 'Exception500',
    component: () => import('@views/exception/500/index.vue'),
    meta: { title: '500', isHideTab: true }
  },
  {
    path: '/outside',
    component: () => import('@views/index/index.vue'),
    name: 'Outside',
    meta: { title: 'menus.outside.title' },
    children: [
      // iframe 内嵌页面
      {
        path: '/outside/iframe/:path',
        name: 'Iframe',
        component: () => import('@/views/outside/Iframe.vue'),
        meta: { title: 'iframe' }
      }
    ]
  }
]
