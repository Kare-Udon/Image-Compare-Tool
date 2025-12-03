# 代码与协作约定
- 语言：文档与注释使用中文，AGENTS.md 保持英文简洁。
- 工具：依赖与脚本使用 pnpm，避免生成 package-lock；保持现有目录结构和单一职责。
- 设计原则：本地优先，不引入后端或上传；使用 File System Access API + localStorage/IndexedDB；小步提交，遵循 `IMPLEMENTATION_PLAN.md` 阶段目标。
- 代码风格：ESLint（@eslint/js + typescript-eslint + react-hooks/react-refresh）；TypeScript 严格模式（tsconfig 默认）；组件/逻辑按功能拆分，避免大杂烩。
- 文档同步：每次功能变更后更新 README.md 与 AGENTS.md（英文），保持 milestone 状态。
- 测试：新增功能需补测试并用 pnpm 运行；暂未有现成测试脚本。