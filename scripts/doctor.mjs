import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { pathToFileURL } from 'url';

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

function formatStatus(ok, label) {
  const symbol = ok ? 'OK' : 'FAIL';
  const color = ok ? colors.green : colors.red;
  return `${color}${symbol}${colors.reset} ${label}`;
}

function runCommand(command, args = []) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    windowsHide: true,
  });

  if (result.error && result.error.code === 'ENOENT') {
    return {
      ok: false,
      present: false,
      command,
      args,
      output: '',
      status: null,
      error: result.error,
    };
  }

  const output = [result.stdout, result.stderr]
    .filter(Boolean)
    .map((value) => value.trim())
    .filter(Boolean)
    .join('\n');

  return {
    ok: true,
    present: true,
    command,
    args,
    output,
    status: typeof result.status === 'number' ? result.status : 0,
    error: result.error || null,
  };
}

function checkCommand(name, candidates) {
  let lastPresentFailure = null;

  for (const candidate of candidates) {
    const result = runCommand(candidate.command, candidate.args);
    if (!result.present) {
      continue;
    }

    if (result.status === 0) {
      return {
        name,
        found: true,
        command: candidate.command,
        args: candidate.args,
        output: result.output || 'present',
        status: result.status,
      };
    }

    lastPresentFailure = {
      command: candidate.command,
      args: candidate.args,
      output: result.output || `check failed with code ${result.status}`,
      status: result.status,
    };
  }

  if (lastPresentFailure) {
    return {
      name,
      found: false,
      command: lastPresentFailure.command,
      args: lastPresentFailure.args,
      output: lastPresentFailure.output,
      status: lastPresentFailure.status,
    };
  }

  return {
    name,
    found: false,
    command: candidates[0].command,
    args: candidates[0].args,
    output: 'not found',
    status: null,
  };
}

function checkRequiredCommand(name, candidates) {
  const result = checkCommand(name, candidates);
  return {
    ...result,
    required: true,
    ok: result.found,
  };
}

function checkOptionalCommand(name, candidates) {
  const result = checkCommand(name, candidates);
  return {
    ...result,
    required: false,
    ok: true,
  };
}

function printHeader(logger) {
  logger.log(`${colors.bright}${colors.magenta}╔══════════════════════════════════════════════════════════╗${colors.reset}`);
  logger.log(`${colors.bright}${colors.magenta}║                    UNIVERSAL AI DOCTOR                  ║${colors.reset}`);
  logger.log(`${colors.bright}${colors.magenta}╚══════════════════════════════════════════════════════════╝${colors.reset}\n`);
}

function printEntry(logger, entry) {
  if (entry.required) {
    const status = entry.found ? formatStatus(true, entry.name) : formatStatus(false, entry.name);
    const detail = entry.found ? entry.output : 'missing';
    logger.log(`${status} -> ${detail}`);
    return;
  }

  if (entry.found) {
    logger.log(`${formatStatus(true, entry.name)} -> ${entry.output}`);
    return;
  }

  logger.log(`${colors.yellow}SKIP${colors.reset} ${entry.name} -> not installed`);
}

function printNextSteps(logger, failedRequired) {
  if (failedRequired.length > 0) {
    logger.log(`\n${colors.red}Dependências obrigatórias ausentes:${colors.reset}`);
    for (const item of failedRequired) {
      logger.log(`- ${item.name}`);
    }
    logger.log('\nInstale os itens acima e execute novamente `node setup.js doctor`.');
    return;
  }

  logger.log(`\n${colors.green}Tudo certo.${colors.reset}`);
  logger.log('Você já pode executar o bootstrap non-interactive ou continuar no modo interativo.');
}

function runDoctor({ rootDir = process.cwd(), logger = console } = {}) {
  printHeader(logger);

  const repoChecks = [
    {
      name: 'setup.js',
      ok: fs.existsSync(path.resolve(rootDir, 'setup.js')),
      output: path.resolve(rootDir, 'setup.js'),
    },
    {
      name: 'core-scripts/context/project_context.js',
      ok: fs.existsSync(path.resolve(rootDir, 'core-scripts', 'context', 'project_context.js')),
      output: path.resolve(rootDir, 'core-scripts', 'context', 'project_context.js'),
    },
  ];

  logger.log(`${colors.blue}Repositorio${colors.reset}`);
  for (const entry of repoChecks) {
    logger.log(`${formatStatus(entry.ok, entry.name)} -> ${entry.ok ? 'found' : 'missing'}`);
  }

  const required = [
    checkRequiredCommand('node', [{ command: 'node', args: ['--version'] }]),
    checkRequiredCommand('python', [
      { command: 'python', args: ['--version'] },
      { command: 'python3', args: ['--version'] },
      { command: 'py', args: ['--version'] },
    ]),
    checkRequiredCommand('git', [{ command: 'git', args: ['--version'] }]),
  ];

  const optional = [
    checkOptionalCommand('gemini', [{ command: 'gemini', args: ['--version'] }]),
    checkOptionalCommand('claude', [{ command: 'claude', args: ['--version'] }]),
    checkOptionalCommand('gh', [{ command: 'gh', args: ['--version'] }]),
    checkOptionalCommand('docker', [{ command: 'docker', args: ['--version'] }]),
    checkOptionalCommand(
      'ai (global PATH)',
      process.platform === 'win32'
        ? [{ command: 'where', args: ['ai'] }]
        : [{ command: 'which', args: ['ai'] }],
    ),
  ];

  logger.log(`\n${colors.blue}Dependências obrigatórias${colors.reset}`);
  for (const entry of required) {
    printEntry(logger, entry);
  }

  logger.log(`\n${colors.blue}CLIs opcionais${colors.reset}`);
  for (const entry of optional) {
    printEntry(logger, entry);
  }

  const failedRequired = required.filter((entry) => !entry.ok);
  printNextSteps(logger, failedRequired);

  return {
    rootDir,
    repoChecks,
    required,
    optional,
    failedRequired,
    exitCode: failedRequired.length > 0 ? 1 : 0,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const report = runDoctor();
  process.exitCode = report.exitCode;
}

export { runDoctor };
