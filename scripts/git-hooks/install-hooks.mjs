/**
 * Instalador dos git hooks, chamado pelo `prepare` do `package.json` da raiz.
 *
 * **O `|| true` do `prepare` NÃO é preguiça — é o que mantém o build de imagem
 * verde, e o erro que ele engole é esperado.** Nenhum Dockerfile do monorepo copia
 * `scripts/` (medido em 2026-09-13 no `mesas/frontend`: as camadas trazem
 * `package.json`, `packages`, `apps/<mod>`, `patches`, e só). Como o `pnpm install`
 * dispara o `prepare`, todo build imprime:
 *
 *     Error: Cannot find module '/repo/scripts/git-hooks/install-hooks.mjs'
 *     code: 'MODULE_NOT_FOUND'
 *     ... prepare: Done
 *
 * A linha `Done` é a prova de que o `|| true` cumpriu o papel. **Isto não é falha
 * de deploy e não se conserta copiando `scripts/` para a imagem** — seria inchar a
 * imagem para rodar um instalador de git hooks num container que não tem `.git`.
 * Se um dia o ruído incomodar, a saída é `--ignore-scripts` no install dos
 * Dockerfiles (vale para os 3 apps: `mesas`, `site`, `glossario`, nenhum usa hoje),
 * o que mexe em contrato de build e aciona a trava de `deploy-flow.md` §1.
 *
 * A guarda abaixo cobre o caso oposto — o script existe, mas não há `.git`
 * (tarball, worktree sem hooks). Ela nunca é alcançada dentro da imagem, porque lá
 * o Node falha antes, ao resolver o caminho.
 */
import { chmodSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

if (!existsSync('.git') || !existsSync('.githooks')) {
  process.exit(0);
}

try {
  chmodSync('.githooks/pre-push', 0o755);
  chmodSync('.githooks/pre-commit', 0o755);
} catch {
  console.warn('Não foi possível marcar .githooks/* como executável automaticamente.');
}

const result = spawnSync('git', ['config', 'core.hooksPath', '.githooks'], {
  stdio: 'ignore',
});

if (result.status !== 0) {
  console.warn('Não foi possível configurar core.hooksPath=.githooks automaticamente.');
}
