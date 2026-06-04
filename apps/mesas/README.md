# 🎲 Mesas RPG Artifício

> Um portal colaborativo para encontrar, publicar e acompanhar mesas de RPG no Brasil.

[![Teste](https://img.shields.io/badge/beta-mesasbeta.artificiorpg.com-orange)](https://mesasbeta.artificiorpg.com)
[![Oficial](https://img.shields.io/badge/produção-mesas.artificiorpg.com-success)](https://mesas.artificiorpg.com)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

---

## 🌟 O que é este projeto?

O **Mesas RPG Artifício** nasceu para resolver um problema simples: hoje, encontrar mesa de RPG ainda depende de muitos grupos espalhados e mensagens perdidas.

Aqui, a ideia é centralizar tudo em um só lugar:
- pessoas jogadoras encontram mesas com mais facilidade;
- mestres conseguem publicar suas mesas com mais organização;
- a comunidade acompanha a evolução do projeto com transparência.

> [!IMPORTANT]
> Este projeto é construído de forma **gratuita**, sem anúncios e com foco comunitário.

---

## 🚀 Como usar agora (passo a passo)

### Para quem quer encontrar mesa

1. Acesse o beta: [mesas.artificiorpg.com](https://mesas.artificiorpg.com)
2. Navegue pelo catálogo público
3. Use filtros (sistema, modalidade, idioma, dia, preço etc.)
4. Abra a página da mesa e confira detalhes

### Para mestres que querem publicar

1. Entre no portal
2. Faça login com Google
3. Acesse o painel do mestre
4. Crie sua mesa com sistema, cenário, horários, vagas e descrição
5. Publique e acompanhe pelo painel

---

## ✅ O que já dá para fazer hoje

### Jogadores
- Buscar mesas com filtros estruturados
- Ver catálogo público de mesas ativas
- Abrir página detalhada de cada mesa

### Mestres
- Login com Google
- Criar e editar mesas no painel
- Gerenciar informações da mesa (vagas, descrição, horários)
- Sugerir sistemas e cenários

### Administração
- Moderação de dados
- Gestão de taxonomias (sistemas e cenários)
- Fluxo de deploy e migrations estabilizado em beta e produção

---

## 🧭 Como está a evolução do projeto

### Situação atual
- Beta ativo em: `mesasbeta.artificiorpg.com`
- Produção ativa em: `mesas.artificiorpg.com` (aqui onde voce pode anunciar)
- Fluxo de publicação de mesas estabilizado
- Sincronização estrutural de banco concluída entre beta e produção

### Etapa em andamento
- Refinamento de experiência para mestres e jogadores
- Priorização de melhorias de cobertura entre frontend e backend
- Evolução contínua das rotas administrativas e sociais

---

## 🛠️ Como avisar erros

Encontrou um problema? Isso ajuda muito a melhorar o projeto.

Abra uma issue em:
👉 [GitHub Issues](https://github.com/FarenRavirar/mesas_rpg_artificio/issues)

Quando possível, envie:
1. O que você tentou fazer
2. O que deveria acontecer
3. O que aconteceu de fato
4. Print da tela (se tiver)
5. Mensagem de erro (se aparecer)

---

## 💡 Como enviar propostas de melhoria

Tem ideia de funcionalidade nova ou ajuste de UX?

Abra uma issue com a proposta:
👉 [Sugerir melhoria](https://github.com/FarenRavirar/mesas_rpg_artificio/issues/new)

Para ajudar na priorização, descreva:
- qual dor isso resolve;
- quem é beneficiado (jogador, mestre, admin);
- como você imagina o fluxo.

---

## 🗺️ Etapas do projeto

### Etapa 1 — Base do portal (concluída)
- Catálogo público
- Login Google
- Painel do mestre
- Publicação de mesas

### Etapa 2 — Estabilização operacional (concluída nesta rodada)
- Correções críticas de publicação
- Deploy beta e produção com gate de migrations
- Alinhamento de schema e documentação canônica

### Etapa 3 — Evolução de experiência (em progresso)
- Melhorias de jornada no onboarding de mesas
- Ampliação de cobertura de funcionalidades no frontend
- Ajustes contínuos de usabilidade e consistência

---

## 🔮 O que pretendemos fazer no futuro

- Melhorar recursos de interação entre comunidade e mestres
- Expandir ferramentas de acompanhamento de mesas
- Avançar em priorizações de curadoria e descoberta
- Continuar evolução sem perder os compromissos públicos

---

## 🤝 Compromissos públicos do projeto

- **Gratuito para a comunidade**
- **Sem anúncios na plataforma**
- **Privacidade e coleta mínima de dados**
- **Transparência sobre evolução e prioridades**

---

## 👥 Comunidade

- **Grupo do WhatsApp:** [links.artificiorpg.com](https://links.artificiorpg.com)
- **Issues (bugs e propostas):** [GitHub Issues](https://github.com/FarenRavirar/mesas_rpg_artificio/issues)
- **Contato do mantenedor:** paulohenriquercc@gmail.com

---

## 📚 Governança e operação (SDD)

### Fonte canônica
- [AGENTS.md](AGENTS.md) — regras operacionais do agente, gate de tarefas e protocolo de sessão
- [Constituição](.specify/memory/constitution.md) — regras de projeto, princípios e guardrails técnicos
- [Estado do Projeto](.specify/memory/project-state.md) — estado atual e próxima ação

### Workflows por situação

- **Nova feature / mudança estrutural (>10 linhas):**
  `/speckit.specify` → `/speckit.clarify` → `/speckit.plan` → `/speckit.tasks` → `/speckit.analyze` → `/speckit.implement`
- **Atalho de preparação (sem implementar ainda):**
  `/speckit.prepare` (Specify → Clarify → Plan → Tasks → Analyze)
- **Correção de bug com rastreabilidade completa:**
  `/speckit.bugfix.report` → `/speckit.bugfix.patch` → `/speckit.bugfix.verify`
- **Auditoria de consistência entre artefatos:**
  `/speckit.analyze`
- **Checagem estática e testes:**
  `/speckit.checker` e `/speckit.tester`
- **Validação final de aderência à spec:**
  `/speckit.validate`
- **Reconciliação de drift (spec/plan/tasks vs implementação):**
  `/speckit.reconcile.run`
- **Fechamento e memória de sessão:**
  `/speckit.status` + `/speckit.retro.run` + `/speckit.archive.run` (quando aplicável)

### Comandos Spec-Kit disponíveis (quando usar)

#### Core
- `/speckit.specify` — usar para criar/atualizar `spec.md` a partir da necessidade da feature.
- `/speckit.clarify` — usar quando a spec tiver ambiguidades ou lacunas.
- `/speckit.plan` — usar para gerar `plan.md` com abordagem técnica.
- `/speckit.tasks` — usar para gerar `tasks.md` executável e ordenado.
- `/speckit.analyze` — usar para checar consistência entre `spec.md`, `plan.md` e `tasks.md`.
- `/speckit.implement` — usar para executar as tasks aprovadas.
- `/speckit.constitution` — usar para regenerar/ajustar a constituição do projeto.

#### Execução, qualidade e validação
- `/speckit.checker` — usar para análise estática (lint/checkers).
- `/speckit.tester` — usar para executar testes e cobertura.
- `/speckit.reviewer` — usar para revisão técnica com feedback acionável.
- `/speckit.validate` — usar para confirmar aderência da implementação à spec.

#### Utilitários
- `/util-speckit.status` — usar para visão rápida de progresso e bloqueios da feature.
- `/util-speckit.checklist` — usar para gerar checklist customizado de entrega.
- `/util-speckit.diff` — usar para comparar versões de spec/plan.
- `/util-speckit.migrate` — usar para migrar projeto existente para estrutura Spec-Kit.
- `/util-speckit.quizme` — usar para desafiar robustez da spec (perguntas socráticas).
- `/util-speckit.taskstoissues` — usar para converter tasks em issues dependentes.

#### Extensões instaladas
- `/speckit.fixit.run` — usar para aplicar correção guiada por erro/memória canônica.
- `/speckit.brownfield.scan` — usar para mapear stack/estrutura de código legado.
- `/speckit.brownfield.bootstrap` — usar para iniciar configuração SDD em brownfield.
- `/speckit.brownfield.validate` — usar para validar bootstrap contra estrutura real.
- `/speckit.brownfield.migrate` — usar para adoção incremental de SDD no legado.
- `/speckit.memorylint.run` — usar para auditar qualidade da governança de memória.
- `/speckit.memorylint.load-agents` — usar para carregar/validar agentes de memória.
- `/speckit.optimize.run` — usar para otimizar docs de governança.
- `/speckit.optimize.tokens` — usar para medir consumo de tokens.
- `/speckit.optimize.learn` — usar para aprender padrões de sessão e sugerir melhorias.
- `/speckit.reconcile.run` — usar para reconciliar drift entre artefatos e implementação.
- `/speckit.bugfix.report` — usar para abrir diagnóstico formal de bug.
- `/speckit.bugfix.patch` — usar para gerar patch de bug nos artefatos.
- `/speckit.bugfix.verify` — usar para verificar consistência do bugfix.
- `/speckit.status` — usar para atualizar/exibir estado SDD atual.
- `/speckit.status.show` — usar para exibição de dashboard de status.
- `/speckit.verify-tasks` — usar para detectar task marcada como concluída sem evidência.
- `/speckit.verify-tasks.run` — usar para executar verificação completa de tasks.
- `/speckit.archive.run` — usar ao finalizar feature para arquivar memória canônica.
- `/speckit.doctor` — usar para diagnóstico de saúde do projeto Spec-Kit.
- `/speckit.doctor.check` — usar para checagem detalhada de saúde.
- `/speckit.retro.run` — usar no fechamento de sessão/sprint para retrospectiva.

### Documentos de apoio
- [docs/sdd/README.md](docs/sdd/README.md)
- [MAPA_DE_API.md](MAPA_DE_API.md)
- [PRE_DEPLOY_CHECKLIST.md](PRE_DEPLOY_CHECKLIST.md)
- [BRANCH_POLICY.md](docs/sdd/BRANCH_POLICY.md)
- [Catálogo de Erros](.specify/memory/errors.md)
- [Features SDD](.specify/features/)
- [Legado — BACKLOG_OPERACIONAL](docs/legacy/BACKLOG_OPERACIONAL.md)
- [Legado — FILA_IMPLEMENTACAO](docs/legacy/FILA_IMPLEMENTACAO.md)

---

## 🙌 Quer ajudar?

Você pode contribuir de várias formas, mesmo sem programar:
- testando o portal e reportando bugs;
- sugerindo melhorias de usabilidade;
- ajudando na divulgação para mestres e jogadores.

Se você programa e quer colaborar com código, também é bem-vindo.

---

<div align="center">

### Feito com cuidado pela comunidade Artifício RPG

**[🌐 Beta](https://mesasbeta.artificiorpg.com)** • **[🟢 Grupo do WhatsApp](https://links.artificiorpg.com)** • **[🐛 Issues](https://github.com/FarenRavirar/mesas_rpg_artificio/issues)**

</div>
