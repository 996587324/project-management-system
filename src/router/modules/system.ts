import { AppRouteRecord } from '@/types/router'

export const systemRoutes: AppRouteRecord = {
  path: '/system',
  name: 'System',
  component: '/index/index',
  meta: {
    title: 'menus.system.title',
    icon: 'ri:user-3-line',
    roles: ['R_SUPER', 'R_ADMIN']
  },
  children: [
    {
      path: 'user',
      name: 'User',
      component: '/system/user',
      meta: {
        title: 'menus.system.user',
        keepAlive: true,
        roles: ['R_SUPER', 'R_ADMIN']
      }
    },
    {
      path: 'role',
      name: 'Role',
      component: '/system/role',
      meta: {
        title: 'menus.system.role',
        keepAlive: true,
        roles: ['R_SUPER', 'R_ADMIN']
      }
    },
    {
      path: 'user-activity',
      name: 'UserActivity',
      component: '/system/user-activity',
      meta: {
        title: '用户行为日志',
        keepAlive: true,
        roles: ['R_SUPER', 'R_ADMIN']
      }
    },
    {
      path: 'user-center',
      name: 'UserCenter',
      component: '/system/user-center',
      meta: {
        title: 'menus.system.userCenter',
        isHide: true,
        keepAlive: true,
        isHideTab: true
      }
    },
    {
      path: 'menu',
      name: 'Menus',
      component: '/system/menu',
      meta: {
        title: 'menus.system.menu',
        keepAlive: true,
        roles: ['R_SUPER'],
        authList: [
          { title: '新增', authMark: 'add' },
          { title: '编辑', authMark: 'edit' },
          { title: '删除', authMark: 'delete' }
        ]
      }
    },
    {
      path: 'project-manage',
      name: 'SystemProjectManage',
      component: '/index/index',
      meta: {
        title: '项目协作',
        icon: 'ri:kanban-view-2-line',
        roles: ['R_SUPER', 'R_ADMIN', 'R_ENGINEER']
      },
      children: [
        {
          path: 'dashboard',
          name: 'ProjectDashboard',
          component: '/dashboard/console',
          meta: {
            title: '项目仪表盘',
            keepAlive: true,
            roles: ['R_SUPER', 'R_ADMIN', 'R_ENGINEER']
          }
        },
        {
          path: 'project',
          name: 'ProjectLedger',
          component: '/projectmanage/project',
          meta: {
            title: '项目台账',
            keepAlive: true,
            roles: ['R_SUPER', 'R_ADMIN', 'R_ENGINEER'],
            authList: [
              { title: '新增项目', authMark: 'Create' },
              { title: '批量导入', authMark: 'Import' },
              { title: '下载模板', authMark: 'Template' },
              { title: '编辑项目', authMark: 'Update' },
              { title: '变更状态', authMark: 'Status' },
              { title: '删除项目', authMark: 'Delete' }
            ]
          }
        },
        {
          path: 'task',
          name: 'TaskBoard',
          component: '/projectmanage/task',
          meta: {
            title: '任务视图',
            keepAlive: true,
            roles: ['R_SUPER', 'R_ADMIN', 'R_ENGINEER'],
            authList: [
              { title: '新增任务', authMark: 'Create' },
              { title: '编辑任务', authMark: 'Update' },
              { title: '变更状态', authMark: 'Status' },
              { title: '删除任务', authMark: 'Delete' }
            ]
          }
        },
        {
          path: 'file',
          name: 'ProjectFile',
          component: '/projectmanage/file',
          meta: {
            title: '项目文件库',
            keepAlive: true,
            roles: ['R_SUPER', 'R_ADMIN', 'R_ENGINEER'],
            authList: [
              { title: '上传文件', authMark: 'Upload' },
              { title: '在线预览', authMark: 'Preview' },
              { title: '下载文件', authMark: 'Download' },
              { title: '删除文件', authMark: 'Delete' }
            ]
          }
        }
      ]
    }
  ]
}
