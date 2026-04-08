import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";

function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf-8",
    shell: false,
    windowsHide: true,
    ...options
  });

  const stdout = (result.stdout || "").trim();
  const stderr = (result.stderr || "").trim();
  if (result.error) {
    return {
      ok: false,
      error: result.error.message,
      stdout,
      stderr,
      exitCode: 1
    };
  }
  return {
    ok: result.status === 0,
    exitCode: result.status ?? 1,
    stdout,
    stderr,
    error: result.status === 0 ? null : stderr || stdout || `Command failed with code ${result.status}`
  };
}

function emit(payload, exitCode = 0) {
  console.log(JSON.stringify(payload, null, 2));
  process.exitCode = exitCode;
}

function hasEslintConfig(projectPath) {
  const candidates = [
    ".eslintrc.json",
    ".eslintrc.js",
    ".eslintrc.cjs",
    "eslint.config.js",
    "eslint.config.mjs"
  ];
  return candidates.some((file) => fs.existsSync(path.join(projectPath, file)));
}

function runReview(projectPath) {
  const normalizedProjectPath = path.resolve(projectPath);
  const report = {
    status: "success",
    error: null,
    data: {
      projectPath: normalizedProjectPath,
      eslint: null,
      typecheck: null,
      warnings: []
    }
  };

  if (!fs.existsSync(normalizedProjectPath) || !fs.statSync(normalizedProjectPath).isDirectory()) {
    return {
      status: "error",
      error: `Project path not found: ${normalizedProjectPath}`,
      data: { usage: "node reviewer_tool.js [projectPath]" }
    };
  }

  if (hasEslintConfig(normalizedProjectPath)) {
    const eslintResult = runCommand("npx", ["eslint", normalizedProjectPath, "--format", "json"]);
    if (eslintResult.ok) {
      try {
        report.data.eslint = JSON.parse(eslintResult.stdout || "[]");
      } catch {
        report.status = "error";
        report.error = "ESLint output is not valid JSON.";
        report.data.eslint = eslintResult.stdout;
      }
    } else {
      report.data.eslint = eslintResult.stdout || eslintResult.stderr;
      report.data.warnings.push("ESLint reported issues.");
    }
  } else {
    report.data.warnings.push("No ESLint config found; lint step skipped.");
  }

  if (fs.existsSync(path.join(normalizedProjectPath, "tsconfig.json"))) {
    const tscResult = runCommand("npx", ["tsc", "--noEmit"], { cwd: normalizedProjectPath });
    report.data.typecheck = {
      ok: tscResult.ok,
      output: tscResult.stdout || tscResult.stderr || ""
    };
    if (!tscResult.ok) {
      report.data.warnings.push("TypeScript check reported issues.");
    }
  } else {
    report.data.warnings.push("No tsconfig.json found; typecheck skipped.");
  }

  return report;
}

const targetPath = process.argv[2] || process.cwd();
const result = runReview(targetPath);
emit(result, result.status === "success" ? 0 : 1);
