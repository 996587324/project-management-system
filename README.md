# 项目管理系统前端

基于 Art Design Pro、Vue 3、Vite、TypeScript、Element Plus 开发的项目管理系统前端。系统面向小型团队项目过程管理，提供工作台、项目详情、任务管理、文件管理、用户权限管理等功能。

## 项目简介

本项目是项目管理系统的前端工程，采用 Art Design Pro 作为基础开发框架，在原有后台管理能力上扩展了项目管理业务模块。

当前主要功能：

- 登录认证：账号密码登录、记住密码、忘记密码入口。
- 工作台：项目统计卡片、项目状态分布、负责人项目统计、近期项目。
- 项目详情：项目新增、编辑、删除、状态维护、负责人检索选择、项目进度展示。
- 任务管理：任务看板、甘特图、任务新增编辑、执行人检索选择、任务状态拖拽、项目进度联动统计。
- 文件管理：按项目分类上传文件、同名替换、文件数量统计、PDF/Word/Excel/CSV 在线预览、下载和删除。
- 系统管理：用户管理、角色管理、菜单管理、权限维护。

## 技术栈

- Vue 3
- Vite 7
- TypeScript
- Pinia
- Vue Router
- Element Plus
- ECharts
- Axios
- Art Design Pro
- xlsx、mammoth 等文件预览相关依赖

## 环境要求

请先安装：

- Node.js `>= 20.19.0`
- pnpm `>= 8.8.0`

检查版本：

```bash
node -v
pnpm -v
```

## 快速开始

进入前端目录：

```bash
cd project-management-system
```

安装依赖：

```bash
pnpm install
```

启动开发环境：

```bash
pnpm dev
```

默认访问地址：

```text
http://localhost:3006/
```

## 常用命令

```bash
# 启动开发服务
pnpm dev

# 类型检查并打包
pnpm build

# 本地预览打包产物
pnpm serve

# 代码检查
pnpm lint

# 自动修复 ESLint 问题
pnpm fix

# 格式化代码
pnpm lint:prettier
```

## 环境变量

通用配置文件：

```text
.env
```
