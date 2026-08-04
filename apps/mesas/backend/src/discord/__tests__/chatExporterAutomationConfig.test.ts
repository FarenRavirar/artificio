import { mkdtemp, mkdir, realpath, rm, symlink, writeFile } from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  ensureDirectoryInsideBase,
  resolveDirectoryInsideBase,
} from '../chatExporterAutomationConfig.js';

const tempDirs: string[] = [];

async function makeDir(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'artificio-d13-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('contenção canônica do DiscordChatExporter', () => {
  it('aceita caminho relativo legítimo dentro da base e cria somente depois de validar', async () => {
    const baseDir = await makeDir();
    const result = await ensureDirectoryInsideBase(path.join('perfil-1', 'incoming'), baseDir);

    expect(result).toBe(path.join(await realpath(baseDir), 'perfil-1', 'incoming'));
  });

  it('rejeita travessia relativa com ..', async () => {
    const baseDir = await makeDir();

    await expect(resolveDirectoryInsideBase('../fora', baseDir))
      .rejects.toThrow('Diretório fora da base permitida');
  });

  it('rejeita caminho absoluto fora da base', async () => {
    const baseDir = await makeDir();
    const outsideDir = await makeDir();

    await expect(resolveDirectoryInsideBase(outsideDir, baseDir))
      .rejects.toThrow('Diretório fora da base permitida');
  });

  it('rejeita importDir symlink dentro da base apontando para fora', async () => {
    const baseDir = await makeDir();
    const outsideDir = await makeDir();
    const linkedDir = path.join(baseDir, 'perfil-link');
    await symlink(outsideDir, linkedDir, 'junction');

    await expect(resolveDirectoryInsideBase(linkedDir, baseDir))
      .rejects.toThrow('Diretório fora da base permitida');
  });

  it('aceita base cujo caminho passa por symlink, encadeando as duas etapas', async () => {
    // Achado P2 do Codex na PR #237: com base atrás de symlink (`/var` no macOS
    // resolve para `/private/var`), ensureDirectoryInsideBase devolvia caminho
    // real e prepareChatExporterImportPaths o realimentava contra a base
    // lexical — a segunda etapa rejeitava o que a primeira tinha aprovado.
    const realBase = await makeDir();
    const linkParent = await makeDir();
    const linkedBase = path.join(linkParent, 'base-link');
    await symlink(realBase, linkedBase, 'junction');

    const rootDir = await ensureDirectoryInsideBase('perfil-1', linkedBase);
    await expect(ensureDirectoryInsideBase(path.join(rootDir, 'incoming'), linkedBase))
      .resolves.toContain('incoming');
  });

  it('rejeita escape mesmo quando a base tem nome lexical e real distintos', async () => {
    // Guard-rail do fix P2: aceitar os dois nomes da base não pode virar porta
    // de saída — symlink dentro da base apontando pra fora continua barrado,
    // e o alvo absoluto fora dela também.
    const realBase = await makeDir();
    const outsideDir = await makeDir();
    const linkParent = await makeDir();
    const linkedBase = path.join(linkParent, 'base-link');
    await symlink(realBase, linkedBase, 'junction');

    await expect(resolveDirectoryInsideBase(outsideDir, linkedBase))
      .rejects.toThrow('Diretório fora da base permitida');

    const escape = path.join(realBase, 'perfil-fuga');
    await symlink(outsideDir, escape, 'junction');
    await expect(resolveDirectoryInsideBase(escape, linkedBase))
      .rejects.toThrow('Diretório fora da base permitida');
  });

  it('rejeita alvo que é arquivo e travessia através de arquivo', async () => {
    // Achado do Codex na PR #237: sem checar isDirectory(), os dois casos eram
    // aprovados aqui e só estouravam no mkdir como ENOTDIR cru — o admin
    // recebia erro de sistema em vez do 422 com mensagem explicativa.
    const baseDir = await makeDir();
    const filePath = path.join(baseDir, 'arquivo.txt');
    await writeFile(filePath, 'conteudo');

    await expect(resolveDirectoryInsideBase(filePath, baseDir))
      .rejects.toThrow('precisa ser um diretório');

    await expect(resolveDirectoryInsideBase(path.join(filePath, 'incoming'), baseDir))
      .rejects.toThrow('precisa ser um diretório');
  });

  it('rejeita incoming existente como symlink para fora', async () => {
    const baseDir = await makeDir();
    const outsideDir = await makeDir();
    const profileDir = path.join(baseDir, 'perfil-1');
    await mkdir(profileDir);
    await symlink(outsideDir, path.join(profileDir, 'incoming'), 'junction');

    await expect(ensureDirectoryInsideBase(path.join(profileDir, 'incoming'), baseDir))
      .rejects.toThrow('Diretório fora da base permitida');
  });
});
