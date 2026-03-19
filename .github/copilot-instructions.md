# Copilot instructions for `jarvis`

## Build, test, and lint

- Install dependencies with `npm install`.
- Build with `npm run build`.
- Lint with `npm run lint`.
- Run the working automated test suite with `npm run test:e2e`.
- Run the current single e2e file with `npm run test:e2e -- --runTestsByPath test/health.e2e-spec.ts`.
- Run the current single e2e test case with `npm run test:e2e -- --runTestsByPath test/health.e2e-spec.ts -t '/system/health'`.
- `npm test` targets `src/**/*.spec.ts`, but the repository currently has no unit spec files, so it exits with "No tests found".

## High-level architecture

- This is a NestJS pure API backend. `src/main.ts` applies the global `ValidationPipe`, exposes Swagger at `/swagger`, and adds the global `/api` prefix for runtime routes.
- `src/app.module.ts` is intentionally small: it wires together `AppConfigModule`, `SystemModule`, and `FeishuModule`. Most current code is infrastructure, not domain business logic.
- Configuration is centralized in `AppConfigModule`/`AppConfigService`. Environment files are loaded in this order: `.env.local`, then `.env`.
- The system slice is `src/system/*` and currently exposes the health endpoint.
- The Feishu integration is layered:
  - `FeishuAuthService` fetches tenant tokens.
  - `FeishuHttpService` adds auth headers and translates Feishu API error codes into Nest HTTP exceptions.
  - `FeishuBitableService` wraps low-level Bitable CRUD.
  - `FeishuSheetsService` wraps Sheets append operations.
  - `FeishuStorageService` is the higher-level access layer used by future business modules (`db(name).table(tableId)` and `exportLog.append(...)`).
- Webhook handling lives under `src/integrations/feishu/webhook/*`: the controller validates the verification token, handles `url_verification`, and dispatches schema 2.0 events through `FeishuEventDispatcher`.

## Key conventions

- Keep configuration access behind `AppConfigService` instead of reading environment variables directly throughout the codebase.
- Treat Feishu as an internal storage/integration detail. External API DTOs should use stable field names and should not expose raw Feishu details such as `record_id` or raw Feishu error codes unless that is an intentional API choice.
- When adding new API endpoints, follow the existing repository guidance from `AGENTS.md`: use DTO validation plus Swagger decorators, and document any new environment variables in both `README.md` and `.env.example`.
- Prefer building new business features on top of `FeishuStorageService`/`FeishuBitableService` rather than calling Feishu HTTP endpoints directly from controllers.
- Feishu database selection is name-based (`FEISHU_BITABLE_DATABASES_JSON` maps logical database names to app tokens). Code should resolve databases through `FeishuBitableService.db(name)` instead of hardcoding app tokens.
- KV caching is described as optional in the docs, but the current Feishu auth path depends on `KvService`; any code path that fetches Feishu tenant tokens needs valid `KV_BASE_URL` and `KV_API_TOKEN` configured.
- Current e2e tests create a Nest app directly from `AppModule` instead of calling `bootstrap()`, so they do not automatically include the `/api` prefix or other `main.ts` bootstrap behavior. If you add e2e coverage for runtime behavior, account for that explicitly.
