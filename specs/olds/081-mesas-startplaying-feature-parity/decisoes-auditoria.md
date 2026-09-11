# Decisões da auditoria visual — 081

> Registro pergunta-a-pergunta das decisões do mantenedor sobre `auditoria-visual.md`. Cada linha referencia o `#` da tabela de origem. Não implementar nada até todos os itens (A, B, C) estarem com decisão registrada aqui.
>
> **Nota de recuperação (2026-07-18):** recuperado pelo mantenedor no chat depois que a pasta `specs/081-*/` nunca foi criada durante a implementação real. `auditoria-visual.md` (a tabela de origem A/B/C referenciada aqui) **não foi recuperado** — só este arquivo de decisões.

## Catálogo (A)

| # | Decisão | Detalhe |
|---|---|---|
| A1 | **Mudar** | Layout vira full-bleed + filtro horizontal no topo (chips), como StartPlaying. |
| A2 | **Mudar** | Filtro de Estilos vira chips com scroll horizontal, compacto (hoje é lista de 48 botões que quebra linha). |
| A5 | **Mudar** | Badge de vagas sai do corpo do card e vai para PILL sobre a imagem, junto das badges de certificação. |
| A6 | **Investigar antes** | Confirmar % de mesas reais sem `gm_display_name` preenchido (announcer vs gm) antes de decidir o que fazer aqui. |
| A7 | **Adicionar** | Rating do GM aparece no card do catálogo também (não só na página de mesa/perfil). Depende de T4 (review) da spec. |
| A8 | **Mudar** | Preço ganha destaque de fonte maior no card (hoje mesmo peso que vagas). |
| A9 | **Adicionar** | Card mostra "X/Y preenchidas" além de "N vagas restantes". |
| A10 | **Adicionar** | Card mostra dia/horário da próxima sessão (hoje não mostra nada disso). |
| A12 | **Não mudar** | Badge "Top GM" continua descartado (decisão anterior mantida). |
| A13 | **Implementar direto** | Ícone de favoritar (bookmark) no card — assume que falta e implementa, sem investigar mais. |
| A14 | **Mudar** | Remove contagem de resultados duplicada (aparece 2x na mesma tela). |
| A15 | **Mudar** | Paginação numérica vira scroll infinito. |
| A16 | **Manter** | Chips de filtros ativos removíveis continuam (diferencial do Mesas). |

## Página de mesa (B)

| # | Decisão | Detalhe |
|---|---|---|
| B1 | **Mudar — maior que breadcrumb** | Achado real: breadcrumb precisa 3 níveis "Home › Sistema › Mesa" (não 4, não "Home › Catálogo › Mesa") **porque Home e Catálogo vão ser fundidos** (ver decisão estrutural abaixo) — Home já É o catálogo, não faz sentido ele aparecer como nível próprio separado do Catálogo. Breadcrumb também precisa ficar visualmente rente/colado ao título, não solto num `<header>` com padding próprio. |
| B2 | **Mudar** | Ordem trocada: TÍTULO deve vir ANTES da imagem de capa (hoje é imagem primeiro, título depois/fora do hero). |
| B3 | **Mudar** | Remove duplicata de "vagas" (aparece 2x: aviso de urgência + quick info). |
| B4 | **Não mudar** | Manter emojis nos títulos de seção (Sobre a Mesa, História, Cenário etc). |
| B5 | **Mudar** | Horários das Sessões: estrutura "parecida" não é suficiente — mantenedor: "se não é próximo no sentido de usabilidade e design, não tem que manter, tem que melhorar". Redesenhar visual, não só copiar estrutura. |
| B6 | **Mudar — entra no escopo** | Corrigir formulário de cadastro de mesa para guiar preenchimento do campo estruturado `setting_styles`/`scenario_subgenres` (hoje usuário digita estilo dentro do texto livre "Sobre a Mesa" em vez de usar o campo certo, e por isso as pills não aparecem). Mesmo achado que C2. |
| B7 | **Confirmado — escopo fechado** | Card do Mestre ganha só: rating (T4), anos na plataforma + mesas hospedadas (T3). Sem Top GM, sem mensagem direta, sem tags de perfil (pronome/LGBTQ+/etc não entram). **Adicional (via B15): card deve aparecer mesmo quando a mesa é publicada por ANUNCIANTE** (hoje cai em texto cru "Mestre responsável: X" sem nenhum componente visual) — mostrar card do mestre responsável com o que houver disponível (nome/avatar/bio), não só texto solto. |
| B8 | **Mudar** | Lista completa de reviews individuais (nome+avatar+nota+texto de cada avaliador), não só média agregada. Parte de T4. |
| B9 | **Fora de escopo** | "Meet your party members" (avatares de quem confirmou presença) exigiria sistema de RSVP/inscrição que Mesas não tem — mudança de modelo de produto, não cabe nesta spec. |
| B10 | **Mudar** | Safety tools/content warnings ganham descrição explicativa de cada tag (hoje só mostra o nome da tag em pill, sem explicar o que significa). |
| B11 | **Mudar** | Sidebar de detalhes rápidos ganha hierarquia visual forte (preço e vagas em destaque de tamanho/cor; Sistema/Experiência/Modalidade viram info secundária menor) — hoje tudo tem o mesmo peso visual. |
| B12 | **Mudar — feature nova** | Achado corrigido: "Report Adventure" do StartPlaying é denúncia da MESA específica (conteúdo inadequado/golpe/spam), diferente do FAB de feedback de sistema que Mesas já tem (que é sobre a ferramenta, não sobre o anúncio). Criar botão/link novo "Denunciar mesa" na página de mesa, separado do FAB existente. |
| B13 | **Não mudar** | Plataformas de jogo (VTT) sem gap identificado. |
| B14 | **Mudar — só ajuste visual** | Ícones de requisitos técnicos (PC/câmera/microfone) já existem, só precisam de mais destaque (tamanho/contraste maior). Sem adicionar novo requisito à lista. |
| B15 | **Resolvido via B7** | Ver decisão de B7 acima — card do mestre passa a aparecer também para mesas publicadas por anunciante. |
| B16 | **Mudar** | CTA principal ganha aviso de cobrança quando mesa é paga (conectado ao selo de mesa paga, T2) — texto avisando que cobrança é feita pelo GM, fora da plataforma. |
| B17 | **Mudar** | "Copiar anúncio": output copiado hoje não inclui horário/data da sessão — precisa incluir esses dados no texto copiado. |

### Decisão estrutural (fora da tabela original, descoberta durante B1)

**Fundir Home (`/`) e Catálogo (`/catalogo`) numa página só.** Hoje são 2 páginas diferentes: `HomePage.tsx` é landing com busca simples (12 mesas, sugestões, hero) e `CatalogoPage.tsx` é a listagem completa com filtros. Mantenedor decidiu que isso é redundante — `/` deve já ser o catálogo completo, sem landing separada. Isso é maior que um ajuste visual: implica decidir o destino de `HomePage.tsx` (deletar? redirecionar `/` para renderizar `CatalogoPage`? migrar elementos únicos da home, como hero/sugestões, para dentro do catálogo?) — **pendente de detalhamento antes de virar task.**

## Dado sujo (C)

| # | Decisão | Detalhe |
|---|---|---|
| C1 | **Entra no escopo** | Normalizar duplicatas de estilo já existentes no banco (merge por capitalização/pontuação: "Dark Fantasy"/"dark fantasy", "Exploração"/"Exploração.", corrigir erro de digitação "Saobrevivência" etc) + corrigir formulário para não deixar entrar sujeira nova (mesma correção de B6). |
| C2 | **Já coberto por B6** | Mesmo achado — uma única correção de formulário resolve os dois. |
| C3 | **Já coberto por B3** | Duplicata de "vagas" na página de mesa — resolvido pela decisão de B3 (remover duplicata). |

## Pendente de pergunta (ainda não abordado nesta rodada)

- A11, A3, A4 (sem gap identificado — não geram pergunta, ficam registrados só como "sem mudança" no `auditoria-visual.md`)
- Pendências de auditoria ainda não cobertas: mesa com `publisher_role=gm` (confirmar como fica o card do mestre quando NÃO é anunciante), perfil `/mestre/{slug}` (ainda não auditado — pode ganhar os mesmos elementos do card: rating/anos/mesas-hospedadas/reviews), mobile, tema claro
- Decisão estrutural pendente de detalhamento: fusão Home+Catálogo (destino de `HomePage.tsx` — deletar? migrar hero/sugestões pro catálogo?)

> Nota de fechamento: todos os itens listados aqui como decididos foram implementados — ver `tasks.md` T1-T9. Os itens "pendente de pergunta" acima (A6, A3/A4/A11, `publisher_role=gm`, mobile, tema claro) foram resolvidos ao longo da implementação (ex.: A6 virou T3.5 ainda pendente; tema claro virou T7, resolvido como falso-positivo; `publisher_role=gm`/anunciante virou T6.2).
