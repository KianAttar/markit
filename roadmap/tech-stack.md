# Markit — Tech Stack Decisions

## Language
TypeScript throughout.

## AI
**Vercel AI SDK** with Anthropic as the provider. Avoids vendor lock-in — switching models or providers is a one-line change. Structured output via Zod for typed AI reports.

## Database
**PostgreSQL + Prisma**. Not needed for the CLI phase — filesystem serves that role. Prisma schema will be defined when the web app begins. Supabase is the likely host (Postgres + storage + auth-friendly).

## File Storage
**S3 or Cloudflare R2** for submission files, result files, and AI reports. Local filesystem for now.

## Auth
**Clerk** (or equivalent). Not needed for CLI phase.

## Background Jobs
No framework decided yet. Core grading logic must be kept modular and decoupled from the CLI so it can be invoked from a job queue later without refactoring.

## Monorepo
Decision deferred. If a web app is added, pnpm workspaces is the likely approach to share core grading logic across packages.

---

## Current Phase: CLI
No database, no auth, no file storage service, no job queue. Everything runs locally. Decisions above are made now to ensure the architecture doesn't need to be revisited when the web app phase begins.
