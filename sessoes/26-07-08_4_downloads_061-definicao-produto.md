# Sessão 26-07-08_4 — Downloads · Spec 061 definição prévia

## Escopo

Abrir a Spec 061 como investigação e definição do produto `downloads`, sem código.

## Antes de alterar

- Feito: leitura integral de `AGENTS.md`, T0, `docs/agents/roadmap.md`, `README.md` e `specs/README.md`.
- Feito: busca focada por `downloads`, `Dungeonist`, `DriveThruRPG`, mídia, Cloudinary, upload, sidebar e submenu nos `.md`.
- Feito: verificação do código/árvore real: `apps/downloads` ainda não existe; workspace está em branch de mesas com mudanças alheias, preservadas.
- Falta: criar `spec.md`, `plan.md`, `tasks.md`; registrar decisão, backlog e mapas.

## Ferramentas

- `rtk`: usado para leitura, busca e Git read-only.
- Serena MCP: instruções iniciais lidas; não há código/símbolo de `downloads` para navegar ou editar.
- `artificio-api-governance`: não aplicável nesta fase sem API/código; a investigação futura deverá usar o bundle antes de definir contratos.
- `codebase-memory-mcp` e LSP: não expostos no cliente atual; fallback local registrado conforme D088.

## Achados iniciais

- Decisão firme existente: `downloads.artificiorpg.com`, app independente, root `/`, SSO e design compartilhados (D017/D018).
- Documentação antiga limita o produto a “materiais traduzidos”; pedido atual amplia para catálogo comunitário de materiais gratuitos.
- Usuário autenticado publica cadastro e links externos; PDF não será hospedado pelo Artifício.
- Capas podem usar o armazenamento Cloudinary compartilhado, sempre por upload backend signed.
- Há legado potencial no WP: CPT `docs` (17 itens), página `material-online` e categoria `downloads`; investigar valor/migração, sem presumir importação.
- Referências de produto: Dungeonist antigo e profundidade de metadados semelhante ao DriveThruRPG; não copiar marca/layout.

## Alterações

- Criados `specs/061-downloads-definicao-produto/{spec,plan,tasks}.md`.
- Registrada D089; descrição antiga “materiais traduzidos” superada.
- Atualizados README, roadmap, mapa de specs, backlog e project-state.
- Definidas 7 fases de investigação e 12 specs filhas candidatas em ordem de dependência.

## Estado

Spec aberta em investigação. Nenhum código, commit, push, deploy, VM write ou chamada externa. Próximo passo: F0.4/F0.5 e pesquisa externa F1; perguntas prioritárias aguardam definição baseada em evidência + mantenedor.

## Refinamento do mantenedor

- Catálogo/hub; não hospeda arquivos. Link direto autorizado ou página externa, inclusive DMsGuild.
- Terceiros aceitos; usuário declara papel e garante gratuidade/permissão.
- Login/cadastro/newsletter externos aceitos com flags.
- Moderação prévia para cadastro e edição; auto-publicação modelada, desativada por padrão.
- Sem licença explícita: somente produção de fã declarada.
- MVP inclui comentários, avaliações, favoritos, coleções, perfil público e métricas.
- Taxonomia deve cobrir os filtros atuais do DriveThruRPG; pesquisa web inicial confirmou sistema/regras, editora, formato/VTT, categorias, busca e ordenação, mas snapshot completo segue task T1.2.
- Não existe legado WP de downloads; removida hipótese de importação.
- Naquele momento ainda aberto: “pague quanto quiser”, prova de permissão, regras anti-abuso e eventual serviço de arquivos/PDF. PWYW foi fechado inicialmente por D101 e reformulado depois por D102.

## Storage definido pelo mantenedor

- Arquivos permitidos poderão ser hospedados.
- Ordem: Cloudflare R2 → Backblaze B2 → Fastio → Cloudinary para PDF.
- Capas permanecem no Cloudinary compartilhado.
- Registrada D091.
- Investigação obrigatória: confirmar “Fastio”; quotas/APIs/egress; adapter; URL estável; failover; migração/reconciliação.

## Retomada — investigação T0.4

- Fazer agora: auditar no código real contratos reutilizáveis de auth, UI, mídia, feedback, analytics, API e deploy para o futuro `apps/downloads`.
- Já feito: produto/D089–D091, storage preliminar, fases e perguntas abertas.
- Falta: produzir inventário com evidência por arquivo, classificar reuso/adaptação/gaps e registrar resultado na spec/tasks.

## Resultado T0.4

- Auditoria concluída e registrada diretamente em `spec.md`; nenhum arquivo auxiliar criado.
- Serena confirmou `defaultNavItems`: Downloads já está no shell.
- API governance confirmou bundle com 290 operações e 22 rotas do links; padrão público/self-service/admin/health mapeado.
- Reuso: `requireAuth`, CSRF, Header `moduleNav`, Footer/tokens, Cloudinary para capas, feedback técnico, analytics base, SEO base, manifesto/deploy/migrations.
- Referência: `apps/links` para pending→admin, denúncias, rate limits e sidebar responsiva.
- Não copiar: ownership denormalizado do links, workflow curto, sidebar Astro acoplada e role global binária.
- Gaps: permissões app-local, histórico editorial, comentários/avaliações/favoritos/coleções, storage R2/B2/Fastio/Cloudinary.
- `@artificio/media` é Cloudinary-only; storage multi-provider exige spec compartilhada própria.
- T0.4 marcado concluído. Nenhum código, API, infra ou deploy alterado.

## Correção do mantenedor

- `apps/mesas` passa a baseline técnico principal por ser o app mais avançado.
- Reusar padrões de stack, ownership, perfis, painel, gestão, moderação, filtros, validação, testes, API e deploy.
- `apps/links` permanece apenas referência complementar de sugestão simples e denúncia.
- R2, B2 e Fastio são implementação obrigatória na spec filha de storage; Cloudinary PDF fica fallback final.
- Registrada D092.

## Ambientes definidos

- Beta: `downloadsbeta.artificiorpg.com`, alimentado por `dev`.
- Produção: `downloads.artificiorpg.com`, alimentado por `main` após promoção explícita.
- Isolamento obrigatório de app, DB, containers, secrets, buckets/namespaces, métricas e jobs.
- Registrada D093.

## Correção de ambientes

- D094 refina D093: apenas os hosts beta/prod ficam previstos.
- Fluxo operacional deve ser idêntico ao padrão canônico vigente dos demais módulos no momento da implementação.
- Proibido criar snowflake de branch, promoção, compose, manifesto, isolamento, gates ou deploy sem nova decisão.

## Resultado T1.1 — Dungeonist

- Pesquisa web executada; domínio oficial está fora do ar.
- Internet Archive/Arquivo.pt não abriram pelo acesso disponível; limitação registrada.
- Triangulação: cobertura contemporânea, TCC acadêmico, páginas de produtos e relatos comunitários.
- Confirmado: marketplace brasileiro especializado, PDFs pagos e gratuitos, autores/editoras independentes, aprovação de produtos, pagamentos, suporte, comissão autoral 65–75% e encerramento por custo operacional.
- Não confirmado: UI, filtros, schema, reviews, favoritos, perfis, storage e políticas detalhadas.
- Lição: Dungeonist orienta missão/risco; não serve como especificação copiável.
- T1.1 marcado concluído; nenhum arquivo auxiliar criado.

## Regra pétrea + T1.1b

- D095: downloads é hub de catálogo, descoberta e redirecionamento.
- Usuário cadastra link externo ou envia arquivo para provider externo integrado.
- Zero pagamento, preço, carrinho, checkout, comissão ou biblioteca comercial.
- DriveThruRPG = referência máxima de configuração/metadados/filtros.
- Dungeonist = referência visual/histórica.
- Analogia funcional: Baixaki antigo, adaptado a materiais gratuitos de RPG.
- T1.1b aberto: matriz completa DriveThruRPG → Artifício (`adotar|adaptar|excluir`).

## Resultado T1.1b — DriveThruRPG

- Fontes primárias atuais do Partner/Customer Help Center auditadas.
- Browse público bloqueou automação com HTTP 403; lista literal de valores fica em T1.2, sem invenção.
- Matriz completa registrada diretamente no `spec.md`.
- Adotar: ficha rica, autores/créditos/editora, taxonomias, sistema/agnóstico, gênero, tipo, formatos/VTT, idioma, requisitos, múltiplos arquivos, versões, perfis, busca, favoritos, coleções e moderação por confiança.
- Adaptar: capa/previews, classificação, criação/IA, avaliações, publicação agendada, duplicação/edição em lote e histórico.
- Excluir: preço, carrinho, checkout, cupom, desconto, comissão, accounting, POD e biblioteca comercial.
- Adicionar: link/upload, provider, URL lógica, barreiras externas, verificação, permissão/licença, papel do publicador e takedown.
- T1.1b marcado concluído. T1.2 preservado para enumerar valores atuais de cada filtro.

## Pré-requisito novo — sistemas compartilhados

- D096: primeira spec filha da 061 será investigação/decisão da fonte única de sistemas/edições.
- Escopo: `apps/mesas`, `apps/glossario` e futuro `apps/downloads`.
- Motivo: mesas e glossário já gerenciam o mesmo conceito; downloads não criará terceira fonte.
- Fase F-1 adicionada com auditoria, comparação arquitetural, migração, rollout e rollback.
- Banco/catálogo canônico único e gestão única são requisitos firmes; investigação decide onde vivem e como migrar/consumir.
- Toda spec executável de downloads fica bloqueada até essa decisão.

## Retomada — prova obrigatória para aprovação

- Fazer: registrar decisão do mantenedor sobre comprovação de gratuidade ou possibilidade jurídica de publicação.
- Já feito: papel do publicador, curadoria de terceiros, garantia de permissão e moderação prévia já definidos.
- Falta: transformar a garantia declaratória em evidência obrigatória e retirar essa pergunta da lista aberta.
- Limite: definição de produto/política; nenhum código.

## Resultado — D100

- Toda aprovação exige prova verificável de gratuidade ou possibilidade jurídica de divulgação/publicação.
- Formas aceitas: URL oficial; imagem/captura contextualizada; licença, autorização, programa de fã ou base jurídica demonstrável.
- Declaração isolada do usuário não basta.
- Regra vale para material próprio, curadoria de terceiro e futura auto-publicação.
- Mudança material de link, arquivo, licença, titularidade ou distribuição exige nova avaliação.
- Pendente investigar somente operação da prova: armazenamento, privacidade, acesso, retenção e revalidação.
- Registrado em `spec.md`, `tasks.md`, D100 e `project-state.md`. Nenhum código.

## Retomada — investigação T1.2

- Fazer: capturar snapshot datado e verificável dos filtros públicos, metadados, submissão e políticas atuais do DriveThruRPG.
- Separar: filtro público real, categoria/taxonomia, navegação/atalho e campo apenas editorial/comercial.
- Fontes: páginas públicas atuais e documentação oficial Partner/Customer Help Center; fonte secundária só para localizar, nunca para afirmar valor.
- Limite: investigação e documentação; nenhum código.

## Resultado T1.2

- Catálogo público atual inspecionado sem login; ficha real e documentação oficial cruzadas.
- Famílias confirmadas: Publisher, Genre, Product Type, Rule System, Languages e Format.
- Separados filtros/taxonomias de atalhos comerciais, strips, ordenações e navegação editorial.
- Valores de primeiro nível de gênero, tipo, idioma, formato e sistemas destacados registrados em `spec.md`.
- Sistemas/editoras são listas dinâmicas; destaques do menu não foram falsamente tratados como enum completo.
- Campos literais de submissão e ficha pública inventariados.
- Políticas de moderação, adulto, IA, propriedade intelectual, community content, previews, arquivos e reviews registradas.
- Limitação: `/en/browse` deu 403 no leitor HTTP e erro de locale no navegador; home e fichas carregaram. Nenhuma folha não observada foi inventada.
- T1.2 concluído. Próximo: T1.2a consolidar modelo Artifício sem campos financeiros.
- Nenhum código, commit, push ou deploy.

## Retomada histórica — decisão inicial sobre PWYW (superada por D102)

- Fazer: fechar T2.3 conforme decisão do mantenedor.
- Decisão inicial: Downloads aceitaria somente material gratuito; PWYW não entraria. Superada por D102.
- Limite: documentação de produto; nenhum código.

## Resultado histórico — D101 (superada por D102)

- Somente material integralmente gratuito.
- PWYW havia sido rejeitado, inclusive com mínimo zero. Regra superada por D102.
- Nenhum pagamento obrigatório ou opcional pode integrar o acesso ao material.
- Login, cadastro e newsletter externos continuam aceitos com flags.
- Regra histórica: destino PWYW perderia publicação. D102 passou a aceitar PWYW externo com opção zero.
- T2.3 fechado. Nenhum código.

## Retomada — investigação T1.2a

- Fazer naquele momento: consolidar T1.1b, T1.2, D100 e D101 em modelo conceitual sem comércio. D102 posteriormente revisou somente a condição PWYW externa.
- Entregas: entidades, grupos de campos, obrigatoriedade, visibilidade, validações, estados de verificação e exclusões.
- Limite: modelo de produto, não schema SQL/API/código; taxonomias finais continuam em T3.1.

## Resultado T1.2a

- Modelo consolidado em dez entidades conceituais: material, versão, destino, pessoa/organização, perfil, classificação, evidência, revisão, verificação e interação.
- Campos obrigatórios, condicionais, públicos e privados definidos.
- `external_link` e `managed_upload` têm contratos conceituais separados, mesma ficha pública.
- Barreiras foram modeladas por coleção controlada. D102 retirou PWYW das barreiras: virou condição `pwyw_external`; pagamento obrigatório continua inelegível.
- Estados editoriais e de verificação definidos.
- Validações cruzadas e exclusões financeiras registradas.
- Lacunas encaminhadas às fases corretas, sem antecipar taxonomia, política jurídica, storage ou métricas.
- T1.2a concluído. Próximo: T1.3 comparar três catálogos gratuitos atuais.
- Nenhum código, schema SQL, API, commit, push ou deploy.

## Retomada — investigação T1.3

- Fazer: comparar ao menos três catálogos atuais de materiais gratuitos, com fontes públicas verificáveis.
- Comparar: proposta, descoberta, taxonomia, submissão, autoria, hospedagem/link externo, moderação, prova jurídica, barreiras de acesso, interações, métricas e saúde dos destinos.
- Separar: fato observado, inferência e limitação; não importar comércio ou práticas incompatíveis com D095/D100. A leitura original usou D101; D102 depois reformulou PWYW.
- Já feito: Dungeonist, DriveThruRPG e modelo conceitual Artifício.
- Falta: selecionar referências atuais relevantes, registrar comparação e marcar T1.3; T1.4 continua reservada para matriz final `adotar|adaptar|rejeitar`.
- Limite: investigação documental; nenhum código, schema, API, infra ou deploy.

## Resultado T1.3

- Snapshot público de 2026-07-09 comparou itch.io, RPGGeek e Keeper/Fari RPGs.
- itch.io: descoberta em escala, cards, tags, coleções, perfis e separação publicação/indexação; tag `free` e `$0` não provam condição de acesso. D102 depois aceitou `$0 or Donate` somente por link externo quando zero libera o material.
- RPGGeek: banco relacional comunitário, busca de duplicidade, moderação prévia, arquivo/link ligados ao item, nota privada e consentimento expresso para reupload.
- Keeper: coleção gratuita/open, licença visível, conteúdo acessível e curadoria humana; taxonomia, interações e escala são rasas.
- Comparação, forças, riscos, lacunas e fontes oficiais registradas em `spec.md` §T1.3.
- Achados: material/destino/arquivo separados; link oficial pode ser juridicamente superior; publicação não é descoberta; licença pública; histórico preservado; vocabulário central controlado; ratings protegidos contra amostra pequena/manipulação.
- T1.3 concluído. Próximo: T1.4, matriz normativa única `adotar|adaptar|rejeitar`.
- Nenhum código, schema, API, commit, push, deploy ou write externo.

## Retomada — reformulação PWYW

- Fazer: superar D101 e revisar toda a Spec 061 para aceitar PWYW somente como página externa de aquisição.
- Regra nova: Artifício cataloga/redireciona; arquivo PWYW nunca entra em `managed_upload`, providers, espelhamento, proxy ou armazenamento do Artifício.
- Preservar: preço fixo obrigatório continua proibido; oferta deve permitir aquisição por valor zero; condição PWYW precisa ser sinalizada e verificada.
- Falta: corrigir política, modelo conceitual, estados de verificação, T1.3, tasks, decisão e memória operacional.
- Limite: documentação de produto; nenhum código.

## Resultado — D102

- D102 supera D101.
- PWYW aceito somente como `external_link` para página externa de aquisição quando valor zero libera integralmente o material.
- Proibido para PWYW: `managed_upload`, R2, B2, Fastio, Cloudinary PDF, espelhamento, proxy ou cópia Artifício.
- Ficha/card/CTA sinalizam “Pague quanto quiser — site externo”.
- Prova D100 demonstra opção zero e legitimidade; checker revalida a condição.
- Preço mínimo positivo, tier pago necessário e pagamento obrigatório continuam proibidos.
- Spec, plan, tasks, decisões e memória operacional revisados. Nenhum código.

## Retomada — exposição de valor PWYW

- Fazer: deixar explícito que Downloads não captura nem exibe valor sugerido, mínimo ou pago de oferta PWYW.
- Público vê somente sinalização PWYW e orientação para consultar o link externo.
- Moderação/verificação acessa o destino para confirmar que valor zero ainda libera integralmente o material.
- Limite: documentação de produto; nenhum código.

## Resultado — valor PWYW não exposto

- Artifício não captura, armazena nem mostra valor sugerido, mínimo escolhido ou pago.
- Card/ficha/CTA mostram somente “Pague quanto quiser — consulte no site externo”.
- Usuário consulta condições no destino externo.
- Moderação/checker abre o destino e confirma que zero ainda libera integralmente o material.
- D102, spec, tasks e memória operacional sincronizados. Nenhum código.

## Retomada — investigação T1.4

- Fazer: consolidar T1.1, T1.1b, T1.2, T1.3 e D089–D102 em matriz normativa final `adotar|adaptar|rejeitar`.
- Cobrir: posicionamento, catálogo, descoberta, ficha, submissão, moderação, direito, acesso, storage, interações, métricas, UX e operação.
- Cada linha deve registrar origem, decisão Artifício, regra concreta e encaminhamento para fase/task posterior.
- Preservar: hub de descoberta; sem comércio interno; PWYW apenas link externo sem valor exposto; prova D100; catálogo canônico da 062.
- Limite: definição de produto; nenhum código, schema, API, infra ou deploy.

## Resultado T1.4

- Matriz normativa final registrada em `spec.md` §T1.4.
- Consolidados Dungeonist, DriveThruRPG, itch.io, RPGGeek, Keeper, T0.4 e D089–D102.
- Nove blocos cobertos: posicionamento; origem/acesso; ficha; descoberta; submissão; direito/segurança; interações/métricas; UX; storage/operação.
- Cada conceito recebeu origem, veredito, regra concreta e encaminhamento.
- Doze decisões derivadas viraram entradas obrigatórias das specs filhas.
- Lista explícita protege conceitos rejeitados contra reintrodução acidental.
- F1 concluída. Próximo: F2/T2.1, usuários/personas e jornadas.
- Nenhum código, schema, API, infra, commit, push ou deploy.

## Retomada — F2/T2.1 personas e jornadas

- Fazer: definir atores reais do produto, objetivos, dores, capacidades e jornadas ponta a ponta.
- Evitar personas fictícias decorativas; usar arquétipos funcionais verificáveis pelas decisões já fechadas.
- Cobrir descoberta anônima, participação autenticada, publicação própria, tradução, editora, curadoria de terceiro, PWYW externo, upload elegível, moderação, denúncia, manutenção e retirada.
- Explicitar limites de permissão e troca de papel por material.
- Limite: definição de produto; nenhum código, schema, API ou UI final.

## Resultado F2/T2.1

- Dez personas funcionais definidas: visitante, usuário leitor, autor, tradutor, editora, curador, moderador, admin, titular reivindicante e automação.
- Papel por material foi separado de permissão, ownership, crédito e titularidade.
- Matriz de capacidades fechou quem lê, interage, submete, edita, revisa, suspende e gere permissões.
- Quinze jornadas cobrem descoberta, participação, link próprio, upload, curadoria, PWYW, tradução, edição, moderação, denúncia, reivindicação, checker, retirada, auto-publicação futura e organização.
- Regras de ownership e continuidade evitam conta compartilhada, perda de histórico, sobrescrita de publicação e confusão entre erro técnico/jurídico.
- Perguntas residuais foram encaminhadas às tasks próprias sem bloquear T2.1.
- Próximo: T2.2, MVP, pós-MVP e não objetivos.
- Nenhum código, schema, API, infra, commit, push ou deploy.

## Retomada — F2/T2.2 escopo do produto

- Fazer: dividir capacidades e jornadas em MVP obrigatório, pós-MVP planejado e não objetivos.
- Respeitar decisões já firmes: comentários, avaliações, favoritos, coleções e perfis públicos pertencem ao MVP; R2/B2/Fastio são obrigatórios; auto-publicação nasce modelada, mas desativada.
- Definir critérios mínimos de lançamento, dependências e itens que não podem ser cortados para antecipar entrega.
- Evitar chamar de pós-MVP requisito jurídico, segurança, moderação ou isolamento beta/prod.
- Limite: definição/planejamento; nenhum código ou infraestrutura.

## Resultado F2/T2.2

- MVP definido como produto público confiável, não lista provisória de links.
- Seis pré-requisitos bloqueantes registrados.
- Onze blocos obrigatórios cobrem descoberta, ficha, submissão, PWYW, moderação, upload, comunidade, perfis, métricas, segurança e operação.
- J1–J13 entram no MVP; J14 entra somente como estrutura desativada; J15 entra com perfil institucional e um responsável.
- R2, B2 e Fastio permanecem obrigatórios já no MVP; Cloudinary PDF é fallback final.
- Comentários, avaliações, favoritos, coleções e perfis públicos permanecem MVP, sem erosão.
- Oito frentes pós-MVP e vinte não objetivos foram separados.
- Lista não cortável e gate de lançamento com doze provas impedem conclusão parcial.
- Próximo: T2.5, métricas de sucesso e analytics.
- Nenhum código, schema, API, infra, commit, push ou deploy.

## Retomada — F2/T2.5 métricas e analytics

- Fazer: definir sucesso do produto sem inventar download concluído.
- Cobrir funis de descoberta, acesso, publicação, moderação, saúde, comunidade, storage e segurança.
- Separar métricas públicas, privadas do responsável e administrativas.
- Definir eventos conceituais, deduplicação, anti-bot, retenção, privacidade e baseline.
- Não fixar metas arbitrárias de crescimento antes de beta; criar gates mensuráveis e método para definir metas após observação.
- Limite: contrato de medição; nenhum código, dashboard ou integração.

## Resultado F2/T2.5

- Métrica principal definida: acessos qualificados ao destino por período.
- Clique externo e redirect de arquivo nunca são chamados de download concluído.
- Métricas de descoberta, cobertura, publicação, moderação, confiabilidade, comunidade e storage definidas.
- Quatro funis e catálogo mínimo de eventos conceituais registrados.
- Dimensões permitidas e dados proibidos separam analytics de evidência, PII, conteúdo e valores PWYW.
- Contagens bruta, válida e qualificada; deduplicação/anti-bot/anti-fraude previstos.
- Visibilidade pública, do responsável e administrativa separada.
- Beta mede correção; produção cria baseline de 30 dias e revisão de 90 dias, sem metas de crescimento inventadas.
- Doze critérios de aceite definidos para futura implementação.
- F2 encerrada. Próximo: F3/T3.1.
- Nenhum código, schema, dashboard, integração, commit, push ou deploy.

## Retomada — F3/T3.1 taxonomia e metadados

- Fazer: fechar taxonomias públicas e campos obrigatórios, opcionais e condicionais.
- Usar snapshot DriveThruRPG como cobertura máxima, adaptando comércio para hub gratuito.
- Sistemas/edições vêm exclusivamente da Spec 062; cenários ficam fora desse catálogo compartilhado.
- Separar classificação editorial de formato técnico, plataforma VTT, acesso, licença, autoria e tags.
- Definir governança, aliases, “outro”, sugestões e facetas sem congelar enums no código.
- Limite: modelo conceitual; nenhum schema SQL, API, migration ou implementação.

## Resultado F3/T3.1

- Dezessete famílias taxonômicas definidas com cardinalidade, faceta e governança.
- Sistemas/edições permanecem exclusivos da Spec 062; cenários usam vocabulário próprio do Downloads.
- Tipos de material, gênero, idioma, formatos, plataformas, acesso, barreiras, licenças, créditos, público, idade, avisos, criação e tags receberam vocabulários iniciais.
- Metadados obrigatórios, condicionais, opcionais e privados fechados.
- Dezesseis facetas públicas e ordenações não financeiras definidas.
- Dezesseis validações cruzadas impedem combinações incoerentes.
- Sugestões, aliases, merges, traduções e revisão periódica compõem governança.
- Quinze critérios de aceite definidos para futura implementação.
- Próximo: T3.2, autoria/licença/fan content/traduções/IA/provas.
- Nenhum schema, enum de código, API, migration, commit, push ou deploy.

## Retomada — F3/T3.2 autoria, licenças e provas

- Fazer: investigar bases oficiais atuais e definir política conservadora de autoria, licença, produção de fã, tradução, IA e evidência D100.
- Fontes prioritárias: legislação brasileira oficial, textos oficiais CC/OGL/ORC e políticas dos titulares/programas comunitários.
- Separar direito de catalogar link, usar capa/metadata e armazenar/redistribuir arquivo.
- Declaração do usuário nunca substitui prova; produção de fã sem licença explícita exige tratamento próprio.
- Registrar fatos, inferências, política recomendada e gates de decisão; nenhum aconselhamento jurídico individual.
- Limite: investigação/política de produto; nenhum código.

## Resultado parcial — F3/T3.2

- Investigação completa registrada em `spec.md` §T3.2.
- Separados quatro direitos: catalogar link, usar capa/preview, traduzir/adaptar e armazenar/redistribuir.
- Definidas classes A1–A10, regras CC/OGL/ORC/SRD, programas fechados, produção de fã e traduções.
- D100 detalhada por ação e força E0–E3; declaração isolada, gratuidade e crédito não bastam.
- IA: proposta conservadora rejeita texto gerado e pacotes autônomos; imagem integrada a obra humana depende de decisão.
- Pendem duas decisões do mantenedor: A10 somente link; política final de imagem generativa.
- T3.2 permanece aberta. Nenhum código, commit, push ou deploy.

## Fechamento — F3/T3.2

- Mantenedor confirmou A10 somente link para página pública do criador, nunca upload.
- Mantenedor confirmou IA visual somente integrada a obra humana substancial, declarada e moderada.
- Texto final gerado por IA e pacotes autônomos gerados permanecem proibidos.
- Decisão registrada como D103; `spec.md`, `tasks.md`, backlog e estado sincronizados.
- T3.2 concluída. Próximo: T3.3.

## Retomada — F3/T3.3 estados editoriais e moderação

- Fazer: investigar e definir estados, transições, filas, revisão de cadastro/edições, papéis, auditoria e notificações.
- Referência material principal: fluxos reais de `apps/mesas`; Glossário como comparação de moderação.
- Auto-publicação deve existir apenas como capacidade futura, desativada globalmente e por padrão.
- Separar estado editorial, disponibilidade técnica do destino e visibilidade/indexação.
- Limite: investigação e política de produto; nenhum código.

## Resultado — F3/T3.3

- Investigação completa registrada em `spec.md` §T3.3.
- Código real de Mesas confirmou draft separado, publicação explícita e autonomia bloqueada por gates/kill switch; Glossário confirmou fila, revisor, data e notificação.
- Definidos três eixos independentes: versão editorial, visibilidade pública e saúde técnica.
- Versões são imutáveis; edição pendente não derruba publicação anterior, salvo risco grave.
- Fechados estados, transições, fila, prioridades, papéis, conflito de interesse, decisões, auditoria, notificações, concorrência e falhas.
- `downloads.content.auto_publish` existe apenas conceitualmente, sem atribuição, desligada em beta/prod e sem ativação no MVP.
- Ativação futura exige spec própria, shadow, métricas, rollback e autorização nominal.
- Decisão registrada como D104. T3.3 concluída; próximo T3.4.
- Nenhum código, commit, push ou deploy.

## Retomada — F3/T3.4 denúncias, retirada e links quebrados

- Fazer: investigar e definir denúncia, triagem, suspensão/remoção, notificação, contraditório, recurso, restauração, reincidência e auditoria.
- Definir abandono do cadastro, sucessão/reivindicação e política para links quebrados/degradados.
- Verificar base oficial brasileira aplicável; não prometer aconselhamento jurídico nem automatizar decisões jurídicas.
- Reusar padrões reais de denúncia/triagem de Mesas e Links onde forem adequados.
- Limite: investigação e política de produto; nenhum código.

## Resultado — F3/T3.4

- Investigação completa registrada em `spec.md` §T3.4.
- Verificados Marco Civil, parâmetros do STF publicados em 2025, LDA, LGPD e orientação ANPD.
- Definidos canais, categorias P0–P3, estados, triagem, contenção proporcional e decisões.
- Denúncia comum não remove automaticamente; risco grave/inequívoco permite contenção cautelar.
- Fechados contraditório, recurso, restauração, abuso, retirada voluntária e auditoria.
- Abandono não transfere autoria/direitos; reivindicação pode transferir somente gestão comprovada.
- Checker distingue falha transitória, persistente e hostil; thresholds exatos serão calibrados em beta/T6.3.
- Automação não decide autoria, licença, recurso ou transferência.
- Decisão registrada como D105. T3.4 concluída; próximo T3.5.
- Nenhum código, commit, push ou deploy.

## Retomada — F3/T3.5 capas, imagens e direitos de uso

- Decisão do mantenedor: capas podem ser usadas como ilustração editorial em tamanho reduzido, como em manchetes/artigos; nunca em resolução original/substitutiva.
- Fazer: definir classes de imagem, origem/prova, transformações, atribuição, marcas, previews, conteúdo sensível, moderação, retirada e armazenamento Cloudinary shared.
- Verificar limites jurídicos oficiais e o contrato técnico já praticado pelo monorepo.
- Separar direito sobre obra textual, capa, arte interna, logotipo e imagem generativa.
- Limite: investigação e política de produto; nenhum código.

## Resultado — F3/T3.5

- Investigação completa registrada em `spec.md` §T3.5.
- Decisão do mantenedor consolidada: capa editorial acessória/reduzida, como manchete/artigo, nunca original/substitutiva.
- Derivado editorial canônico máximo 800×1200, sem upscale, zoom ou original público.
- Capa, preview, arte interna, galeria e marca têm direitos separados.
- Fechados origem, créditos, integridade, curadoria/fan content, marcas, sensível, IA D103, moderação e retirada por asset.
- Cloudinary shared confirmado; implementação futura reutiliza/evolui `packages/media`, com namespace beta/prod e backend seguro.
- Decisão registrada como D106. T3.5 concluída; F3 encerrada.
- Próximo: F4/T4.1.
- Nenhum código, commit, push ou deploy.

## Retomada — F4/T4.1 mapa de páginas e rotas

- Fazer: definir inventário público, autenticado, editorial/admin e rotas técnicas de saída.
- Fixar ownership, parâmetros, indexação, canonical, autenticação, estados vazios/erro e relação entre páginas.
- Reusar padrões maduros de Mesas e contrato subdomínio-por-projeto; Downloads usa root próprio, sem basename.
- Administração central de sistemas/edições continua pertencendo ao Site/Spec 062; Downloads apenas oferece entrada contextual.
- Limite: mapa conceitual/arquitetura de informação; layout visual, sidebar e submenu ficam em T4.2.

## Resultado — F4/T4.1

- Mapa completo registrado em `spec.md` §T4.1.
- `/catalogo` é busca canônica; `/materiais/:slug` é ficha pública estável.
- `/criadores/:slug` separa entidade creditada de `/usuarios/:username`, evitando transformar curador em autor.
- Landings, coleções, páginas institucionais, painel e gestão foram mapeados.
- `/ir/:destinationId` resolve externos; `/obter/:fileId` resolve arquivo gerenciado; ambas noindex/fail-closed.
- Definidos estados públicos, 404/403/503, redirects, canonical, sitemap e ownership.
- Sistemas/edições continuam no serviço central 062, com gestão major no Site.
- Decisão registrada como D107. T4.1 concluída; próximo T4.2.
- Nenhum código, commit, push ou deploy.

## Retomada — F4/T4.2 submenu e sidebar

- Fazer: definir hierarquia nav global → submenu Downloads → sidebar contextual.
- Cobrir desktop, tablet e mobile; estados público, autenticado, painel e gestão.
- Reusar tokens/componentes de `packages/ui` e padrão de gestão do Mesas sem copiar divergências.
- Preservar acessibilidade, teclado, foco, landmarks, redução de movimento e densidade responsiva.
- Limite: investigação/design conceitual; busca/filtros detalhados ficam em T4.3 e páginas em T4.4.

## Resultado — F4/T4.2

- Investigação completa registrada em `spec.md` §T4.2.
- `packages/ui/Header`, AppShell/gestão/filtros do Mesas verificados como baseline real.
- Fixada hierarquia: nav global → submenu Downloads → sidebar contextual → conteúdo.
- Sidebar pública desktop cobre exploração; catálogo incorpora filtros.
- Painel e Gestão substituem a sidebar pública por rails próprias.
- Abaixo de 1024 px, rail vira drawer com foco, Escape, backdrop, safe area e retorno ao gatilho.
- Fechados itens, breakpoints, sticky, persistência, acessibilidade, estados e telemetria conceitual.
- Gestão de sistemas/edições continua no Site/062.
- Decisão registrada como D108. T4.2 concluída; próximo T4.3.
- Nenhum código, commit, push ou deploy.
