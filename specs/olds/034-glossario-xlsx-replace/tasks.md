# Tasks — 034

## Fase 1 — Investigação e setup

- [ ] T1 — **Verificar APIs exatas das bibliotecas substitutas**
  - Instalar `read-excel-file@^9.2.0` e `write-excel-file@^4.1.1` localmente (fora do projeto, ou `pnpm add -D` temporário)
  - Confirmar: `read-excel-file` aceita `ArrayBuffer`/`Uint8Array` e suporta CSV ou não
  - Confirmar: `write-excel-file` retorna `Blob` no browser e aceita schema com largura de colunas
  - Verificar tipos TypeScript de ambas (`@types/` ou built-in)
  - **Feito quando:** APIs confirmadas, decisão de CSV (fallback ou suporte nativo) tomada

- [ ] T2 — **Definir estratégia de CSV**
  - Se `read-excel-file` suporta CSV nativo → usar
  - Se não suporta → escolher entre `papaparse` (leve, 30KB) ou parser vanilla para CSV simples
  - Documentar decisão em plan.md
  - **Feito quando:** caminho de CSV definido e documentado

## Fase 2 — Implementação

- [ ] T3 — **Bump de dependências**
  - `apps/glossario/frontend/package.json`: remover `xlsx`, adicionar `read-excel-file` + `write-excel-file` (+ parser CSV se necessário)
  - `pnpm install` no root
  - Verificar `pnpm audit --prod` — 2 HIGH do xlsx devem sumir
  - **Feito quando:** `pnpm install` limpo, audit sem xlsx

- [ ] T4 — **Reescrever `parseSheet()` (leitura)**
  - Trocar `import * as XLSX from 'xlsx'` → `import readExcelFile, { readRows } from 'read-excel-file'`
  - Reescrever lógica de leitura:
    1. `readExcelFile(data)` → array 2D de rows
    2. Scan das primeiras 25 linhas para detectar header (mesmo algoritmo atual via `COL_MAP`)
    3. Mapear linhas após header para `ParsedTerm[]` usando `COL_MAP`
  - Manter validações: sem planilhas, sem termos, limite 2000
  - Manter sanitização inline (`sanitizeInlineText`, `decodeHtmlEntities`)
  - **Feito quando:** `parseSheet()` compila e a lógica de parse é idêntica à atual

- [ ] T5 — **Reescrever `handleDownloadTemplate()` (escrita)**
  - Trocar `XLSX.utils.*` + `XLSX.writeFile()` → `write-excel-file`
  - Mapear `TEMPLATE_ROWS` para formato `write-excel-file` (array de arrays com `{ type, value }` ou objetos com schema)
  - Definir schema de colunas com larguras (28, 28, 20, 20, 14, 24, 16, 42)
  - Implementar download via `Blob` + `URL.createObjectURL`
  - **Feito quando:** botão "Baixar modelo Excel" gera arquivo .xlsx válido com 2 linhas + cabeçalhos + larguras

- [ ] T6 — **Implementar fallback CSV (se necessário)**
  - Detectar extensão `.csv` no nome do arquivo
  - Roteamento: `.xlsx` → `read-excel-file`, `.csv` → parser dedicado
  - Parser CSV: split por `\n`, detectar delimitador (`,` ou `;`), mapear com `COL_MAP`
  - Ou integrar `papaparse` se a complexidade justificar
  - **Feito quando:** upload de .csv funciona no fluxo completo

## Fase 3 — Testes e validação

- [ ] T7 — **Build e smoke local**
  - `pnpm --filter @artificio/glossario-frontend build` (tsc + vite)
  - `pnpm turbo build --force` 13/13 verde
  - **Feito quando:** build sem erros

- [ ] T8 — **Teste funcional manual**
  - Abrir glossario-frontend (`pnpm --filter @artificio/glossario-frontend dev`)
  - Navegar para `/import` (ImportPage)
  - Baixar template → abrir no Excel → verificar cabeçalhos + 2 linhas exemplo
  - Preencher template com dados de teste → upload → verificar parse (n termos detectados)
  - Preview → verificar classificação (inserções/atualizações)
  - Upload de .csv de teste → verificar parse
  - **Feito quando:** fluxo completo funciona sem erros

- [ ] T9 — **Verificar testes existentes**
  - Rodar `pnpm --filter @artificio/glossario-frontend test` (se existir)
  - Se houver testes que tocam importação, atualizar mocks
  - **Feito quando:** testes passam ou nenhum teste quebrado pela mudança

- [ ] T10 — **Audit final**
  - `pnpm audit --prod` — verificar que 2 HIGH do xlsx sumiram
  - Verificar que novas deps (`read-excel-file`, `write-excel-file`) não têm vulnerabilidades
  - **Feito quando:** audit limpo de HIGH relacionados ao escopo

## Fase 4 — Documentação

- [ ] T11 — **Atualizar `specs/backlog.md`**
  - Fechar `BL-AUDIT-033` (fatia xlsx) ou atualizar status para "em execução spec 034"
  - Registrar novas pendências se houver
  - **Feito quando:** backlog reflete estado real

- [ ] T12 — **Atualizar `project-state.md`**
  - Adicionar spec 034 em execução/concluída
  - Atualizar status de `BL-AUDIT-033`
  - **Feito quando:** project-state consistente

- [ ] T13 — **Atualizar sessão**
  - Registrar execução no arquivo de sessão ativo
  - **Feito quando:** sessão atualizada com resultados

---

**Resumo de esforço estimado:**

| Fase | Tasks | Esforço |
|---|---|---|
| Investigação | T1-T2 | 30 min |
| Implementação | T3-T6 | 2-3 h |
| Testes | T7-T10 | 30 min |
| Documentação | T11-T13 | 15 min |
| **Total** | **13 tasks** | **~3-4 h** |

**Dependências:** Nenhuma. Spec independente.

**Risco principal:** CSV pode precisar de parser extra (T2 → T6). Se `read-excel-file` não suportar, adicionar `papaparse` (~30KB) ou implementar parser vanilla (~20 linhas).
