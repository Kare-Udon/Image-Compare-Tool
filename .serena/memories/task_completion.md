# 完成任务前检查
- 确认代码能编译：运行 `pnpm run build`（必要时先 `pnpm install`）。
- 确认 lint 通过：`pnpm run lint`。
- 新增功能需添加并运行对应测试（若无现成测试需补充后执行）。
- 更新文档：同步 README.md（中文）与 AGENTS.md（英文要点），保持里程碑/阶段计划一致。
- 自检变更：确保符合目录分层与单一职责，没有引入后端或上传逻辑。
- 提交说明：使用清晰消息描述“为何改动”，关联 IMPLEMENTATION_PLAN 阶段。