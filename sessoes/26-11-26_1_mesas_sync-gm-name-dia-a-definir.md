# Sessão 26-11-26_1 · mesas · sync com 500 e dia "a definir"

Sem spec, a pedido do mantenedor.

## Sync do rascunho 0815b871 devolvia 500

- Log do `mesas-api`: `violates check constraint "tables_announcer_requires_name"`.
- Causa: `author_name` é "𝑻" (um code point, `length` 2 em JS). O guard de `syncHelpers.ts` deixava passar e o Postgres (`char_length` 1) recusava.
- Correção: guard e `actual_gm_name` (zod) contam code points; o editor do rascunho acusa "Nome do mestre (mínimo 2 caracteres)" antes do sync.
- Esse rascunho ainda precisa do nome do mestre preenchido à mão: o anúncio traz só a menção em "Mestre:".

## Dia "a definir" não reconhecido

- Regra nova em `extractDayOfWeek`: a linha de agenda ("Dias e horários", "Data e Hora", "Dia/Horário") manda no resto do corpo; só vira `to_define` quando declara isso (a definir, flexível, livre). Inferir "a definir" pela ausência de dia foi descartado: apagava a pendência de revisão em datas, abreviações e dias escritos na linha seguinte.
- Medido contra os 155 rascunhos de produção, tendo o dia salvo pelo admin como referência: 139 antes, 148 depois. Frase que fala só do horário ("horários livres", "qualquer horário") não decide o dia, ao custo de anúncios que o admin marcou como "a definir" e agora ficam pendentes.
- Restantes: aaf736bc (só fala de horários livres); 3 sem nenhuma linha de agenda; 3 que são erro do parser antigo ainda publicado, sem correção humana do dia (`parsed_payload` igual ao salvo, `import_corrections.diff` sem `day_of_week`).
- Rótulo de dia aprendido (`label_alias`) continua vencendo a linha de agenda genérica.
- Mesma classe do "𝑻" corrigida em `nickname` de mestre (rotas e `deriveGmNickname`).

## Dado publicado errado (corrigido em produção com aprovação, conferido por SELECT)

| rascunho | mesa | publicado | anúncio |
|---|---|---|---|
| a42e5151 | `110a148b-deff-40b8-970a-d3fe73ec0703` | sexta | sábado |
| 777d6e4b | `faa63e92-6ba4-47a1-9af2-fdc1b3712d98` | quarta | sexta |
| 5ff69b3a | `d1536616-2caa-4a2c-9b4d-dc3b5accf675` | quarta | quinta |
- Preço e frequência não têm opção "a definir" no editor; não foram alterados.
- `fieldLearning` (aprendizado por valor) não tem chamador em produção; não foi ligado.

## Hook do ajudante-haiku

Fora do repositório (`~/.claude/hooks/ajudante-bash-somente-leitura.js`): passou a permitir leitura na VM (`docker ps|logs`, `inspect .State`, `psql` SELECT em transação só leitura). A lista de bloqueio de SQL não substitui um role de banco só leitura.

## Aceite que falta

- Deploy (autorização própria).
- Smoke: salvar o rascunho 0815b871 com nome do mestre e sincronizar.
