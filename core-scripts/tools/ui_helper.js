import readline from 'readline';

const colors = {
    reset: "\x1b[0m",
    bright: "\x1b[1m",
    cyan: "\x1b[36m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    magenta: "\x1b[35m",
    blue: "\x1b[34m",
    red: "\x1b[31m"
};

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const ask = (query) => new Promise((resolve) => rl.question(`${colors.bright}${colors.cyan}? ${colors.reset}${query}: `, resolve));

export async function confirm(message) {
    const ans = await ask(`${message} (s/n)`);
    return ans.toLowerCase() === 's';
}

export async function select(message, options) {
    console.log(`\n${colors.bright}${colors.magenta}🔍 ${message}${colors.reset}`);
    options.forEach((opt, i) => console.log(`${colors.cyan}[${i + 1}]${colors.reset} ${opt}`));
    const ans = await ask(`Selecione uma opção (1-${options.length})`);
    const idx = parseInt(ans) - 1;
    return options[idx] || null;
}

export async function checkbox(message, options) {
    console.log(`\n${colors.bright}${colors.magenta}✅ ${message}${colors.reset}`);
    console.log(`${colors.yellow}(Digite os números separados por vírgula, ex: 1,3)${colors.reset}`);
    options.forEach((opt, i) => console.log(`${colors.cyan}[${i + 1}]${colors.reset} [ ] ${opt}`));
    const ans = await ask(`Sua seleção`);
    const indices = ans.split(',').map(n => parseInt(n.trim()) - 1);
    return indices.map(i => options[i]).filter(opt => !!opt);
}

export function closeUI() {
    rl.close();
}

export function logTitle(title) {
    console.log(`\n${colors.bright}${colors.blue}=== ${title.toUpperCase()} ===${colors.reset}\n`);
}

export function logSuccess(msg) {
    console.log(`${colors.green}✔ ${msg}${colors.reset}`);
}

export function logError(msg) {
    console.log(`${colors.red}✘ ${msg}${colors.reset}`);
}
