#!/usr/bin/env bash
# Colhe as QUATRO fontes de achado do laco de review, so o POSTERIOR a um instante.
#
# Fontes (nomeadas pelo mantenedor, 2026-09-02):
#   1. checks de build   - falha da maquina, precedencia sobre qualquer bot
#   2. CodeRabbit        - inline + secoes colapsadas no CORPO da review
#   3. Codex             - inline, so quando chamado (nao revisa por push)
#   4. Sonar             - issue comment, e "as vezes": silencio dele e esperado
#
# O corte por data e o ponto: o bot leu um commit anterior, e review antiga se
# disfarca de nova. Sem o corte, o agente "corrige" o que ja corrigiu.
#
# Uso: bash .agents/skills/ciclo-de-review/colher.sh <pr> <ISO-do-push>
#
# Notas de implementacao, todas pagas com bug real nesta PR:
#   - `gh api --jq` NAO aceita `--arg`; a data entra por env (env.DESDE).
#   - `--paginate` concatena ARRAYS ("[...][...]"); `jq -s add` funde antes.
#   - `reviews(last:5)` cegava PR longa: paginar com first:100 + endCursor.
#   - `|| echo "(nenhum)"` mapeava FALHA DE REDE para "sem achado" - ver `emitir`.
set -uo pipefail
pr="${1:?uso: colher.sh <pr> <ISO-do-push>}"
export DESDE="${2:?uso: colher.sh <pr> <ISO-do-push>}"
repo="$(gh repo view --json nameWithOwner --jq .nameWithOwner)"
owner="${repo%%/*}"
nome="${repo##*/}"
FALHAS=0

# Falha de rede/parse NAO pode virar "(nenhum)": a colheita reportaria "sem
# achado" quando nao conseguiu nem perguntar, e o laco encerraria com achado por
# ler. Mesmo defeito que este ciclo corrigiu no CatalogTree horas antes,
# reproduzido no proprio script. Achado do CodeRabbit na PR #304.
# O `rc` que chega aqui e o do ESTAGIO DA CONSULTA (`gh`/`curl`), capturado por
# `PIPESTATUS[0]` na chamada — nunca o do pipe inteiro. `emitir` NAO normaliza
# codigo nenhum, de proposito:
#
#   - `|| true` no fim do pipe (1a tentativa) zerava o rc inteiro e devolvia a
#     falha mascarada que esta funcao existe para impedir;
#   - `rc == 1 -> 0` (2a tentativa) era pior: `gh` documenta exit 1 para falha
#     de rede/API (`gh help exit-codes`), entao uma consulta que falhou de
#     verdade nao incrementava FALHAS e a colheita se declarava completa.
#     Achado do Codex na PR #304.
#
# O exit 1 do `grep` sem match e legitimo e some sozinho: ele nao e o primeiro
# estagio de nenhum pipe daqui, logo nao entra em `PIPESTATUS[0]`.
# `consultar` roda o comando da FONTE e guarda o status em `RC_CONSULTA` + a saida no
# arquivo `$BRUTO`. Chame SEMPRE fora de `$( )` e leia a saida com `cat "$BRUTO"`.
#
# Duas armadilhas ja pagas aqui, nesta ordem:
#
#   1. `PIPESTATUS` nao atravessa `$( )`, e com `pipefail` o `$?` de fora e o do ULTIMO
#      estagio do pipe — o `jq`, que sai 5 quando o filtro nao produz saida (vazio
#      legitimo, nao falha). Medido na PR #304: a colheita acusava 2 falhas inexistentes.
#
#   2. `bruto="$(consultar ...)"` NAO resolve: a substituicao de comando tambem e
#      subshell, entao `RC_CONSULTA=$?` era atribuido la dentro e morria junto com ela —
#      o pai lia sempre o valor inicial 0. Medido: `consultar bash -c 'exit 42'` dentro
#      de `$( )` devolveu rc=0; fora dela, 42. Achado do Codex (P1) na PR #304, DEPOIS
#      de a tentativa anterior ter sido validada so no caminho em que TODAS as consultas
#      falham — onde o contador subia por outro motivo e escondia o defeito.
BRUTO="$(mktemp)"
trap 'rm -f "$BRUTO"' EXIT
RC_CONSULTA=0
consultar() {
  "$@" >"$BRUTO" 2>&1
  RC_CONSULTA=$?
}

emitir() {
  local saida="$1" rc="$2"
  if [[ $rc -ne 0 ]]; then
    echo "  !! FALHA ao consultar - NAO e ausencia de achado (exit $rc)"
    echo "$saida" | head -3 | sed 's/^/     /'
    FALHAS=$((FALHAS + 1))
  elif [[ -z "$saida" ]]; then
    echo "  (nenhum)"
  else
    echo "$saida"
  fi
  return 0
}

echo "== 1. checks de build que FALHARAM =="
# Filtrar por FAILURE, NUNCA por != SUCCESS: medido, `!= SUCCESS` devolveu 7
# linhas e nenhuma era falha (6 SKIPPED de modulo nao tocado + 1 IN_PROGRESS).
out="$(gh pr checks "$pr" --json name,state,link --jq '.[] | select(.state=="FAILURE") | "  \(.name)\n    \(.link)"' 2>&1)"; rc=${PIPESTATUS[0]}
emitir "$out" $rc

echo
echo "   ainda rodando (nao concluir nada sobre eles):"
# `gh pr checks` sai 8 quando HÁ check pendente - que e exatamente o caso desta
# consulta, e nao e falha. Normalizar SO o 8; qualquer outro codigo continua
# falha de verdade. Achado do CodeRabbit na PR #304.
out="$(gh pr checks "$pr" --json name,state --jq '.[] | select(.state=="IN_PROGRESS" or .state=="PENDING") | "     \(.name)"' 2>&1)"; rc=$?
if [[ $rc -eq 8 ]]; then rc=0; fi
emitir "$out" $rc

echo
echo "== 2. CodeRabbit (veredito) =="
# SUCCESS sozinho NAO prova revisao - so a description separa revisao de recusa.
out="$(gh pr checks "$pr" --json name,state,description --jq '.[] | select(.name|test("CodeRabbit";"i")) | "  \(.state) - \(.description)"' 2>&1)"; rc=$?
emitir "$out" $rc

echo
echo "== 2+3. achados inline (CodeRabbit, Codex) =="
consultar gh api "repos/$repo/pulls/$pr/comments" --paginate; rc=$RC_CONSULTA
out="$(< "$BRUTO" jq -s -r 'add | .[] | select(.created_at > env.DESDE) | "  [\(.user.login)] \(.path):\(.line // "-")\n\(.body)\n  ---"' 2>/dev/null)"
emitir "$out" $rc

echo
echo "== 4. Sonar / issue comments =="
# Sonar comenta como issue; o CodeRabbit EDITA um comentario antigo para anunciar
# limite ou progresso - por isso updated_at, nao created_at.
consultar gh api "repos/$repo/issues/$pr/comments" --paginate; rc=$RC_CONSULTA
out="$(< "$BRUTO" jq -s -r 'add | .[] | select(.updated_at > env.DESDE) | select(.user.login|test("sonar|coderabbit";"i")) | "  \(.user.login) (editado \(.updated_at))"' 2>/dev/null)"
emitir "$out" $rc

# QUAL commit o Sonar analisou. O comentario dele NAO cita SHA - so
# `pullRequest=<N>` - entao pela data e impossivel saber se reporta o commit
# atual ou o anterior. O check-run, esse sim, e atrelado ao SHA. O scan leva
# ~28 min; commit nessa janela faz o comentario reportar o commit ANTERIOR.
# Isso e ACEITAVEL e o achado DEVE SER LIDO: costuma apontar o que o commit novo
# nao tocou, e continua valendo.
echo
echo "   qual commit o Sonar analisou:"
head_sha="$(git rev-parse HEAD)"
head_curto="$(git rev-parse --short HEAD)"
# `consultar` e nao `2>/dev/null`: falha de rede aqui saia como string vazia e caia no
# ramo "SEM scan do Sonar", dizendo ao agente que o comentario e do commit anterior —
# conclusao inventada a partir de uma consulta que nem chegou a rodar.
consultar gh api "repos/$repo/commits/$head_sha/check-runs"; rc=$RC_CONSULTA
if [[ $rc -ne 0 ]]; then
  echo "     !! FALHA ao consultar o check-run do Sonar (exit $rc) - NAO concluir nada"
  head -3 "$BRUTO" | sed 's/^/        /'
  FALHAS=$((FALHAS + 1))
  sonar_run=""
else
  sonar_run="$(< "$BRUTO" jq -r '.check_runs[] | select(.name|test("sonar";"i")) | "\(.status)|\(.conclusion)|\(.started_at)|\(.completed_at)"' 2>/dev/null | head -1)"
fi
if [[ $rc -eq 0 && -z "$sonar_run" ]]; then
  echo "     * SEM scan do Sonar no HEAD ($head_curto)."
  echo "       O comentario acima e do commit ANTERIOR - normal. LER assim mesmo:"
  echo "       verificar cada achado contra o codigo ATUAL antes de agir."
elif [[ $rc -eq 0 ]]; then
  IFS='|' read -r st cc ini fim <<< "$sonar_run"
  echo "     HEAD $head_curto: $st/$cc (inicio $ini, fim $fim)"
  if [[ "$st" != "completed" ]]; then
    echo "       * ainda rodando - o comentario acima e do commit anterior."
  fi
fi

echo
echo "== reviews desde $DESDE =="
consultar gh api "repos/$repo/pulls/$pr/reviews" --paginate; rc=$RC_CONSULTA
out="$(< "$BRUTO" jq -s -r 'add | .[] | select(.submitted_at > env.DESDE) | "  \(.submitted_at) \(.user.login) \(.state)"' 2>/dev/null)"
emitir "$out" $rc

# NITPICKS e demais secoes colapsadas vivem no BODY DA REVIEW, nao na API de
# comentarios - medido: `issues/comments` e `pulls/comments` devolveram ZERO
# ocorrencias de um nitpick que existia (e era defeito real).
# `first:100` + cursor: `last:5` devolvia so as 5 ultimas reviews da PR, e o
# filtro por data nao recupera o que ficou de fora. Achado do CodeRabbit.
echo
echo "== secoes colapsadas no corpo da review (nitpick, outside-diff, duplicate) =="
Q='query($owner:String!,$nome:String!,$pr:Int!,$endCursor:String){repository(owner:$owner,name:$nome){pullRequest(number:$pr){reviews(first:100,after:$endCursor){nodes{author{login} submittedAt body} pageInfo{hasNextPage endCursor}}}}}'
consultar gh api graphql --paginate -F owner="$owner" -F nome="$nome" -F pr="$pr" -f query="$Q" --jq '.data.repository.pullRequest.reviews.nodes[] | select(.submittedAt > env.DESDE) | .body'; rc=$RC_CONSULTA
# SEM `head`: truncar a colheita e o mesmo defeito que `|| true` — o laco encerraria
# com achado por ler, so que por corte de saida em vez de erro engolido. Uma PR com
# muitas secoes colapsadas e exatamente o caso em que perder as ultimas custa caro.
out="$(< "$BRUTO" grep -oiE '<summary>[^<]*\([0-9]+\)</summary>|\*\*[A-Z][^*]{10,90}\*\*' | sed 's/^/  /')"
emitir "$out" $rc

echo
echo "== metricas do Sonar (gate passa mesmo com issue) =="
# O Quality Gate PASSA com issue aberta - "Quality Gate Passed" NAO significa
# "sem achado". Ler a contagem, e buscar a issue na API publica.
consultar gh api "repos/$repo/issues/$pr/comments" --paginate; rc=$RC_CONSULTA
out="$(< "$BRUTO" jq -s -r 'add | map(select(.user.login=="sonarqubecloud[bot]")) | last | .body // ""' 2>/dev/null | grep -oE '[0-9]+ (New issue|Accepted issue|Security Hotspot)s?|[0-9.]+% (Coverage|Duplication)' | sed 's/^/  /')"
emitir "$out" $rc

echo
echo "   issues abertas no SonarCloud:"
chave="$(echo "$repo" | tr '/' '_')"
consultar curl -sf "https://sonarcloud.io/api/issues/search?componentKeys=$chave&pullRequest=$pr&issueStatuses=OPEN,CONFIRMED&ps=20"; rc=$RC_CONSULTA
out="$(< "$BRUTO" jq -r '.issues[]? | "     \(.severity) | \(.component | split(":")|last):\(.line) | \(.message)"' 2>/dev/null)"
emitir "$out" $rc

echo
echo "== marcador terminal do CodeRabbit =="
consultar gh api "repos/$repo/issues/$pr/comments" --paginate; rc=$RC_CONSULTA
out="$(< "$BRUTO" jq -s -r 'add | .[] | select(.updated_at > env.DESDE) | .body' 2>/dev/null | grep -oiE 'Actionable comments posted: [0-9]+|Review limit reached|review in progress' | sort -u | sed 's/^/  /')"
emitir "$out" $rc

echo
if [[ $FALHAS -gt 0 ]]; then
  echo "!! $FALHAS consulta(s) FALHARAM - a colheita esta INCOMPLETA."
  echo "   Nao encerrar o laco com base nela; repetir depois de investigar."
  exit 1
fi
echo "colheita completa (nenhuma consulta falhou)."
