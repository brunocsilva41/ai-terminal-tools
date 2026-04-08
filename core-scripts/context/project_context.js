import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const PROJECTS_MAP_PATH = path.resolve(process.cwd(), 'core-scripts/context/PROJECTS_MAP.json');
const CONFIG_PATH = path.resolve(process.cwd(), 'core-scripts/context/scan_config.json');

function mapProjects() {
    console.log("🔍 Scanning directories for project context...");
    
    let baseDirs = [
        'C:\\Users\\Bruno Silva\\Desktop\\Code',
        'C:\\Users\\Bruno Silva\\Documents\\Projetos'
    ];

    // Tenta ler a configuração customizada do instalador
    if (fs.existsSync(CONFIG_PATH)) {
        try {
            const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
            if (config.paths && config.paths.length > 0) {
                baseDirs = config.paths;
                console.log(`📂 Using custom scan paths from setup: ${baseDirs.join(', ')}`);
            }
        } catch (e) {
            console.log("⚠️ Error reading scan_config.json, using defaults.");
        }
    }

    const map = {
        scan_date: new Date().toISOString(),
        directories: {}
    };

    baseDirs.forEach(base => {
        if (fs.existsSync(base)) {
            try {
                const projects = fs.readdirSync(base);
                map.directories[base] = projects.map(p => {
                    const fullPath = path.join(base, p);
                    
                    // Pula se não for diretório
                    if (!fs.statSync(fullPath).isDirectory()) return null;

                    let type = "Folder/Misc";
                    if (fs.existsSync(path.join(fullPath, 'package.json'))) type = "Node/Web Project";
                    else if (fs.existsSync(path.join(fullPath, 'requirements.txt'))) type = "Python Project";
                    else if (fs.existsSync(path.join(fullPath, '.git'))) type = "Git Repository";
                    else if (fs.existsSync(path.join(fullPath, 'docker-compose.yml'))) type = "Docker Stack";

                    return {
                        name: p,
                        path: fullPath,
                        type: type,
                        description: `Projeto localizado em ${base}.`
                    };
                }).filter(p => p !== null);
            } catch (e) {
                console.log(`⚠️ Error scanning ${base}: ${e.message}`);
            }
        }
    });

    if (!fs.existsSync(path.dirname(PROJECTS_MAP_PATH))) {
        fs.mkdirSync(path.dirname(PROJECTS_MAP_PATH), { recursive: true });
    }

    fs.writeFileSync(PROJECTS_MAP_PATH, JSON.stringify(map, null, 2));
    console.log(`✅ Projects Map saved with ${Object.keys(map.directories).length} directories.`);
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1].endsWith('project_context.js')) {
    mapProjects();
}

export { mapProjects };
