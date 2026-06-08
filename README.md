<div align="center">

# @socheli/mcp

**A Model Context Protocol server that gives Claude — and any MCP-enabled agent — your Socheli content engine as tools.**

List and inspect content, dispatch renders to your device fleet, check device status, publish across platforms, and read/curate the dated content plan — all from a chat with your agent.

[![npm](https://img.shields.io/npm/v/@socheli/mcp?color=000&label=%40socheli%2Fmcp)](https://www.npmjs.com/package/@socheli/mcp)
[![npm downloads](https://img.shields.io/npm/dm/@socheli/mcp?color=000)](https://www.npmjs.com/package/@socheli/mcp)
[![MCP](https://img.shields.io/badge/Model_Context_Protocol-server-000)](https://modelcontextprotocol.io)
[![license](https://img.shields.io/npm/l/@socheli/mcp?color=000)](LICENSE)

[API](https://github.com/Socheli/api) · [SDK](https://github.com/Socheli/sdk) · [CLI](https://github.com/Socheli/cli) · [MCP](https://github.com/Socheli/mcp) · [Docs](https://docs.socheli.com)

</div>

---

## What it is

`@socheli/mcp` is a [Model Context Protocol](https://modelcontextprotocol.io) server that exposes Socheli as agent tools, so Claude (or any MCP client) can inspect content, dispatch renders to the fleet, publish finished posts, and read & curate the dated content plan — by talking to it in natural language.

It is a **dependency-free stdio JSON-RPC server** built on top of [`@socheli/sdk`](https://github.com/Socheli/sdk), which it uses to talk to the Socheli HTTP API. Every tool call is a typed SDK call under the hood. Authentication is **one Socheli API key**.

Under the hood it speaks the `2024-11-05` MCP protocol over `stdin`/`stdout` using `Content-Length`-framed JSON-RPC, and advertises a `tools` capability with `serverInfo` `{ name: "socheli", version: "0.1.0" }`.

## Install

```bash
npm i -g @socheli/mcp
# or run on demand, no install:
npx @socheli/mcp
```

The package ships a `socheli-mcp` binary. Most users don't run it directly — they point an MCP client at it (see [Quickstart](#quickstart)).

## Authentication

The server is configured with **two environment variables** — one for the API base URL, one for your API key:

| Env var | Required | Default | Description |
|---|---|---|---|
| `SOCHELI_API_KEY` | yes | — | Your Socheli API key (e.g. `sk_live_xxx`). Sent as a bearer token to the Socheli API. |
| `SOCHELI_API_URL` | no | `https://api.socheli.com` | The Socheli API base URL. |

These are passed to `createSocheli({ baseUrl: process.env.SOCHELI_API_URL, apiKey: process.env.SOCHELI_API_KEY })`. The SDK then authenticates to the API with `Authorization: Bearer <SOCHELI_API_KEY>` on every request. A wrong key yields `401`; a server with no key configured yields `503`.

> Set these in your MCP client's `env` block (below), not in a shell, so the agent process inherits them.

## Quickstart

Add Socheli to your MCP client. For Claude Desktop / Claude Code, drop this into your `.mcp.json` (or `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "socheli": {
      "command": "npx",
      "args": ["@socheli/mcp"],
      "env": {
        "SOCHELI_API_URL": "https://api.socheli.com",
        "SOCHELI_API_KEY": "sk_live_xxx"
      }
    }
  }
}
```

Running from a checkout of the monorepo instead of npm? Use the source entry directly:

```json
{
  "mcpServers": {
    "socheli": {
      "command": "node",
      "args": ["--import", "tsx", "packages/mcp/src/index.ts"],
      "env": {
        "SOCHELI_API_URL": "https://api.socheli.com",
        "SOCHELI_API_KEY": "sk_live_xxx"
      }
    }
  }
}
```

Then just talk to your agent:

- *"Use socheli to list the last 5 items and their QA scores."*
- *"Generate a video about **the science of habit** on `concept_lab` and auto-publish it."*
- *"What devices are online right now?"*
- *"Show me everything planned for next Tuesday and archive anything scoring under 7."*
- *"Move the Instagram post on the 20th to the 25th at 2:30pm."*

## Tool reference

### Core

| Tool | Description | Arguments |
|---|---|---|
| `socheli_list_items` | List recent content items (id, status, QA score, title). | `limit?` (number, default `20`), `channel?` (string) |
| `socheli_get_item` | Get the full detail of one content item by id — idea, script, storyboard, package, video URL, publish state. | `id` (string, **required**) |
| `socheli_generate` | Dispatch a new render job to the device fleet from an idea/seed. `type: "auto"` also publishes; `type: "new"` builds only. | `seed` (string, **required**), `channel?` (string, default `concept_lab`), `type?` (`"new"` \| `"auto"`), `mood?` (string), `voice?` (boolean) |
| `socheli_jobs` | List recent fleet jobs and their status (dispatched/running/done/error) and which device ran them. | _(none)_ |
| `socheli_fleet_status` | Show connected render devices and how many are online/idle/busy. | _(none)_ |
| `socheli_publish` | Publish a finished item to every configured platform (YouTube / Instagram / TikTok + bundle). Set `public` to go public. | `id` (string, **required**), `public?` (boolean) |

### Calendar & plan (`plan_*`)

The full `plan_*` CRUD is exposed too, so an agent can read and curate the dated content plan exactly the way the dashboard's day dialog does — open a day, open an event, edit / move / archive / delete. Posts live as `PlannedPost` records.

| Tool | Kind | Description | Arguments |
|---|---|---|---|
| `plan_list` | read | List planned posts (newest plan-run first). | `channel?`, `status?`, `includeArchived?` (default `false`) |
| `plan_get` | read | One full post by id. | `id` |
| `plan_day` | read | Every post for one date, sorted by time — the day-view data. | `date`, `includeArchived?` |
| `plan_create` | mutate | Hand-add a post. | `channel`, `date`, `time?`, `platform`, `topic`, `angle?`, `format?`, `mood?`, `hook?`, `rationale?`, `algoLever?`, `status?` |
| `plan_update` | mutate | Edit fields on a post. | `id`, `patch` (any of `date`/`time`/`status`/`platform`/`mood`/`topic`/`angle`/`format`/`hook`/`rationale`/`algoLever`) |
| `plan_move` | mutate | Reschedule a post (drag-and-drop equivalent). | `id`, `date`, `time?` |
| `plan_archive` | mutate | Soft-hide a post (status → `archived`; reversible). | `id` |
| `plan_delete` | mutate | Permanently delete a post (not reversible). | `id` |
| `plan_strategy` | read | The saved strategy brief for a channel (channel brief + subject playbook + per-cluster cadence). | `channel` |
| `plan_run` | long | Run the algo planner for a channel and append a dated plan. Returns a started job. | `channel`, `days?` (default `14`), `platforms?`, `time?` |

All mutations return the affected post. `plan_archive` is reversible (`plan_update` the status back to `idea`); `plan_delete` is not.

#### The `PlannedPost`

```ts
type PlannedPost = {
  id: string;
  date: string;        // YYYY-MM-DD
  time: string;        // HH:MM
  channel: string;     // brand / channel id
  platform: "youtube" | "instagram" | "tiktok" | "x" | "linkedin" | "telegram";
  topic: string;
  angle: string;
  format: string;      // short | explainer | …
  mood?: string;
  hook?: string;
  rationale: string;
  algoLever?: string;  // which algorithm lever this idea exploits
  scores?: Record<string, number>;
  overall?: number;
  status: "idea" | "approved" | "scheduled" | "generated" | "dropped" | "archived";
  planRunId: string;
  createdAt: string;
  updatedAt?: string;
};
```

## How it works

The server implements the MCP JSON-RPC methods below over a `Content-Length`-framed stdio transport:

| Method | Behavior |
|---|---|
| `initialize` | Returns `protocolVersion` (echoes the client's, default `2024-11-05`), `capabilities: { tools: {} }`, and `serverInfo: { name: "socheli", version: "0.1.0" }`. |
| `notifications/initialized` | Acknowledged (no-op). |
| `tools/list` | Returns every tool's `name`, `description`, and `inputSchema`. |
| `tools/call` | Looks up the named tool, runs it via the SDK, and returns the result as `{ content: [{ type: "text", text }] }`. Unknown tools return JSON-RPC error `-32601`. |

Each tool's `run` maps directly to an `@socheli/sdk` call — e.g. `socheli_list_items` → `socheli.items.list(...)`, `socheli_generate` → `socheli.generate(...)`, `socheli_publish` → `socheli.items.publish(...)`. Tool errors are returned to the agent as text content with `isError: true` rather than as transport errors, so the model can read and react to them.

## The Socheli surfaces

Socheli is built API-first. This MCP server is one of four public client surfaces, all speaking to the same control plane:

| Surface | Package | Repo |
|---|---|---|
| HTTP API | `@socheli/api` | [Socheli/api](https://github.com/Socheli/api) |
| SDK | `@socheli/sdk` | [Socheli/sdk](https://github.com/Socheli/sdk) |
| CLI | `@socheli/cli` | [Socheli/cli](https://github.com/Socheli/cli) |
| MCP | `@socheli/mcp` | [Socheli/mcp](https://github.com/Socheli/mcp) — _you are here_ |

Full documentation lives at **[docs.socheli.com](https://docs.socheli.com)**.

## Developed in the Socheli monorepo

`@socheli/mcp` is developed inside the Socheli monorepo (as `packages/mcp`) alongside the API, SDK, CLI, and engine, and mirrored to this repo for publishing. Issues and PRs are welcome here.

## License

MIT — see [LICENSE](LICENSE).
