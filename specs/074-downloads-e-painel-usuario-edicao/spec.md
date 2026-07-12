# Spec 074 — Downloads-E: Painel do usuário e edição com histórico

## Origem

Spec filha da `061-downloads-definicao-produto` (§F7/T7.3). Implementa a área `/painel/*` de T4.2, favoritos/coleções do MVP (T2.2), e a extensão de escopo trazida pelo mantenedor em D111 item 7: edição de material publicado pelo próprio autor com histórico versionado.

## Pré-requisito

Depende da spec 073 (reaproveita componentes de card/ficha).

## Objetivo

Área logada do usuário: "meus materiais" com edição (inclusive do link/arquivo de destino), histórico de edição público (última atualização) e completo para admin (fica em spec 075, mas o dado é gravado aqui), avaliação condicionada a download prévio, comentário condicionado a conta, favoritos e coleções.

## Escopo

- `/painel/*` conforme T4.2: Visão geral, Meus materiais, Favoritos, Coleções, Perfil, Organizações, Notificações, Denúncias, Configurações.
- Edição de material pelo autor: qualquer campo, **incluindo o link/arquivo de destino** (D111 item 7).
- Toda edição grava entrada em `download_material_version`/histórico por campo (campo, valor antigo, valor novo, autor, timestamp) — nunca sobrescreve sem rastro.
- Ficha pública (spec 073) mostra apenas "atualizado em X" agregado; série completa fica reservada ao admin (spec 075).
- Contador de download: **clique logado no CTA de acesso** é o evento; dedup por (conta, material) — 1 download único por conta, cliques subsequentes da mesma conta continuam redirecionando mas não incrementam contador (D111 item 7).
- Avaliação: exige que a mesma conta já tenha registro de download daquele material; sem isso, ação de avaliar fica indisponível/oculta com explicação, não apenas desabilitada sem contexto (D111 item 5).
- Comentário: exige conta `accounts.`; retirada só via denúncia (D111 item 6) — UI aqui, regra de backend já resolvida em spec 072.
- Favoritos e coleções (T2.2 MVP).

## Fora de escopo

- Painel de moderação/gestão (spec 075).
- Regras de backend de avaliação/comentário/denúncia (já em spec 072 — aqui é consumo/UI).

## Critérios de aceite

1. Autor edita material próprio, incluindo link de destino, sem apagar histórico anterior.
2. Toda edição gera entrada de histórico (campo, valor antigo→novo, quem, quando).
3. Ficha pública mostra só "última atualização"; série completa não vaza para usuário comum.
4. Contador de download é deduplicado por (conta, material); segundo clique da mesma conta não incrementa, mas ainda redireciona.
5. Avaliação bloqueada/oculta com explicação para conta sem download prévio.
6. Comentário exige conta; sem fluxo anônimo.
7. Favoritos/coleções funcionam conforme MVP de T2.2.

## Dependências

- Spec 073.
- Bloqueia spec 075 (gestão opera sobre o que aqui é produzido).
