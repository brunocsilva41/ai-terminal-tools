import fs from 'fs';
import os from 'os';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import { runDoctor } from './scripts/doctor.mjs';

const __filename = fileURLToPath(import.meta.url);
const ROOT_DIR = path.dirname(__filename);

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const colors = useColor
  ? {
      reset: '\x1b[0m',
      bright: '\x1b[1m',
      cyan: '\x1b[36m',
      green: '\x1b[32m',
      yellow: '\x1b[33m',
      red: '\x1b[31m',
      blue: '\x1b[34m',
      magenta: '\x1b[35m',
    }
  : {
      reset: '',
      bright: '',
      cyan: '',
      green: '',
      yellow: '',
      red: '',
      blue: '',
      magenta: '',
    };

const TOOL_OPTIONS = [
  { id: 'devops', label: 'DevOps & Docker (Clean/Monitor)' },
  { id: 'git', label: 'Git Analyzer (Summary/Commits)' },
  { id: 'web', label: 'Web Component Scaffolder (React)' },
  { id: 'data', label: 'Data & CSV Analyzer (Fast Parser)' },
  { id: 'browser', label: 'Browser Automation (Playwright)' },
  { id: 'dbeaver', label: 'DBeaver Manager (SQL/DB)' },
  { id: 'postman', label: 'Postman/Newman Manager (API Test)' },
];

const AGENT_OPTIONS = ['Architect', 'Designer', 'Frontend', 'Backend', 'Data Specialist'];

const BUILTIN_PROFILES = {
  core: {
    tools: ['devops', 'git', 'web', 'data'],
    agents: ['Architect', 'Frontend', 'Backend', 'Data Specialist'],
  },
  mcp: {
    tools: ['devops', 'git', 'web', 'data', 'browser', 'dbeaver', 'postman'],
    agents: ['Architect', 'Designer', 'Frontend', 'Backend', 'Data Specialist'],
  },
  full: {
    tools: TOOL_OPTIONS.map((tool) => tool.id),
    agents: [...AGENT_OPTIONS],
  },
  enterprise: {
    tools: ['devops', 'git', 'web', 'data', 'dbeaver', 'postman'],
    agents: ['Architect', 'Backend', 'Data Specialist'],
  },
};

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function printUsage() {
  console.log(`Usage:
  node setup.js
  node setup.js --non-interactive [--profile <core|mcp|full|enterprise|path/to/profile.json>] [--yes] [--configure-path|--no-configure-path]
  node setup.js doctor
  node setup.js --doctor

Options:
  --non-interactive   Disable prompts and use the selected profile/defaults.
  --profile <value>   Use a built-in profile or a JSON profile file.
  --yes               Alias for unattended execution.
  --configure-path    Force command PATH setup (global "ai").
  --no-configure-path Skip PATH setup.
  --doctor            Run dependency checks only.
  -h, --help          Show this help.
`);
}

function parseArgs(argv) {
  const result = {
    help: false,
    doctor: false,
    nonInteractive: false,
    yes: false,
    profile: null,
    profileSpecified: false,
    configurePath: null,
    command: null,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '-h' || arg === '--help') {
      result.help = true;
      continue;
    }

    if (arg === '--doctor') {
      result.doctor = true;
      continue;
    }

    if (arg === 'doctor' && !result.command) {
      result.command = 'doctor';
      continue;
    }

    if (arg === '--non-interactive') {
      result.nonInteractive = true;
      continue;
    }

    if (arg === '--yes' || arg === '-y') {
      result.yes = true;
      result.nonInteractive = true;
      continue;
    }

    if (arg === '--configure-path') {
      result.configurePath = true;
      continue;
    }

    if (arg === '--no-configure-path') {
      result.configurePath = false;
      continue;
    }

    if (arg === '--profile' || arg === '-p') {
      const next = argv[i + 1];
      if (!next || next.startsWith('-')) {
        throw new Error('Missing value for --profile.');
      }
      result.profile = next;
      result.profileSpecified = true;
      result.nonInteractive = true;
      i += 1;
      continue;
    }

    if (arg.startsWith('--profile=')) {
      const value = arg.slice('--profile='.length);
      if (!value) {
        throw new Error('Missing value for --profile.');
      }
      result.profile = value;
      result.profileSpecified = true;
      result.nonInteractive = true;
      continue;
    }

    if (!arg.startsWith('-') && !result.command) {
      result.command = arg;
      continue;
    }
  }

  return result;
}

function isYes(answer) {
  return ['s', 'sim', 'y', 'yes'].includes(String(answer).trim().toLowerCase());
}

function expandHome(input) {
  if (!input) {
    return input;
  }

  if (input === '~') {
    return os.homedir();
  }

  if (input.startsWith(`~${path.sep}`) || input.startsWith('~/') || input.startsWith('~\\')) {
    return path.join(os.homedir(), input.slice(2));
  }

  return input;
}

function resolvePathCandidate(input) {
  return path.resolve(expandHome(input));
}

function getDefaultProjectCandidates() {
  const home = os.homedir();
  return unique([
    path.join(home, 'Desktop', 'Code'),
    path.join(home, 'Documents', 'Projetos'),
    path.join(home, 'Documents', 'Projects'),
  ]);
}

function getPreferredDefaultPaths() {
  const candidates = getDefaultProjectCandidates();
  const existing = candidates.filter((candidate) => fs.existsSync(candidate));
  return existing.length > 0 ? existing : candidates;
}

function normalizePathEntry(entry) {
  const normalized = path.resolve(entry);
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
}

function pathContainsEntry(targetPath) {
  const currentPath = process.env.PATH || '';
  const entries = currentPath.split(path.delimiter).filter(Boolean);
  const target = normalizePathEntry(targetPath);
  return entries.some((entry) => normalizePathEntry(entry) === target);
}

function ensureCommandShims() {
  const binDir = path.resolve(ROOT_DIR, 'bin');
  if (!fs.existsSync(binDir)) {
    fs.mkdirSync(binDir, { recursive: true });
  }

  const unixShimPath = path.join(binDir, 'ai');
  const psShimPath = path.join(binDir, 'ai.ps1');
  const cmdShimPath = path.join(binDir, 'ai.cmd');

  const unixShim = `#!/usr/bin/env bash
SCRIPT_DIR="$(cd -- "$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
exec "$REPO_ROOT/ai.sh" "$@"
`;
  const psShim = `$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Resolve-Path (Join-Path $ScriptDir "..")
& (Join-Path $RepoRoot "ai.ps1") @args
`;
  const cmdShim = `@echo off
set SCRIPT_DIR=%~dp0
powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%..\\ai.ps1" %*
`;

  fs.writeFileSync(unixShimPath, unixShim, 'utf8');
  fs.writeFileSync(psShimPath, psShim, 'utf8');
  fs.writeFileSync(cmdShimPath, cmdShim, 'utf8');

  try {
    fs.chmodSync(unixShimPath, 0o755);
  } catch {
    // No-op on filesystems that do not support chmod semantics.
  }

  return binDir;
}

function configureWindowsUserPath(pathToAdd) {
  const escapedPath = pathToAdd.replace(/'/g, "''");
  const script = `
$target = '${escapedPath}'
$current = [Environment]::GetEnvironmentVariable('Path', 'User')
if (-not $current) { $current = '' }
$parts = $current -split ';' | Where-Object { $_ -and $_.Trim() -ne '' }
if ($parts -contains $target) {
  Write-Output 'already-present'
  exit 0
}
$parts += $target
$newPath = ($parts -join ';')
[Environment]::SetEnvironmentVariable('Path', $newPath, 'User')
Write-Output 'updated'
`;

  const result = spawnSync('powershell', ['-NoProfile', '-Command', script], {
    encoding: 'utf8',
    windowsHide: true,
  });

  if (result.error) {
    throw new Error(`Falha ao configurar PATH do usuário: ${result.error.message}`);
  }
  if (result.status !== 0) {
    const details = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
    throw new Error(`Falha ao atualizar PATH do usuário. ${details}`);
  }

  return (result.stdout || '').trim() || 'updated';
}

function configureUnixUserPath(pathToAdd) {
  const home = os.homedir();
  const rcCandidates = [path.join(home, '.zshrc'), path.join(home, '.bashrc'), path.join(home, '.profile')];
  const shell = process.env.SHELL || '';

  let preferred = rcCandidates[2];
  if (shell.includes('zsh')) {
    preferred = rcCandidates[0];
  } else if (shell.includes('bash')) {
    preferred = rcCandidates[1];
  }

  const rcPath = rcCandidates.find((candidate) => fs.existsSync(candidate)) || preferred;
  const startMarker = '# >>> universal-ai-terminal-tools >>>';
  const endMarker = '# <<< universal-ai-terminal-tools <<<';
  const block = `${startMarker}\nexport PATH="$PATH:${pathToAdd}"\n${endMarker}\n`;

  const current = fs.existsSync(rcPath) ? fs.readFileSync(rcPath, 'utf8') : '';
  if (current.includes(startMarker)) {
    return { rcPath, status: 'already-present' };
  }

  const prefix = current.endsWith('\n') || current.length === 0 ? '' : '\n';
  fs.writeFileSync(rcPath, `${current}${prefix}${block}`, 'utf8');
  return { rcPath, status: 'updated' };
}

function configureCommandPath() {
  const pathToAdd = ensureCommandShims();
  const alreadyPresentInCurrentSession = pathContainsEntry(pathToAdd);

  if (process.platform === 'win32') {
    const status = configureWindowsUserPath(pathToAdd);
    return {
      pathToAdd,
      updated: status === 'updated',
      scope: 'user',
      detail: status,
      alreadyPresentInCurrentSession,
    };
  }

  const result = configureUnixUserPath(pathToAdd);
  return {
    pathToAdd,
    updated: result.status === 'updated',
    scope: 'shell-profile',
    profileFile: result.rcPath,
    detail: result.status,
    alreadyPresentInCurrentSession,
  };
}

function createPrompt() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return {
    ask(query) {
      return new Promise((resolve) => rl.question(query, resolve));
    },
    close() {
      rl.close();
    },
  };
}

async function askYesNo(prompt, label, defaultValue = false) {
  const suffix = defaultValue ? 'S/n' : 's/N';
  const answer = await prompt.ask(`${colors.cyan}${label} (${suffix}): ${colors.reset}`);
  if (!answer.trim()) {
    return defaultValue;
  }
  return isYes(answer);
}

function normalizeSelectionList(values, allowedValues, kind) {
  const allowed = new Set(allowedValues);
  const items = unique(values || []);
  const invalid = items.filter((item) => !allowed.has(item));

  if (invalid.length > 0) {
    throw new Error(`Invalid ${kind} in profile: ${invalid.join(', ')}.`);
  }

  return items;
}

function readProfileDefinition(profileValue) {
  const builtIn = BUILTIN_PROFILES[profileValue];
  if (builtIn) {
    return {
      name: profileValue,
      source: 'builtin',
      definition: builtIn,
    };
  }

  const resolvedPath = resolvePathCandidate(profileValue);
  if (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isFile()) {
    try {
      const data = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
      return {
        name: path.basename(resolvedPath),
        source: resolvedPath,
        definition: data,
      };
    } catch (error) {
      throw new Error(`Unable to read profile file "${resolvedPath}": ${error.message}`);
    }
  }

  const available = Object.keys(BUILTIN_PROFILES).join(', ');
  throw new Error(`Unknown profile "${profileValue}". Use one of: ${available}, or pass a JSON file path.`);
}

function normalizeProfileDefinition(profileValue, definition) {
  const tools = normalizeSelectionList(definition.tools || [], TOOL_OPTIONS.map((tool) => tool.id), 'tools');
  const agents = normalizeSelectionList(definition.agents || [], AGENT_OPTIONS, 'agents');
  const rawPaths = Array.isArray(definition.paths) ? definition.paths : [];
  const paths = rawPaths.length > 0 ? unique(rawPaths.map((entry) => resolvePathCandidate(entry))) : getPreferredDefaultPaths();

  return {
    name: profileValue,
    tools,
    agents,
    paths,
  };
}

function getInteractivePathSelection(prompt) {
  return (async () => {
    console.log(`\n${colors.yellow}📂 CONFIGURAÇÃO DE CONTEXTO DE PROJETOS${colors.reset}\n`);

    const selectedPaths = [];
    for (const candidate of getDefaultProjectCandidates()) {
      const exists = fs.existsSync(candidate);
      const label = exists ? candidate : `${candidate} (não encontrado)`;
      const shouldScan = await askYesNo(prompt, `Escanear projetos em ${label}?`, false);
      if (shouldScan) {
        selectedPaths.push(candidate);
      }
    }

    const customPath = await prompt.ask(
      `${colors.cyan}Deseja adicionar um caminho customizado? (vazio para pular): ${colors.reset}`,
    );

    if (customPath.trim()) {
      const resolved = resolvePathCandidate(customPath.trim());
      if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
        selectedPaths.push(resolved);
      } else {
        console.log(
          `${colors.yellow}⚠️  Caminho customizado ignorado porque não existe ou não é diretório: ${resolved}${colors.reset}`,
        );
      }
    }

    return unique(selectedPaths);
  })();
}

async function collectBootstrapSelection(cli) {
  const profileName = cli.profileSpecified ? cli.profile : null;
  const wantsInteractive = !cli.nonInteractive && !cli.yes && !cli.profileSpecified && process.stdin.isTTY;

  if (!process.stdin.isTTY && !cli.nonInteractive && !cli.yes && !cli.profileSpecified) {
    console.log(
      `${colors.yellow}⚠️  stdin não é interativo. O setup continuará em modo não interativo usando o perfil "core".${colors.reset}`,
    );
  }

  if (profileName) {
    const profile = readProfileDefinition(profileName);
    return {
      ...normalizeProfileDefinition(profile.name, profile.definition),
      configurePath: cli.configurePath ?? true,
    };
  }

  if (!wantsInteractive) {
    const defaultTools = BUILTIN_PROFILES.core.tools;
    const defaultAgents = BUILTIN_PROFILES.core.agents;
    return {
      name: 'core',
      tools: [...defaultTools],
      agents: [...defaultAgents],
      paths: getPreferredDefaultPaths(),
      configurePath: cli.configurePath ?? true,
    };
  }

  const prompt = createPrompt();
  try {
    console.log(`${colors.yellow}🔧 CONFIGURAÇÃO DE PREFERÊNCIAS${colors.reset}\n`);

    const selectedTools = [];
    for (const tool of TOOL_OPTIONS) {
      const selected = await askYesNo(prompt, `Instalar ${tool.label}?`, false);
      if (selected) {
        selectedTools.push(tool.id);
      }
    }

    const selectedPaths = await getInteractivePathSelection(prompt);

    console.log(`\n${colors.yellow}🤖 CONFIGURAÇÃO DA EQUIPE DE AGENTES${colors.reset}\n`);
    const selectedAgents = [];
    for (const agent of AGENT_OPTIONS) {
      const selected = await askYesNo(prompt, `Ativar agente ${agent}?`, false);
      if (selected) {
        selectedAgents.push(agent);
      }
    }

    if (selectedTools.length === 0) {
      console.log(
        `${colors.yellow}⚠️  Nenhuma ferramenta foi selecionada. O setup vai continuar, mas a configuração ficará vazia.${colors.reset}`,
      );
    }

    if (selectedPaths.length === 0) {
      console.log(
        `${colors.yellow}⚠️  Nenhum caminho de projeto foi selecionado. O mapa de contexto será gerado sem diretórios base.${colors.reset}`,
      );
    }

    const configurePath =
      cli.configurePath !== null
        ? cli.configurePath
        : await askYesNo(prompt, 'Configurar comando "ai" no PATH do seu usuário?', true);

    return {
      name: 'interactive',
      tools: selectedTools,
      agents: selectedAgents,
      paths: selectedPaths,
      configurePath,
    };
  } finally {
    prompt.close();
  }
}

function saveConfigs(selection) {
  const config = {
    profile: selection.name,
    mode: selection.name === 'interactive' ? 'interactive' : 'non-interactive',
    tools: selection.tools,
    paths: selection.paths,
    agents: selection.agents,
    configure_path: selection.configurePath,
    install_date: new Date().toISOString(),
  };

  const configPath = path.resolve(ROOT_DIR, 'core-scripts', 'context', 'scan_config.json');
  const configDir = path.dirname(configPath);

  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

async function configurePathStep(selection) {
  if (!selection.configurePath) {
    console.log(`${colors.blue}ℹ️  Configuração de PATH desativada por parâmetro/perfil.${colors.reset}`);
    selection.pathConfig = {
      status: 'skipped',
      detail: 'disabled',
    };
    return;
  }

  try {
    const result = configureCommandPath();
    selection.pathConfig = {
      status: 'success',
      ...result,
    };
    console.log(
      `${colors.green}✔ PATH atualizado (${result.scope}). Reinicie o terminal para usar o comando "ai" globalmente.${colors.reset}`,
    );
  } catch (error) {
    selection.pathConfig = {
      status: 'error',
      detail: error.message,
    };
    console.log(`${colors.yellow}⚠️  Não foi possível configurar PATH automaticamente: ${error.message}${colors.reset}`);
    console.log(
      `${colors.yellow}   Você ainda pode usar os scripts locais (./ai.ps1 ou ./ai.sh) e ajustar PATH manualmente.${colors.reset}`,
    );
  }
}

function runProjectContext() {
  const scriptPath = path.resolve(ROOT_DIR, 'core-scripts', 'context', 'project_context.js');
  if (!fs.existsSync(scriptPath)) {
    throw new Error(`project_context.js não encontrado em ${scriptPath}.`);
  }

  const result = spawnSync(process.execPath, [scriptPath], {
    cwd: ROOT_DIR,
    stdio: 'inherit',
    windowsHide: true,
  });

  if (result.error) {
    throw new Error(`Falha ao executar project_context.js: ${result.error.message}`);
  }

  if (result.status !== 0) {
    throw new Error(`project_context.js saiu com código ${result.status}.`);
  }
}

async function setupWrappers(selection) {
  const summary = selection.tools.length > 0 ? selection.tools.join(', ') : 'nenhuma ferramenta';
  console.log(`${colors.blue}ℹ️  Seleção de wrappers registrada para: ${summary}${colors.reset}`);
}

async function setupAgents(selection) {
  const summary = selection.agents.length > 0 ? selection.agents.join(', ') : 'nenhum agente';
  console.log(`${colors.blue}ℹ️  Seleção de agentes registrada para: ${summary}${colors.reset}`);
}

async function finalize(selection) {
  console.log(`\n${colors.green}✅ Bootstrap concluído com sucesso.${colors.reset}`);
  console.log(
    `${colors.cyan}Próximo passo: execute o doctor novamente ou use a dispatcher conforme necessário.${colors.reset}`,
  );
  console.log(
    `${colors.magenta}Resumo: ${selection.tools.length} ferramentas, ${selection.agents.length} agentes e ${selection.paths.length} caminhos.${colors.reset}`,
  );
  if (selection.pathConfig?.status === 'success') {
    console.log(`${colors.cyan}Comando global: "ai" ficará disponível após reiniciar o terminal.${colors.reset}`);
  }
}

function renderStep(progress, total, label) {
  if (!process.stdout.isTTY) {
    console.log(`- ${label}`);
    return;
  }

  const width = 36;
  const filled = total === 0 ? width : Math.round((progress / total) * width);
  const empty = width - filled;
  const percent = total === 0 ? 100 : Math.round((progress / total) * 100);
  const bar = '█'.repeat(filled) + '░'.repeat(empty);

  process.stdout.clearLine(0);
  process.stdout.cursorTo(0);
  process.stdout.write(`${colors.cyan}[${bar}] ${percent}% | ${label}${colors.reset}`);
}

function renderStepDone() {
  if (process.stdout.isTTY) {
    process.stdout.write('\n');
  }
}

function renderHeader() {
  if (process.stdout.isTTY) {
    console.clear();
  }

  console.log(`${colors.bright}${colors.magenta}╔══════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.bright}${colors.magenta}║       UNIVERSAL AI TOOLS - BOOTSTRAP INSTALLER          ║${colors.reset}`);
  console.log(`${colors.bright}${colors.magenta}╚══════════════════════════════════════════════════════════╝${colors.reset}\n`);
}

async function runDoctorFlow() {
  const report = runDoctor({ rootDir: ROOT_DIR });

  if (report.exitCode !== 0) {
    throw new Error('Doctor encontrou dependências obrigatórias ausentes. Corrija os itens acima e tente novamente.');
  }
}

async function runSetup(cli) {
  renderHeader();

  const selection = await collectBootstrapSelection(cli);
  const modeLabel = selection.name === 'interactive' ? 'interativo' : `não interativo (${selection.name})`;

  console.log(`${colors.green}✅ Preferências carregadas em modo ${modeLabel}.${colors.reset}\n`);

  const steps = [
    { label: 'Validando dependências principais...', action: runDoctorFlow },
    { label: 'Salvando configuração bootstrap...', action: () => saveConfigs(selection) },
    { label: 'Gerando mapa de projetos...', action: runProjectContext },
    { label: 'Registrando seleção de wrappers...', action: () => setupWrappers(selection) },
    { label: 'Registrando seleção de agentes...', action: () => setupAgents(selection) },
    { label: 'Configurando comando global no PATH...', action: () => configurePathStep(selection) },
    { label: 'Finalizando bootstrap...', action: () => finalize(selection) },
  ];

  for (let index = 0; index < steps.length; index += 1) {
    const step = steps[index];
    renderStep(index, steps.length, step.label);
    try {
      await step.action();
      renderStepDone();
    } catch (error) {
      renderStepDone();
      console.log(`\n${colors.red}❌ Erro no passo: ${step.label}${colors.reset}`);
      console.log(error && error.message ? error.message : String(error));
      if (process.env.DEBUG && error && error.stack) {
        console.log(error.stack);
      }
      throw error;
    }
  }
}

async function main() {
  try {
    const cli = parseArgs(process.argv.slice(2));

    if (cli.help) {
      printUsage();
      return;
    }

    if (cli.doctor || cli.command === 'doctor') {
      const report = runDoctor({ rootDir: ROOT_DIR });
      if (report.exitCode !== 0) {
        process.exitCode = 1;
      }
      return;
    }

    await runSetup(cli);
  } catch (error) {
    console.error(`\n${colors.red}Falha no setup:${colors.reset} ${error.message}`);
    if (process.env.DEBUG && error.stack) {
      console.error(error.stack);
    }
    process.exitCode = 1;
  }
}

main();
