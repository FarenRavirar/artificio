# 034 — Substituir `xlsx` (SheetJS) por `read-excel-file` + `write-excel-file`

- **Módulo/Pacote:** `apps/glossario/frontend`
- **Gate relacionado:** D (glossario já fechado, mas muda funcionalidade user-facing)
- **Débito:** `BL-AUDIT-033` (2 HIGH — xlsx abandonado sem patch)

## Problema

`xlsx@0.18.5` (SheetJS) tem 2 vulnerabilidades **HIGH** sem patch publicado:

- **GHSA-4r6h-8v6p-xvw6** — Prototype Pollution em `XLSX.read()`
- **GHSA-5pgg-2g8v-p4x9** — ReDoS no parser de spreadsheet

O package está **abandonado**: a última versão publicada no npm é `0.18.5` (a mesma instalada). As advisories citam versões `>=0.19.3`/`>=0.20.2` como corrigidas, mas essas versões **não existem** no registro público. O maintainer (SheetJS) não publica novas releases desde 2024.

Uso atual: `apps/glossario/frontend/src/pages/ImportPage.tsx` — único ponto de uso do `xlsx` no monorepo. Funcionalidade admin-only de importação de termos via planilha Excel/CSV.

## Requisitos

1. **R1** — Substituir `xlsx` por alternativas ativamente mantidas e sem vulnerabilidades conhecidas.
2. **R2** — Leitura de `.xlsx`: preservar suporte a detecção automática de linha de cabeçalho (scan das primeiras 25 linhas) com fallback de colunas em PT/EN.
3. **R3** — Leitura de `.csv`: deve continuar funcionando (o parser atual via `XLSX.read` suporta CSV; verificar se o substituto também suporta ou se precisa de fallback dedicado).
4. **R4** — Escrita de `.xlsx` (template): gerar arquivo Excel com cabeçalhos, dados de exemplo e larguras de coluna para download.
5. **R5** — Zero regressão funcional: fluxo `upload → parse → preview → confirm` deve funcionar idêntico ao atual.
6. **R6** — Zero regressão de build: `turbo build --force` 13/13, `pnpm --filter @artificio/glossario-frontend build` verde.
7. **R7** — `pnpm audit --prod` deve eliminar os 2 HIGH do xlsx.

## Critérios de aceite

- `pnpm audit --prod` sem os 2 HIGH do `xlsx`
- Upload de `.xlsx` de exemplo (com cabeçalhos em PT e EN) → parse correto
- Upload de `.csv` → parse correto
- Download do template `.xlsx` → arquivo válido com 2 linhas de exemplo + cabeçalhos
- Fluxo completo: upload → preview → confirm → summary OK
- `turbo build --force` 13/13 verde
- Nenhuma nova dependência com vulnerabilidades introduzida

## Fora de escopo

- Substituir `xlsx` em qualquer outro pacote (só existe no glossario-frontend)
- Alterar a lógica de negócio da importação (endpoints, preview, confirmação)
- Alterar o formato do template ou as colunas aceitas
- Migrar CSV para parser separado além do que a lib substituta já oferece

## Riscos e impacto em outros módulos

- **Risco baixo:** funcionalidade isolada no glossario-frontend. Nenhum outro app/pacote importa `xlsx`.
- **Risco médio:** `read-excel-file` e `write-excel-file` têm APIs diferentes do `xlsx`. O parser de header-row adaptativo (linhas 143-161 do ImportPage.tsx) precisa ser reescrito.
- **Risco médio:** `read-excel-file` pode não suportar CSV nativamente → fallback com parser CSV dedicado (ex.: `papaparse` ou parser vanilla para CSV simples).
- **Impacto:** zero em outros módulos. Glossario-frontend é o único consumidor.
