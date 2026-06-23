# Débitos — 048 Importador DiscordChatExporter JSON

## DEB-048-01 — JSON inválido/truncado precisa de erro amigável

- **Origem:** `spec047-backup/extracao_json2.json`
- **Severidade:** Média
- **Descrição:** O segundo arquivo real está truncado/inválido por volta da linha 3042. Importador não pode falhar com stack trace genérico nem importar parcialmente sem rastreio.
- **Ação:** Fixture negativa + teste de endpoint/serviço retornando 400 com mensagem clara.
- **Status:** aberto

## DEB-048-02 — Automação diária com DiscordChatExporter exige desenho seguro

- **Origem:** decisão de produto 2026-06-23 — DiscordChatExporter será permanente e rodará todo dia na VM.
- **Severidade:** Alta
- **Descrição:** Rodar export diário pode envolver token/cookie/credencial Discord. Não pode virar solução frágil com cookie pessoal esquecido em script.
- **Ação:** Planejar credencial, diretórios, logs, retenção, idempotência e risco/ToS antes de qualquer VM write.
- **Status:** aberto

## DEB-048-03 — Parser ainda não cobre padrões reais do JSON

- **Origem:** auditoria `extracao_json.json`
- **Severidade:** Média
- **Descrição:** Amostra real contém `<t:UNIX:...>`, Google Forms, role mentions, contato implícito por autor e formatos variados de vagas/preço.
- **Ação:** Implementar tasks T-C1..T-C9.
- **Status:** aberto

## DEB-048-04 — Import runs podem precisar de auditoria própria

- **Origem:** robustez/operação permanente
- **Severidade:** Baixa/Média
- **Descrição:** MVP pode funcionar sem migration, mas operação diária permanente pode precisar rastrear arquivo, hash, contagens e erros por execução.
- **Ação:** Avaliar `discord_import_runs` após MVP upload manual.
- **Status:** aberto

## DEB-048-05 — Script DiscordChatExporter local não é desenho seguro de automação permanente

- **Origem:** diff local `apps/mesas/scripts/discord-export.sh`
- **Severidade:** Alta
- **Descrição:** O script usa `tyrrrz/discordchatexporter:latest`, recebe token por argumento CLI e grava por padrão em `/opt/artificio/exports`. Ele também documenta uso manual e “não automatizar”, o que conflita com a decisão de produto da Spec 048: evolução futura com execução diária permanente na VM.
- **Ação:** Antes de qualquer commit/VM write, decidir se o script será removido, mantido como helper manual ou redesenhado para operação diária com versão pinada, segredo fora de argv, diretórios `incoming/processed/error`, retenção e risco/ToS documentado.
- **Status:** aberto

## DEB-048-06 — Fallback DeepSeek está no diff local, mas não pertence diretamente ao importador JSON

- **Origem:** diff local `apps/mesas/backend/src/inbox/deepseek.ts` + alteração em `adminImportInbox.ts`
- **Severidade:** Média/Alta
- **Descrição:** O fallback DeepSeek envia texto bruto de anúncio para API externa quando `manual_paste` tem baixa confiança ou sem `system_id`. Isso pode ser útil para a Inbox, mas não é parte do MVP DiscordChatExporter JSON. O arquivo atual faz cast do JSON retornado sem Zod/schema forte, não tem timeout explícito e a falha é silenciosa.
- **Ação:** Reclassificar em Spec 047 ou spec própria. Se mantido: validar retorno com schema, adicionar testes, timeout, política de privacidade/logs e documentação de env `DEEPSEEK_API_KEY`.
- **Status:** aberto

## DEB-048-07 — `chrono-node`/`fuzzball` já aparecem no diff, mas precisam de matriz real

- **Origem:** diff local `parseDiscordAnnouncement.ts`, `normalizeDiscordTableDraft.ts`, `apps/mesas/backend/package.json`
- **Severidade:** Média
- **Descrição:** O parser passou a usar `chrono-node` e o match de sistemas passou a usar `fuzzball.token_sort_ratio >= 82`. Isso pode melhorar robustez, mas sem matriz de exemplos pode introduzir falso positivo de sistema, dia/hora ambíguos ou retorno declarado `quinzenal` sem implementação real.
- **Ação:** Criar testes com exemplos reais do JSON e comparar antes/depois. Ajustar threshold e regras de frequência antes de declarar ferramenta adotada.
- **Status:** aberto

## DEB-048-08 — Playwright E2E local depende de autenticação admin não resolvida

- **Origem:** diff local `apps/mesas/frontend/e2e/` + `apps/mesas/frontend/vitest.config.ts`
- **Severidade:** Média
- **Descrição:** O smoke E2E aponta para `https://mesasbeta.artificiorpg.com` e pressupõe cookie/sessão admin válido. Sem estratégia de `storageState` segura, ele pode virar teste manual disfarçado, flaky ou dependente do Chrome/cookies reais do mantenedor. O diff também altera `vitest.config.ts` para excluir `e2e/` e `**/*.spec.ts`; hoje os testes unitários são `*.test.*`, mas esse padrão pode esconder futuros unit specs sem perceber.
- **Ação:** Definir autenticação de teste sem Chrome real; decidir se roda em CI, local ou somente smoke manual; limitar o exclude do Vitest ao diretório E2E se possível. Registrar pré-requisitos e comando real antes de fechar.
- **Status:** aberto
