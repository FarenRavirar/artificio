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
# `grep` sem match sai 1 e isso e vazio LEGITIMO; qualquer outro codigo e falha.
# O remendo anterior (`|| true` no fim do pipe) zerava o rc inteiro e devolvia a
# falha mascarada que a funcao existe para impedir - achado do Codex na PR #304.
# `PIPESTATUS` separa: se algum estagio ANTES do grep falhou, e falha de verdade.
emitir() {
  local saida="$1" rc="$2"
  if [[ $rc -eq 1 ]]; then rc=0; fi
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
out="$(gh pr checks "$pr" --json name,state,link --jq '.[] | select(.state=="FAILURE") | "  \(.name)\n    \(.link)"' 2>&1)"; rc=$?
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
out="$(gh api "repos/$repo/pulls/$pr/comments" --paginate 2>&1 | jq -s -r 'add | .[] | select(.created_at > env.DESDE) | "  [\(.user.login)] \(.path):\(.line // "-")\n\(.body)\n  ---"' 2>&1)"; rc=$?
emitir "$out" $rc

echo
echo "== 4. Sonar / issue comments =="
# Sonar comenta como issue; o CodeRabbit EDITA um comentario antigo para anunciar
# limite ou progresso - por isso updated_at, nao created_at.
out="$(gh api "repos/$repo/issues/$pr/comments" --paginate 2>&1 | jq -s -r 'add | .[] | select(.updated_at > env.DESDE) | select(.user.login|test("sonar|coderabbit";"i")) | "  \(.user.login) (editado \(.updated_at))"' 2>&1)"; rc=$?
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
sonar_run="$(gh api "repos/$repo/commits/$head_sha/check-runs" --jq '.check_runs[] | select(.name|test("sonar";"i")) | "\(.status)|\(.conclusion)|\(.started_at)|\(.completed_at)"' 2>/dev/null | head -1)"
if [[ -z "$sonar_run" ]]; then
  echo "     * SEM scan do Sonar no HEAD ($head_curto)."
  echo "       O comentario acima e do commit ANTERIOR - normal. LER assim mesmo:"
  echo "       verificar cada achado contra o codigo ATUAL antes de agir."
else
  IFS='|' read -r st cc ini fim <<< "$sonar_run"
  echo "     HEAD $head_curto: $st/$cc (inicio $ini, fim $fim)"
  if [[ "$st" != "completed" ]]; then
    echo "       * ainda rodando - o comentario acima e do commit anterior."
  fi
fi

echo
echo "== reviews desde $DESDE =="
out="$(gh api "repos/$repo/pulls/$pr/reviews" --paginate 2>&1 | jq -s -r 'add | .[] | select(.submitted_at > env.DESDE) | "  \(.submitted_at) \(.user.login) \(.state)"' 2>&1)"; rc=$?
emitir "$out" $rc

# NITPICKS e demais secoes colapsadas vivem no BODY DA REVIEW, nao na API de
# comentarios - medido: `issues/comments` e `pulls/comments` devolveram ZERO
# ocorrencias de um nitpick que existia (e era defeito real).
# `first:100` + cursor: `last:5` devolvia so as 5 ultimas reviews da PR, e o
# filtro por data nao recupera o que ficou de fora. Achado do CodeRabbit.
echo
echo "== secoes colapsadas no corpo da review (nitpick, outside-diff, duplicate) =="
Q='query($owner:String!,$nome:String!,$pr:Int!,$endCursor:String){repository(owner:$owner,name:$nome){pullRequest(number:$pr){reviews(first:100,after:$endCursor){nodes{author{login} submittedAt body} pageInfo{hasNextPage endCursor}}}}}'
out="$(gh api graphql --paginate -F owner="$owner" -F nome="$nome" -F pr="$pr" -f query="$Q" --jq '.data.repository.pullRequest.reviews.nodes[] | select(.submittedAt > env.DESDE) | .body' 2>&1 | grep -oiE '<summary>[^<]*\([0-9]+\)</summary>|\*\*[A-Z][^*]{10,90}\*\*' | sed 's/^/  /' | head -30)"; rc=${PIPESTATUS[0]}
emitir "$out" $rc

echo
echo "== metricas do Sonar (gate passa mesmo com issue) =="
# O Quality Gate PASSA com issue aberta - "Quality Gate Passed" NAO significa
# "sem achado". Ler a contagem, e buscar a issue na API publica.
out="$(gh api "repos/$repo/issues/$pr/comments" --paginate 2>&1 | jq -s -r 'add | map(select(.user.login=="sonarqubecloud[bot]")) | last | .body // ""' 2>&1 | grep -oE '[0-9]+ (New issue|Accepted issue|Security Hotspot)s?|[0-9.]+% (Coverage|Duplication)' | sed 's/^/  /')"; rc=${PIPESTATUS[0]}
emitir "$out" $rc

echo
echo "   issues abertas no SonarCloud:"
chave="$(echo "$repo" | tr '/' '_')"
out="$(curl -sf "https://sonarcloud.io/api/issues/search?componentKeys=$chave&pullRequest=$pr&issueStatuses=OPEN,CONFIRMED&ps=20" 2>&1 | jq -r '.issues[]? | "     \(.severity) | \(.component | split(":")|last):\(.line) | \(.message)"' 2>&1)"; rc=$?
emitir "$out" $rc

echo
echo "== marcador terminal do CodeRabbit =="
out="$(gh api "repos/$repo/issues/$pr/comments" --paginate 2>&1 | jq -s -r 'add | .[] | select(.updated_at > env.DESDE) | .body' 2>&1 | grep -oiE 'Actionable comments posted: [0-9]+|Review limit reached|review in progress' | sort -u | sed 's/^/  /')"; rc=${PIPESTATUS[0]}
emitir "$out" $rc

echo
if [[ $FALHAS -gt 0 ]]; then
  echo "!! $FALHAS consulta(s) FALHARAM - a colheita esta INCOMPLETA."
  echo "   Nao encerrar o laco com base nela; repetir depois de investigar."
  exit 1
fi
echo "colheita completa (nenhuma consulta falhou)."
