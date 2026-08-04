# Tarefa: Investigação D1 + correção D13 — escrita arbitrária de diretório (mesas)

Repositório: `C:\projetos\artificio` (monorepo pnpm/turbo).
Branch de trabalho: `fix/seguranca-d13-directory-write`, criada de `origin/dev` (`1692015`, merge da PR #236).
Leia `AGENTS.md` antes de agir.

## Contexto mínimo

Achado do Snyk classificado como "file inclusion". O rótulo está errado: o impacto real é **criação/escrita arbitrária de diretório**, não leitura de arquivo. Exige admin da aplicação (`requireAdmin`). Registro completo em `sessoes/26-08-03_1_seguranca_snyk-headers-sast.md`, seções `D13` e `Investigação D1` — leia só essas duas seções, não o arquivo inteiro.

Arquivo: `apps/mesas/backend/src/routes/discord/chatExporterAutomation.ts`

Linhas confirmadas no HEAD desta branch (2026-08-04, pós-merge):

```ts
:58   importDir: z.string().trim().min(1),                        // aceita qualquer caminho
:604  outputDir: path.join(parsed.data.importDir, 'incoming'),    // rota POST /test
:627  const incomingDir = path.join(parsed.data.importDir, 'incoming');
:628  await mkdir(incomingDir, { recursive: true });              // cria ANTES de conter
:636  const importResult = await runFolderImport(parsed.data.importDir, req.user?.userId);
```

`ensureInsideBaseDir` existe, mas só é aplicado dentro de `runFolderImport` (`:636`) — depois do `mkdir`. E é contenção **lexical**, não resolve symlink.

## Fase 1 — Investigação D1 (obrigatória, antes de qualquer código)

Não escreva correção antes de responder isto. Entregue as respostas antes do diff.

1. Qual é a base canônica legítima para `importDir`? Existe diretório previsto (config, env, convenção de deploy), ou é livre por design? Verifique `apps/mesas/backend/src/discord/chatExporterAutomationConfig.ts` e o `.env`/compose do mesas.
2. `chatExporterProfileRunner.ts` e o cron (`chatExporterSchedule.ts`) passam pelo mesmo caminho ou por outro? Se por outro, ele tem o mesmo furo?
3. `realpath`/symlink precisa de tratamento explícito? `ensureInsideBaseDir` é lexical — confirme se um symlink dentro da base escapa dela.
4. A configuração global tem outros campos de caminho sem contenção? (`outputDir`, `exportPath`, o que houver)
5. Se houver `importDir` legado gravado em produção fora da base canônica, o que quebra ao aplicar a contenção?

**Ponto de atenção que a sessão não registra:** a rota `POST /test` (`:588-604`) também monta caminho a partir de `importDir` sem contenção. Confirme se ela é um segundo sink e trate junto — ou explique por que não é.

## Fase 2 — Correção

Só depois da Fase 1 respondida.

- Conter `importDir` **antes** do `mkdir` e antes de executar a CLI: base canônica + `realpath` + rejeitar fora da base.
- Cobrir os dois sinks (`/run` e `/test`, se a Fase 1 confirmar).
- Erro claro na resposta da API quando o caminho for rejeitado — não falha silenciosa.
- Testes: caminho válido, `..` relativo, caminho absoluto fora da base, symlink apontando para fora (se a Fase 1 confirmar que é vetor).

## Regras do repositório (não negociáveis)

- **Não commitar, não pushar, não abrir PR.** Entregue o diff e pare. A autorização é do mantenedor, por ação.
- **`git commit --amend` proibido.**
- **Não responder nem acionar bots de review no PR** (`@codex`, `@coderabbit`, `@q`).
- Rodar antes de declarar pronto: `rtk pnpm verify:api`, `rtk pnpm run lint`, e `cd apps/mesas/backend && rtk vitest run`.
- Nunca mascarar erro (`@ts-ignore`, `eslint-disable`, `.skip`, `continue-on-error`).
- **"Solução mínima" não vale como critério** — resolver a causa raiz, não o sintoma. Escopo mínimo vale para abrangência (não sair mexendo em código não relacionado), não para profundidade.
- Comentário que explica decisão não se perde em edição: se mudar um trecho comentado, atualize o comentário para refletir a decisão atual.
- Se achar bug fora do escopo: **parar e perguntar** ao mantenedor (corrigir agora ou registrar), nunca decidir sozinho.

## Estado — o que já está em `dev`, não refazer

A PR #236 foi mergeada (`1692015`). Ela cobriu, em `apps/mesas`: stored XSS em contatos, canais `phone`/`facebook`/`instagram`, regra de link alcançável, validação por canal e alinhamento entre escrita e renderização.

Não mexa em `safeExternalUrl.ts`, `contactUrls.ts`, `tableValidators.ts`, `syncHelpers.ts` nem `contactSerializer.ts` — estão fechados.
