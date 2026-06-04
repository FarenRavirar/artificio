# BACKLOG_OPERACIONAL.md

> Backlog vivo de melhorias, correções e débitos técnicos. **Guia de produto.**
> 
> **O QUE FAZER:** Itens de/features que precisam ser implementadas (perspectiva de produto).
> **DETALHES TÉCNICOS:** Ver FILA_IMPLEMENTACAO.md para tarefas específicas de código.
> 
> **MAPEAMENTO:** BACKLOG (REQ/DEB/OPS) ↔ FILA (números) — ver seção §4.

---

## §1. ÍNDICE — Pendentes por prioridade

### Alta Prioridade (GUT ≥ 100)

| # | ID | GUT | Item |Ação | FILA ref |
|---|---|---|---|---|---|
| 1 | OPS-06 | 125 | Remover apply_required_migrations.sh.bak | Cleanup pós-Feature 001 | — |
| 2 | OPS-07 | 125 | Ativar branch protection main/dev | GitHub UI | — |
| 3 | OPS-08 | 100 | Corrigir job smoke deploy-beta.yml | Erro sintaxe bash (não bloqueante) | — |
| 4 | DEB-08 | 100 | Frequência detalhada schedules | Adicionar campos + UI | ↔ 086 |
| 5 | REQ-29 | 100 | Auditoria API + implementação | Atualizar MAPA | ↔ DEB-06 |

### Média Prioridade (GUT 50-99)

| # | ID | GUT | Item |Ação | FILA ref |
|---|---|---|---|---|---|
| 1 | DEB-06 | 75 | Integração rotas API órfãs | Após REQ-29 | ↔ REQ-29 |
| 2 | DEB-09 | 80 | Nível mesa dropdown | Substituir Input por Select | ↔ 085 |

### Baixa Prioridade (GUT < 50)

| # | ID | GUT | Item |Ação | FILA ref |
|---|---|---|---|---|---|
| 1 | DEB-01 | 36 | Engajamento social | Fase 5 | — |
| 2 | DEB-02 | 18 | Paginação catálogo | Sem volume | — |
| 3 | DEB-03 | 18 | SEO estruturado | Meta tags | — |
| 4 | DEB-04 | 12 | Onboarding revisitável | UX secundária | — |
| 5 | OPS-01 | 16 | Logs centralizados | Fase 1 | — |
| 6 | OPS-02 | 20 | Backup Oracle→Drive | Herdado | — |
| 7 | OPS-03 | 9 | Script dump PostgreSQL | — | — |

---

## §2. BACKLOG ATIVO — O que precisa ser feito

### Alta Prioridade (GUT ≥ 100)

| ID | GUT | Descrição |Ação | FILA ref | Status |
|---|---|---|---|---|---|
| OPS-06 | 125 | **Remover apply_required_migrations.sh.bak:** Arquivo backup da Feature 001 deve ser removido após validação completa em prod. | Executar `rm scripts/deploy/apply_required_migrations.sh.bak` | — | ⏳ Pendente |
| OPS-07 | 125 | **Ativar branch protection em main e dev:** Configurar via GitHub UI para prevenir pushes diretos e exigir PRs. Parte da governança SDD. | Configurar via GitHub Settings → Branches | — | ⏳ Pendente |
| OPS-08 | 100 | **Corrigir job smoke em deploy-beta.yml:** Erro de sintaxe bash (`syntax error near unexpected token 'fi'`) na linha 43 do script SSH. Não bloqueante mas deve ser corrigido. | Revisar script de smoke test | — | ⏳ Pendente |
| REQ-29 | 100 | **Auditoria API + implementação:** Mapear endpoints via `MAPA_DE_API.md`, atualizar status, implementar UI para os 5 mais críticos. Endereça DEB-06. | Primeiro auditoria, segundo implementar | ↔ DEB-06 | Pendente |

### Média Prioridade (GUT 50-99)

| ID | GUT | Descrição |Ação | FILA ref | Status |
|---|---|---|---|---|---|
| DEB-06 | 75 | **Integração Rotas API Órfãs:** 29 endpoints pendentes no MAPA_DE_API.md. | Após REQ-29 | ↔ REQ-29 | Pendente |

### Baixa Prioridade (GUT < 50)

| ID | GUT | Descrição |Ação | FILA ref | Status |
|---|---|---|---|---|---|
| DEB-01 | 36 | **Engajamento social:** Q&A, reviews, bookmarks. | Fase 5 | — | Planejado |
| DEB-02 | 18 | **Paginação catálogo:** Server-side se volume crescer. | Sem dados | — | Planejado |
| DEB-03 | 18 | **SEO estruturado:** Open Graph, sitemap. | Meta tags | — | Planejado |
| DEB-04 | 12 | **Onboarding revisitável:** Atualizar preferências. | UX secundária | — | Planejado |
| DEB-09 | 80 | **Nível mesa dropdown:** level_range é texto livre. Frontend StepFinal.tsx usa InputField. **PRECISA:** SelectField (Iniciante/Intermediário/Avançado/Misto) + tooltip. | Substituir InputField por SelectField | ↔ 085 | ❌ Pendente |
| DEB-08 | 100 | **Frequência detalhada (schedules):** frequency + day_of_week existem. **FALTA:** times_per_month (quinzenal) + custom_notes (mensal) + UI no SessionRepeater. | Adicionar campos + UI | ↔ 086 | ⏳ Parcial |
| OPS-01 | 16 | **Logs centralizados:** Morgan/Winston. | Fase 1 | — | Planejado |
| OPS-02 | 20 | **Backup Oracle→Drive:** 3 backups retidos. | Herdado | — | Planejado |
| OPS-03 | 9 | **Script dump PostgreSQL:** Backup manual. | — | — | Planejado |

---

## §3. MAPEAMENTO — BACKLOG ↔ FILA

> Este mapeamento conecta itens por **conteúdo**, não por número.

| BACKLOG ID | ↔ | FILA ID | Conteúdo |
|---|---|---|---|
| REQ-21 | ↔ | 084 | Faixa etária dropdown |
| REQ-21 | ↔ | 100, 097, 098 | Cenário/Estilos (parcial: 100 ✅ impl., 097 ❌ pend. migration, 098 ✅ impl.) |
| REQ-26 | ↔ | 085 | Nível mesa dropdown |
| REQ-30 | ↔ | 086 | Frequência detalhada |
| DEB-07 | ↔ | 075 | Plataformas como tabelas |
| DEB-08 | ↔ | 086 | Frequência detalhada (schedules) |
| DEB-09 | ↔ | 085 | Nível mesa dropdown |
| — | ↔ | 060-067, 089, 082 | UX Gestão + Markdown |
| — | ↔ | 060 | Busca texto candidatos |
| — | ↔ | 061 | Status PT-BR |
| — | ↔ | 062 | Botão Cancelar modal |
| — | ↔ | 064 | Ordenação candidatos |
| — | ↔ | 065 | Tabs modal revisão |
| — | ↔ | 066 | Erros específicos |
| — | ↔ | 067 | Tooltips explicativos |
| — | ↔ | 082 | Markdown sanitizer backend |
| — | ↔ | 089 | Render markdown MesaPage |
| — | ↔ | 096 | Dados brutos completos |

---

## §4. HISTÓRICO DE CONCLUSÃO

_16/04/2026_
- [x] **DEB-07:** Plataformas como tabelas validadas ponta a ponta (create/edit/list/detail), com deploy em produção e health OK. | FILA: 075
- [x] **REQ-21:** Faixa etária concluída com ícones visuais no dropdown (`StepConfig.tsx`). | FILA: 084

_15/04/2026_
- [x] **REQ-03:** Cloudinary + Sharp. Pipeline completo, upload direto, VITE_CLOUDINARY_*. Beta funcional. | FILA: —
- [x] **REQ-04:** Catálogo público. Filtros: sistema, modalidade, preço, experiência, selos, estilos. Busca server-side. | FILA: —
- [x] **REQ-05:** Landing page mestre. Perfil rico, banner, avatar, bio, especialidades, lista mesas. | FILA: —
- [x] **REQ-06:** Painel mestres autopublicação. Cover, vagas, frequência, regras, bloco DDAL. | FILA: —
- [x] **REQ-07:** Painel admin + moderação. GestaoPage, CRUD sistemas/cenários, systemSuggestions. | FILA: 025-026
- [x] **REQ-08:** Diferenciação visual papéis. Badges admin/gm, abas condicionais, redirecionamento. | FILA: 090
- [x] **REQ-09:** Selos Covil + DDAL. Persistência, filtro, badges, validação. | FILA: 068
- [x] **REQ-11:** Publicador (anunciante vs mestre). publisher_role, selo visual. | FILA: 090
- [x] **REQ-12:** Canais de contato. table_contacts, 7 canais, validação backend. | FILA: —
- [x] **REQ-13:** QA publicação real. Fluxo completo: onboarding, gm_profile, publication, Cloudinary, contacts, selos. | FILA: —
- [x] **REQ-17:** Auditoria UX Nielsen. Documentação + regra AGENTS.md. | FILA: 039
- [x] **REQ-21 (13/14):** Melhorias formulário. 13/14 itens: paridade, ocultar perfil, frequência, placeholder, renomeado, plataformas (campos texto), edição admin, editor rico, auto-detecção, dados brutos, nível, cenário/estilo. **Item remanescente (faixa etária) concluído em 16/04/2026.** | FILA: 084, 100, 097, 098 (parcial)
- [x] **REQ-26:** Formulário Expandido. 13 campos: master_display_name, campaign_length, level_range, billing_text, session_zero_free, synopsis, style_text, listing_excerpt, technical_requirements, requires_pc/camera/microphone. | FILA: 085 (parcial)
- [x] **REQ-27:** Agenda Estruturada. table_schedules, 4 rotas CRUD, SessionRepeater. | FILA: —
- [x] **REQ-30:** Correção onboarding. Frequency duplicado, editor rico, vagas, cenário, name_pt, toggle PT/EN. | FILA: 086
- [x] **REQ-31:** Sync schema beta→prod. Gate workflows, migration_104 aplicada. | FILA: —
- [x] **OPS-04:** MonitorImgur. Cancelado — Cloudinary substituiu Imgur. | FILA: 015

_14/04/2026_
- [x] **REQ-30 (parcial):** BUGs críticos. Race condition editar mesa (commit 8bb716b), token desativar (PUT→PATCH, E142). | FILA: —

_09/04/2026_
- [x] **REQ-26/REQ-27:** Ver 15/04/2026 (reoriginados para sessão atual). | FILA: —

_05/04/2026_
- [x] **REQ-23:** Painel Admin CRUD. Rotas admin, SystemEditModal, ScenarioEditModal, /gestao. | FILA: —
- [x] **REQ-22:** 3 bugs bloqueadores. Dockerfile .py (E109), SystemTreeSelector (E111), JWT 7d (E116). | FILA: —
- [x] **REQ-16:** Logout inesperado. JWT_EXPIRES_IN 15m→7d no compose. | FILA: —

_04/04/2026_
- [x] **REQ-15:** CRUD sistemas + notificações. Migrations 06/07, 3 rotas, modal, /gestao, sino. | FILA: —
- [x] **REQ-06 (atualização):** Frequência, regras, banner, "em andamento". | FILA: —

_31/03/2026_
- [x] **REQ-01:** Repositório, secrets, Oracle, Cloudflare, React+Node. | FILA: —
- [x] **REQ-02:** Schema + API base. Migrations, Express, Google OAuth, JWT, Kysely. | FILA: —
- [x] **REQ-10:** Layout global. AppShell, SiteHeader+Footer. | FILA: —