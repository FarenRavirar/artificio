# Guia Completo: Detecção e Unificação de Duplicações — Artifício Mesas

**Premissa:** este guia não assume o que está duplicado. Cada etapa produz evidência antes de qualquer modificação no código. Nenhuma linha é tocada sem o relatório confirmar o clone.

---

## Pré-requisitos obrigatórios

Antes de começar qualquer etapa, confirme:

```bash
# Node.js >= 18
node --version

# Java >= 21 (para PMD CPD — instale antes se não tiver)
java --version

# Go >= 1.21 (para dcd — instale antes se não tiver)
go version

# Git limpo — NUNCA rode refatoração com working tree sujo
git status
# Esperado: "nothing to commit, working tree clean"
```

Se `git status` mostrar qualquer arquivo modificado, faça commit ou stash antes de prosseguir.

---

## Estrutura de trabalho

Crie esta estrutura na raiz do projeto antes de começar:

```bash
mkdir -p reports/jscpd
mkdir -p reports/cpd
mkdir -p reports/dcd
mkdir -p refactoring/backend
mkdir -p refactoring/frontend
```

O diretório `refactoring/` vai conter os rascunhos de extração antes de substituir os originais. Isso é o buffer de segurança.

---

---

# FASE 1 — DETECÇÃO (sem tocar em código)

---

## Etapa 1.1 — jscpd: mapa completo de clones exatos

### Checklist de entrada

- [ ] `git status` limpo
- [ ] `node --version` >= 18
- [ ] Diretório `reports/jscpd/` criado

### Configuração

Crie o arquivo `.jscpd.json` na raiz do projeto (não dentro de `backend/` nem `frontend/`):

```json
{
  "minLines": 8,
  "minTokens": 60,
  "reporters": ["html", "json", "console"],
  "output": "reports/jscpd",
  "threshold": 0,
  "gitignore": true,
  "ignore": [
    "**/*.d.ts",
    "**/*.min.js",
    "**/node_modules/**",
    "**/dist/**",
    "**/build/**",
    "**/coverage/**",
    "**/migrations/**",
    "**/*.test.ts",
    "**/*.test.tsx",
    "**/*.spec.ts",
    "**/*.spec.tsx",
    "**/generated/**"
  ]
}
```

**Por que `minLines: 8` e não 5:** blocos de 5 linhas em TypeScript capturam muito ruído — declarações de tipo, imports agrupados, blocos `try/catch` triviais. Oito linhas é o mínimo para que o bloco represente lógica real candidata a extração.

**Por que `threshold: 0`:** o threshold faz o comando falhar com código de saída não-zero se ultrapassado. Com zero, o jscpd sempre termina com sucesso, permitindo que você analise o relatório sem interromper o processo.

### Execução

```bash
# Na raiz do projeto
npx jscpd backend/src frontend/src
```

O `.jscpd.json` é lido automaticamente do diretório corrente. Se quiser sobrescrever parâmetros pontualmente:

```bash
npx jscpd backend/src frontend/src --min-lines 5 --min-tokens 40
```

Isso serve para uma segunda rodada mais agressiva — veja abaixo.

### O que será gerado

```
reports/jscpd/
├── jscpd-report.html     ← abrir no browser
├── jscpd-report.json     ← processar programaticamente se necessário
└── jscpd-badge.svg
```

### Como ler o relatório HTML

Abra `reports/jscpd/jscpd-report.html` no browser. A estrutura da página mostra:

1. **Summary** no topo: percentual total de duplicação por linguagem
2. **Duplicates** abaixo: cada clone listado com:
   - Arquivo A: caminho + linha de início + linha de fim
   - Arquivo B: caminho + linha de início + linha de fim
   - Número de linhas duplicadas
   - Preview do código

### Classificação obrigatória dos achados

Antes de avançar para a próxima etapa, classifique **cada clone** no arquivo abaixo. Não pule esta etapa.

Crie `refactoring/inventory.md`:

```markdown
# Inventário de Duplicações

## Backend — Rotas/Queries

| Clone | Arquivo A | Linhas A | Arquivo B | Linhas B | Tipo | Ação |
|-------|-----------|----------|-----------|----------|------|------|
| 1 | tables.ts | 40-80 | gmPanel.ts | 200-240 | Query SQL similar | Extrair TableRepository |
| ... | | | | | | |

## Frontend — Formatação/Utils

| Clone | Arquivo A | Linhas A | Arquivo B | Linhas B | Tipo | Ação |
|-------|-----------|----------|-----------|----------|------|------|
| 1 | TableCard.tsx | 15-30 | MesaPage.tsx | 45-60 | formatDate | Extrair tableFormatters |
| ... | | | | | | |

## Frontend — Componentes/Páginas

| Clone | Arquivo A | Linhas A | Arquivo B | Linhas B | Tipo | Ação |
|-------|-----------|----------|-----------|----------|------|------|

## Hooks

| Clone | Arquivo A | Linhas A | Arquivo B | Linhas B | Tipo | Ação |
|-------|-----------|----------|-----------|----------|------|------|

## Ignorar (duplicação intencional ou aceitável)

| Clone | Razão para ignorar |
|-------|---------------------|
```

A coluna **Tipo** pode ser: `Query SQL`, `Formatação`, `Validação`, `Componente UI`, `Handler HTTP`, `Tipo/Interface`.

A coluna **Ação** pode ser: `Extrair repositório`, `Extrair utils`, `Extrair hook`, `Extrair componente`, `Ignorar`.

### Segunda rodada com limiar menor (opcional mas recomendada)

Depois de classificar os achados com `minLines: 8`, rode uma segunda vez mais agressiva para pegar candidatos menores:

```bash
npx jscpd backend/src frontend/src \
  --min-lines 5 \
  --min-tokens 40 \
  --reporters html \
  --output reports/jscpd-aggressive
```

Muitos destes serão ruído. O objetivo é não deixar passar um `formatDate` de 6 linhas que aparece em 4 arquivos.

### Checklist de saída da Etapa 1.1

- [ ] `reports/jscpd/jscpd-report.html` gerado e aberto
- [ ] `reports/jscpd/jscpd-report.json` gerado
- [ ] `refactoring/inventory.md` preenchido com todos os clones classificados
- [ ] Percentual de duplicação registrado (anotar no topo do `inventory.md`)

---

## Etapa 1.2 — PMD CPD: clones estruturais com nomes trocados

Esta etapa só faz sentido depois que o `inventory.md` estiver preenchido. O CPD vai confirmar se os blocos suspeitos são clones mesmo quando os identificadores foram renomeados.

### Checklist de entrada

- [ ] Etapa 1.1 concluída
- [ ] `inventory.md` preenchido
- [ ] `java --version` >= 21
- [ ] PMD instalado

### Instalação do PMD

```bash
# macOS
brew install pmd

# Linux / qualquer OS — download direto
cd /tmp
wget https://github.com/pmd/pmd/releases/download/pmd_releases/7.10.0/pmd-dist-7.10.0-bin.zip
unzip pmd-dist-7.10.0-bin.zip -d /opt/pmd
echo 'export PATH="/opt/pmd/pmd-bin-7.10.0/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc

# Confirmar
pmd --version
```

### Execução

```bash
# Backend (.ts puro — rotas, services, hooks)
pmd cpd \
  --minimum-tokens 60 \
  --dir backend/src \
  --language typescript \
  --ignore-identifiers \
  --ignore-literals \
  --ignore-usings \
  --format xml \
  > reports/cpd/cpd-backend.xml

# Frontend utils, hooks, types (.ts puro)
pmd cpd \
  --minimum-tokens 60 \
  --dir frontend/src/utils \
  --dir frontend/src/hooks \
  --dir frontend/src/types \
  --language typescript \
  --ignore-identifiers \
  --ignore-literals \
  --format xml \
  > reports/cpd/cpd-frontend-ts.xml

# Frontend components e pages (.tsx)
# Nota: CPD trata TSX como TypeScript. Se falhar, omitir .tsx e confiar no jscpd para este subconjunto.
pmd cpd \
  --minimum-tokens 60 \
  --dir frontend/src/components \
  --dir frontend/src/pages \
  --dir frontend/src/features \
  --language typescript \
  --ignore-identifiers \
  --format xml \
  > reports/cpd/cpd-frontend-tsx.xml
```

**Nota sobre TSX:** o suporte a TSX no PMD CPD é via `--language typescript`. Se o CPD retornar erro de parse em arquivos `.tsx`, rode apenas nos diretórios `.ts` e confie no jscpd para os `.tsx`. Isso não é um gap — o jscpd já cobriu os arquivos `.tsx` na etapa anterior.

### Leitura do XML

O output XML tem este formato:

```xml
<pmd-cpd>
  <duplication lines="25" tokens="180">
    <file path="backend/src/routes/tables.ts" line="42"/>
    <file path="backend/src/routes/gmPanel.ts" line="312"/>
    <codefragment>
      // código duplicado aqui
    </codefragment>
  </duplication>
</pmd-cpd>
```

Priorize as `<duplication>` com mais de 3 arquivos listados — são as melhores candidatas a extração de utilitário central.

### Atualização do inventário

Volte ao `refactoring/inventory.md` e adicione uma coluna `CPD confirm`:

- `SIM` — CPD também encontrou, mesmo com identificadores ignorados → **alta confiança para extração**
- `NÃO` — CPD não encontrou → a duplicação é apenas léxica, não estrutural → pode ser aceitável ou menor prioridade
- `ERRO-PARSE` — CPD não conseguiu parsear o arquivo → confiar apenas no jscpd para este clone

### Checklist de saída da Etapa 1.2

- [ ] `reports/cpd/cpd-backend.xml` gerado
- [ ] `reports/cpd/cpd-frontend-ts.xml` gerado
- [ ] `reports/cpd/cpd-frontend-tsx.xml` gerado (ou documentado como ignorado)
- [ ] `inventory.md` atualizado com coluna `CPD confirm`

---

## Etapa 1.3 — dcd: near-duplicates nos arquivos grandes

Esta etapa é cirúrgica. Roda apenas nos dois arquivos problemáticos identificados no diagnóstico: `gmPanel.ts` (1.551 linhas) e `MestrePage.tsx` (466 linhas).

### Checklist de entrada

- [ ] Etapas 1.1 e 1.2 concluídas
- [ ] `go version` >= 1.21
- [ ] dcd instalado

### Instalação do dcd

```bash
go install github.com/boyter/dcd@latest

# Confirmar
dcd --version
```

Se `dcd` não estiver no PATH após o install:

```bash
export PATH="$PATH:$(go env GOPATH)/bin"
```

### Execução

```bash
# gmPanel.ts contra o resto do backend
dcd \
  --file backend/src/routes/gmPanel.ts \
  --fuzz 2 \
  --gap-tolerance 2 \
  > reports/dcd/dcd-gmPanel.txt

# MestrePage.tsx contra o resto do frontend
dcd \
  --file frontend/src/pages/MestrePage.tsx \
  --fuzz 2 \
  --gap-tolerance 2 \
  > reports/dcd/dcd-MestrePage.txt
```

**O que `--fuzz 2` significa:** o dcd admite até 2 tokens diferentes entre blocos para ainda considerá-los clone. Isso pega casos como "mesma função, mas `userId` virou `gmId`".

**O que `--gap-tolerance 2` significa:** admite até 2 linhas de diferença inseridas no meio do bloco (um `if` extra, uma atribuição extra) e ainda marca como near-duplicate.

### Leitura do output

O dcd lista as correspondências com arquivo, linha e o trecho. Se aparecer correspondência entre `gmPanel.ts` e qualquer outro arquivo de rota com mais de 15 linhas, adicione ao `inventory.md` como clone de alta prioridade para extração de repositório.

### Checklist de saída da Etapa 1.3

- [ ] `reports/dcd/dcd-gmPanel.txt` gerado
- [ ] `reports/dcd/dcd-MestrePage.txt` gerado
- [ ] Novos clones adicionados ao `inventory.md` se encontrados

---

## Etapa 1.4 — Priorização final antes de qualquer código

Antes de sair da FASE 1, você precisa de uma lista ordenada de o que extrair primeiro.

Abra `refactoring/inventory.md` e ordene os clones por:

1. **Número de arquivos afetados** (clones em 3+ arquivos têm prioridade máxima)
2. **Número de linhas** (clones maiores primeiro)
3. **Tipo** (queries de banco primeiro, pois um bug lá afeta dados; UI depois)
4. **CPD confirm = SIM** tem prioridade sobre `NÃO`

Documente a ordem final numa seção `## Ordem de execução da refatoração` no próprio `inventory.md`.

Exemplo:

```markdown
## Ordem de execução da refatoração

1. Extrair TableRepository (backend) — clone em 3 arquivos, ~80 linhas, CPD: SIM
2. Extrair tableFormatters (frontend) — clone em 3 arquivos, ~40 linhas, CPD: SIM
3. Extrair validação de slug (backend) — clone em 2 arquivos, ~15 linhas, CPD: NÃO
4. ...
```

**Regra de parada:** se um clone tem `CPD confirm = NÃO` e menos de 15 linhas, considere seriamente colocá-lo na lista de "Ignorar" em vez de refatorar. O custo de manutenção de uma abstração desnecessária é maior que o custo de 10 linhas repetidas.

---

---

# FASE 2 — REFATORAÇÃO (uma extração por vez)

---

**Regra absoluta desta fase:** uma extração por commit. Nunca agrupe duas extrações no mesmo commit. Se algo quebrar, o rollback é cirúrgico.

O protocolo de cada extração tem sempre a mesma estrutura:

```
1. Branch nova
2. Escrever o novo arquivo (repositório/utils/hook)
3. Verificar que o novo arquivo compila isoladamente
4. Substituir o primeiro ponto de uso
5. Compilar + testar manualmente
6. Substituir os demais pontos de uso um por um
7. Compilar + testar após cada substituição
8. Deletar o código original duplicado
9. Compilar final
10. Commit
```

---

## Etapa 2.1 — Extração do TableRepository (backend)

Este é o clone de maior impacto: queries de mesa repetidas em `tables.ts`, `gm.ts` e `gmPanel.ts`.

### Checklist de entrada

- [ ] FASE 1 concluída
- [ ] `inventory.md` com clones de `tables.ts` / `gm.ts` / `gmPanel.ts` confirmados
- [ ] Branch criada: `git checkout -b refactor/table-repository`

### Passo 1 — Ler os três arquivos originais antes de escrever qualquer coisa

Abra os três arquivos lado a lado e identifique:

- Qual é o "menor denominador comum" — a query base que os três usam
- O que cada um adiciona de diferente (filtros, joins, campos extras)
- Os tipos de retorno exatos (verifique no `domain/table.ts`)

Anote num rascunho. Não escreva TypeScript ainda.

### Passo 2 — Criar o arquivo do repositório

Crie `backend/src/repositories/tableRepository.ts`:

```typescript
import { db } from '../db/database'; // ajuste o caminho para o seu db
import type { TableFilters } from '../domain/table'; // ajuste conforme seus tipos reais

// RASCUNHO — adaptar conforme os tipos reais do projeto
// Este arquivo é criado vazio com a estrutura, preenchido com base nos clones

export class TableRepository {

  // Método base — usado por tables.ts (catálogo público)
  static async findPublicTables(filters?: TableFilters) {
    // COLAR AQUI o bloco de query de tables.ts que o jscpd identificou como clone
    // NÃO reescrever — copiar literalmente primeiro, depois parametrizar
  }

  // Usado por gm.ts (mesas de um mestre específico, visão pública)
  static async findByGmSlug(slug: string) {
    // COLAR AQUI o bloco de query de gm.ts
  }

  // Usado por gmPanel.ts (mesas do mestre logado, painel privado)
  static async findByGmId(gmId: string) {
    // COLAR AQUI o bloco de query de gmPanel.ts
  }
}
```

**Regra:** copie os blocos literalmente dos arquivos originais primeiro. Não parametrize na criação. Parametrize depois que os testes passarem.

### Passo 3 — Verificar compilação do arquivo novo isoladamente

```bash
cd backend
npx tsc --noEmit src/repositories/tableRepository.ts
```

Se houver erros de tipo, corrija-os antes de avançar. Erros comuns:

- Import do `db` com caminho errado → ajuste o caminho relativo
- Tipo de retorno incompatível → use o tipo exato que o arquivo original retornava

**Não avance com erros de compilação.**

### Passo 4 — Substituir o primeiro ponto de uso (apenas um)

Escolha o arquivo mais simples dos três — geralmente `gm.ts`. Substitua a query direta pela chamada ao repositório:

```typescript
// ANTES (gm.ts — exemplo do que o jscpd provavelmente encontrou)
router.get('/gm/:slug', async (req, res) => {
  const { slug } = req.params;
  const tables = await db
    .selectFrom('tables')
    .innerJoin('users', 'users.id', 'tables.gm_id')
    .where('users.slug', '=', slug)
    .where('tables.status', '=', 'active')
    // ... resto da query
    .execute();
  res.json(tables);
});

// DEPOIS
import { TableRepository } from '../repositories/tableRepository';

router.get('/gm/:slug', async (req, res) => {
  const { slug } = req.params;
  const tables = await TableRepository.findByGmSlug(slug);
  res.json(tables);
});
```

### Passo 5 — Compilar após a primeira substituição

```bash
cd backend
npx tsc --noEmit
```

Se erros, corrija antes de tocar em mais arquivos.

### Passo 6 — Testar manualmente a rota substituída

```bash
# Subir o servidor em modo dev
npm run dev

# Testar a rota com curl ou Insomnia
curl http://localhost:3000/gm/seu-slug-de-teste
```

Confirme que a resposta é idêntica ao comportamento anterior.

### Passo 7 — Substituir os demais arquivos um por um

Repita os passos 4-6 para `tables.ts` e depois para `gmPanel.ts`. Compile e teste após cada um.

### Passo 8 — Deletar o código duplicado dos originais

Só depois que os três arquivos estiverem usando o repositório e os testes passarem, delete os blocos originais que foram movidos.

### Passo 9 — Compilação final e commit

```bash
cd backend
npx tsc --noEmit
# Sem erros

cd ..
git add backend/src/repositories/tableRepository.ts
git add backend/src/routes/tables.ts
git add backend/src/routes/gm.ts
git add backend/src/routes/gmPanel.ts
git commit -m "refactor(backend): extract TableRepository from duplicated route queries

- tables.ts, gm.ts, gmPanel.ts had ~80 lines of similar Kysely queries
- Extracted to src/repositories/tableRepository.ts
- Detected by jscpd + PMD CPD (--ignore-identifiers confirmed structural match)"
```

### Checklist de saída da Etapa 2.1

- [ ] `tableRepository.ts` criado e compilando
- [ ] `tables.ts` usando repositório e testado
- [ ] `gm.ts` usando repositório e testado
- [ ] `gmPanel.ts` usando repositório e testado
- [ ] Blocos originais deletados
- [ ] `npx tsc --noEmit` sem erros no backend
- [ ] Commit feito

---

## Etapa 2.2 — Extração de tableFormatters (frontend)

Clone de formatação entre `TableCard.tsx`, `MesaPage.tsx` e `MestrePage.tsx`.

### Checklist de entrada

- [ ] Etapa 2.1 concluída e commitada
- [ ] Branch: `git checkout -b refactor/table-formatters`

### Passo 1 — Identificar as funções exatas

Abra o relatório do jscpd e localize os clones entre os três arquivos. Procure padrões como:

```typescript
// Exemplo do tipo de coisa que provavelmente está duplicada
const formatSlots = (filled: number, total: number) => `${filled}/${total} jogadores`;
const formatPrice = (price: number | null) => price ? `R$ ${price}` : 'Gratuito';
const formatSystem = (system: string) => system.toLowerCase().replace(/_/g, ' ');
```

### Passo 2 — Criar o arquivo de utilitários

Crie `frontend/src/utils/tableFormatters.ts`:

```typescript
// frontend/src/utils/tableFormatters.ts

// REGRA: copiar os blocos LITERALMENTE dos arquivos originais primeiro
// Só parametrizar/generalizar depois que todos os pontos de uso estiverem funcionando

export const formatTableSlots = (filled: number, total: number): string => {
  // COLAR aqui o bloco exato do primeiro arquivo onde aparece
};

export const formatTablePrice = (price: number | null): string => {
  // COLAR aqui o bloco exato
};

// ... demais funções encontradas pelo jscpd
```

### Passo 3 — Verificar compilação isolada

```bash
cd frontend
npx tsc --noEmit src/utils/tableFormatters.ts
```

Corrija erros de tipo antes de avançar.

### Passo 4 — Substituir nos arquivos um por um

Ordem: `TableCard.tsx` → `MesaPage.tsx` → `MestrePage.tsx`

Em cada arquivo:

```typescript
// Adicionar import no topo
import { formatTableSlots, formatTablePrice } from '../utils/tableFormatters';
// (ajustar caminho relativo conforme localização do arquivo)

// Substituir a função local pela importada
// ANTES: const slots = `${filled}/${total} jogadores`;
// DEPOIS: const slots = formatTableSlots(filled, total);
```

Compile após cada substituição:

```bash
npx tsc --noEmit
```

### Passo 5 — Build completo do frontend

```bash
npm run build
```

Se o build passar, rode o servidor de desenvolvimento e navegue pelas páginas afetadas:

```bash
npm run dev
# Abrir: /, /catalogo, /mesas/qualquer-slug, /mestre/qualquer-slug
```

Verifique visualmente que nenhum dado de formatação mudou.

### Passo 6 — Deletar funções locais e commit

```bash
git add frontend/src/utils/tableFormatters.ts
git add frontend/src/pages/MesaPage.tsx
git add frontend/src/pages/MestrePage.tsx
git add frontend/src/components/TableCard.tsx
git commit -m "refactor(frontend): extract tableFormatters from duplicated formatting logic

- TableCard.tsx, MesaPage.tsx, MestrePage.tsx had ~40 lines of identical formatters
- Extracted to src/utils/tableFormatters.ts
- Detected by jscpd"
```

### Checklist de saída da Etapa 2.2

- [ ] `tableFormatters.ts` criado e compilando
- [ ] Três arquivos substituídos e testados visualmente
- [ ] `npm run build` passando
- [ ] Commit feito

---

## Etapa 2.3 — Demais extrações do inventário

Para cada item restante do `inventory.md`, siga exatamente o mesmo protocolo da Etapa 2.1:

1. Branch nova por extração
2. Criar arquivo destino
3. Compilar isolado
4. Substituir um arquivo por vez
5. Compilar + testar após cada substituição
6. Deletar código original
7. Compilar final
8. Commit com mensagem descritiva

**Exemplos de outros arquivos que provavelmente serão extraídos:**

- `backend/src/middleware/validateSlug.ts` — se validação de slug aparece em múltiplas rotas
- `frontend/src/hooks/useTableData.ts` — se lógica de fetch de mesa aparece em múltiplos hooks
- `frontend/src/utils/dateFormatters.ts` — se formatação de datas está espalhada

---

---

# FASE 3 — GOVERNANÇA CONTÍNUA

---

## Etapa 3.1 — eslint-plugin-sonarjs

### Checklist de entrada

- [ ] FASE 2 concluída
- [ ] Todos os testes passando
- [ ] Branch: `git checkout -b chore/eslint-sonarjs`

### Instalação

```bash
# Backend
cd backend
npm install --save-dev eslint-plugin-sonarjs

# Frontend
cd ../frontend
npm install --save-dev eslint-plugin-sonarjs
```

### Configuração do backend

Edite ou crie `backend/.eslintrc.json`:

```json
{
  "root": true,
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "ecmaVersion": 2022,
    "sourceType": "module"
  },
  "plugins": ["@typescript-eslint", "sonarjs"],
  "rules": {
    "sonarjs/no-identical-functions": "error",
    "sonarjs/no-duplicated-branches": "error",
    "sonarjs/no-redundant-boolean": "warn",
    "sonarjs/cognitive-complexity": ["warn", 15],
    "sonarjs/no-duplicate-string": ["warn", { "threshold": 5 }]
  },
  "ignorePatterns": [
    "dist/",
    "node_modules/",
    "*.d.ts"
  ]
}
```

### Configuração do frontend

Edite `frontend/.eslintrc.json` ou `frontend/eslint.config.js` (Vite moderno usa flat config). Se for flat config:

```javascript
// eslint.config.js
import sonarjs from 'eslint-plugin-sonarjs';

export default [
  // ... suas configs existentes ...
  {
    plugins: { sonarjs },
    rules: {
      'sonarjs/no-identical-functions': 'error',
      'sonarjs/no-duplicated-branches': 'error',
      'sonarjs/no-redundant-boolean': 'warn',
      'sonarjs/cognitive-complexity': ['warn', 15],
    },
  },
];
```

### Verificação imediata após instalar

```bash
# Backend
cd backend
npx eslint src/ --ext .ts

# Frontend
cd ../frontend
npx eslint src/ --ext .ts,.tsx
```

Na primeira execução pós-refatoração, espera-se zero erros de `no-identical-functions`. Se aparecerem, são clones que o jscpd ou o CPD não detectaram — corrigir antes do próximo commit.

### Integração com scripts npm

No `backend/package.json`:

```json
{
  "scripts": {
    "lint": "eslint src/ --ext .ts",
    "lint:fix": "eslint src/ --ext .ts --fix"
  }
}
```

No `frontend/package.json`:

```json
{
  "scripts": {
    "lint": "eslint src/ --ext .ts,.tsx",
    "lint:fix": "eslint src/ --ext .ts,.tsx --fix"
  }
}
```

### Commit

```bash
git add backend/.eslintrc.json backend/package.json backend/package-lock.json
git add frontend/.eslintrc.json frontend/package.json frontend/package-lock.json
git commit -m "chore: add eslint-plugin-sonarjs for duplicate function detection

- no-identical-functions: error (blocks identical function bodies)
- no-duplicated-branches: error
- cognitive-complexity: warn at 15"
```

### Checklist de saída da Etapa 3.1

- [ ] Plugin instalado em backend e frontend
- [ ] Zero erros de `no-identical-functions` na primeira execução
- [ ] Scripts `lint` adicionados ao `package.json` de cada lado
- [ ] Commit feito

---

## Etapa 3.2 — Script de auditoria periódica

Crie `scripts/audit-duplicates.sh` na raiz:

```bash
#!/bin/bash
# Executa auditoria completa de duplicações
# Uso: ./scripts/audit-duplicates.sh

set -e  # para na primeira falha

echo "=== Auditoria de Duplicações — Artifício Mesas ==="
echo "Data: $(date)"
echo ""

# Etapa 1: jscpd
echo "--- jscpd ---"
mkdir -p reports/jscpd
npx jscpd backend/src frontend/src \
  --min-lines 8 \
  --min-tokens 60 \
  --reporters console,json \
  --output reports/jscpd

echo ""

# Etapa 2: ESLint sonarjs
echo "--- ESLint SonarJS (backend) ---"
cd backend && npx eslint src/ --ext .ts --format compact && cd ..

echo "--- ESLint SonarJS (frontend) ---"
cd frontend && npx eslint src/ --ext .ts,.tsx --format compact && cd ..

echo ""
echo "=== Relatórios salvos em reports/ ==="
echo "Abra reports/jscpd/jscpd-report.html para visualização detalhada"
```

```bash
chmod +x scripts/audit-duplicates.sh
```

Execute mensalmente ou antes de qualquer grande refatoração.

---

## Etapa 3.3 — Adicionar jscpd ao package.json raiz

Se o projeto já tem um `package.json` na raiz (monorepo):

```json
{
  "scripts": {
    "analyze:duplicates": "jscpd backend/src frontend/src --min-lines 8 --min-tokens 60 --reporters html,json --output reports/jscpd",
    "analyze:duplicates:aggressive": "jscpd backend/src frontend/src --min-lines 5 --min-tokens 40 --reporters html --output reports/jscpd-aggressive"
  },
  "devDependencies": {
    "jscpd": "^4.0.0"
  }
}
```

Se não há `package.json` na raiz, adicione ao `backend/package.json`.

---

---

# Checklist Master — execução completa

```
FASE 1 — DETECÇÃO

[ ] git status limpo antes de começar
[ ] reports/ e refactoring/ criados
[ ] .jscpd.json criado na raiz
[ ] jscpd executado (min-lines 8, min-tokens 60)
[ ] jscpd executado em modo agressivo (min-lines 5)
[ ] inventory.md preenchido com todos os clones
[ ] PMD instalado e com java >= 21
[ ] CPD executado no backend
[ ] CPD executado no frontend (.ts)
[ ] CPD executado no frontend (.tsx) ou documentado como ignorado
[ ] inventory.md atualizado com CPD confirm
[ ] dcd instalado
[ ] dcd executado em gmPanel.ts
[ ] dcd executado em MestrePage.tsx
[ ] inventory.md atualizado com near-duplicates do dcd
[ ] Ordem de execução da refatoração definida no inventory.md

FASE 2 — REFATORAÇÃO

[ ] TableRepository extraído e testado
[ ] tableFormatters extraído e testado
[ ] Demais itens do inventory.md executados (um commit por extração)
[ ] tsc --noEmit passando em backend e frontend
[ ] npm run build passando no frontend
[ ] Teste manual das rotas afetadas

FASE 3 — GOVERNANÇA

[ ] eslint-plugin-sonarjs instalado no backend
[ ] eslint-plugin-sonarjs instalado no frontend
[ ] Zero erros de no-identical-functions após instalação
[ ] Scripts lint adicionados ao package.json
[ ] audit-duplicates.sh criado e executável
[ ] analyze:duplicates adicionado ao package.json
```

---

## Regras de parada (quando NÃO refatorar)

Estas situações justificam deixar um clone no "Ignorar" do `inventory.md`:

1. **Clone com `CPD confirm = NÃO` e menos de 12 linhas** — custo de abstração maior que benefício
2. **Clone em arquivo de teste** — duplicação em testes é frequentemente intencional para clareza
3. **Clone entre backend e frontend do mesmo tipo** — ex: `TableStatus` definido nos dois lados. Isso é candidato a `shared/types`, não a extração de função. Trate separadamente como refatoração de tipos.
4. **Clone que cruza camadas de abstração diferentes** — ex: uma query em rota e outra em seed/script. Extrair forçaria acoplamento desnecessário.
5. **Clone com lógica ligeiramente diferente que o CPD só pegou com `--ignore-literals` muito agressivo** — revise manualmente antes de extrair; pode ser coincidência estrutural, não duplicação real.