import type { AppRouteRecord } from '@/types/router'

export const workTaskRoutes: AppRouteRecord = {
  path: '/work-tasks',
  name: 'WorkTasks',
  component: '/index/index',
  meta: { title: '工作任务', icon: 'ri:task-line' },
  children: [
    {
      path: 'overview',
      name: 'WorkTasksOverview',
      component: '/work-tasks/overview',
      meta: { title: '任务总览', keepAlive: false }
    },
    {
      path: 'my',
      name: 'WorkTasksMy',
      component: '/work-tasks/my',
      meta: { title: '我的工作', keepAlive: false }
    },
    {
      path: 'team',
      name: 'WorkTasksTeam',
      component: '/work-tasks/team',
      meta: { title: '团队工作', keepAlive: false }
    },
    {
      path: 'settings',
      name: 'WorkTasksSettings',
      component: '/work-tasks/settings',
      meta: { title: '工作设置', keepAlive: false }
    },
    {
      path: 'keys',
      name: 'WorkTasksKeys',
      component: '/work-tasks/keys',
      meta: { title: '个人MCP连接', keepAlive: false }
    }
  ]
}
