# 智能制造管理系统前端

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

开发环境配置：

```text
.env.development
```

生产环境配置：

```text
.env.production
```

核心变量说明：

| 变量                    | 说明                  | 示例                     |
| ----------------------- | --------------------- | ------------------------ |
| `VITE_VERSION`          | 前端版本号            | `3.0.1`                  |
| `VITE_PORT`             | 开发服务端口          | `3006`                   |
| `VITE_BASE_URL`         | 前端部署基础路径      | `/`                      |
| `VITE_API_URL`          | 前端请求基础路径      | `/`                      |
| `VITE_API_PROXY_URL`    | Vite 开发代理后端地址 | `http://localhost:8089/` |
| `VITE_ACCESS_MODE`      | 权限模式              | `backend`                |
| `VITE_WITH_CREDENTIALS` | 是否携带 Cookie       | `false`                  |

开发环境通常配置：

```env
VITE_API_URL = /
VITE_API_PROXY_URL = http://localhost:8089/
```

如果后端部署在服务器，例如：

```text
http://10.148.201.223:8087/
```

则开发环境可配置：

```env
VITE_API_PROXY_URL = http://10.148.201.223:8087/
```

生产环境通常让前端请求 `/api`，再由 IIS 或 Nginx 反向代理到后端：

```env
VITE_API_URL = /
```

## 接口代理说明

开发环境中，Vite 会将 `/api` 请求代理到 `.env.development` 中的 `VITE_API_PROXY_URL`。

示例：

```text
前端请求：/api/auth/login
代理到：http://localhost:8089/api/auth/login
```

生产环境部署到 IIS 或 Nginx 时，Vite 代理不会生效，需要在 Web 服务器中配置反向代理。

例如 IIS 中需要将：

```text
/api/*
```

转发到后端服务地址：

```text
http://后端IP:后端端口/api/*
```

Agent 对话使用 WebSocket，还需要将同源地址 `/ws/agent` 转发到后端的 `/ws/agent`。IIS 服务器需安装并启用“WebSocket 协议”，URL Rewrite/ARR 规则必须保留 `Upgrade` 和 `Connection` 请求头；HTTPS 页面应使用 `wss://`，浏览器会自动按当前页面协议连接。

```text
前端连接：wss://前端域名/ws/agent
转发到：ws://后端IP:后端端口/ws/agent
```

否则登录、项目管理、文件上传等接口可能出现 `405 Method Not Allowed`、`404 Not Found` 或跨域问题。

## 打包部署

执行打包：

```bash
pnpm build
```

打包产物目录：

```text
dist
```

将 `dist` 目录发布到 IIS、Nginx 或其它静态资源服务器。

部署注意事项：

- 如果部署在站点根目录，`VITE_BASE_URL=/`。
- 如果部署在子目录，例如 `/project/`，需要设置 `VITE_BASE_URL=/project/` 后重新打包。
- 生产环境需要配置 `/api` 反向代理到后端服务。
- Vue Router 使用 hash 路由，访问地址通常为 `http://域名/#/xxx`。

## 目录结构

```text
project-management-system
├── public                  # 静态资源
├── src
│   ├── api                 # 接口请求
│   ├── assets              # 图片、图标、样式资源
│   ├── components          # 公共组件
│   ├── config              # 系统配置
│   ├── enums               # 枚举
│   ├── hooks               # 通用 hooks
│   ├── router              # 路由
│   ├── store               # Pinia 状态管理
│   ├── types               # 类型声明
│   ├── utils               # 工具函数
│   └── views
│       ├── dashboard       # 工作台
│       ├── projectmanage   # 项目管理模块
│       │   ├── project     # 项目详情
│       │   ├── task        # 任务管理
│       │   └── file        # 文件管理
│       └── system          # 系统管理
├── .env
├── .env.development
├── .env.production
├── package.json
└── vite.config.ts
```

## 项目管理模块说明

### 项目详情

路径：

```text
src/views/projectmanage/project/index.vue
```

主要能力：

- 项目分页查询
- 项目名称、编号、状态、负责人筛选
- 新增项目
- 编辑项目
- 删除项目
- 快速变更项目状态
- 负责人远程检索
- 项目进度展示

### 任务管理

路径：

```text
src/views/projectmanage/task/index.vue
```

主要能力：

- 按项目筛选任务
- 看板视图
- 甘特图视图
- 新增任务
- 编辑任务
- 删除任务
- 拖拽更新任务状态
- 执行人远程检索选择
- 任务完成后联动项目进度统计

### 文件管理

路径：

```text
src/views/projectmanage/file/index.vue
```

主要能力：

- 左侧项目树
- 项目树伸缩
- 按项目筛选文件
- 文件名称搜索
- 按项目上传文件
- 同项目同名文件自动替换
- 文件在线预览
- 文件下载
- 文件删除
- 读取后端 `uploads/{项目名称}` 目录文件数量

支持在线预览格式：

- PDF
- Word：主要支持 `.docx`
- Excel：`.xls`、`.xlsx`
- CSV

## 后端接口

后端 Swagger 地址：

```text
http://10.148.201.223:8087/swagger/index.html
```

项目管理相关接口统一前缀：

```text
/api/ProjectManage
```

主要接口：

- `/api/ProjectManage/dashboard`
- `/api/ProjectManage/projects`
- `/api/ProjectManage/tasks`
- `/api/ProjectManage/files`

详细接口说明可查看项目根目录文档：

```text
../docs/项目管理后端接口文档.md
```

## Gitee 使用说明

首次提交到 Gitee：

```bash
git init
git add .
git commit -m "init project management frontend"
git remote add origin https://gitee.com/你的账号/你的仓库.git
git push -u origin master
```

如果 Gitee 默认分支是 `main`：

```bash
git branch -M main
git push -u origin main
```

建议不要提交以下目录：

```text
node_modules
dist
```

如需忽略，请确认 `.gitignore` 中包含：

```gitignore
node_modules
dist
.DS_Store
*.local
```

## 常见问题

### 1. 登录接口 405 或 404

通常是生产环境未正确配置 `/api` 反向代理。开发环境使用 Vite 代理，生产环境必须由 IIS/Nginx 转发到后端。

### 2. 页面打开后接口请求到了前端端口

检查 `.env.production` 中的 `VITE_API_URL`，以及 Web 服务器的反向代理配置。

### 3. 文件上传成功但左侧数量不变

文件管理左侧数量读取后端 `uploads/{项目名称}` 目录下的实际文件数量。请确认：

- 上传时已选择项目。
- 后端服务有 `uploads` 目录写入权限。
- 项目名称和后端目录名称一致。

### 4. Word 文件无法在线预览

当前主要支持 `.docx` 在线解析，旧版 `.doc` 建议下载后查看，或转换为 `.docx`。

## 相关链接

- Art Design Pro 文档：https://www.artd.pro/docs/zh/
- Vue 官方文档：https://cn.vuejs.org/
- Vite 官方文档：https://cn.vite.dev/
- Element Plus 文档：https://element-plus.org/zh-CN/
