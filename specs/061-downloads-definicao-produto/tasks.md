# Tasks — Spec 061

## F-1 — Fonte única de sistemas/edições

- [x] T-1.1 — Auditar schemas, dados, APIs, telas admin e consumidores de sistemas/edições no `apps/mesas`.
- [x] T-1.2 — Auditar schemas, dados, APIs, telas admin e consumidores de sistemas/edições no `apps/glossario`.
- [x] T-1.3 — Comparar IDs, nomes, aliases, edições, árvores, status e regras de exclusão/merge.
- [x] T-1.4 — Definir requisitos comuns de mesas/glossário/downloads e requisitos exclusivos por app.
- [x] T-1.5 — Comparar topologias para o banco/catálogo canônico único: ownership, serviço/API, cache/projeções e contratos de acesso.
- [x] T-1.6 — Avaliar disponibilidade, acoplamento, cache, auth admin, migrations, rollout, rollback e observabilidade.
- [x] T-1.7 — Abrir a Spec 062 SDD Completo de investigação/decisão da fonte única.
- [x] T-1.8 — Bloquear specs executáveis de downloads até plano aprovado de migração para o banco/catálogo único.

## F0 — Base interna

- [x] T0.1 — Ler `AGENTS.md`, T0, roadmap, README geral e `specs/README.md`.
- [x] T0.2 — Buscar todas as ocorrências `.md` sobre `downloads` e referências correlatas.
- [x] T0.3 — Registrar sessão e limitações das ferramentas.
- [x] T0.4 — Auditar no código real contratos reutilizáveis de auth, UI, mídia, feedback, analytics, content, API e deploy. Resultado registrado em `spec.md` §T0.4.
- [x] T0.5 — Registrar decisão do mantenedor: não existe legado WP de `downloads`; ocorrências históricas não serão importadas.

## F1 — Referências

- [x] T1.1 — Reconstruir proposta/fluxos do Dungeonist com fontes verificáveis. Fatos, inferências, lacunas e lições registrados em `spec.md` §T1.1.
- [x] T1.1b — Auditar DriveThruRPG atual como referência máxima de configuração e produzir matriz campo/filtro → Artifício → adotar/adaptar/excluir. Registrado em `spec.md` §T1.1b.
- [x] T1.2 — Capturar snapshot datado e verificável de todos os filtros públicos atuais, metadados, submissão e políticas do DriveThruRPG; separar filtro real de navegação/categoria.
- [x] T1.2a — Consolidar T1.1b/T1.2 sem qualquer campo financeiro; adicionar origem `external_link|managed_upload`, barreiras, visibilidade e verificação.
- [x] T1.3 — Comparar ao menos 3 catálogos atuais de materiais gratuitos. Snapshot 2026-07-09: itch.io, RPGGeek e Keeper; fatos, limites, comparação, lacunas e fontes em `spec.md` §T1.3.
- [x] T1.4 — Produzir matriz “adotar / adaptar / rejeitar”. Matriz normativa final consolidou posicionamento, acesso, metadados, descoberta, moderação, direito, interações, UX e operação em `spec.md` §T1.4.

## F2 — Produto

- [x] T2.1 — Definir usuários/personas e jornadas. Dez personas funcionais, matriz de capacidades, quinze jornadas, ownership, continuidade e encaminhamentos registrados em `spec.md` §T2.1.
- [x] T2.2 — Definir MVP, pós-MVP e não objetivos. Onze blocos MVP, jornadas incluídas, oito frentes pós-MVP, vinte não objetivos, itens não cortáveis e gate de lançamento registrados em `spec.md` §T2.2.
- [x] T2.3 — Resolver “pague quanto quiser”: somente link externo quando zero libera o material; Artifício não captura/exibe valor, manda consultar o destino; proibido em upload/storage Artifício (D102 supera D101).
- [x] T2.4 — Fechar publicação própria e curadoria de terceiro: ambas aceitas; papel declarado e garantia de gratuidade/permissão.
- [x] T2.5 — Definir métricas de sucesso e analytics sem contar clique como download. Métrica principal, resultados, funis, eventos, dimensões, dados proibidos, anti-fraude, visibilidades, baseline e aceite registrados em `spec.md` §T2.5.

## F3 — Conteúdo e políticas

- [x] T3.1 — Fechar taxonomia e metadados obrigatórios/opcionais. Famílias, vocabulários iniciais, requiredness, condicionais, privacidade, facetas, validações, governança e aceite registrados em `spec.md` §T3.1.
- [x] T3.2 — Fechar autoria, licença, tradução, fan content e propriedade intelectual. Classes A1–A10, direitos por ação, traduções, IA, provas E0–E3 e critérios de aceite registrados em `spec.md` §T3.2. A10 é somente link; IA visual só integrada a obra humana, declarada e moderada.
- [x] T3.2a — Fixar prova obrigatória para aprovação: URL, imagem/captura ou licença/autorização/base jurídica demonstrável; declaração isolada não basta.
- [x] T3.3 — Fechar estados editoriais e matriz de moderação: eixos separados, versões imutáveis, transições, filas, papéis, auditoria, falhas e aceite registrados em `spec.md` §T3.3. Auto-publicação modelada como capacidade futura, sem atribuição e bloqueada globalmente/por kill switch.
- [x] T3.4 — Fechar denúncia, remoção, recurso, abandono e link quebrado. Canais, categorias, estados, contenção, decisões, contraditório, recurso, abuso, retirada, abandono/reivindicação, checker, automação, privacidade e aceite registrados em `spec.md` §T3.4.
- [x] T3.5 — Definir política de capas/imagens e direitos de uso. Capa editorial reduzida, classes, origem, resolução, integridade, créditos, previews, marcas, sensível, IA, Cloudinary, moderação, retirada, retenção e aceite registrados em `spec.md` §T3.5.

## F4 — UX/design

- [x] T4.1 — Definir mapa de páginas e rotas conceituais. Rotas públicas, catálogo/ficha, criadores versus usuários, landings, painel, gestão, saída técnica, erros, redirects, canonical, sitemap, ownership e aceite registrados em `spec.md` §T4.1.
- [x] T4.2 — Definir submenu abaixo do nav e sidebar desktop/mobile. Hierarquia global/módulo/contexto, itens, shells público/painel/gestão, catálogo, drawer, breakpoints, sticky, persistência, acessibilidade, estados e aceite registrados em `spec.md` §T4.2.
- [x] T4.3 — Definir busca, filtros, ordenação e paginação. Contrato de URL, facetas do MVP, ordenação, paginação e performance registrados em `spec.md` §F4/T4.3.
- [x] T4.4 — Definir detalhe, cards, perfil do publicador, submissão e gestão. Card, ficha, perfil de criador, fluxo de submissão em etapas e gestão de material registrados em `spec.md` §F4/T4.4.
- [x] T4.5 — Produzir wireframes textuais e requisitos AA/responsivos. Wireframes de catálogo/ficha/submissão (desktop/mobile) e requisitos AA transversais registrados em `spec.md` §F4/T4.5.

## F5 — Técnica/segurança

- [x] T5.1 — Propor modelo de dados e índices. Entidades conceituais, FK lógica ao catálogo 062 (nunca física cross-DB) e índices mínimos registrados em `spec.md` §F5/T5.1.
- [x] T5.2 — Propor contratos API usando governança canônica. Regras de rota pública/autenticada, reuso de batch e `verify:api` registradas em `spec.md` §F5/T5.2.
- [x] T5.3 — Definir SSO, roles, ownership e autorização. Roles, ownership de material e auditoria imutável registrados em `spec.md` §F5/T5.3.
- [x] T5.4 — Definir Cloudinary signed para capas e, como último fallback, PDFs; fixar limites por tipo. Registrado em `spec.md` §F5/T5.4 (limite exato de MB fica para a spec filha).
- [x] T5.4a — Especificar implementação obrigatória do adapter R2 → B2 → Fastio → Cloudinary PDF. Interface `StorageAdapter` plugável, ordem fixa e URL pública estável registradas em `spec.md` §F5/T5.4a.
- [ ] T5.4b — Confirmar produto/contrato “Fastio”, APIs, autenticação, quotas, egress e disponibilidade antes da implementação obrigatória. **Bloqueado pela pergunta aberta 9** (o que é "Fastio" de fato); adapter já desenhado com posição 3 plugável/removível (§F5/T5.4b).
- [ ] T5.4c — Definir medição de cota, failover para novos uploads, migração, reconciliação e URL pública estável. **Parcialmente bloqueado pela pergunta aberta 8** (escopo do fallback: só novo upload ou também migra existente); medição/failover/reconciliação de novo upload já registrados em `spec.md` §F5/T5.4c.
- [x] T5.5 — Threat model: links maliciosos, spam, phishing, XSS, SSRF, abuso e copyright. Tabela vetor/superfície/mitigação registrada em `spec.md` §F5/T5.5.
- [x] T5.6 — Definir SEO, analytics, privacidade e retenção. Registrado em `spec.md` §F5/T5.6, reaproveitando contratos já pétreos do monorepo.

## F6 — Infra/operação

- [x] T6.1 — Mapear o padrão beta/prod vigente dos módulos no momento da implementação; não usar memória desta spec como contrato operacional. Padrão observado nesta data registrado em `spec.md` §F6/T6.1 com aviso explícito de re-leitura obrigatória na implementação.
- [x] T6.2 — Planejar `downloadsbeta.`/`downloads.` com paridade exata de compose, manifesto, DNS/Tunnel, gates e promoção; zero fluxo específico. Registrado em `spec.md` §F6/T6.2.
- [x] T6.2a — Herdar as mesmas guardas de isolamento usadas pelos outros módulos; qualquer diferença exige decisão explícita. Registrado em `spec.md` §F6/T6.2a.
- [x] T6.3 — Planejar backup, rollback, observabilidade e link checker. Registrado em `spec.md` §F6/T6.3.
- [x] T6.4 — Dimensionar rotina humana de moderação e SLA inicial. Modelo de rotina (sem número de SLA prometido publicamente ainda) registrado em `spec.md` §F6/T6.4.

## F7 — Saída

- [x] T7.1 — Resolver perguntas bloqueantes com o mantenedor. 10 perguntas resolvidas em 2026-07-11, registradas em `spec.md` §F7/T7.1.
- [x] T7.2 — Consolidar decisões firmes em `decisions.md`. D111 registrada em `.specify/memory/decisions.md`.
- [x] T7.3 — Mapa de specs filhas (Downloads-A a G, ordem/dependências/gates/testes) proposto em `spec.md` §F7/T7.3 e **estrutura criada** (2026-07-11, mantenedor autorizou "abrir as 7 specs filhas"): `specs/070-downloads-a-schema-api-ownership`, `071-downloads-b-storage-multiprovider`, `072-downloads-c-submissao-moderacao-taxonomia`, `073-downloads-d-descoberta-publica`, `074-downloads-e-painel-usuario-edicao`, `075-downloads-f-gestao-admin`, `076-downloads-g-infra-deploy` — cada uma com `spec.md`/`plan.md`/`tasks.md`/`reviews.md`/`debitos.md`. Zero código, zero migration, zero commit. Implementação de cada spec segue gated por aprovação nominal própria por fase, conforme regra pétrea.
- [x] T7.4 — Atualizar `specs/backlog.md`, `specs/README.md`, roadmap, README e `project-state.md`.
- [x] T7.5 — Sessão encerrada. Evidência: 5 arquivos por spec filha (35 no total) criados em `specs/070` a `specs/076`; `spec.md` da 061 com F4–F7 completas; `decisions.md` D111; `tasks.md` da 061 com F4–F7 marcadas. Próximo passo real: autorização nominal para começar a spec 070 (Downloads-A), a primeira da fila — nenhuma implementação iniciada.

## Perguntas abertas prioritárias — RESOLVIDAS (2026-07-11)

1. ~~Como detectar e tratar destino que deixou de ser gratuito após publicação?~~ → só revisão humana via denúncia, sem scan automático.
2. ~~Como armazenar, proteger, revalidar e reter as provas obrigatórias definidas por D100?~~ → retenção ilimitada, nunca expurga.
3. ~~Quais critérios permitem conceder/revogar auto-publicação?~~ → ainda não definido; continua desligada por kill switch; critério fica para spec futura.
4. ~~Quais flags externas serão obrigatórias além de login/cadastro/newsletter?~~ → nenhuma nova; login `accounts.` cobre.
5. ~~Qual escala, peso e política anti-abuso das avaliações?~~ → só quem já baixou (download registrado) pode avaliar.
6. ~~Comentários exigem moderação prévia, posterior ou por denúncia?~~ → só por denúncia; exige conta `accounts.`, sem anônimo.
7. ~~Quais métricas ficam públicas e quais só para autor/admin?~~ → download = clique logado deduplicado por conta+material, contagem simples pública; edição de material (incl. link) grava histórico, última atualização pública, série completa só admin.
8. ~~O fallback troca apenas novos uploads ou também migra arquivos existentes?~~ → também migra existentes, sempre com aprovação nominal + checksum.
9. ~~Qual é o serviço/contrato exato “Fastio”?~~ → confirmado (`fast.io`, storage para agentes de IA); mantido na cadeia R2→B2→Fastio→Cloudinary PDF.
10. ~~Quais tipos e limites de arquivo entram no MVP além de PDF?~~ → apenas documentos (PDF/MD/DOC), sem `.zip`.
