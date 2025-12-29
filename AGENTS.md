# Agent Notes
- Commands: build `pnpm build`, tests `pnpm test`, lint `pnpm run lint`.
- Vite 7 with Vitest 2: keep `vitest.config.d.ts` (adds `test` field typing) and `tsconfig.node.json` include list aligned with config files.
- File access helpers in `src/lib/fsAccess.ts` use standard `<input>` and `DataTransfer` for file selection; `ensureReadPermission` is kept for compatibility with existing file handles.
- IndexedDB fakes in `src/lib/handleStore.test.ts` avoid parameter properties (due to `erasableSyntaxOnly`) and use mutable request helpers when mocking IDB requests.
