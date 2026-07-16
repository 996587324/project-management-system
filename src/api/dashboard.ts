import request from '@/utils/http'

// 获取工作台顶部卡片统计
export function fetchDashboardCardList(params?: Api.Dashboard.CardStatsParams) {
  return request.get<Api.Dashboard.SalesStatsResponse>({
    url: '/api/Dashboard/GetCardList',
    params,
    showErrorMessage: false
  })
}

// 获取工作台一周营业额
export function fetchDashboardActiveUser(params?: Api.Dashboard.CommonParams) {
  return request.get<Api.Dashboard.ActiveUserResponse>({
    url: '/api/Dashboard/GetActiveUser',
    params,
    showErrorMessage: false
  })
}

// 获取工作台年销售量
export function fetchDashboardSalesOverview(params?: Api.Dashboard.CommonParams) {
  return request.get<Api.Dashboard.SalesOverviewResponse>({
    url: '/api/Dashboard/GetSalesOverview',
    params,
    showErrorMessage: false
  })
}

// 获取工作台商品销售/生产统计
export function fetchDashboardNewUser(params?: Api.Dashboard.CommonParams) {
  return request.get<Api.Dashboard.NewUserResponse>({
    url: '/api/Dashboard/GetNewUser',
    params,
    showErrorMessage: false
  })
}

// 获取工作台动态列表
export function fetchDashboardDynamicStats(params?: Api.Dashboard.CommonParams) {
  return request.get<Api.Dashboard.DynamicStatsResponse>({
    url: '/api/Dashboard/GetDynamicStats',
    params,
    showErrorMessage: false
  })
}

// 获取工作台待办列表
export function fetchDashboardTodoList(params?: Api.Dashboard.CommonParams) {
  return request.get<Api.Dashboard.TodoListResponse>({
    url: '/api/Dashboard/GetTodoList',
    params,
    showErrorMessage: false
  })
}
