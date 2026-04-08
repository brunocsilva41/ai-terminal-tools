import fs from 'fs';
import path from 'path';
import { logTitle, logSuccess, logError, checkbox, closeUI } from './ui_helper.js';

async function mapProjectForTests(projectPath) {
    logTitle(`Mapeamento de Testes: ${path.basename(projectPath)}`);
    
    const testableAreas = [];
    
    // Procura por áreas comuns
    const mappings = [
        { dir: 'src/components', label: 'Componentes Frontend (React)' },
        { id: 'api', dir: 'src/pages/api', label: 'Endpoints API (Next.js)' },
        { id: 'routes', dir: 'routes', label: 'Rotas Backend (Express/FastAPI)' },
        { id: 'db', dir: 'prisma', label: 'Modelos de Banco de Dados' },
        { id: 'e2e', dir: 'tests/e2e', label: 'Fluxos de Usuário (E2E)' }
    ];

    for (const m of mappings) {
        if (fs.existsSync(path.join(projectPath, m.dir))) {
            testableAreas.push(m.label);
        }
    }

    if (testableAreas.length === 0) {
        logError("Nenhuma área testável padrão encontrada. Mapeando arquivos soltos...");
        testableAreas.push("Scripts Root", "Configurações de Ambiente");
    }

    const selected = await checkbox("Quais áreas você deseja testar massivamente?", testableAreas);
    
    if (selected.length > 0) {
        logSuccess(`Iniciando ecossistema de testes para: ${selected.join(', ')}`);
        // Aqui o Tester chamaria os scripts de execução real (Jest, Playwright, Newman)
    } else {
        logError("Nenhuma área selecionada. Abortando.");
    }

    closeUI();
}

const target = process.argv[2] || process.cwd();
mapProjectForTests(target);
