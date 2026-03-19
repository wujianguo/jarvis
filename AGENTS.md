# Agent Guide (GitHub Copilot / Coding Agents)

This repository supports using GitHub Copilot (Chat/Coding Agent) to assist development. Please follow these rules to ensure changes remain safe, reviewable, and aligned with the project.

## How agents should work

When assigned a task:

1. **Clarify scope**: list target files, new endpoints, new env vars, and any breaking changes.
2. **Prefer minimal, complete increments**: ship a small vertical slice that compiles and can be verified.
3. **Explain changes**:
   - why
   - what changed (file list)
   - how to verify (commands + sample requests)
4. **No “fake implementations”**: don’t add empty controllers/services without clear TODOs and docs.

## Security & privacy

- Never commit secrets:
  - `FEISHU_APP_SECRET`, `KV_API_TOKEN`, personal access tokens, etc.
- Never log full tokens. If necessary, log only redacted values.

## Feishu/Bitable guidance (pure API mode)

- Do not expose Feishu raw details directly to external clients (e.g. `record_id` / Feishu error codes) unless explicitly intended.
- Prefer a mapping layer:
  - API DTOs use stable field names
  - Bitable column names can change; keep them behind a mapper

## Quality bar (recommended)

For any new API:

- Must have DTO validation and Swagger annotations (tag/summary/responses).
- Must document new env vars in `.env.example` and README.
- Provide verification steps (Swagger or curl examples).
