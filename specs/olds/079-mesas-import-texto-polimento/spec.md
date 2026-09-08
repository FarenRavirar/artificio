# 079 — Mesas: polimento do parser de import via texto colado

- **Módulo/Pacote:** apps/mesas (backend `discord`/`inbox`, frontend `discord-sync`/`inbox`)
- **Gate relacionado:** D (Mesas ativo)

## Problema

Tela `/gestao/importacao` → "Importar texto" (colagem manual de anúncio, sem
passar por JSON/DiscordChatExporter) produz drafts com campos errados/ausentes
em boa parte dos anúncios reais testados. Achado do mantenedor (2026-07-16),
confirmado com bateria de 13 anúncios reais colados do Discord
(`sessoes/` desta spec traz o texto bruto completo dos 13 casos).

Causa raiz principal (confirmada por investigação, não suposição): ao colar
texto de uma mensagem Discord no textarea do navegador, quebras de linha
visuais entre "labels" do anúncio (`Sistema:`, `Estilo:`, `Data e Hora:` etc.)
frequentemente se perdem, virando uma única linha corrida
(`"Sistema: Próprio Dias e horários: A definir Vagas: 4 jogadores..."`).
`parseDiscordAnnouncement.ts` (`splitLabelLine`/`extractLabelValue`) assume
**um label por linha** — quando isso não é verdade, o regex de split captura
do primeiro `:` até TUDO que vem depois (incluindo os labels seguintes) como
valor de um único campo, contaminando título/sistema/vagas/etc. entre si.

**Isolamento confirmado:** o import via JSON (DiscordChatExporter,
`chatExporterAdapter.ts:61`, `content_raw: msg.content`) usa o `content`
retornado pela API do Discord, que preserva quebras de linha reais salvas no
banco — não sofre esse problema. O bug é exclusivo do fluxo de texto colado
manual (`routes/inbox/import.ts` → `textToRawMessage.ts` →
`parseDiscordAnnouncement`). **Trava do mantenedor: qualquer fix aqui não pode
tocar/arriscar o comportamento hoje estável do import JSON** — fixes devem ser
aditivos e, quando possível, isolados ao caminho de texto colado (pré-
processamento antes de chamar o parser compartilhado), nunca substituindo
regra genérica usada por ambos sem prova de que o JSON não regride.

## Requisitos (numerados, testáveis)

1. Anúncio colado com labels grudados numa única linha (sem `\n` entre eles)
   deve ser normalizado (inserir quebra antes de cada label reconhecido) antes
   de entrar no parser — título/sistema/vagas/estilo/etc. não podem se
   contaminar entre si nos 13 casos reais de evidência.
2. Separador decorativo `▬▬▬`/`═══`/`---` etc. usado como divisor visual
   DENTRO de um único anúncio (não como fronteira entre dois anúncios) não
   pode fragmentar o texto em segmentos/drafts diferentes.
   **[Implementado — `segmentation.ts` `splitBySeparators`, migrado da spec
   077 para cá em 2026-07-16 junto com a manutenção. Herda dono único.]**
3. Label "Data e hora: a definir" (ou variantes "data(s) [e hora(s)] a
   decidir/combinar/definir") deve resolver `day_of_week` para o sentinela
   `to_define`, mesmo sem a palavra "dia(s)"/"horário(s)" explícita no valor.
   **[Implementado — `DAY_TO_DEFINE_PATTERNS`, migrado da spec 077 para cá em
   2026-07-16. Herda dono único.]**
4. Contato por telefone/WhatsApp em texto livre (ex.: "93 992155816 no
   Whatsapp", "Chamar no Discord ou 62994292879 no Whatsapp") deve ser
   reconhecido como contato (campo novo ou reaproveitado — decidir em
   `plan.md`), hoje cai só na descrição e o draft fica com "contato" pendente
   mesmo com dado explícito no texto.
5. Regex de extração de vagas não pode capturar números de OUTROS campos
   (achado real: caso "3-duskwood", `slots_total` saiu `23` — vindo de
   "20:00 - 22:00/**23**:00", um horário, não uma contagem de vagas).
6. `system_name` não pode absorver texto de outros labels quando eles vêm
   colados na mesma linha (achado real: caso "2-narrun", sistema saiu
   `"Título"`; caso "10-a-censura" via texto de uma linha só, sistema saiu
   `"A CENSURA ... -Sistema"`).
7. Campo novo, opcional: "Nome do Mestre" no formulário de draft/mesa
   (`DraftEditorTab.tsx` + schema/API), preenchido automaticamente quando o
   parser reconhece um label `Mestre:`/`Narrador:`/`GM:`/`DM:` com texto
   (não apenas menção `<@id>`), com fallback vazio para revisão manual.
8. **Pré-preenchimento assistido no fluxo PÚBLICO de criação de mesa**
   (`create-table`, o form que o mestre usa direto, fora do admin/Discord):
   nova opção "colar anúncio para pré-preencher" no início do fluxo — mestre
   cola texto livre (mesmo formato dos anúncios de Discord, ou similar) e o
   MESMO parser (`parseDiscordAnnouncement` + normalizador do requisito 1)
   roda para sugerir valores nos campos do form (`useCreateTableForm.ts`).
   Requisitos do pré-preenchimento:
   - Nunca publica/salva sozinho — só popula o estado do form; o mestre
     revisa/edita/confirma normalmente antes de submeter (mesmo modelo do
     fluxo admin: parser sugere, humano confirma).
   - Campos que o parser não conseguiu extrair ficam com o default atual do
     form (não em branco/quebrado) — degrade gracioso.
   - **A correção que o mestre faz no form antes de publicar é capturada e
     vira aprendizado**, reaproveitando o mesmo pipeline hoje usado pelo
     admin (`recordParseCase`/`buildParseCaseContract` em `parseLearning.ts`,
     contrato `deterministic_result_json` vs `final_result_json`) — a
     diferença entre o que o parser sugeriu e o que o mestre efetivamente
     publicou é sinal de treino, exatamente como a correção de um admin em
     `registerDraftCorrection` já é hoje. Isso fecha um loop de aprendizado
     novo: mestres publicando mesa por conta própria também ensinam o
     parser, não só a curadoria admin.
   - Overlap de escopo com requisito 7 (Nome do Mestre): quando o
     pré-preenchimento reconhece o campo mestre, some direto pro autor
     logado (não precisa reperguntar "quem é o mestre" pro próprio usuário
     criando a mesa) — mas o campo capturado do texto (se divergir do nome
     de exibição da conta) fica disponível como sugestão, não sobrescreve
     silenciosamente a identidade da conta.

## Critérios de aceite

- Suíte de regressão nova cobre os 13 anúncios reais de evidência (arquivo
  fixture único, texto verbatim) e passa com campos corretos nos pontos
  descritos nos requisitos 1, 4, 5, 6.
- Suíte completa do parser (`src/discord`) e de `segmentation.ts` seguem
  100% verdes — nenhuma regressão introduzida no fluxo JSON.
- `pnpm run lint` + `pnpm run build` verdes (backend+frontend mesas no
  mínimo; repo-wide antes do fechamento final).
- Smoke manual real: colar pelo menos 3 dos 13 casos reais na tela
  `/gestao/importacao` → "Importar texto" e conferir campos no draft criado.
- Smoke manual real do requisito 8: colar 1+ anúncio no fluxo público
  `create-table`, confirmar que o form é pré-preenchido, editar/corrigir 1+
  campo, publicar, e confirmar que a correção gerou registro de aprendizado
  (`discord_parse_cases` com `final_result_json` divergente do
  `deterministic_result_json`).

## Fora de escopo

- Qualquer mudança no fluxo de import via JSON/DiscordChatExporter
  (`chatExporterAdapter.ts`, `ingestMessages.ts`) — já estável, não tocar.
- Suporte a mais de um "Mestre" por mesa (campo é singular, texto livre).
- Publicação automática/sem revisão a partir do texto colado no fluxo
  público (requisito 8) — sempre passa por confirmação humana antes de
  salvar, igual ao fluxo admin.
- Mudar o pipeline de aprendizado em si (`parseLearning.ts`) — reaproveita
  o contrato existente, não redesenha.

## Riscos e impacto em outros módulos

- Único módulo tocado: `apps/mesas` (backend `discord`/`inbox`, frontend
  `discord-sync`/`inbox`/`admin`). Sem impacto em `packages/*`, SSO, DNS,
  outros apps.
- Risco principal: qualquer heurística de "quebrar linha antes de label
  conhecido" (requisito 1) mal escopada pode introduzir falso positivo em
  texto livre de descrição/sinopse que contenha, por coincidência, uma palavra
  igual a um label seguida de `:` (ex.: um personagem fictício chamado
  "Sistema" numa frase). Mitigação: lista de labels fechada (a mesma já usada
  pelo parser), exigir padrão `label:` com case-insensitive e capitalização
  típica de cabeçalho, e cobertura de teste negativo (texto livre não deve
  ganhar quebras espúrias).
