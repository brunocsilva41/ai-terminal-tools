import fs from "fs";
import path from "path";
import { spawn } from "child_process";

const DEFAULT_TIMEOUT_MS = 120000;

export class ToolRuntimeError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "ToolRuntimeError";
    this.details = details;
  }
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function toArray(value) {
  return Array.isArray(value) ? value : [value];
}

function normalizeInputValue(value, spec, toolName) {
  const expectedType = spec.type;
  if (!expectedType || value === undefined || value === null) {
    return value;
  }

  if (expectedType === "string" && typeof value !== "string") {
    throw new ToolRuntimeError(`Tool '${toolName}': '${spec.input}' must be a string`);
  }
  if (expectedType === "number" && typeof value !== "number") {
    throw new ToolRuntimeError(`Tool '${toolName}': '${spec.input}' must be a number`);
  }
  if (expectedType === "boolean" && typeof value !== "boolean") {
    throw new ToolRuntimeError(`Tool '${toolName}': '${spec.input}' must be a boolean`);
  }

  return value;
}

function buildArgsFromSpec(tool, inputArgs) {
  const execution = tool.execution || {};
  const input = isObject(inputArgs) ? inputArgs : {};
  const args = [];

  if (Array.isArray(execution.fixedArgs)) {
    for (const fixed of execution.fixedArgs) {
      args.push(String(fixed));
    }
  }

  for (const spec of execution.args || []) {
    const kind = spec.kind;
    if (!kind) {
      throw new ToolRuntimeError(`Tool '${tool.name}': arg spec is missing 'kind'`);
    }

    let value = input[spec.input];
    if (value === undefined && spec.default !== undefined) {
      value = spec.default;
    }
    value = normalizeInputValue(value, spec, tool.name);

    if (kind === "flag") {
      if (typeof value === "boolean" && value && spec.flag) {
        args.push(spec.flag);
      }
      continue;
    }

    const hasValue = value !== undefined && value !== null && `${value}` !== "";
    if (!hasValue) {
      if (spec.required) {
        throw new ToolRuntimeError(`Tool '${tool.name}': missing required input '${spec.input}'`);
      }
      continue;
    }

    if (kind === "option") {
      if (!spec.option) {
        throw new ToolRuntimeError(`Tool '${tool.name}': option arg '${spec.input}' is missing 'option'`);
      }
      args.push(spec.option, String(value));
      continue;
    }

    if (kind === "positional") {
      args.push(String(value));
      continue;
    }

    throw new ToolRuntimeError(`Tool '${tool.name}': unsupported arg kind '${kind}'`);
  }

  return args;
}

function getCommandCandidates(tool) {
  const command = tool.execution?.command;
  if (!command || (Array.isArray(command) && command.length === 0)) {
    throw new ToolRuntimeError(`Tool '${tool.name}': missing execution.command`);
  }
  return toArray(command).map((item) => String(item).trim()).filter(Boolean);
}

export function loadToolManifest(manifestPath, repoRoot) {
  const absoluteManifestPath = path.resolve(repoRoot, manifestPath);
  if (!fs.existsSync(absoluteManifestPath)) {
    throw new ToolRuntimeError("Tool manifest file not found", { manifestPath: absoluteManifestPath });
  }

  const raw = fs.readFileSync(absoluteManifestPath, "utf8");
  const parsed = JSON.parse(raw);

  if (!parsed || typeof parsed.version !== "string" || !Array.isArray(parsed.tools)) {
    throw new ToolRuntimeError("Invalid tool manifest format", { manifestPath: absoluteManifestPath });
  }

  return {
    ...parsed,
    _manifestPath: absoluteManifestPath
  };
}

export function listMcpTools(manifest) {
  return manifest.tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema || { type: "object", additionalProperties: false }
  }));
}

export function findTool(manifest, toolName) {
  return manifest.tools.find((tool) => tool.name === toolName);
}

function resolveScriptArgs(tool, repoRoot) {
  const execution = tool.execution || {};
  const scriptPath = execution.script ? path.resolve(repoRoot, execution.script) : null;
  if (scriptPath && !fs.existsSync(scriptPath)) {
    throw new ToolRuntimeError(`Tool '${tool.name}': script file not found`, { scriptPath });
  }
  return scriptPath ? [scriptPath] : [];
}

function runProcess(command, args, options) {
  const { cwd, env, timeoutMs } = options;

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env,
      shell: false
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const killTimer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      clearTimeout(killTimer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(killTimer);
      if (timedOut) {
        reject(new ToolRuntimeError(`Command timed out after ${timeoutMs}ms`, { command, args }));
        return;
      }

      resolve({
        exitCode: code ?? 1,
        stdout: stdout.trim(),
        stderr: stderr.trim()
      });
    });
  });
}

export async function executeToolContract(tool, inputArgs, repoRoot) {
  const invocationArgs = [
    ...resolveScriptArgs(tool, repoRoot),
    ...buildArgsFromSpec(tool, inputArgs)
  ];
  const commandCandidates = getCommandCandidates(tool);
  const cwd = path.resolve(repoRoot, tool.execution?.cwd || ".");
  const timeoutMs = tool.execution?.timeoutMs || DEFAULT_TIMEOUT_MS;

  let lastError = null;
  for (const command of commandCandidates) {
    try {
      const result = await runProcess(command, invocationArgs, {
        cwd,
        env: process.env,
        timeoutMs
      });

      if (result.exitCode !== 0) {
        throw new ToolRuntimeError(`Tool '${tool.name}' failed with exit code ${result.exitCode}`, {
          command,
          args: invocationArgs,
          ...result
        });
      }

      return {
        command,
        args: invocationArgs,
        ...result
      };
    } catch (error) {
      const isCommandNotFound = error && (error.code === "ENOENT" || String(error.message || "").includes("ENOENT"));
      if (isCommandNotFound) {
        lastError = error;
        continue;
      }
      throw error;
    }
  }

  throw new ToolRuntimeError(`Tool '${tool.name}' could not start. None of the commands are available.`, {
    commandsTried: commandCandidates,
    lastError: lastError ? String(lastError.message || lastError) : null
  });
}

export async function executeToolByName(manifest, toolName, inputArgs, repoRoot) {
  const tool = findTool(manifest, toolName);
  if (!tool) {
    throw new ToolRuntimeError(`Tool not found: ${toolName}`);
  }
  return executeToolContract(tool, inputArgs, repoRoot);
}
