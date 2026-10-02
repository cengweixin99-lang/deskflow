# DeskFlow 架构说明

本文记录当前已经落地的工程边界。它用于帮助开发者和 Coding Agent 判断代码应放在哪里，不是未来架构的预先设计。

## 设计原则

- 保持 Electron 主进程、preload 桥接层和 React 渲染进程的安全边界。
- 按已经形成的产品功能组织较大的前端模块；小型共享界面继续放在 `components`。
- 共享类型和跨功能状态逻辑保持集中，只有在规模和职责明显增长后再拆分。
- 不为可能出现的需求预建目录、抽象层、状态库或测试框架。

## 当前目录

```text
electron/
├── main.cjs
├── preload.cjs
├── browser-view.cjs
├── network.cjs
└── state-store.cjs

src/
├── components/
│   ├── Sidebar.tsx
│   └── Sidebar.css
├── features/
│   ├── tasks/
│   ├── focus/
│   ├── review/
│   └── reader/
├── hooks/useDeskFlow.ts
├── lib/state.ts
├── styles/
├── App.tsx
├── App.css
├── env.d.ts
├── main.tsx
└── types.ts

tests/
├── feeds.cjs
├── focus-sessions.mjs
├── focus-timer.mjs
├── daily-records.mjs
├── daily-reflections.mjs
├── daily-stats.mjs
├── reading-actions.mjs
├── review-timeline.mjs
├── state-migration.cjs
├── state-store.cjs
├── task-dates.mjs
└── task-focus-history.mjs
```

## Electron 主进程

- `electron/main.cjs`：应用和窗口生命周期、默认状态、持久化写入队列、IPC 注册。
- `electron/preload.cjs`：通过 `contextBridge` 暴露最小化的 `window.desktop` API。
- `electron/browser-view.cjs`：`WebContentsView` 创建、导航、重试、尺寸和销毁。
- `electron/network.cjs`：HTTP/HTTPS URL 校验、订阅文本请求、响应大小限制和字符集解码。
- `electron/state-store.cjs`：存档校验、备份读取和原子写入。

新增系统能力时，先在对应模块实现并进行运行时校验，再由 `main.cjs` 注册 IPC，最后通过 `preload.cjs` 暴露必要接口。不得在渲染进程直接启用 Node.js。

## React 渲染进程

- `src/App.tsx`：顶层页面组合、导航、回顾日期协调和跨功能入口，不承载底层解析或持久化实现。
- `src/components/`：跨功能或应用外壳组件。当前只有侧栏符合这个边界。
- `src/features/tasks/`：任务列表、日历和任务编辑相关组件。
- `src/features/focus/`：专注计时相关组件。
- `src/features/review/`：每日回顾页面，以及按本地日期派生记录概览、统计、专注趋势、行动时间轴和更新个人回顾的逻辑。
- `src/features/reader/`：订阅阅读界面以及订阅发现、解析和分页逻辑。
- `src/hooks/useDeskFlow.ts`：当前应用状态与主要操作入口。保持现状，只有出现可独立测试且职责清晰的领域逻辑时再逐步拆分。
- `src/lib/state.ts`：跨功能的状态默认值、归一化和迁移。
- `src/types.ts`：跨功能共享的领域类型和日期工具。
- `src/styles/`：全局基础样式和跨组件共享样式。

功能私有组件、样式和纯逻辑放在对应 `features/<feature>/` 内。只有被多个功能实际复用后，才提升到 `components`、`hooks` 或 `lib`，不要提前创建公共抽象。

## 测试

当前测试数量较少，继续使用扁平的 `tests/`：

- `tests/feeds.cjs`：订阅发现、解析、分页和合并回归测试。
- `tests/focus-sessions.mjs`：专注记录创建、实际投入和补充文字更新测试。
- `tests/focus-timer.mjs`：专注计时的时间戳推进、暂停恢复、持久化归一化和完成边界测试。
- `tests/daily-records.mjs`：回顾日期边界和任务、专注、回顾记录概览测试。
- `tests/daily-reflections.mjs`：每日回顾的输入校验、单日更新和撤销恢复测试。
- `tests/daily-stats.mjs`：计划完成率、实际专注时长和提前结束记录的派生统计测试。
- `tests/focus-trends.mjs`：当天、本周和本月专注趋势的本地日期分桶、未来日期和异常记录测试。
- `tests/reading-actions.mjs`：文章打开事件的文章与订阅源快照测试。
- `tests/review-timeline.mjs`：任务计划、专注和阅读行动的日期筛选与时间排序测试。
- `tests/state-migration.cjs`：存档版本迁移、活动计时恢复和异常值过滤测试。
- `tests/state-store.cjs`：主进程存档读取、备份恢复和写入测试。
- `tests/task-dates.mjs`：任务创建日下限和异常日期的业务规则测试。
- `tests/task-focus-history.mjs`：任务关联专注记录的筛选、累计与时间排序测试。

测试规模尚不需要镜像源码目录。新增测试时优先按被测模块命名；只有单一领域出现多个测试文件后，再为该领域建立子目录。

## 暂不拆分

- 不创建 `.agents/`；当前 `AGENTS.md` 足以承载全仓库规则，本文件负责架构细节。
- 不拆分 `src/types.ts`、`src/lib/state.ts` 或 `src/hooks/useDeskFlow.ts`，直到它们出现稳定且可独立维护的领域边界。
- 不增加路径别名、barrel 文件、状态管理库或新的测试框架。
- 不把每个组件都变成独立目录；组件与同名样式并列即可。
