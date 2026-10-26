/**
 * API 接口类型定义模块
 *
 * 提供所有后端接口的类型定义
 *
 * ## 主要功能
 *
 * - 通用类型（分页参数、响应结构等）
 * - 认证类型（登录、用户信息等）
 * - 系统管理类型（用户、角色等）
 * - 全局命名空间声明
 *
 * ## 使用场景
 *
 * - API 请求参数类型约束
 * - API 响应数据类型定义
 * - 接口文档类型同步
 *
 * ## 注意事项
 *
 * - 在 .vue 文件使用需要在 eslint.config.mjs 中配置 globals: { Api: 'readonly' }
 * - 使用全局命名空间，无需导入即可使用
 *
 * ## 使用方式
 *
 * ```typescript
 * const params: Api.Auth.LoginParams = { userName: 'admin', password: '123456' }
 * const response: Api.Auth.UserInfo = await fetchUserInfo()
 * ```
 *
 * @module types/api/api
 * @author Art Design Pro Team
 */

declare namespace Api {
  /** 通用类型 */
  namespace Common {
    /** 分页参数 */
    interface PaginationParams {
      /** 当前页码 */
      current: number
      /** 每页条数 */
      size: number
      /** 总条数 */
      total: number
    }

    /** 通用搜索参数 */
    type CommonSearchParams = Pick<PaginationParams, 'current' | 'size'>

    /** 分页响应基础结构 */
    interface PaginatedResponse<T = any> {
      records: T[]
      current: number
      size: number
      total: number
    }

    /** 启用状态 */
    type EnableStatus = '1' | '2'
  }

  /** 认证类型 */
  namespace Auth {
    /** 登录参数 */
    interface LoginParams {
      userName: string
      password: string
    }

    /** 登录响应 */
    interface LoginResponse {
      token: string
      refreshToken: string
    }

    /** OAuth 2.0 登录公开状态 */
    interface OAuth2Status {
      enabled: boolean
      displayName: string
    }

    /** OAuth 2.0 一次性票据兑换参数 */
    interface OAuth2CompleteParams {
      ticket: string
    }

    /** 修改当前用户密码参数 */
    interface ChangePasswordParams {
      oldPassword: string
      newPassword: string
      confirmPassword?: string
    }

    /** 用户信息 */
    interface UserInfo {
      buttons: string[]
      roles: string[]
      permissionKeys?: string[]
      accountKey?: string
      userId: number
      userName: string
      email: string
      avatar?: string | null
      avatarVersion?: string | null
    }
  }

  /** 工作台类型 */
  namespace Dashboard {
    /** 工作台顶部卡片统计项 */
    interface CardStatsItem {
      id?: number | string
      title?: string
      name?: string
      des?: string
      description?: string
      icon?: string
      unit?: string
      uint?: string
      compareName?: string
      compareLabel?: string
      value?: number | string
      num?: number | string
      total?: number | string
      amount?: number | string
      change?: string
      changeRate?: number | string
      rate?: number | string
      startVal?: number
      duration?: number
    }

    interface SalesTrendPoint {
      name: string
      date: string
      salesAmount: number | string
      quantity: number
      orderCount: number
    }

    interface SalesStatsResponse {
      periodType: string
      periodName: string
      startDate: string
      endDate: string
      salesAmount: number | string
      quantity: number
      orderCount: number
      previousSalesAmount: number | string
      previousQuantity: number
      previousOrderCount: number
      growthRate: number | string
      trend: SalesTrendPoint[]
    }

    type CardStatsListResponse =
      | CardStatsItem[]
      | {
          records?: CardStatsItem[]
          list?: CardStatsItem[]
          data?: CardStatsItem[]
          items?: CardStatsItem[]
        }

    interface CardStatsParams {
      type?: string
      Date?: string
      Year?: number
      Month?: number
      Quarter?: number
      date?: string
      startTime?: string
      endTime?: string
    }

    type CommonParams = CardStatsParams & {
      type?: string
    }

    interface DashboardStatItem {
      name?: string
      title?: string
      label?: string
      num?: number | string
      value?: number | string
    }

    interface ActiveUserResponse {
      title?: string
      xAxisData?: string[]
      xAxisLabels?: string[]
      labels?: string[]
      chartData?: Array<number | string>
      data?: Array<number | string>
      values?: Array<number | string>
      list?: DashboardStatItem[]
      stats?: DashboardStatItem[]
    }

    interface SalesOverviewResponse {
      title?: string
      growthText?: string
      growth?: number | string
      change?: number | string
      xAxisData?: string[]
      xAxisLabels?: string[]
      labels?: string[]
      data?: Array<number | string>
      chartData?: Array<number | string>
      values?: Array<number | string>
    }

    interface NewUserItem {
      id?: number | string
      province?: string
      productName?: string
      name?: string
      outNum?: number | string
      salesNum?: number | string
      saleNum?: number | string
      AllNum?: number | string
      allNum?: number | string
      productionNum?: number | string
      percentage?: number | string
      pro?: number | string
      color?: string
      avatar?: string
    }

    type NewUserResponse =
      | NewUserItem[]
      | {
          title?: string
          growth?: number | string
          change?: number | string
          records?: NewUserItem[]
          list?: NewUserItem[]
          data?: NewUserItem[]
          items?: NewUserItem[]
        }

    interface DynamicStatsItem {
      username?: string
      userName?: string
      type?: string
      action?: string
      target?: string
      content?: string
    }

    type DynamicStatsResponse =
      | DynamicStatsItem[]
      | {
          count?: number | string
          records?: DynamicStatsItem[]
          list?: DynamicStatsItem[]
          data?: DynamicStatsItem[]
          items?: DynamicStatsItem[]
        }

    interface TodoListItem {
      username?: string
      title?: string
      name?: string
      date?: string
      time?: string
      complate?: boolean
      complete?: boolean
      completed?: boolean
      done?: boolean
    }

    type TodoListResponse =
      | TodoListItem[]
      | {
          pending?: number | string
          count?: number | string
          records?: TodoListItem[]
          list?: TodoListItem[]
          data?: TodoListItem[]
          items?: TodoListItem[]
        }
  }

  /** 系统管理类型 */
  namespace ProjectManage {
    type ProjectList = Api.Common.PaginatedResponse<ProjectItem>
    type TaskList = Api.Common.PaginatedResponse<TaskItem>
    type FileList = Api.Common.PaginatedResponse<FileItem>

    interface ProjectItem {
      id: number
      projectCode: string
      projectName: string
      projectType: string
      projectTag?: string
      priority: number
      projectStage: number
      projectStatus: number
      progress: number
      startTime: string
      endTime: string
      managerId: number | string
      managerUserId?: number | string
      managerName?: string
      customerName?: string
      contractCode?: string
      remark?: string
      createTime?: string
      updateTime?: string
      taskCount?: number
      fileCount?: number
    }

    interface ProjectStageOption {
      value: number
      label: string
      sort?: number
    }

    type ProjectSaveParams = Partial<ProjectItem> &
      Pick<
        ProjectItem,
        'projectCode' | 'projectName' | 'projectType' | 'startTime' | 'endTime' | 'managerId'
      >

    interface ProjectImportRow {
      rowIndex: number
      success: boolean
      projectId?: number
      projectCode: string
      projectName: string
      message: string
    }

    interface ProjectImportResult {
      total: number
      createdCount: number
      failedCount: number
      message: string
      rows: ProjectImportRow[]
    }

    type ProjectQueryParams = Partial<
      Pick<
        ProjectItem,
        | 'projectName'
        | 'projectCode'
        | 'projectType'
        | 'projectStatus'
        | 'projectStage'
        | 'managerId'
        | 'managerUserId'
      > &
        Api.Common.CommonSearchParams & {
          startTime?: string
          endTime?: string
        }
    >

    interface TaskItem {
      id: number
      projectId: number | string
      projectName?: string
      parentId: number
      taskName: string
      taskType?: string
      priority: number
      progress: number
      taskStatus: number
      executorId: number | string
      startTime: string
      endTime: string
      sort?: number
      remark?: string
      createTime?: string
      updateTime?: string
      children?: TaskItem[]
    }

    interface TaskParentOption {
      id: number
      label: string
      level: number
      projectName?: string
    }

    interface TaskTypeOption {
      id: number
      label: string
      value: string
      sort?: number
    }

    type TaskSaveParams = Partial<TaskItem> &
      Pick<
        TaskItem,
        'projectId' | 'parentId' | 'taskName' | 'progress' | 'executorId' | 'startTime' | 'endTime'
      >

    type TaskQueryParams = Partial<
      Pick<TaskItem, 'projectId' | 'parentId' | 'taskStatus' | 'executorId' | 'taskName'> &
        Api.Common.CommonSearchParams
    >

    interface FileItem {
      id: number
      projectId: number
      taskId?: number
      fileName: string
      fileSuffix: string
      fileSize: number
      filePath: string
      folderType: string
      uploadUserId: number
      createTime?: string
    }

    type FileQueryParams = Partial<
      Pick<FileItem, 'projectId' | 'taskId' | 'folderType' | 'fileName'> &
        Api.Common.CommonSearchParams
    >

    interface DashboardStats {
      totalProjects: number
      pendingProjects: number
      runningProjects: number
      delayedProjects: number
      finishedProjects: number
      pausedProjects: number
      archivedProjects: number
      averageProgress: number
      pendingTasks: number
      finishedTasks: number
      projectStatusDistribution?: ProjectStatusStat[]
      managerProjectStatusStats?: ManagerProjectStatusStat[]
      recentProjects: ProjectItem[]
      todoTasks: TaskItem[]
    }

    interface ProjectStatusStat {
      status: number
      label: string
      value: number
      color?: string
    }

    interface ManagerProjectStatusStat {
      managerId: number | string
      managerName: string
      pendingProjects: number
      runningProjects: number
      finishedProjects: number
      totalProjects: number
    }
  }

  namespace Agent {
    type ConversationList = Api.Common.PaginatedResponse<Conversation>

    interface StartRequest {
      agentCode?: string
      userId?: number | string
      title?: string
      scopeProjectName?: string
      mode?: 'Chat' | 'Work' | 'Online'
    }

    interface SendRequest {
      agentCode?: string
      conversationId?: number
      message: string
      userId?: number | string
      scopeProjectName?: string
      mode?: 'Chat' | 'Work' | 'Online'
      autoExecute?: boolean
      attachmentType?: 'project-csv'
      attachmentName?: string
      attachmentContent?: string
    }

    interface StreamProgress {
      stage: string
      message: string
      conversationId?: number
    }

    interface ConfirmRequest {
      toolCallId?: number
      userId?: number | string
      remark?: string
    }

    interface Conversation {
      id: number
      agentCode: string
      userId: string
      title: string
      scopeProjectName?: string
      mode: string
      status: string
      createTime: string
      updateTime?: string
    }

    interface Message {
      id: number
      conversationId: number
      role: 'user' | 'assistant' | string
      content: string
      createTime: string
    }

    interface PlanStep {
      sort: number
      title: string
      description: string
      toolName: string
      requiresConfirmation: boolean
    }

    interface ToolCall {
      id: number
      conversationId: number
      agentCode: string
      toolName: string
      toolTitle: string
      requestJson: string
      responseJson: string
      status: string
      requiresConfirmation: boolean
      confirmed: boolean
      createTime: string
    }

    interface ToolDefinition {
      agentCode: string
      name: string
      title: string
      description: string
      isWriteAction: boolean
      requiresConfirmation: boolean
      enabled?: boolean
    }

    interface Response {
      conversationId: number
      reply: string
      plan: PlanStep[]
      toolCalls: ToolCall[]
      requiresConfirmation: boolean
      suggestions: string[]
    }

    interface ConversationDetail {
      conversation: Conversation
      messages: Message[]
      toolCalls: ToolCall[]
    }

    interface EmailDraftRequest {
      conversationId?: number
      sourceToolCallId?: number
      userId?: number | string
      subject?: string
      content?: string
    }

    interface EmailDraft {
      subject: string
      body: string
      conversationId?: number
      sourceToolCallId?: number
    }

    interface EmailSendRequest {
      recipientUserIds: string[]
      ccUserIds: string[]
      idempotencyKey: string
      confirm: boolean
      conversationId?: number
      sourceToolCallId?: number
      userId?: number | string
      subject: string
      body: string
    }

    interface EmailSendResult {
      taskId: number
      status: string
      success: boolean
      message: string
      toEmails: string[]
      ccEmails: string[]
      sendTime?: string | null
    }
  }

  namespace SystemManage {
    /** 用户列表 */
    type UserList = Api.Common.PaginatedResponse<UserListItem>

    /** 用户列表项 */
    interface UserListItem {
      id?: number | string
      userId?: number | string
      avatar?: string
      status?: string | boolean
      userName: string
      userGender?: string
      nickName?: string
      userPhone?: string
      userEmail?: string
      email?: string
      userRoles?: string[]
      roles?: string[]
      roleNames?: string
      enabled?: boolean
      permissionKeys?: string[]
      createBy?: string
      createTime: string
      updateBy?: string
      updateTime?: string
    }

    /** 用户搜索参数 */
    type UserSearchParams = Partial<
      Pick<UserListItem, 'id' | 'userName' | 'userGender' | 'userPhone' | 'userEmail' | 'status'> &
        Api.Common.CommonSearchParams & {
          keyword?: string
          nickName?: string
          roleCode?: string
          enabled?: boolean
        }
    >

    /** 角色列表 */
    type RoleList = Api.Common.PaginatedResponse<RoleListItem>

    /** 角色列表项 */
    interface RoleListItem {
      roleId: number
      roleName: string
      roleCode: string
      description: string
      permissionKeys?: string
      permissionKeyList?: string[]
      enabled: boolean
      createTime: string
      updateTime?: string
    }
    type RoleSaveParams = Partial<RoleListItem> & Pick<RoleListItem, 'roleName' | 'roleCode'>
    //路由信息
    interface MenuFormData {
      id: number | string
      name: string
      path: string
      label: string
      component: string
      icon: string
      isEnable: boolean
      sort: number
      isMenu: boolean
      keepAlive: boolean
      isHide: boolean
      isHideTab: boolean
      link: string
      isIframe: boolean
      showBadge: boolean
      showTextBadge: string
      fixedTab: boolean
      activePath: string
      roles: string[]
      isFullPage: boolean
      authName: string
      authLabel: string
      authIcon: string
      authSort: number
      action: string
    }

    /** 角色搜索参数 */
    type RoleSearchParams = Partial<
      Pick<RoleListItem, 'roleId' | 'roleName' | 'roleCode' | 'description' | 'enabled'> &
        Api.Common.CommonSearchParams
    >

    /** 登录账户权限列表 */
    type AccountPermissionList = Api.Common.PaginatedResponse<AccountPermissionItem>

    /** 登录账户权限列表项 */
    interface AccountPermissionItem {
      id?: number | string
      userId?: number | string
      userName: string
      nickName?: string
      userEmail?: string
      email?: string
      roles: string[]
      roleNames?: string
      permissionKeys?: string[]
      menuIds?: Array<number | string>
      enabled?: boolean
      status?: string | boolean
      createTime?: string
      updateTime?: string
    }

    /** 登录账户权限保存参数 */
    type AccountPermissionSaveParams = Partial<AccountPermissionItem> & {
      password?: string
      roleCodes?: string[]
      menuKeys?: string[]
    }

    /** 登录账户权限搜索参数 */
    type AccountPermissionSearchParams = Partial<
      Pick<AccountPermissionItem, 'userId' | 'userName' | 'nickName' | 'enabled' | 'status'> &
        Api.Common.CommonSearchParams & {
          roleCode?: string
          startTime?: string
          endTime?: string
        }
    >

    /** 商品列表 */
    type ProductList = Api.Common.PaginatedResponse<ProductListItem>

    /** 商品列表项 */
    interface ProductListItem {
      productId?: number | string
      id?: number | string
      productName: string
      productCode: string
      price: number
      capacity?: number
      unit: string
      category: string
      description?: string
      isActive: boolean
      createTime?: string
      updateTime?: string
    }

    /** 商品保存参数 */
    type ProductSaveParams = Partial<ProductListItem> &
      Pick<ProductListItem, 'productName' | 'productCode'>

    /** 商品搜索参数 */
    type ProductSearchParams = Partial<
      Pick<ProductListItem, 'productName' | 'productCode' | 'category' | 'isActive'> &
        Api.Common.CommonSearchParams & {
          startTime?: string
          endTime?: string
        }
    >
  }
}
