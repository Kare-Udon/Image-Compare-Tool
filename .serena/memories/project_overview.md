# 项目概览
- 目的：纯前端本地照片对比工具，使用 File System Access API + localStorage/IndexedDB，实现组内图片的导入、A/B 对比与本地持久化，不依赖后端或上传。
- 技术栈：React + TypeScript + Vite；样式在 App.css/index.css；依赖管理用 pnpm。
- 结构：按职责拆分 `src/components`（布局等通用组件）、`src/features`（groups/images/compare 等功能）、`src/hooks`、`src/lib`（底层封装）、`src/types`（领域模型）。实现计划详见 `IMPLEMENTATION.md`；阶段推进记录在 `IMPLEMENTATION_PLAN.md`。
- 当前进度：已完成三栏布局骨架与基础文档（Milestone 1-2 目录、UI 骨架）。类型定义已在 `src/types/index.ts`。