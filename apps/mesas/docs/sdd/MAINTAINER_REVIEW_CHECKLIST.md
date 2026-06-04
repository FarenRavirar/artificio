# Checklist de Review do Mantenedor (uma feature SDD)

Antes de aprovar cada transição de fase, verificar:

## Ao receber "Fase X completa, peço aprovado"

- [ ] Número de commits em `git log <base>..HEAD` = número de tasks da fase
- [ ] Nenhum commit tem mais de 2-3 arquivos mudados (exceto polish docs)
- [ ] Nenhum arquivo fora da lista em plan.md §3 aparece em `git diff --name-only <base>..HEAD`
- [ ] `git status` está limpo (working tree sem surpresas)
- [ ] Último commit tem mensagem no formato `<tipo>(001): <ação específica>` — não genérico

## Ao receber "task X está DONE"

- [ ] Agente colou output LITERAL de comando validando o critério de done
- [ ] Output não está truncado com `...`
- [ ] Se é task de teste: vi RED antes (ou o commit anterior é test red)
- [ ] Se é task de código: vi GREEN agora (saída do teste passando)

## Sinais de alerta imediato

Se o agente escreve qualquer destas frases, parar e investigar:
- "tratamos depois" / "fase posterior" sem justificativa técnica
- "mock performético passou" / "skeleton validado"
- "agente anterior" / "dívida herdada" (na mesma sessão)
- "forçando" / "interceptou" (sem evidência de hook/CI real)
- "inferência" / "inferi" aplicada a decisões de produto
- "ajuste cosmético" em arquivo fora da Seção 3 do plan
- Output resumido com `[cortado para brevidade]` em contexto de debug
- Nomes/papéis não mencionados em spec ("Mantenedor-Chefe", etc.)

## Após merge da feature

- [ ] Registrar em `.specify/memory/errors.md` as falhas processuais observadas
- [ ] Atualizar constitution.md se novos padrões emergiram

## Gatilhos de alerta específicos (mapeados do registry F01-F14)

Quando o agente disser ou fizer estas coisas, PARAR e investigar:

### Alertas verbais
- "tratamos depois" → F05
- "mock performético" → F03
- "agente anterior" ou "último agente" → F07
- "inferência" aplicada a produto → F04
- "[cortado para brevidade]" → F06
- "ajuste cosmético" em arquivo fora do escopo → F12, F13
- "forçando" / "interceptou" sem evidência → ver F01 (pode ser real, 
  mas exigir prova)

### Alertas de ação
- commit com mais de 2 arquivos em trabalho SDD sem justificativa → F01, F12
- PARTIAL em qualquer task → F02
- DONE em Fase 3 sem evidência de bats/script rodando → F03
- Clarification adicionada sem pergunta prévia → F04
- Teste com assert_failure sem assertion de conteúdo → F05
- git checkout/reset em arquivo versionado sem reporte → F13
- Declaração BLOCKED por binário antes de verificar remoto → F10
- Nenhum commit em sessoes/ após 3+ commits de feature → F15 (sessão 
  não está sendo atualizada em tempo real)

### Alertas de output
- git status mostrando modificações não mencionadas na narrativa → F08
- Encoding Unicode text with CRLF/LF line terminators → F11
- Divergência entre schema SQL e consumers em shell/TS → F09
- Lista de arquivos com números duplicados (migrations, specs, etc.) → F14

## Regra de ouro pós-F15

A cada 3 commits de feature (ou a cada mudança de fase), verificar:
   git log --since="2 hours ago" --name-only | grep -c "^sessoes/"

Se retornar 0 após 3+ commits de feature, disparar alerta F15 
imediatamente. O arquivo de sessão é o único ponto de recuperação 
narrativa se o ambiente local falhar.
