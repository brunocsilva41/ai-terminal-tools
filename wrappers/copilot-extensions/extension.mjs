import { spawnSync } from "child_process";
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CORE_DIR = path.resolve(__dirname, '../../core-scripts');

let cachedPythonCommand = null;

function resolvePythonCommand() {
  const candidates = ["python", "python3", "py"];
  for (const command of candidates) {
    const probe = spawnSync(command, ["--version"], {
      encoding: "utf-8",
      shell: false,
      windowsHide: true
    });
    if (!probe.error && probe.status === 0) {
      return command;
    }
  }
  throw new Error("Python command not found (tried: python, python3, py).");
}

function getPythonCommand() {
  if (!cachedPythonCommand) {
    cachedPythonCommand = resolvePythonCommand();
  }
  return cachedPythonCommand;
}

function runCommand(command, args, cwd = process.cwd()) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf-8",
    shell: false,
    windowsHide: true
  });

  if (result.error) {
    throw new Error(result.error.message);
  }
  if (result.status !== 0) {
    const details = (result.stderr || result.stdout || "").trim();
    throw new Error(details || `Command failed with exit code ${result.status}`);
  }
  return (result.stdout || result.stderr || "").trim();
}

function parseArgs(rawArgs) {
  return String(rawArgs || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

// Exporting slash commands for GitHub Copilot CLI Extension API
export const commands = {
  "/devops": {
    description: "Run Docker health check and cleanup",
    execute: (args) => {
      const parts = parseArgs(args);
      const clean = parts.includes("clean");
      const output = runCommand(
        getPythonCommand(),
        [
          path.join(CORE_DIR, "devops", "docker_clean.py"),
          ...(clean ? ["--clean"] : [])
        ]
      );
      return `Here is the Docker Status:\n\`\`\`json\n${output}\n\`\`\``;
    }
  },
  "/scaffold": {
    description: "Scaffold a React component",
    execute: (args) => {
      const parts = parseArgs(args);
      if (parts.length === 0 || !parts[0]) {
        return "Please provide a component name, e.g., `/scaffold Button`";
      }

      const componentName = parts[0];
      const targetDir = parts[1] || "./src/components";
      const output = runCommand("node", [
        path.join(CORE_DIR, "web", "react_scaffold.js"),
        componentName,
        targetDir
      ]);
      return `Scaffolding complete:\n\`\`\`json\n${output}\n\`\`\``;
    }
  }
};
