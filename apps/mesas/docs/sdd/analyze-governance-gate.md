# Gate de Governança do /speckit.analyze

Este documento é lido pelo agente antes de rodar /speckit.analyze. 
Até a integração formal com workflows speckit, o mantenedor invoca 
manualmente pedindo "rode o analyze com governance gate".

## Gate de Governança (obrigatório antes de declarar analyze GREEN)

Ao rodar /speckit.analyze em uma branch SDD, verificar e reportar:

1. **Atomicidade de commits**: `git log <base>..HEAD --pretty=format:'%H %s'` 
   mostra cada commit de feature mapeado para exatamente uma task de tasks.md? 
   Listar commits que agregam múltiplas ou que não citam task.

2. **TDAD observável**: existe commit de "tests red" ANTES do commit de 
   "core"? Ambos tocam arquivos de `testes/` e `scripts/` respectivamente?

3. **Placeholders suspeitos**: grep em `testes/` por:
   - `"for now it will"`
   - `"will fail"`
   - `assert_failure` sem assertions subsequentes sobre conteúdo
   - `exit 1` hardcoded em linhas sem lógica prévia
   - Comentários `TODO` ou `FIXME` em arquivos de teste

4. **Escopo**: listar arquivos tocados na branch que NÃO aparecem em 
   plan.md Seção 3. Se houver, reportar como violação.

5. **Consistência de contrato**: para cada migration SQL nova, grep pelas 
   colunas declaradas em todos os `.sh` e `.ts` do repo — listar divergências.

6. **Termos inventados**: listar termos no spec/plan que não aparecem em 
   AGENTS.md ou na constituição — pedir aprovação de cada.

7. **Clarifications vs decisões**: contar items na Seção 7 do spec vs 
   número de mensagens do mantenedor aprovando cada — se não há 1-para-1, 
   reportar.

Se qualquer um dos 7 reporta violação, analyze retorna BLOCKED.
