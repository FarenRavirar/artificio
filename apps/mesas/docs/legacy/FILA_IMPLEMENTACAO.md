# FILA_IMPLEMENTACAO.md

> Backlog operacional de desenvolvimento. **Guia de implementação técnica.**
> 
> **PARA que Serve:** Detalhes técnicos de como implementar cada item do BACKLOG_OPERACIONAL.
> **DETALHES TÉCNICOS:** Tarefas específicas de código (arquivos, dependências, migrations).
> **NÃO contém itens novos:** Itens novos devem ser adicionados primeiro no BACKLOG_OPERACIONAL.md.
> **Ver BACKLOG:** Para entender o contexto de produto de cada item.
> 
> **MAPEAMENTO:** FILA (números) ↔ BACKLOG (REQ/DEB/OPS) — ver seção §4.

---

## §1. FORMATO — Como adicionar item

Cada item na FILA deve ter:
- **ID**: número sequencial (ex: 075, 086)
- **GUT**: Score (G x U x T)
- **Ação**: Ação imediata (1 linha)
- **Dependências**: de quais itens depende (se houver)
- **Arquivos**: arquivos concretos para modificar

**Não adicionar itens sem:**
1. GUT calculado
2. Ação clara
3. Referência de arquivos

---

## §2. ÍNDICE — Pendentes por prioridade

### Alta Prioridade (GUT ≥ 100)

| # | ID | GUT | Item | Ação | BACKLOG ref |
|---|---|---|---|---|---|
| 1 | 086 | 100 | Frequência detallada | ⏳ Parcial (times_per_month+custom_notes faltam) | ↔ DEB-08 |

### Média Prioridade (GUT 50-99)

| # | ID | GUT | Item | Ação | BACKLOG ref |
|---|---|---|---|---|---|
| 1 | 085 | 80 | Nível mesa dropdown | ❌ Pendente (é InputField, não dropdown) | ↔ DEB-09 |
| 2 | 089 | 80 | Render markdown MesaPage | ❌ Pendente (descrição e rules_notes não renderizados como markdown) | ↔ — |
| 3 | 097 | 80 | Migration cenário/estilos | ❌ Pendente (migration não existe) | ↔ REQ-21 |

### Baixa Prioridade (GUT < 50)

| # | ID | GUT | Item | Ação | BACKLOG ref |
|---|---|---|---|---|---|
| 1 | 060 | 64 | Busca texto candidatos | Implementar | ↔ — |
| 2 | 067 | 48 | Tooltips explicativos | Implementar | ↔ — |
| 3 | 082 | 48 | Markdown sanitizer backend | Pending | ↔ — |
| 4 | 096 | 48 | Dados brutos completos | Pending | ↔ — |
| 5 | 061 | 36 | Status PT-BR | Implementar | ↔ — |
| 6 | 062 | 36 | Botão Cancelar modal | Implementar | ↔ — |
| 7 | 064 | 36 | Ordenação candidatos | Implementar | ↔ — |
| 8 | 065 | 36 | Tabs modal revisão | Implementar | ↔ — |
| 9 | 066 | 36 | Erros específicos | Implementar | ↔ — |

---

## §3. DETALHES — Implementação por item

### Alta Prioridade (GUT ≥ 100)

| ID | GUT | Ação | Descrição completa | Dependências | Arquivos | BACKLOG ref | Status |
|---|---|---|---|---|---|---|
| **086** | 100 | **⏳ Parcial** | **Frequência detalhada em table_schedules:** Já existe: frequency (semanal/quinzenal/mensal/avulsa) + day_of_week + start_time + end_time + slots_per_session + notes. **FALTA:** (1) campo times_per_month SMALLINT no schema (para frequency=quinzenal), (2) campo custom_notes TEXT (para frequency=mensal), (3) validações condicionais (times obrigatório se quinzenal, notes obrigatório se mensal), (4) UI no SessionRepeater. Ver sessões: 26-04-14_7, 26-04-15_1. | Depende de nada | Backend: db/types.ts (ScheduleTable), routes/tableSchedules.ts. Frontend: SessionRepeater.tsx, validator.ts | ↔ REQ-30 | ⏳ Parcial |

### Média Prioridade (GUT 50-99)

| ID | GUT | Ação | Descrição completa | Dependências | Arquivos | BACKLOG ref | Status |
|---|---|---|---|---|---|---|
| **085** | 80 | **❌ Pendente** | **Nível mesa dropdown:** Backend: level_range é texto livre (types.ts). Frontend: StepFinal.tsx usa InputField (texto livre), não SelectField. **PRECISA:** substituir por SelectField com opções fixas (Iniciante/Intermediário/Avançado/Misto) + tooltip explicativo. Campo opcional. | Depende de nada | Frontend: StepFinal.tsx (level_range), createTable.types.ts | ↔ REQ-26 | ❌ Pendente |
| **089** | 80 | **Pending** | **Renderização markdown em MesaPage:** Description e rules_notes são salvos como markdown mas não são renderizados na MesaPage. Precisa: (1) verificar se backend já sanitiza (item 082), (2) usar react-markdown-editor-lite ou dangerouslySetInnerHTML para renderizar. Componente MarkdownEditor já existe. Depende de 082 (sanitização). | Depende de 082 (backend sanitizer) | Frontend: MesaPage.tsx, MarkdownEditor.tsx | Pendente |
| **097** | 80 | **Pending** | **Migration cenário e estilos:** Adicionar colunas na tabela tables: (1) setting_name TEXT, (2) setting_styles TEXT[]. Criar tabela auxiliar setting_style_suggestions com colunas: id UUID PK, setting_name TEXT, suggested_styles TEXT[]. Mapeamento cenário → estilos sugeridos. | Depende de nada | database/migration_XX_setting_styles.sql | Pendente |

### Baixa Prioridade (GUT < 50)

| ID | GUT | Ação | Descrição completa | Dependências | Arquivos | BACKLOG ref | Status |
|---|---|---|---|---|---|---|---|
| **060** | 64 | **Implementar** | **Busca por texto em candidatos:** Adicionar campo de busca que filtra candidatos por título ou sistema (case-insensitive). Busca client-side com debounce 300ms. Viola H7 (Eficiência). GUT: 64 | Depende de nada | Frontend: GestaoPage.tsx | Pendente |
| **061** | 36 | **Implementar** | **Traduzir status para PT-BR:** Substituir status em inglês do banco: "awaiting_review" → "Aguardando Revisão", "accepted" → "Aceito", "rejected" → "Rejeitado" (com ícones: ⏳ ✅ ❌). Viola H2 (Correspondência com o mundo real). GUT: 36 | Depende de nada | Frontend: GestaoPage.tsx | Pendente |
| **062** | 36 | **Implementar** | **Botão Cancelar explícito no modal:** Adicionar botão "Cancelar" ao lado de "Aprovar" no modal de revisão (além do "X" no canto). Viola H3 (Controle do usuário). GUT: 36 | Depende de nada | Frontend: GestaoPage.tsx | Pendente |
| **063** | 48 | **Implementar** | **Aviso sistema não detectado:** Exibir badge amarelo "⚠️ Sistema não detectado" se system_id estiver vazio após mapeamento do candidato. Sugerir seleção manual no tooltip. Viola H5 (Prevenção de erros). GUT: 48 | Depende de 047 (findSystemId) | Frontend: GestaoPage.tsx | Pendente |
| **064** | 27 | **Implementar** | **Ordenação de candidatos:** Adicionar dropdown de ordenação: "Mais recentes" (default), "Maior confiança", "Menor confiança". Viola H7 (Eficiência). GUT: 27. Médio esforço. | Depende de nada | Frontend: GestaoPage.tsx | Pendente |
| **065** | 27 | **Implementar** | **Tabs no modal de revisão:** Reorganizar modal com tabs: "Dados Extraídos" (default), "Dados Brutos" (JSON), "Preview" (visualização). Reduz sobrecarga visual. Viola H8 (Minimalismo e estética). GUT: 27. médio esforço. | Depende de nada | Frontend: GestaoPage.tsx | Pendente |
| **066** | 27 | **Implementar** | **Mensagens de erro específicas:** Substituir mensagens genéricas por específicas: "Sistema não encontrado. Selecione manualmente.", "Título obrigatório.", "Descrição obrigatória.", etc. Viola H9 (Recuperação de erros). GUT: 27. Baixo esforço. | Depende de nothing | Frontend: GestaoPage.tsx | Pendente |
| **067** | 27 | **Implementar** | **Tooltips explicativos:** Adicionar ícone "?" com tooltips em campos complexos: "Confiança" (mostrar %), "Publisher Role" (anunciante vs mestre), "Frequência" (semanal/quinzenal/mensal). Viola H10 (Ajuda e documentação). GUT: 27. Baixo esforço. | Depende de nothing | Frontend: GestaoPage.tsx | Pendente |
| **082** | 48 | **Pending** | **Markdown sanitizer no backend:** Adicionar sanitização de markdown no backend usando biblioteca marked + DOMPurify (ou equivalente). Aceitar markdown no payload de description/rules_notes, sanitizar e retornar HTML seguro. Permitir tags seguras: p, strong, em, ul, ol, li, a, br. Bloquear: script, iframe, object, embed. Usar em validação e na resposta GET /tables/:id. GUT: 48. | Dependente de nothing | Backend: utils/markdownSanitizer.ts, validators/tableValidators.ts | Pendente |
| **096** | 48 | **Pending** | **Ver dados brutos completo:** Usuário reportou que "Ver dados brutos não tá mostrando tudo". Verificar implementação do item 049 (dados brutos). Garantir que JSON.stringify(candidate.parsed_json, null, 2) exibe objeto completo, não truncado. Pode ser problema de altura do pre (overflow). GUT: 48. | Depende de 049 | Frontend: GestaoPage.tsx | Pendente |

---

## §4. MAPEAMENTO — FILA ↔ BACKLOG

> Este mapeamento conecta itens por **conteúdo**, não por número.

| FILA ID | ↔ | BACKLOG ID | Conteúdo |
|---|---|---|---|
| 084 | ↔ | REQ-21 | Faixa etária dropdown |
| 100, 097, 098 | ↔ | REQ-21 (parcial) | Cenário/Estilos (100 ✅, 097 ❌, 098 ✅) |
| 085 | ↔ | DEB-09 | Nível mesa dropdown |
| 086 | ↔ | DEB-08 | Frequência detalhada (schedules) |
| 075 | ↔ | DEB-07 | Plataformas como tabelas |
| DEB-06 | ↔ | REQ-29 | Auditoria API (mesmo item) |
| 015 | ↔ | OPS-04 | Imgur → Cloudinary |
| 039 | ↔ | REQ-17 | Auditoria UX Nielsen |
| 090 | ↔ | REQ-08, REQ-11 | Perfil announcer + badges |
| 068 | ↔ | REQ-09 | Selos Covil + DDAL |
| 025-026 | ↔ | REQ-07 | Admin + moderação |
| 060-067 | ↔ | — | UX Gestão (itens técnicos) |
| 082, 089 | ↔ | — | Markdown (backend + render) |

---

## §5. HISTÓRICO DE CONCLUSÃO

_16/04/2026_
- [x] **075**: plataformas como tabelas validadas ponta a ponta (create/edit/list/detail), com deploy em produção concluído | BACKLOG: DEB-07
- [x] **100**: campos cenário/estilos implementados e removidos da área ativa da fila | BACKLOG: REQ-21
- [x] **084**: faixa etária concluída com ícones visuais no dropdown (`StepConfig.tsx`) | BACKLOG: REQ-21

_15/04/2026_
- [x] **015**: Imgur → descartado (Cloudinary substituiu) | BACKLOG: OPS-04
- [x] **017A**: carga sistemas → parcialmente | BACKLOG: —
- [x] **025-026**: admin → concluído | BACKLOG: REQ-07
- [x] **027-030**: engajamento → planejado (Fase 5) | BACKLOG: DEB-01
- [x] **039**: Auditoria UX Nielsen → concluído | BACKLOG: REQ-17
- [x] **045-054**: 10 itens admin → concluídos | BACKLOG: REQ-07
- [x] **059**: Atalhos teclado → removido (descartado)
- [x] **068**: is_covil → concluído | BACKLOG: REQ-09
- [x] **069-073**: campos formulário → concluídos | BACKLOG: REQ-26
- [x] **077**: level_range → concluído | BACKLOG: REQ-26
- [x] **087**: renomeado → concluído | BACKLOG: REQ-21
- [x] **088**: editor rico → concluído | BACKLOG: REQ-21
- [x] **090**: perfil announcer → concluído | BACKLOG: REQ-08, REQ-11
- [x] **098**: Endpoint sugestões estilos → implementado | BACKLOG: REQ-21
- [x] **143**: name_pt → concluído | BACKLOG: REQ-30

_14/04/2026_
- [x] **REQ-30 (parcial)**: bugs críticos (race condition, token) | BACKLOG: REQ-30