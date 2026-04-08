import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");
const DEFAULT_MANIFEST = path.resolve(REPO_ROOT, "contracts", "tools.manifest.json");

function fail(message) {
  console.error(`❌ ${message}`);
}

function ok(message) {
  console.log(`✅ ${message}`);
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validateArgSpec(toolName, spec, index, issues) {
  const allowedKinds = new Set(["flag", "option", "positional"]);
  const allowedTypes = new Set(["string", "number", "boolean"]);
  if (!isObject(spec)) {
    issues.push(`Tool '${toolName}': args[${index}] must be an object`);
    return;
  }
  if (!allowedKinds.has(spec.kind)) {
    issues.push(`Tool '${toolName}': args[${index}] has invalid kind '${spec.kind}'`);
  }
  if (spec.type && !allowedTypes.has(spec.type)) {
    issues.push(`Tool '${toolName}': args[${index}] has invalid type '${spec.type}'`);
  }
  if ((spec.kind === "option" || spec.kind === "positional") && !spec.input) {
    issues.push(`Tool '${toolName}': args[${index}] requires 'input'`);
  }
  if (spec.kind === "flag" && !spec.flag) {
    issues.push(`Tool '${toolName}': args[${index}] requires 'flag'`);
  }
  if (spec.kind === "option" && !spec.option) {
    issues.push(`Tool '${toolName}': args[${index}] requires 'option'`);
  }
}

function validateTool(tool, index, repoRoot, issues, knownNames) {
  if (!isObject(tool)) {
    issues.push(`tools[${index}] must be an object`);
    return;
  }

  const label = `tools[${index}]`;
  if (!tool.name || typeof tool.name !== "string") {
    issues.push(`${label}: missing string 'name'`);
  } else {
    const validName = /^[a-zA-Z0-9_.-]+$/.test(tool.name);
    if (!validName) {
      issues.push(`${label}: invalid tool name '${tool.name}'`);
    }
    if (knownNames.has(tool.name)) {
      issues.push(`${label}: duplicated tool name '${tool.name}'`);
    }
    knownNames.add(tool.name);
  }

  if (!tool.description || typeof tool.description !== "string") {
    issues.push(`${label}: missing string 'description'`);
  }
  if (!tool.stability || typeof tool.stability !== "string") {
    issues.push(`${label}: missing string 'stability'`);
  }
  if (!isObject(tool.inputSchema)) {
    issues.push(`${label}: missing object 'inputSchema'`);
  }

  if (!isObject(tool.execution)) {
    issues.push(`${label}: missing object 'execution'`);
    return;
  }

  const command = tool.execution.command;
  const commandValid =
    (typeof command === "string" && command.trim() !== "") ||
    (Array.isArray(command) && command.length > 0 && command.every((entry) => typeof entry === "string" && entry.trim() !== ""));
  if (!commandValid) {
    issues.push(`${label}: invalid execution.command`);
  }

  if (tool.execution.script) {
    if (typeof tool.execution.script !== "string") {
      issues.push(`${label}: execution.script must be a string`);
    } else {
      const scriptPath = path.resolve(repoRoot, tool.execution.script);
      if (!fs.existsSync(scriptPath)) {
        issues.push(`${label}: script file not found '${tool.execution.script}'`);
      }
    }
  }

  if (tool.execution.timeoutMs !== undefined) {
    const validTimeout = Number.isInteger(tool.execution.timeoutMs) && tool.execution.timeoutMs >= 1000;
    if (!validTimeout) {
      issues.push(`${label}: execution.timeoutMs must be integer >= 1000`);
    }
  }

  if (tool.execution.args !== undefined) {
    if (!Array.isArray(tool.execution.args)) {
      issues.push(`${label}: execution.args must be an array`);
    } else {
      tool.execution.args.forEach((spec, argIndex) => validateArgSpec(tool.name || label, spec, argIndex, issues));
    }
  }
}

function main() {
  const manifestPath = process.argv[2] ? path.resolve(process.cwd(), process.argv[2]) : DEFAULT_MANIFEST;
  if (!fs.existsSync(manifestPath)) {
    fail(`Manifest not found: ${manifestPath}`);
    process.exit(1);
  }

  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  } catch (error) {
    fail(`Failed to parse JSON in manifest: ${manifestPath}`);
    fail(String(error.message || error));
    process.exit(1);
  }

  const issues = [];
  if (!isObject(manifest)) {
    issues.push("Manifest root must be an object");
  } else {
    if (typeof manifest.version !== "string" || manifest.version.trim() === "") {
      issues.push("Manifest must have non-empty 'version'");
    }
    if (!Array.isArray(manifest.tools) || manifest.tools.length === 0) {
      issues.push("Manifest must have a non-empty 'tools' array");
    } else {
      const knownNames = new Set();
      manifest.tools.forEach((tool, index) => validateTool(tool, index, REPO_ROOT, issues, knownNames));
    }
  }

  if (issues.length > 0) {
    fail(`Found ${issues.length} contract validation issue(s):`);
    for (const issue of issues) {
      fail(`- ${issue}`);
    }
    process.exit(1);
  }

  ok(`Tool manifest is valid (${manifest.tools.length} tools).`);
}

main();
