import request from '@/utils/http'
import { AppRouteRecord } from '@/types/router'

// 获取用户列表
export function fetchGetUserList(params: Api.SystemManage.UserSearchParams) {
  var item = request.get<Api.SystemManage.UserList>({
    url: '/api/UserInfo/GetUserPage',
    params
  })
  return item
}

// 获取角色列表
export function fetchGetRoleList(params: Api.SystemManage.RoleSearchParams) {
  return request.get<Api.SystemManage.RoleList>({
   // url: '/api/role/list',
   url: '/api/Role/GetRolePage',
    params
  })
}

// 获取菜单列表
export function fetchGetMenuList() {
  var item = request.get<AppRouteRecord[]>({
   // url: '/api/v3/system/menus/simple'
      url: 'api/Menu/GetMenuTree'
  });
  return item
}

//新增路由信息
export function fetchSetMenu(params:any) {
  var item = request.post<AppRouteRecord>({
    url: '/api/Menu/AddMenu',
    params: params
    // showSuccessMessage: true // 显示成功消息
    // showErrorMessage: false // 不显示错误消息
  });

  return item;
}

//新增路由信息
export function fetchEditMenu(params:any) {
  var item = request.post<AppRouteRecord>({
    url: '/api/Menu/UpdateMenu',
    params: params
    // showSuccessMessage: true // 显示成功消息
    // showErrorMessage: false // 不显示错误消息
  });

  return item;
}


// 新增商品数据
export function fetchDeleteMenu(menuId: number | string) {
  return request.post({
    url: `/api/Menu/DeleteMenu?menuId=${encodeURIComponent(String(menuId))}`
  })
}

export function createRole(params: Api.SystemManage.RoleSaveParams) {
  return request.post({
    url: '/api/Role/CreateRole',
    params
  })
}

export function updateRole(params: Api.SystemManage.RoleSaveParams) {
  return request.post({
    url: '/api/Role/UpdateRole',
    params
  })
}

export function deleteRole(roleId: number | string) {
  return request.post({
    url: '/api/Role/DeleteRole',
    data: { roleId },
    showErrorMessage: false
  })
}

export function getRolePermission(roleId: number | string) {
  return request.get<Api.SystemManage.RoleListItem>({
    url: '/api/Role/GetRolePermission',
    params: { roleId }
  })
}

export function saveRolePermission(params: { roleId: number | string; roleCode?: string; permissionKeys: string[] }) {
  return request.post({
    url: '/api/Role/SaveRolePermission',
    params
  })
}

export function createBusinessBill(params: any) {
  var item =request.post({
    url: '/api/BusinessBill/Create',
    params: params
  })
  return item
}

// 修改商品数据
export function updateBusinessBill(params: any) {
  return request.post({
    url: '/api/BusinessBill/Update',
    params: params
  })
}

// 删除商品数据
export function deleteBusinessBill(id: number) {
  return request.post({
    url: `/api/BusinessBill/Delete?id=${encodeURIComponent(id)}`
  })
}

// 获取某个商品数据
export function getBusinessBillDetail(id: number) {
  return request.get({
    url: '/api/BusinessBill/Detail',
    params: { id }
  })
}

// 获取全部商品数据列表
export function getBusinessBillList() {
  return request.get({
    url: '/api/BusinessBill/List'
  })
}

// 分页查询单据商品数据
export function getBusinessBillPage(params: any) {
  return request.post({
    url: '/api/BusinessBill/Page',
    params: params
  })
}

// 获取商品分页列表
export function fetchGetProductPage(params: Api.SystemManage.ProductSearchParams) {
  return request.post<Api.SystemManage.ProductList>({
    url: '/api/Product/Page',
    params
  })
}

// 获取全部商品列表
export function fetchGetProductList(params?: Api.SystemManage.ProductSearchParams) {
  return request.get<Api.SystemManage.ProductListItem[]>({
    url: '/api/Product/List',
    params
  })
}

// 新增商品
export function createProduct(params: Api.SystemManage.ProductSaveParams) {
  return request.post<Api.SystemManage.ProductListItem>({
    url: '/api/Product/Create',
    params
  })
}

// 修改商品
export function updateProduct(params: Api.SystemManage.ProductSaveParams) {
  return request.post<Api.SystemManage.ProductListItem>({
    url: '/api/Product/Update',
    params
  })
}

// 删除商品
export function deleteProduct(id: number | string) {
  return request.post({
    url: '/api/Product/Delete',
    params: { id }
  })
}

// 批量导入商品
export function importProducts(params: Api.SystemManage.ProductSaveParams[]) {
  return request.post({
    url: '/api/Product/Import',
    params
  })
}

// 获取登录账户/用户权限分页列表
export function fetchGetAccountPermissionPage(params: Api.SystemManage.AccountPermissionSearchParams) {
  return request.get<Api.SystemManage.AccountPermissionList>({
    url: '/api/UserInfo/GetUserPage',
    params
  })
}

// 新增登录账户权限
export function createAccountPermission(params: Api.SystemManage.AccountPermissionSaveParams) {
  return request.post({
    url: '/api/UserInfo/AddUser',
    params
  })
}

// 修改登录账户权限
export function updateAccountPermission(params: Api.SystemManage.AccountPermissionSaveParams) {
  return request.post({
    url: '/api/UserInfo/UpdateUser',
    params
  })
}

// 删除登录账户权限
export function deleteAccountPermission(id: number | string) {
  return request.post({
    url: '/api/UserInfo/DeleteUser',
    params: { id }
  })
}

// 获取某个登录账户的权限详情
export function getAccountPermissionDetail(id: number | string) {
  return request.get<Api.SystemManage.AccountPermissionItem>({
    url: '/api/UserInfo/GetUserPermission',
    params: { id }
  })
}

// 保存登录账户菜单权限
export function saveAccountPermission(params: Api.SystemManage.AccountPermissionSaveParams) {
  return request.post({
    url: '/api/UserInfo/SaveUserPermission',
    params
  })
}


