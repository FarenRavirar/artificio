import { execFile } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { afterAll, describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const temporaryOutputs: string[] = [];

describe('fronteiras do pacote', () => {
  afterAll(async () => {
    await Promise.all(
      temporaryOutputs.map((path) => rm(path, { recursive: true, force: true })),
    );
  });

  it('expõe root, React e CSS separadamente, com React fornecido pelo consumidor', async () => {
    const packageJson = JSON.parse(await readFile(resolve(packageRoot, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>;
      exports?: Record<string, unknown>;
      peerDependencies?: Record<string, string>;
      peerDependenciesMeta?: Record<string, { optional?: boolean }>;
      scripts?: Record<string, string>;
    };

    expect(packageJson.exports).toHaveProperty('.');
    expect(packageJson.exports).toHaveProperty('./react');
    expect(packageJson.exports).toHaveProperty('./styles.css');
    expect(packageJson.peerDependencies).toMatchObject({
      react: '^19.2.7',
      'react-dom': '^19.2.7',
    });
    expect(packageJson.peerDependenciesMeta).toMatchObject({
      react: { optional: true },
      'react-dom': { optional: true },
    });
    expect(packageJson.dependencies).not.toHaveProperty('react');
    expect(packageJson.dependencies).not.toHaveProperty('react-dom');
    expect(packageJson.dependencies).toMatchObject({
      '@artificio/content-editor': 'workspace:*',
    });
    expect(packageJson.scripts?.build).toContain('copyFileSync');
  });

  it('mantém o root livre de React, TanStack e globals de navegador', async () => {
    const sourceDirectory = resolve(packageRoot, 'src');
    const rootModules = (await readdir(sourceDirectory))
      .filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts') && name !== 'react.ts')
      .map((name) => resolve(sourceDirectory, name));
    const serverSafeContentEditorModules = [
      resolve(packageRoot, '../content-editor/src/sanitize.ts'),
      resolve(packageRoot, '../content-editor/src/commentLinks.ts'),
    ];
    const runtimeSources = await Promise.all(
      [...rootModules, ...serverSafeContentEditorModules].map((path) => readFile(path, 'utf8')),
    );

    for (const source of runtimeSources) {
      expect(source).not.toMatch(/from ['"]react(?:\/|['"])/);
      expect(source).not.toContain('@tanstack/');
    }
    expect('window' in globalThis).toBe(false);
    await expect(import('./index.js')).resolves.toBeDefined();
  });

  // Os asserts acima leem os FONTES; este lê o ARTEFATO. A distinção é o ponto:
  // quem quebra o backend do `accounts.` é o `dist-cjs` emitido, não o `.ts`.
  // Trocar `tsconfig.cjs.json` para incluir `react.ts` passaria em todos os
  // testes de fonte e só falharia em runtime, no container — que é exatamente o
  // incidente E016/E017 (`MODULE_NOT_FOUND` verde no CI, quebrado em produção).
  //
  // Compila em diretório temporário em vez de ler `dist-cjs/`: `turbo.json`
  // declara `test.dependsOn: ["^build"]` — build dos DEPENDENTES, não do próprio
  // pacote. Medido: `rm -rf dist dist-cjs && pnpm run test` passa 174/174 com o
  // `dist` inexistente, então um assert sobre o artefato pré-existente daria
  // falso-verde em CI limpo e falso-vermelho para quem nunca buildou local.
  it('emite CJS do root sem React, no artefato realmente construído', async () => {
    const outputDirectory = await mkdtemp(resolve(tmpdir(), 'artificio-comments-cjs-'));
    temporaryOutputs.push(outputDirectory);

    await execFileAsync(
      process.execPath,
      [
        resolve(packageRoot, '../../node_modules/typescript/lib/tsc.js'),
        '-p',
        resolve(packageRoot, 'tsconfig.cjs.json'),
        '--outDir',
        outputDirectory,
      ],
      { cwd: packageRoot },
    );

    const emittedFiles = await readdir(outputDirectory);
    expect(emittedFiles).toContain('index.js');
    // `react.ts` fora do projeto CJS é o que mantém o root importável por Node.
    expect(emittedFiles).not.toContain('react.js');

    const emittedRoot = await readFile(resolve(outputDirectory, 'index.js'), 'utf8');
    expect(emittedRoot).not.toMatch(/require\(['"]react(?:-dom)?(?:\/|['"])/);
    expect(emittedRoot).not.toContain('@tanstack/');

    const emittedSources = await Promise.all(
      emittedFiles
        .filter((name) => name.endsWith('.js'))
        .map((name) => readFile(resolve(outputDirectory, name), 'utf8')),
    );
    for (const source of emittedSources) {
      expect(source).not.toMatch(/require\(['"]react(?:-dom)?(?:\/|['"])/);
    }
  }, 60_000);

  it('publica CSS por tokens e slots, sem Tailwind compilado', async () => {
    const css = await readFile(resolve(packageRoot, 'src/styles.css'), 'utf8');

    expect(css).toContain('--artificio-comments-');
    expect(css).toContain('.artificio-comments__status');
    expect(css).not.toMatch(/@(apply|tailwind)/);
  });
});
