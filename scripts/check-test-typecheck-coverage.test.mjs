import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { analyzeWorkspace } from './check-test-typecheck-coverage.mjs';

const ts = createRequire(import.meta.url)('typescript');

/**
 * O gate responde uma pergunta só: existe algum `tsc` que abra este arquivo de
 * teste? Errar para qualquer lado tem custo real — um falso negativo devolve a
 * lacuna que o gate existe para fechar (erro de tipo em teste passando verde),
 * e um falso positivo acusa pacote correto, que é como um gate ganha fama de
 * ruidoso e termina desligado.
 *
 * Por isso os casos abaixo são os quatro desenhos que o monorepo de fato usa,
 * montados em disco. Três deles já produziram falso positivo numa versão
 * anterior deste script: build que delega via `pnpm --filter`, `tsc` sem `-p`, e
 * `tsc -b` que só alcança o teste através de `references`.
 */

const tmpDirs = [];

function makeWorkspace(packages) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-cov-'));
  tmpDirs.push(root);
  const entries = [];

  for (const [name, spec] of Object.entries(packages)) {
    const dir = path.join(root, name.replace('@artificio/', ''));
    fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'package.json'),
      JSON.stringify({ name, scripts: spec.scripts || {} }),
    );
    for (const [file, contents] of Object.entries(spec.files || {})) {
      const target = path.join(dir, file);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, contents);
    }
    entries.push({ name, path: dir });
  }
  return entries;
}

function statusOf(packages, name) {
  const results = analyzeWorkspace({ ts, packages: makeWorkspace(packages) });
  return results.find((r) => r.name === name);
}

const TSCONFIG_INCLUINDO_TESTE = JSON.stringify({ include: ['src/**/*.ts'] });
const TSCONFIG_EXCLUINDO_TESTE = JSON.stringify({
  include: ['src/**/*.ts'],
  exclude: ['src/**/*.test.ts'],
});

afterEach(() => {
  for (const dir of tmpDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe('acusa teste que nenhum tsc alcança', () => {
  it('build sobre tsconfig.build.json que exclui teste, sem tarefa typecheck', () => {
    // A lacuna original: o pacote compila, testa, passa verde — e o arquivo de
    // teste nunca é aberto por um compilador.
    const result = statusOf(
      {
        '@artificio/alvo': {
          scripts: { build: 'tsc -p tsconfig.build.json', test: 'vitest run' },
          files: {
            'tsconfig.json': TSCONFIG_INCLUINDO_TESTE,
            'tsconfig.build.json': TSCONFIG_EXCLUINDO_TESTE,
            'src/index.ts': 'export const x = 1;',
            'src/index.test.ts': 'export const t = 1;',
          },
        },
      },
      '@artificio/alvo',
    );
    expect(result.status).toBe('descoberto');
    expect(result.uncovered).toEqual([path.join('src', 'index.test.ts')]);
  });

  it('tsconfig único que exclui teste — o desenho do catalog-ui antes do fix', () => {
    const result = statusOf(
      {
        '@artificio/alvo': {
          scripts: { build: 'tsc -p tsconfig.json', test: 'vitest run' },
          files: {
            'tsconfig.json': TSCONFIG_EXCLUINDO_TESTE,
            'src/index.ts': 'export const x = 1;',
            'src/index.test.ts': 'export const t = 1;',
          },
        },
      },
      '@artificio/alvo',
    );
    expect(result.status).toBe('descoberto');
  });

  it('aponta só os arquivos descobertos, não a suíte inteira', () => {
    const result = statusOf(
      {
        '@artificio/alvo': {
          scripts: {
            build: 'tsc -p tsconfig.build.json',
            typecheck: 'tsc -p tsconfig.json --noEmit',
            test: 'vitest run',
          },
          files: {
            // O `typecheck` alcança `dentro.test.ts` mas não `fora.test.ts`:
            // cobertura parcial precisa acusar só o que falta.
            'tsconfig.json': JSON.stringify({
              include: ['src/**/*.ts'],
              exclude: ['src/fora.test.ts'],
            }),
            'tsconfig.build.json': TSCONFIG_EXCLUINDO_TESTE,
            'src/index.ts': 'export const x = 1;',
            'src/dentro.test.ts': 'export const a = 1;',
            'src/fora.test.ts': 'export const b = 1;',
          },
        },
      },
      '@artificio/alvo',
    );
    expect(result.status).toBe('descoberto');
    expect(result.uncovered).toEqual([path.join('src', 'fora.test.ts')]);
  });
});

describe('não acusa pacote já coberto', () => {
  it('tarefa typecheck sobre tsconfig que inclui teste', () => {
    const result = statusOf(
      {
        '@artificio/alvo': {
          scripts: {
            build: 'tsc -p tsconfig.build.json',
            typecheck: 'tsc -p tsconfig.json --noEmit',
            test: 'vitest run',
          },
          files: {
            'tsconfig.json': TSCONFIG_INCLUINDO_TESTE,
            'tsconfig.build.json': TSCONFIG_EXCLUINDO_TESTE,
            'src/index.ts': 'export const x = 1;',
            'src/index.test.ts': 'export const t = 1;',
          },
        },
      },
      '@artificio/alvo',
    );
    expect(result.status).toBe('coberto');
  });

  it('`tsc` sem -p, que usa ./tsconfig.json — o desenho dos backends e do site', () => {
    // Versão anterior do gate só entendia `tsc -p`, e acusava `apps/site` e os
    // quatro backends, todos corretos.
    const result = statusOf(
      {
        '@artificio/alvo': {
          scripts: { build: 'tsc', test: 'vitest run' },
          files: {
            'tsconfig.json': TSCONFIG_INCLUINDO_TESTE,
            'src/index.ts': 'export const x = 1;',
            'src/index.test.ts': 'export const t = 1;',
          },
        },
      },
      '@artificio/alvo',
    );
    expect(result.status).toBe('coberto');
  });

  it('`tsc --noEmit` sem -p', () => {
    const result = statusOf(
      {
        '@artificio/alvo': {
          scripts: { typecheck: 'tsc --noEmit', test: 'vitest run' },
          files: {
            'tsconfig.json': TSCONFIG_INCLUINDO_TESTE,
            'src/index.ts': 'export const x = 1;',
            'src/index.test.ts': 'export const t = 1;',
          },
        },
      },
      '@artificio/alvo',
    );
    expect(result.status).toBe('coberto');
  });

  it('`tsc -b` que alcança o teste por references — o desenho dos frontends', () => {
    const result = statusOf(
      {
        '@artificio/alvo': {
          scripts: { build: 'tsc -b && vite build', test: 'vitest run' },
          files: {
            'tsconfig.json': JSON.stringify({
              files: [],
              references: [{ path: './tsconfig.app.json' }, { path: './tsconfig.test.json' }],
            }),
            'tsconfig.app.json': TSCONFIG_EXCLUINDO_TESTE,
            'tsconfig.test.json': JSON.stringify({ include: ['src'] }),
            'src/index.ts': 'export const x = 1;',
            'src/index.test.ts': 'export const t = 1;',
          },
        },
      },
      '@artificio/alvo',
    );
    expect(result.status).toBe('coberto');
  });

  it('`tsc -b` cujas references NÃO alcançam o teste continua sendo acusado', () => {
    // O par do caso acima: `tsc -b` não é passe livre, o que vale é o alcance real.
    const result = statusOf(
      {
        '@artificio/alvo': {
          scripts: { build: 'tsc -b && vite build', test: 'vitest run' },
          files: {
            'tsconfig.json': JSON.stringify({
              files: [],
              references: [{ path: './tsconfig.app.json' }],
            }),
            'tsconfig.app.json': TSCONFIG_EXCLUINDO_TESTE,
            'src/index.ts': 'export const x = 1;',
            'src/index.test.ts': 'export const t = 1;',
          },
        },
      },
      '@artificio/alvo',
    );
    expect(result.status).toBe('descoberto');
  });
});

describe('pacote agregador não é acusado pelos testes de quem ele delega', () => {
  it('`pnpm --filter` marca o pacote como delegado', () => {
    // `apps/mesas` não tem teste próprio: os arquivos sob ele pertencem a
    // `mesas-backend`/`mesas-frontend`, avaliados por conta própria. Sem esta
    // regra o gate contava os mesmos testes duas vezes e acusava o agregador.
    const results = analyzeWorkspace({
      ts,
      packages: makeWorkspace({
        '@artificio/agregador': {
          scripts: {
            build: 'pnpm --filter @artificio/parte build',
            test: 'pnpm --filter @artificio/parte test',
          },
        },
        '@artificio/parte': {
          scripts: { build: 'tsc', test: 'vitest run' },
          files: {
            'tsconfig.json': TSCONFIG_INCLUINDO_TESTE,
            'src/index.ts': 'export const x = 1;',
            'src/index.test.ts': 'export const t = 1;',
          },
        },
      }),
    });

    // O agregador aninha o pacote delegado dentro do próprio diretório, como
    // `apps/mesas` faz com `backend/` e `frontend/`.
    expect(results.find((r) => r.name === '@artificio/parte').status).toBe('coberto');
  });

  it('agregador com teste que NÃO pertence a quem ele delega ainda é acusado', () => {
    const packages = makeWorkspace({
      '@artificio/agregador': {
        scripts: { test: 'pnpm --filter @artificio/parte test' },
        files: { 'src/proprio.test.ts': 'export const t = 1;' },
      },
      '@artificio/parte': {
        scripts: { build: 'tsc', test: 'vitest run' },
        files: {
          'tsconfig.json': TSCONFIG_INCLUINDO_TESTE,
          'src/index.ts': 'export const x = 1;',
        },
      },
    });
    const results = analyzeWorkspace({ ts, packages });
    expect(results.find((r) => r.name === '@artificio/agregador').status).toBe('descoberto');
  });
});

describe('pacote sem teste não é cobrado', () => {
  it('nenhum arquivo de teste', () => {
    const result = statusOf(
      {
        '@artificio/alvo': {
          scripts: { build: 'tsc -p tsconfig.build.json' },
          files: {
            'tsconfig.build.json': TSCONFIG_EXCLUINDO_TESTE,
            'src/index.ts': 'export const x = 1;',
          },
        },
      },
      '@artificio/alvo',
    );
    expect(result.status).toBe('sem-testes');
  });
});
