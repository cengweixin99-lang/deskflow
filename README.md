# DeskFlow

DeskFlow 是一个本地优先的个人工作台，用 Electron + React + TypeScript 构建，包含待办清单、番茄钟和 RSS 阅读流。订阅源、文章阅读状态和收藏保存在本机，不依赖账号和云服务。

## 运行项目

需要 Node.js 18 或更高版本。

```bash
npm install
npm run dev
```

`npm run dev` 会同时启动 Vite 开发服务器和 Electron 窗口。修改 `src` 下的 React 文件时，页面会自动刷新；修改 `electron` 下的主进程文件时，需要重启开发命令。

## 你正在学习的 Electron 结构

- `electron/main.cjs`：主进程。使用 Electron 生态中更常见的 CommonJS，负责创建窗口、读写本地文件、发送系统通知。
- `electron/preload.cjs`：安全桥梁。使用 CommonJS，向页面暴露存档、订阅拉取、系统通知和内嵌浏览器控制接口。
- `src/main.tsx`：渲染进程入口，只负责挂载 React 根节点。
- `src/App.tsx`：页面组合层，连接状态 hook 和业务组件。
- `src/components/`：侧栏、任务区、专注卡片、日历等独立 UI 模块。
- `src/hooks/useDeskFlow.ts`：任务持久化、任务操作和专注计时状态。
- `src/types.ts`：任务、视图和计时器的共享类型。
- `src/env.d.ts`：TypeScript 类型声明，包括 `window.desktop` 的 preload API。
- `tsconfig.json`：TypeScript 严格类型检查配置。
- `src/styles.css`：界面样式。
- `vite.config.js`：开发服务器和生产构建配置。

## 建议的学习顺序

1. 先在 `src/components/TaskSection.tsx` 里修改任务标题和颜色，熟悉 React 组件。
2. 阅读 `addTask`、`toggleTask` 和 `deleteTask`，理解事件如何更新状态。
3. 阅读 `src/hooks/useDeskFlow.ts`，理解状态如何从界面组件中分离出来。
4. 阅读 `electron/preload.cjs` 和 `electron/main.cjs`，理解为什么文件读写放在主进程，页面只通过 IPC 调用。
5. 给任务增加截止日期或备注，并同步更新 `types.ts` 和对应组件。
6. 再考虑搜索、快捷键、托盘菜单、自动启动和安装包。

任务列表中的“全部 / 待完成 / 已完成”是同一页面内的筛选，不会切换页面。

任务支持编辑标题、优先级、日期和复盘记录，也可以直接规划未来日期的任务。日历会标记有任务的日期，选择日期可查看当天任务，再选择任务可编辑完整任务信息。

“聚焦”支持输入网站地址并自动发现 RSS/Atom 订阅，也可以直接输入订阅链接。文章支持未读筛选、搜索和收藏；选择文章后会在应用内打开网页。

本地存档带有版本号，旧版数据会在加载时迁移。保存时先写入临时文件，再原子替换正式存档，并保留上一份有效数据作为 `.bak` 备份。连续状态变化会合并后再写入，减少不必要的磁盘操作。

识别到 WordPress 订阅源时，刷新会通过 `paged` 加载历史文章，每次最多请求 30 页、合并 300 篇。空页、重复页或后续页返回 HTTP 404 时停止；网络或解析错误会提示刷新失败，并保留已有文章。普通 RSS/Atom 仍只请求订阅源提供的内容。已有文章的已读和收藏状态会保留。

分页回归检查：`npm run test:feeds`。使用真实博客验证：`node tests/feeds.cjs --live`（会请求 sinyalee.com 的公开 RSS，测试使用独立的临时目录，不修改应用存档）。

## 构建生产资源

```bash
npm run build
```

检查 TypeScript 类型：

```bash
npm run typecheck
```

生产资源会输出到 `dist`。当前项目已经能加载生产页面；发布安装包时，可以继续加入 `electron-builder`，并配置 Windows、macOS 或 Linux 的打包目标。
