# Checklist de Variant-Readiness (T4) — Spec 020

> Critério objetivo e pétreo para habilitar o controle lua/sol (`Header showThemeToggle` + `@artificio/ui/theme`) num app.
> Regra: **só habilita o toggle DEPOIS que a variante de tema FALTANTE passar em TODOS os itens abaixo.**
> Sem a variante completa = toggle quebrado = NÃO habilita (R4/R8/R10, débito D-UX2).
>
> "Variante faltante" por app:
> - **glossário** = só light → falta **dark**.
> - **mesas** = só dark → falta **light**.
>
> O checklist é simétrico: vale para a variante que está sendo ADICIONADA. Aplica-se via `[data-theme="<variante>"]`
> usando os tokens compartilhados (`--artificio-*`; dark surface `#1B2A4A`; brand `#FF5722`/`#E64A19`).

## Como medir
- Contraste AA = WCAG 2.1: **≥ 4.5:1** texto normal, **≥ 3:1** texto grande (≥18.66px bold / ≥24px) e componentes de UI/estados de foco.
- Medir com amostra de cor real sobre a superfície real (não "deveria dar"). Registrar par cor-texto/cor-fundo + razão.
- Smoke visual local em claro **e** escuro, desktop **e** mobile (preview), sem flash de tema no boot.

## Itens (todos obrigatórios)

### 1. Contraste de texto AA
- [ ] Texto de corpo sobre superfície base — ≥ 4.5:1.
- [ ] Texto secundário/muted sobre superfície base — ≥ 4.5:1 (ou ≥ 3:1 se for "large").
- [ ] Texto sobre cards/painéis/chips (superfície elevada) — ≥ 4.5:1.
- [ ] Texto sobre o acento laranja (`#FF5722`) — laranja é **acento/fundo de botão**, nunca texto de corpo; se houver texto sobre laranja, medir e garantir AA (tende a exigir texto branco/navy, não cinza).

### 2. Estados interativos
- [ ] hover — mudança perceptível e com contraste mantido (botões, links, itens de lista/nav).
- [ ] active/pressed — idem.
- [ ] focus — anel/contorno visível com **≥ 3:1** contra o fundo adjacente (usar `--artificio-focus`).
- [ ] disabled — visivelmente inativo mas ainda legível (não sumir abaixo de ~3:1); cursor coerente.
- [ ] selected/current (nav, abas, item ativo) — distinguível sem depender só de cor.

### 3. Formulários
- [ ] input/textarea — fundo, borda e texto digitado com AA; placeholder ≥ 4.5:1 (ou aceitar 3:1 documentado).
- [ ] select/combobox — incluindo o dropdown aberto e a opção em hover/selecionada.
- [ ] checkbox/radio/toggle — estados marcado/desmarcado/foco visíveis.
- [ ] mensagens de validação (erro/sucesso) — cor + ícone/texto, não só cor; AA.
- [ ] label e helper text — AA, incluindo o estado disabled do campo.

### 4. Modais, drawers e overlays
- [ ] backdrop/scrim com contraste suficiente para separar do fundo.
- [ ] superfície do modal/drawer com AA para todo conteúdo interno.
- [ ] botão de fechar e ações do rodapé do modal — foco e hover visíveis.
- [ ] toasts/notificações — AA nas variantes (info/sucesso/aviso/erro).

### 5. Header e footer (chrome compartilhado)
- [ ] Header `@artificio/ui` renderiza coerente na variante (logo, nav, ações, userMenu).
- [ ] ThemeToggle (lua/sol) visível e com foco/hover AA na variante.
- [ ] Footer compartilhado legível (texto + links) na variante.
- [ ] estado autenticado vs anônimo do header coerente nas duas variantes.

### 6. Mobile / responsivo
- [ ] layout em ~360–414px sem quebra; nav mobile (drawer/menu) legível na variante.
- [ ] alvos de toque ≥ 44px; foco visível em navegação por teclado.
- [ ] modais/drawers usáveis em mobile na variante.

### 7. Troca de tema (runtime)
- [ ] `applyTheme()` roda no boot do app (antes do paint) — **sem flash** claro↔escuro.
- [ ] alternar claro↔escuro via toggle aplica em todos os itens acima sem reload.
- [ ] cookie único `artificio_theme` (`Domain=.artificiorpg.com`) respeitado; sem mecanismo paralelo.
- [ ] preferência persiste ao recarregar e cross-subdomínio (mesmo cookie).

### 8. Evidência (gate de fechamento)
- [ ] prints claro + escuro, desktop + mobile, anexados na sessão.
- [ ] medições AA dos estados principais (texto/foco/disabled/botões/inputs) registradas.
- [ ] `rg` confirma que nenhum app reimplementou `artificio_theme` (runtime segue único em `packages/ui/src/theme.tsx`).
- [ ] build do app piloto + build de `@artificio/ui` (se tocado) verdes.

---

**Só com TODOS marcados:** habilitar `Header showThemeToggle` **somente nesse piloto** e fazer `applyTheme()` no boot.
**Nunca** habilitar os dois apps na mesma fatia.
