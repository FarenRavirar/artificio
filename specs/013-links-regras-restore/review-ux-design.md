# 013 — 2ª revisão independente: UX, estilo/design, Nielsen, ISO 9241-11, predição de bugs

> Revisão independente (2026-06-20) sobre spec/plan/tasks **e** sobre o código F0/F1 já escrito. Não substitui a auditoria do Gate C (`seo-usability-auditor`); antecipa achados p/ virarem tarefas. Itens marcados **[BUG]** são defeitos latentes no código F0 a corrigir antes do deploy.
> **Atualização 2026-06-20:** Bugs TC1–TC6 corrigidos; UX-1/UX-2/UX-8 implementados; §4 itens fechados. Ver `tasks.md`.

---

## 1. Definições de estilo / design (fechar antes do F2)

Ancorar 100% nos tokens de marca `@artificio/ui` (`packages/ui/src/tokens.ts`, D064) — **zero cor nova**.

| Elemento | Token / decisão |
|---|---|
| Tema | **Light** (`lightCanvas #F4F6FB` fundo, `lightSurface #FFFFFF` cards, `lightInk` texto). Sem alternância dark no 1º corte (consistência com accounts/mesas claro). |
| Headings | `font.display` (Oswald) — nome do grupo, títulos de seção. |
| Corpo | `font.sans` (Inter) — descrição, regras. |
| Acento/marca | `brand #FF5722` só em borda/foco/CTA do convite; **nunca texto de corpo sobre branco** (regra D038/AA). |
| CTA "Entrar no grupo" | botão `brand` fill + texto branco (AA ok no laranja escuro `brandDeep` no hover). |
| Badge **+18** | `danger`/`dangerText` (vermelho 700 sobre fundo claro) — alto contraste, leitura de risco. |
| Chips de **tag** | superfície `lightStrong` + texto `ink`; neutros (não competem com +18). Máx 3. |
| Cantos | `radius.md` (8px) cards; `radius.sm` chips. |
| Logo do grupo | quadrado, `radius.md`, `object-fit: cover`, fallback `placeholder.svg` quando `logo_url` nulo. |
| Datas enviado/aprovado | `muted`, tamanho menor, rótulo explícito ("Enviado em…", "Aprovado em…"). |

Componentes reusados (não duplicar shell): `Header` (SSO/login/userMenu), `Footer`, `Badge`, `Field`, `Panel`, `Toolbar` de `@artificio/ui`.

---

## 2. Auditoria — 10 heurísticas de Nielsen (por tela planejada)

### Home (sidebar + grupos curados + seção comunitária)
1. **Visibilidade do estado:** sidebar deve marcar seção ativa (Grupos/Regras/Grupos de RPG). Island comunitária precisa de estado **loading/empty/erro** (não só sucesso). → tarefa.
2. **Mundo real:** rótulos PT claros ("Grupos de RPG", "Enviar grupo"). OK.
3. **Controle/liberdade:** form de sugestão precisa de **cancelar/limpar**. → tarefa.
4. **Consistência:** reusar Header/Footer/Badge (sem variações locais). OK por design.
5. **Prevenção de erro:** validação de link **no cliente** antes do POST (espelhar `parseInviteUrl`); confirmar antes de enviar. → tarefa. **+18: gate de idade** antes de exibir grupos `is_adult` (blur + confirmação). → tarefa (ver §4 UX-1).
6. **Reconhecer > lembrar:** tags como chips clicáveis p/ filtrar; categorias visíveis. → melhoria.
7. **Flexibilidade:** busca/filtro por tag (nice-to-have F2+).
8. **Estética/minimalismo:** card enxuto; regras longas em `<details>` colapsável.
9. **Recuperação de erro:** mensagens do backend já em PT; island deve exibi-las (não engolir). → tarefa.
10. **Ajuda:** microcopy no form ("Cole o convite chat.whatsapp.com…"). → tarefa.

### Página do grupo `/grupo/<slug>` (SEO)
- H1 = nome; breadcrumb (Início › Categoria › Grupo) p/ orientação + SEO. → tarefa.
- Regras em seção própria com heading; CTA de convite fixo/visível (H1 visibilidade).
- Estado 404 amigável se slug inexistente (não stack trace).

### Form de sugestão (logado)
- Só aparece logado; se anônimo, CTA "Entrar para sugerir" (não esconder mudo) — H1/H10.
- Feedback de **rate-limit (429)** explícito ("Você atingiu o limite, tente em X min"). → tarefa.
- Pós-envio: mensagem "Sua sugestão vai para moderação" (expectativa correta — H1).

### Painel admin CRUD
- Fila de pendentes separada de ativos (H6 reconhecer); contadores por status (H1).
- **Confirmação destrutiva** em excluir/arquivar (H5 prevenção). → tarefa.
- Ações com estado pending/sucesso/erro por linha (H1/H9).
- Editar tags = multiselect do vocabulário (máx 3, bloquear 4º — H5).
- Exibir email+nome do remetente p/ contexto de moderação (H1).
- Gerenciador de tags: avisar "remover esta tag a tira de N grupos" (H5/H1). → tarefa.

---

## 3. ISO 9241-11 (eficácia · eficiência · satisfação) — tarefas-chave

| Tarefa | Eficácia (consegue?) | Eficiência (custo) | Satisfação |
|---|---|---|---|
| Visitante acha um grupo | listagem por categoria + página por slug indexável | ≤2 cliques até o convite; busca/tag reduz | card limpo, logo real |
| Visitante entra no grupo | CTA único e claro; abre WhatsApp | 1 clique | sem fricção |
| Usuário sugere grupo | form validado + feedback de moderação | poucos campos (nome/desc/link) | expectativa correta de fila |
| Admin modera | fila + ações inline + identidade do remetente | lote rápido; sem rebuild manual p/ a island | confiança (confirmação destrutiva) |
| +18 (segurança/conformidade) | conteúdo adulto gated | 1 confirmação por sessão | proteção sem bloquear adulto |

Métrica de aceite (mantenedor no Gate C): cada tarefa concluída sem ajuda, sem dead-end, mensagens compreensíveis.

---

## 4. Melhorias de utilização (acionáveis → viram tasks F2/F3)
- **UX-1 (+18 gate):** grupos `is_adult` aparecem com capa borrada + "Confirmo ter 18+"; preferência guardada em `localStorage` por sessão. (Conformidade + H5.)
- **UX-2:** filtro por **tag** clicável na home (chips → filtra lista). (H6/H7.)
- **UX-3:** estados **loading/empty/erro** explícitos nas ilhas. (H1/H9.)
- **UX-4:** validação client-side do convite + microcopy no form. (H5/H10.)
- **UX-5:** breadcrumb + H1 nas páginas de grupo (orientação + SEO).
- **UX-6:** confirmação destrutiva no painel (excluir/arquivar/remover tag). (H5.)
- **UX-7:** skeleton/`loading="lazy"` nas logos; `alt` = nome do grupo (A11y + SEO).
- **UX-8:** foco visível (`focus` token) e navegação por teclado na sidebar/painel (WCAG 2.4.7).

---

## 5. Predição de bugs / inconsistências no código F0 (corrigir antes do deploy)

- **[BUG] CSP bloqueia logos do Cloudinary.** `astro.config.mjs` tem `img-src 'self' data:` (herdado do estático). Cloudinary serve de `res.cloudinary.com` → imagens **não carregam**. **Fix:** `img-src 'self' data: https://res.cloudinary.com`; `connect-src 'self'` (a island chama mesma origem). Rever CSP toda no F2.
- **[BUG] Remoção de acentos no slugify usa faixa literal frágil.** `server.ts`/`seed.ts` usam `replace(/[<combinantes>]/g,"")` com caracteres literais (risco de corromper no encoding). **Fix:** usar `/[̀-ͯ]/g` explícito. Centralizar `slugify` num único util (hoje duplicado em server+seed → risco de divergência).
- **[BUG] Corrida no `insertSuggestion`.** Padrão select-then-insert; dois envios concorrentes do mesmo `invite_url` → 2º viola `groups_invite_url_uniq` e estoura 500. **Fix:** `INSERT … ON CONFLICT (invite_url) DO NOTHING RETURNING`, ou capturar erro de unique e tratar como "já existe".
- **[BUG] `CREATE EXTENSION pgcrypto` exige privilégio.** Em PG gerenciado pode falhar sem superuser. **Fix:** garantir extensão no provisionamento do `links-db` (compose usa postgres oficial → ok), ou trocar `gen_random_uuid()` por geração na app. Validar no T1b.
- **[INCONSISTÊNCIA] +18 sem gate na API/listagem.** `GET /api/groups` devolve `is_adult` sem qualquer marca de idade; a decisão de gate é só de UI (UX-1). Documentar que a API não filtra (cliente decide) — ou aceitar query `?include_adult=`.
- **[RISCO] og:image do WhatsApp pode exigir JS/cookies ou bloquear bot UA.** `fetchOgImage` pode voltar `null` em parte dos convites. **Mitigação:** fallback placeholder + reprocesso manual no painel ("rebuscar logo"); manter `scripts/fetch-logos.mjs` como plano B até validar taxa de sucesso no T1b.
- **[RISCO] Rebuild SSG vs island.** Páginas `/grupo/<slug>` são SSG; aprovar no painel não as cria até o rebuild. Decisão já documentada (fallback SSR via `/api/groups/:slug`) — **implementar o fallback** senão dá 404 em grupo recém-aprovado.
- **[MENOR] `updated_at` não bumpa** em `deleteTag` (array_remove) nem em alguns paths. Aceitável; documentar.
- **[MENOR] Ordem de rotas:** `GET /api/groups/:slug` captura qualquer segmento; se um dia houver `/api/groups/export`, colide. Manter subrotas sob prefixo distinto.

---

## 6. Resultado
Achados §4 e §5 viram tarefas (ver `tasks.md` F2/F3 + bloco "Correções pré-deploy"). Decisões SEO-render/prod-only/painel-in-app **fechadas** no `plan.md`. Estilo §1 é a base do F2 (sem cor nova; tokens D064).
