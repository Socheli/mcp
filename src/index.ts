#!/usr/bin/env -S node --import tsx
import { createSocheli } from "@socheli/sdk";

/* @socheli/mcp — a Model Context Protocol server that exposes the Socheli content
   engine as tools, so Claude (or any MCP client) can list/inspect content, dispatch
   renders to the fleet, check device status, and publish. Dependency-free stdio
   JSON-RPC (matches the repo's editor-mcp pattern).

   Configure in an MCP client:
     { "command": "node", "args": ["--import","tsx","packages/mcp/src/index.ts"],
       "env": { "SOCHELI_API_URL": "https://api.socheli.com", "SOCHELI_API_KEY": "sk_..." } } */

const socheli = createSocheli({ baseUrl: process.env.SOCHELI_API_URL, apiKey: process.env.SOCHELI_API_KEY });

type JsonRpc = { jsonrpc?: "2.0"; id?: string | number | null; method?: string; params?: any };

let buffer = Buffer.alloc(0);
function send(message: Record<string, unknown>) {
  const body = Buffer.from(JSON.stringify(message), "utf8");
  process.stdout.write(`Content-Length: ${body.length}\r\n\r\n`);
  process.stdout.write(body);
}
const result = (id: JsonRpc["id"], value: unknown) => send({ jsonrpc: "2.0", id, result: value });
const error = (id: JsonRpc["id"], code: number, message: string) => send({ jsonrpc: "2.0", id, error: { code, message } });
const textContent = (v: unknown) => ({ content: [{ type: "text", text: typeof v === "string" ? v : JSON.stringify(v, null, 2) }] });

const TOOLS = [
  {
    name: "socheli_list_items",
    description: "List recent content items (id, status, QA score, title). Optionally filter by channel or limit.",
    inputSchema: { type: "object", properties: { limit: { type: "number", description: "max items (default 20)" }, channel: { type: "string" } } },
    run: (a: any) => socheli.items.list({ limit: a.limit ?? 20, channel: a.channel }),
  },
  {
    name: "socheli_get_item",
    description: "Get the full detail of one content item by id (idea, script, storyboard, package, video URL, publish state).",
    inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
    run: (a: any) => socheli.items.get(a.id),
  },
  {
    name: "socheli_generate",
    description: "Dispatch a new render job to the device fleet from an idea/seed. type 'auto' also publishes; 'new' builds only.",
    inputSchema: {
      type: "object",
      properties: {
        seed: { type: "string", description: "the idea/topic to make a video about" },
        channel: { type: "string", description: "channel id (default concept_lab)" },
        type: { type: "string", enum: ["new", "auto"] },
        mood: { type: "string" },
        voice: { type: "boolean" },
      },
      required: ["seed"],
    },
    run: (a: any) => socheli.generate({ seed: a.seed, channel: a.channel, type: a.type, mood: a.mood, voice: a.voice }),
  },
  {
    name: "socheli_jobs",
    description: "List recent fleet jobs and their status (dispatched/running/done/error) and which device ran them.",
    inputSchema: { type: "object", properties: {} },
    run: () => socheli.jobs(),
  },
  {
    name: "socheli_fleet_status",
    description: "Show connected render devices and how many are online/idle/busy.",
    inputSchema: { type: "object", properties: {} },
    run: () => socheli.fleet(),
  },
  {
    name: "socheli_publish",
    description: "Publish a finished item to every configured platform (YouTube/IG/TikTok + bundle). Set public to go public.",
    inputSchema: { type: "object", properties: { id: { type: "string" }, public: { type: "boolean" } }, required: ["id"] },
    run: (a: any) => socheli.items.publish(a.id, { public: a.public }),
  },
] as const;

async function handle(msg: JsonRpc) {
  if (!msg.method) return;
  if (msg.method === "initialize") {
    return result(msg.id, {
      protocolVersion: msg.params?.protocolVersion ?? "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: { name: "socheli", version: "0.1.0" },
    });
  }
  if (msg.method === "notifications/initialized") return;
  if (msg.method === "tools/list") {
    return result(msg.id, { tools: TOOLS.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })) });
  }
  if (msg.method === "tools/call") {
    const tool = TOOLS.find((t) => t.name === msg.params?.name);
    if (!tool) return error(msg.id, -32601, `unknown tool: ${msg.params?.name}`);
    try {
      const value = await tool.run(msg.params?.arguments ?? {});
      return result(msg.id, textContent(value));
    } catch (e: any) {
      return result(msg.id, { ...textContent(`error: ${e?.message ?? e}`), isError: true });
    }
  }
  if (typeof msg.id !== "undefined") error(msg.id, -32601, `method not found: ${msg.method}`);
}

process.stdin.on("data", (chunk) => {
  buffer = Buffer.concat([buffer, chunk]);
  for (;;) {
    const header = buffer.indexOf("\r\n\r\n");
    if (header === -1) break;
    const m = /Content-Length:\s*(\d+)/i.exec(buffer.slice(0, header).toString());
    if (!m) { buffer = buffer.slice(header + 4); continue; }
    const len = Number(m[1]);
    const start = header + 4;
    if (buffer.length < start + len) break;
    const body = buffer.slice(start, start + len).toString();
    buffer = buffer.slice(start + len);
    try {
      void handle(JSON.parse(body));
    } catch { /* ignore malformed frame */ }
  }
});
process.stdin.resume();
