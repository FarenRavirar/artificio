# Mesas

Módulo G1 para `mesas.artificiorpg.com`.

## Estado
- Importado do legado local `C:\projetos\mesas_rpg_artificio` em CDX-308A.
- Estrutura legada preservada em `frontend/` + `backend/`.
- Próxima etapa CDX-308B: trocar auth próprio por SSO `accounts.` e integrar `@artificio/ui`.

## Contrato G1
- Subdomínio próprio, root `/`, sem basename.
- Login via `accounts.artificiorpg.com`.
- Cookie compartilhado `artificio_session` em `Domain=.artificiorpg.com`.
- Backend valida JWT via `@artificio/auth` com mesmo `JWT_SECRET` de `accounts`.
- Segredos ficam fora do git e nunca entram neste diretório.
- Publicado hoje em `mesasbeta.artificiorpg.com` (beta); destino final `mesas.artificiorpg.com`.

## Visão estratégica de produto — pra onde o mesas está caminhando (registrado 2026-07-02)

Fixado nominalmente pelo mantenedor após investimento real de milhares de dólares em tokens/specs. Citação
literal do mantenedor ao fechar esta seção, definindo esta rodada como definitiva: **"quero saber se está
correto agora, e não vamos mais nos distanciar"** — não é mais uma aproximação, é o ponto de referência
estável. **Toda IA/agente que trabalhar no módulo `mesas` deve carregar esta seção como T1 antes de decidir
arquitetura de importação, parser ou aprendizado.** Não é descrição de feature — é o norte que justifica o
porquê das decisões de specs 048/052/057/058 e das que vierem depois.

### Os dois modos de existência do produto

1. **Modo humano (sempre existe, é a base):** pessoa cria/publica mesa manualmente no site. Caminho direto,
   sem importação nenhuma. Nunca deixa de existir — é o piso.
2. **Modo automação (objetivo ideal, ASSÍNTOTA — não meta binária "pronta"):** em fontes autorizadas (ex.:
   canais de Discord de comunidades parceiras exportados via DiscordChatExporter, como os JSONs usados nesta
   sessão), o sistema recolhe mensagens automaticamente e publica a mesa SOZINHO, sem humano no meio.
   **Aceito explicitamente que 100% de automação talvez nunca seja atingido** — o objetivo é aproximar
   continuamente, não declarar "terminado" em algum ponto. Cada melhoria de parser/aprendizado/DeepSeek é
   progresso mensurável em direção a essa assíntota, não um projeto com linha de chegada fixa.

### O caminho do meio (onde o produto está agora, e vai continuar por tempo indeterminado)

Enquanto a automação completa não é confiável: **parser extrai o máximo possível → humano faz curadoria
rápida (revisa/corrige o draft) → toda correção humana vira aprendizado estruturado (não só um `if` novo no
código) → cada rodada de curadoria melhora a precisão da próxima sugestão automática.**

Dois motores de aprendizado, propositalmente em camadas diferentes:
- **Parser determinístico** (`apps/mesas/backend/src/discord/parseDiscordAnnouncement.ts` e módulos
  relacionados): cobre estrutura e sinais óbvios/recorrentes. Fica mais preciso conforme aprende padrões
  novos, mas SEMPRE conservador — na dúvida, não decide sozinho, manda pra revisão humana.
- **DeepSeek** (API paga deliberadamente pelo mantenedor, já configurada em `accounts` do projeto pra esse
  fim): entra exatamente onde o parser determinístico falha ou fica em dúvida. Não é "IA que só olha o texto
  isolado e chuta" — é agente de segunda linha com escopo mais amplo: pode **pesquisar na internet** pra
  identificar sistema desconhecido, cruzar contexto, organizar informação e aprender com o tempo. Configurado
  intencionalmente como investimento de longo prazo (custo de API pago pra esse propósito específico), não
  feature pontual.

Curadoria humana precisa ser **rápida e de baixo atrito** — não pode virar trabalho longo/cansativo, senão
não escala e a pessoa desiste. Isso é requisito de produto, não só UX bonita: se a revisão for lenta, o
"caminho do meio" trava e o produto nunca converge pra automação melhor.

### Por que "sistema desconhecido no banco" nunca é motivo de descarte automático

Quando o texto do anúncio cita um nome de sistema que não bate com nada no banco (`systems`+
`system_aliases`), isso pode ser:
- (a) sistema real e existente, só ainda não cadastrado na plataforma;
- (b) sistema autoral/caseiro genuíno do mestre (homebrew de verdade);
- (c) nome que uma IA generativa criou num prompt de RPG e o autor do post nem sabe que é "sistema próprio/
  não publicado" — ele pode achar que é um sistema de verdade porque nunca verificou.

**O parser/pipeline não tenta e não deve tentar julgar sozinho qual desses três é o caso.** O papel do
parser + aprendizado + DeepSeek é reduzir a ambiguidade (registrar o hint, buscar evidência, comparar com
casos anteriores, eventualmente pesquisar na internet) e alimentar o banco de sistemas com sinal real ao
longo do tempo — nunca decidir por conta própria "isso não é sistema válido, descartar". Toda ambiguidade de
sistema vira sugestão visível pro revisor humano decidir, nunca desaparece silenciosamente.

Mesas de sistema autoral/próprio (RPG caseiro) hoje são de baixo interesse editorial pra este site
especificamente — mas isso é decisão de curadoria/produto, não do parser. Enquanto o banco de sistemas
estiver incompleto, tratar qualquer sistema não reconhecido como "provavelmente autoral, descartar" seria
ERRADO — a maioria desses casos são sistemas reais ainda não cadastrados, não homebrew.

### Regra universal: todo campo do formulário é candidato a auto-preenchimento, não só sistema

Não é "sistema + alguns campos que fomos achando por acaso". É regra geral: **todo campo que existe no
formulário humano de criação de mesa é candidato a auto-preenchimento automático.** Se a informação está no
texto do anúncio importado e existe campo estruturado correspondente, ela DEVE ir pro campo — nunca ficar só
implícita solta dentro da descrição. Só cai em texto livre de descrição o que genuinamente não tem campo
estruturado no formulário.

Exemplo literal do mantenedor, meta-caso pra generalizar o princípio: "se uma descrição cita que tem que ter
microfone, já temos um campo pra preencher isso" (`requires_microphone`, campo real do form manual) — não
pode ficar só na descrição bruta, tem que setar o campo boolean. O mesmo vale pra cenário, faixa etária,
plataforma, nível de experiência, forma de recrutamento, e qualquer outro campo presente no formulário de
criação manual (levantamento sistemático completo dos ~49 campos reais em
`specs/058-mesas-parser-learning-deepseek/auto-preenchimento-draft.md`).

Campos SEM UI no formulário manual (ex.: hoje `content_warnings`/`safety_tools`/`city`/`state` existem no
schema do banco mas não têm campo no form) ficam FORA de escopo de auto-preenchimento até virarem campo real
de produto — não faz sentido o parser preencher o que nem humano consegue preencher hoje.

### Por que isso importa pro produto, não só pra qualidade técnica

O site é **gratuito** — presente do mantenedor pra comunidade de RPG do Brasil, pra fazer o hobby se
movimentar. A automação de importação existe especificamente pra publicar mesa de quem NÃO teria publicado
sozinho no site — divulgação de mesa dá trabalho, muita gente só posta no Discord da própria comunidade e
nunca chega no site. Quanto mais completo o auto-preenchimento (sem depender de curadoria manual demorada),
mais fácil essa mesa aparecer publicada de verdade, mais pessoas visitam o site atrás de mesa, mais gente se
anima a publicar a própria mesa também — ciclo que cresce o hobby. Completude de campo não é só "qualidade
de dado", é o que faz o presente funcionar de verdade pra quem nunca teria publicado sozinho.

### Onde isso ancora as specs técnicas

- Spec 052 (automação inteligente) e spec 058 (parser learning + DeepSeek contextual) são implementações
  concretas desta visão — não features isoladas. Toda decisão de arquitetura de parser/aprendizado deve ser
  avaliada contra "isso aproxima do modo automação, ou só resolve um caso pontual sem generalizar?".
- Specs futuras de importação/curadoria/matching devem citar esta seção como motivação de fundo (`Por quê`),
  não repetir a explicação.
