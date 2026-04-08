import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import path from "path";
import { fileURLToPath } from "url";
import {
  ToolRuntimeError,
  executeToolByName,
  listMcpTools,
  loadToolManifest
} from "../shared/tool_runtime.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "../..");
const TOOL_MANIFEST_PATH =
  process.env.UNIVERSAL_TOOLS_MANIFEST || path.resolve(REPO_ROOT, "contracts", "tools.manifest.json");

const server = new Server(
  { name: "universal-ai-tools", version: "3.0.0" },
  { capabilities: { tools: {} } }
);

let manifest;
try {
  manifest = loadToolManifest(TOOL_MANIFEST_PATH, REPO_ROOT);
  console.error(`[universal-ai-tools] Loaded ${manifest.tools.length} tools from ${manifest._manifestPath}`);
} catch (error) {
  console.error(`[universal-ai-tools] Failed to load tool manifest: ${error.message}`);
  process.exit(1);
}

function formatTextResult(text, isError = false) {
  return {
    content: [{ type: "text", text }],
    isError,
    toolResult: text
  };
}

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: listMcpTools(manifest)
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const toolName = request?.params?.name;
  const args = request?.params?.arguments || {};

  if (!toolName || typeof toolName !== "string") {
    return formatTextResult("Invalid tool call request: missing tool name.", true);
  }

  try {
    const result = await executeToolByName(manifest, toolName, args, REPO_ROOT);
    const text = result.stdout || result.stderr || JSON.stringify({ status: "success" }, null, 2);
    return formatTextResult(text);
  } catch (error) {
    if (error instanceof ToolRuntimeError) {
      const details = error.details ? `\n${JSON.stringify(error.details, null, 2)}` : "";
      return formatTextResult(`Tool execution error: ${error.message}${details}`, true);
    }
    return formatTextResult(`Unexpected tool execution error: ${error.message || String(error)}`, true);
  }
});

const transport = new StdioServerTransport();
server.connect(transport).then(() => {
  console.error("[universal-ai-tools] MCP Server running via stdio transport.");
});
