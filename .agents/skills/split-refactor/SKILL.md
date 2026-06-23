---
name: split-refactor
description: Refatora arquivos, componentes, hooks, services, controllers ou módulos grandes por split incremental, preservando comportamento externo. Use quando houver candidatos a divisão, responsabilidades misturadas, acoplamento excessivo ou código grande demais.
---

# Split refactor

## Quando usar

Use quando o usuário pedir para:

* dividir arquivo grande;
* separar responsabilidades;
* extrair componente, hook, service, controller, utilitário ou módulo;
* reduzir acoplamento;
* limpar duplicação estrutural;
* reorganizar código grande sem mudar comportamento.

## Regras

* Refatoração não é feature.
* Preserve comportamento externo.
* Não misture refatoração com mudança funcional.
* Trabalhe um candidato por vez.
* Não resolva vários débitos no mesmo passo.
* Jamais faça commit, push, merge ou PR sem autorização explícita do usuário.
* Não avance fase sem autorização.
* Se houver dúvida, pergunte em tom simples, com opções e impacto de cada opção.
* Não chute. Toda conclusão precisa de evidência.
* Use arquivo e linha sempre que possível.
* Se tocar algo fora do candidato atual, registre como débito e pare para orientação.
* Se encontrar solução simples, mas inferior, registre. As melhores soluções são mandatórias.
* Não aceite apenas "passou no build" como validação suficiente.

## Ferramentas

Use em ordem de precisão:

1. `codebase-memory-mcp`

   * recuperar padrões, decisões e refatorações anteriores.

2. Serena + LSP

   * mapear símbolos, referências, imports, exports, consumidores e diagnósticos;
   * confirmar impacto antes de mover código.

3. `ast-grep`

   * localizar padrões estruturais, duplicações e usos equivalentes.

4. `rg`

   * localizar imports, exports, rotas, strings e referências textuais.

5. Git

   * usar `git status` e `git diff`;
   * não commitar.

6. Validação

   * `pnpm run lint`;
   * `pnpm run build`;
   * `pnpm run test`;
   * testes específicos, quando existirem.

Não instale dependências sem autorização.

## Fluxo

### 1. Inventariar

Antes de alterar código, identificar:

* arquivo ou módulo candidato;
* responsabilidades misturadas;
* imports e exports;
* consumidores;
* efeitos colaterais;
* testes existentes;
* riscos;
* limite exato do split.

Se o impacto sair do candidato atual, registrar em `debitos.md` e parar.

### 2. Planejar

Definir:

* o que será extraído;
* para onde será movido;
* quais contratos devem permanecer iguais;
* quais imports serão atualizados;
* o que não será alterado;
* como validar equivalência de comportamento.

Registrar no `tasks.md` ou na documentação indicada pelo usuário, se houver spec atual.

### 3. Executar

Fazer apenas o split aprovado.

Evitar:

* reescrever lógica;
* alterar contrato público;
* renomear tudo por estética;
* mexer em módulo consumidor sem necessidade comprovada;
* corrigir bug não solicitado;
* criar abstração prematura;
* esconder débito dentro da refatoração.

Se surgir necessidade maior, registrar débito e parar.

### 4. Validar

Após a alteração:

* usar Serena/LSP para confirmar referências;
* conferir imports e exports;
* revisar `git diff`;
* rodar lint, build e testes relevantes;
* verificar se o comportamento externo foi preservado;
* registrar evidências.

### 5. Documentar

Atualizar, quando aplicável:

* `tasks.md`;
* `plan.md`;
* `debitos.md`;
* `specs/backlog.md`;
* sessão em `sessoes/`.

Não registrar achados próprios em `reviews.md`. `reviews.md` é apenas para reviews enviados pelo usuário após abertura de PR, vindos de bots, checks ou revisores automatizados.

## Débitos

Registrar em `debitos.md` quando encontrar:

* split maior que o candidato atual;
* impacto em outro módulo;
* contrato que precisaria mudar;
* duplicação fora do escopo;
* acoplamento estrutural não resolvido;
* teste ausente ou insuficiente;
* risco de regressão;
* solução provisória, frágil ou inferior;
* melhoria útil que não deve entrar neste split.

Se o débito for acionável fora da spec atual, também registrar em `specs/backlog.md`.

## Saída

```markdown
# Split refactor

## Candidato
- Arquivo/módulo:
- Motivo:
- Consumidores:
- Riscos:

## Plano
- Extrair:
- Manter:
- Não alterar:
- Validação:

## Alterações
-

## Validação
- Serena/LSP:
- `pnpm run lint`:
- `pnpm run build`:
- `pnpm run test`:

## Débitos
-

## Conclusão
- pronto / bloqueado / precisa decisão / precisa correção
```

Depois de concluir um candidato, pare e peça autorização para o próximo.
