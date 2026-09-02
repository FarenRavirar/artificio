#!/usr/bin/env bash
# Colhe as QUATRO fontes de achado do laço de review, só o POSTERIOR a um instante.
#
# As fontes, nomeadas pelo mantenedor (2026-09-02):
#   1. checks de build   — falha da máquina, tem precedência sobre qualquer bot
#   2. CodeRabbit        — inline + issue comment (EDITA comentário antigo)
#   3. Codex             — inline
#   4. Sonar             — issue comment, e "às vezes": silêncio dele é esperado
#
# O corte por data é o ponto: o bot leu um commit anterior, e review antiga se
# disfarça de nova. Sem o corte, o agente "corrige" o que já corrigiu.
#
# Uso: bash .agents/skills/ciclo-de-review/colher.sh <pr> <ISO-do-push>
#   ex: bash .../colher.sh 304 2026-09-02T05:12:00Z
#
# Notas de implementação, ambas pagas com bug real:
#   - `gh api --jq` NÃO aceita `--arg`; a data entra por env (env.DESDE).
#   - `--paginate` concatena ARRAYS ("[...][...]"); `jq -s add` funde antes de filtrar.
set -euo pipefail
pr="${1:?uso: colher.sh <pr> <ISO-do-push>}"
export DESDE="${2:?uso: colher.sh <pr> <ISO-do-push>}"
repo="$(gh repo view --json nameWithOwner --jq .nameWithOwner)"

# ── 1. checks de build ───────────────────────────────────────────────────────
# Filtrar por FAILURE, NUNCA por != SUCCESS: medido, `!= SUCCESS` devolveu 7
# linhas e nenhuma era falha (6 SKIPPED de módulo não tocado + 1 IN_PROGRESS).
echo "== 1. checks de build que FALHARAM =="
gh pr checks "$pr" --json name,state,link \
  --jq '.[] | select(.state=="FAILURE") | "  \(.name)\n    \(.link)"' | grep . \
  || echo "  (nenhum)"

echo
echo "   ainda rodando (não concluir nada sobre eles):"
gh pr checks "$pr" --json name,state \
  --jq '.[] | select(.state=="IN_PROGRESS" or .state=="PENDING") | "     \(.name)"' | grep . \
  || echo "     (nenhum)"

# ── 2. CodeRabbit: veredito ──────────────────────────────────────────────────
# SUCCESS sozinho NÃO prova revisão — só a description separa revisão de recusa.
echo
echo "== 2. CodeRabbit (veredito) =="
gh pr checks "$pr" --json name,state,description \
  --jq '.[] | select(.name|test("CodeRabbit";"i")) | "  \(.state) — \(.description)"' | grep . \
  || echo "  (check ainda não registrado — esperar, não concluir nada)"

# ── 2+3. achados inline (CodeRabbit e Codex) ─────────────────────────────────
echo
echo "== 2+3. achados inline (CodeRabbit, Codex) =="
gh api "repos/$repo/pulls/$pr/comments" --paginate \
  | jq -s -r 'add | .[] | select(.created_at > env.DESDE) | "  [\(.user.login)] \(.path):\(.line // "-")\n\(.body)\n  ---"' \
  | grep . || echo "  (nenhum)"

# ── 4. Sonar (e issue comments do CodeRabbit) ────────────────────────────────
# Sonar comenta como issue; o CodeRabbit EDITA um comentário antigo para anunciar
# limite ou progresso — por isso updated_at, não created_at.
echo
echo "== 4. Sonar / issue comments =="
gh api "repos/$repo/issues/$pr/comments" --paginate \
  | jq -s -r 'add | .[] | select(.updated_at > env.DESDE) | select(.user.login|test("sonar|coderabbit";"i")) | "  \(.user.login) (editado \(.updated_at))"' \
  | grep . || echo "  (nenhum — Sonar mudo após vários commits é ESPERADO, não investigar)"

# QUAL commit o Sonar analisou. O comentário dele NAO cita SHA — só
# `pullRequest=<N>` — então pela data é impossível saber se reporta o commit
# atual ou o anterior. O check-run, esse sim, é atrelado ao SHA.
#
# O scan leva ~28 min (medido: 03:57→04:28 e 05:11→05:38 na PR #304). Commit
# dentro dessa janela faz o comentário chegar reportando o commit ANTERIOR.
#
# Isso é ACEITAVEL e o achado DEVE SER LIDO: ele frequentemente aponta algo que
# o commit novo não tocou, e que portanto continua valendo. O que muda não é se
# ler, é COMO verificar — contra o código atual, nunca contra o diff da volta.
echo
echo "   qual commit o Sonar analisou:"
head_sha="$(git rev-parse HEAD)"
head_curto="$(git rev-parse --short HEAD)"
sonar_run="$(gh api "repos/$repo/commits/$head_sha/check-runs"   --jq '.check_runs[] | select(.name|test("sonar";"i")) | "\(.status)|\(.conclusion)|\(.started_at)|\(.completed_at)"' 2>/dev/null | head -1)"

if [ -z "$sonar_run" ]; then
  echo "     * SEM scan do Sonar no HEAD ($head_curto)."
  echo "       O comentário acima é do commit ANTERIOR — normal. LER assim mesmo:"
  echo "       pode apontar o que o commit novo não tocou. Verificar cada achado"
  echo "       contra o codigo ATUAL antes de corrigir ou descartar."
else
  IFS='|' read -r st cc ini fim <<< "$sonar_run"
  echo "     HEAD $head_curto: $st/$cc (inicio $ini, fim $fim)"
  if [ "$st" != "completed" ]; then
    echo "       * ainda rodando — o comentário acima é do commit anterior."
    echo "         LER assim mesmo; verificar contra o codigo atual."
  fi
fi

# ── estado terminal ──────────────────────────────────────────────────────────
echo
echo "== reviews desde $DESDE =="
gh api "repos/$repo/pulls/$pr/reviews" --paginate \
  | jq -s -r 'add | .[] | select(.submitted_at > env.DESDE) | "  \(.submitted_at) \(.user.login) \(.state)"' \
  | grep . || echo "  (nenhuma)"

# NITPICKS e demais seções colapsadas vivem no BODY DA REVIEW, não na API de
# comentários — medido: `issues/comments` e `pulls/comments` devolveram ZERO
# ocorrências de um nitpick que existia. Sem isto a colheita perde achado real
# (na PR #304 perdeu o `useMemo` do useResolvedSystemNodes, defeito legítimo).
echo
echo "== seções colapsadas no corpo da review (nitpick, outside-diff, duplicate) =="
gh api graphql -f query="{repository(owner:\"${repo%%/*}\",name:\"${repo##*/}\"){pullRequest(number:$pr){reviews(last:5){nodes{author{login} submittedAt body}}}}}"   --jq '.data.repository.pullRequest.reviews.nodes[] | select(.submittedAt > env.DESDE) | .body' 2>/dev/null   | grep -oiE "^\`[0-9-]+\`: .*|<summary>[^<]*\([0-9]+\)</summary>|\*\*[A-Z][^*]{10,90}\*\*"   | sed 's/^/  /' | head -30 | grep . || echo "  (nenhuma)"

# O Quality Gate do Sonar PASSA com issue aberta — "Quality Gate Passed" NÃO
# significa "sem achado". Ler a contagem, e buscar a issue na API pública.
echo
echo "== métricas do Sonar (gate passa mesmo com issue) =="
gh api "repos/$repo/issues/$pr/comments" --paginate   | jq -s -r 'add | map(select(.user.login=="sonarqubecloud[bot]")) | last | .body // ""'   | grep -oE "[0-9]+ (New issue|Accepted issue|Security Hotspot)[s]?|[0-9.]+% (Coverage|Duplication)"   | sed 's/^/  /' | grep . || echo "  (Sonar não comentou)"

echo
echo "   issues abertas no SonarCloud:"
curl -s "https://sonarcloud.io/api/issues/search?componentKeys=$(echo "$repo" | tr '/' '_')&pullRequest=$pr&issueStatuses=OPEN,CONFIRMED&ps=20"   | jq -r '.issues[]? | "     \(.severity) | \(.component | split(":")|last):\(.line) | \(.message)"' 2>/dev/null   | grep . || echo "     (nenhuma)"

echo
echo "== marcador terminal do CodeRabbit =="
gh api "repos/$repo/issues/$pr/comments" --paginate \
  | jq -s -r 'add | .[] | select(.updated_at > env.DESDE) | .body' \
  | grep -oiE "Actionable comments posted: [0-9]+|Review limit reached|review in progress" \
  | sort -u | sed 's/^/  /' | grep . || echo "  (nenhum)"
