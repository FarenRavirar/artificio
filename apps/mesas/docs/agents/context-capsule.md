# Context Capsule - Mesas RPG Artificio

Ultima atualizacao: 2026-05-31

## Como usar

Este e o arquivo curto para retomada apos compactacao. Uma nova sessao deve ler, no maximo:

1. `.specify/memory/project-state.md`
2. `AGENTS.md`
3. `docs/agents/context-capsule.md`

Se houver conflito, `AGENTS.md` prevalece. Para arquitetura e contratos tecnicos, prevalece `.specify/arquiteture.md`.

## Identidade do produto

Mesas RPG Artificio e um portal colaborativo para anuncios de mesas de RPG. Compromissos inegociaveis:

- Gratuidade.
- Sem anúncios.
- Sem coleta desnecessaria de dados.
- Google OAuth como unico login autorizado.
- Discord e vinculo opcional de perfil, nao substitui Google OAuth.

## Ambientes

| Ambiente | URL | Branch | Pasta |
|---|---|---|---|
| Beta | `mesasbeta.artificiorpg.com` | `dev` | `/opt/mesas-beta/` |
| Producao | `mesas.artificiorpg.com` | `main` | `/opt/mesas/` |

Fluxo normal: `feat/*` -> `dev`/Beta -> `main`/Producao.

Validacao funcional de UI/fluxos reais so conta depois de deploy em `dev`/Beta e teste do mantenedor em janela anonima. Browser plugin, Playwright local, screenshot local ou simulacao do agente nao substituem essa validacao; servem apenas como apoio tecnico antes do deploy.

## Stack ativo de agentes

- `mattpocock/skills`: fluxo diario para alinhamento, diagnostico, TDD, arquitetura, handoff, PRD/issues.
- `JuliusBrussee/caveman`: economia de contexto quando solicitada ou util em sessao longa.
- Skills `.system` do Codex: runtime interno.
- `obra/superpowers`: referencia seletiva, nao pacote ativo.

Skills antigas `.agent/skills`, `.agents/skills` e `.gemini/skills` estao desativadas. Nao recriar sem decisao explicita do mantenedor.

## Quando usar SDD

| Modo | Use quando |
|---|---|
| Sem SDD | Pergunta, doc delta, correcao pontual ou ajuste pequeno sem risco critico. |
| SDD Lite | Bug moderado, feature pequena ou mudanca localizada com impacto de produto. |
| SDD Completo | Migration, banco, auth, permissoes, dados pessoais, upload/Cloudinary, API publica, deploy, CI/CD, infraestrutura, feature grande ou refatoracao ampla. |

`/speckit.*` e procedimento documental do agente, nao comando CLI nem skill ativa.

SDD Completo usa `spec.md`, `plan.md`, `tasks.md`, validacao e sessao; quando houver PR, tambem `pr-description.md`.

## Regras petreas resumidas

- Nao fazer commit, push para `dev/main`, deploy, restart/stop/start Docker, `scp`/`rsync`/`docker cp`, build no servidor, write em banco ou comandos destrutivos sem aprovacao quando exigida por `AGENTS.md`.
- **Aprovacao vale por acao, nao por sessao.** "Pode prosseguir"/"faca o deploy" autoriza so o bloco apresentado. Nao se estende a commits/pushes/correcoes seguintes (ex.: re-push apos migration falhar, ou commit de docs/sessao pos-deploy). Pedir aprovacao de novo a cada `git commit`/`git push`. Editar arquivo local e livre; commitar/pushar nunca.
- Nunca aplicar migration com `TRUNCATE`, `DROP`, `DELETE` ou `ALTER` em producao sem dump previo e checklist.
- Nunca executar `ALTER TABLE` avulso em producao.
- Nunca reaplicar migration antiga com mais de uma semana.
- Nunca usar `git checkout` entre `dev` e `main` durante deploy.
- Nunca criar tunnel/container `cloudflared` paralelo.
- Nunca expor token, PAT, segredo ou credencial em chat, logs, commits ou arquivos.

## Invariantes tecnicos

- Banco canonico: `mesas_rpg`.
- Upload/processamento de imagens: sempre via backend.
- Cloudinary: `VITE_CLOUDINARY_CLOUD_NAME` e `VITE_CLOUDINARY_UPLOAD_PRESET` sao build-time; nunca hardcodar.
- `cover_deletehash`, `avatar_deletehash` e `banner_deletehash` nunca retornam por rotas publicas.
- Elevacao `player -> gm` ao criar primeiro `gm_profile` e exclusiva do backend.
- **Normalização obrigatória:** dados externos entram como `unknown` ate passar por normalizador tipado antes de estado React, props ou renderizacao.
- Para JSON/JSONB legado que possa vir string ou objeto, normalizador aceita formatos conhecidos e retorna fallback seguro.
- Mudanca visivel para mestres ou usuarios finais exige `database/changelogs.json` antes do deploy.

## Erros conhecidos

Ao encontrar erro, consultar `.specify/memory/errors.md` por `E###` ou sintoma antes de repetir tentativas. Usar `/speckit.fixit.run` como procedimento documental quando o risco justificar.

## Estado atual

Conforme `project-state.md` em 2026-05-31:

- Feature operacional lider do roadmap: `specs/016-discord-pipeline-rebuild/`.
- Sessao Discord ativa historica: `sessoes/26-05-09_2_discord-pipeline-fase-1-em-diante.md`.
- Fase 0 do pipeline Discord entregue; Fase 1 esta pronta para iniciar quando o mantenedor retomar esse trabalho.
- Sessao atual de governanca: `sessoes/26-05-31_1_migracao-governanca-skills.md`.

## Decisoes fixas

- Skills ativas pessoais ficam em `C:\Users\paulo\.codex\skills`.
- Backups da reforma de skills: `C:\Users\paulo\.codex\backups\skills-reform-20260531-174406`.
- Matt e Caveman sao ativos; Superpowers e apenas referencia seletiva.
- SDD Completo continua obrigatorio para alto risco.
- Tarefas simples nao devem disparar cerimonia completa por padrao.

## Riscos atuais

- Cortar SDD demais e perder rastreabilidade.
- Manter SDD demais e travar execucao diaria.
- Reintroduzir skills antigas como fonte ativa.
- Duplicar regra entre documentos e criar contradicao.
- Concluir tarefa sem evidencia fresca.

## Como retomar sessao

1. Ler `project-state.md`, `AGENTS.md` e este capsule.
2. Verificar se ha sessao ativa incompleta em `sessoes/`.
3. Registrar na sessao o que sera feito antes de editar.
4. Escolher modo: Sem SDD, SDD Lite ou SDD Completo.
5. Executar no menor processo que controle o risco.
6. Atualizar sessao e `project-state.md` quando o estado operacional mudar.
7. Ao fechar sessao, registrar retro/session-log via procedimento `/speckit.retro.run` quando aplicavel.
