# Plano — 034

## Arquitetura da solução

Substituir `xlsx` por duas bibliotecas do mesmo autor (catamphetamine, MIT, ativamente mantidas):

| Operação | Antes (`xlsx@0.18.5`) | Depois | Versão |
|---|---|---|---|
| Parse .xlsx (ArrayBuffer → rows) | `XLSX.read()` + `XLSX.utils.sheet_to_json()` | `read-excel-file` | `^9.2.0` |
| Gerar .xlsx (rows → blob/download) | `XLSX.utils.json_to_sheet()` + `XLSX.writeFile()` | `write-excel-file` | `^4.1.1` |
| Parse .csv | `XLSX.read()` (auto-detect) | `read-excel-file` (se suportar) ou fallback vanilla | — |

### API mapping detalhado

#### Leitura (`ImportPage.tsx` — função `parseSheet`)

**Antes (xlsx):**
```ts
const workbook = XLSX.read(data, { type: 'array' });
const sheet = workbook.Sheets[workbook.SheetNames[0]];
// Scan header row (linhas 143-161)
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
// ... detecta headerRowIndex ...
const raw = XLSX.utils.sheet_to_json(sheet, { defval: '', range: headerRowIndex });
```

**Depois (read-excel-file):**
```ts
// Opção A: readRows() retorna array de arrays, depois mapeia com COL_MAP
import readExcelFile, { readRows } from 'read-excel-file';
const allRows = await readExcelFile(data, { sheet: 1 }); // ou readRows(data)
// Scan manual das primeiras 25 linhas para achar header
// Depois mapeia rows[headerRowIndex] → keys, rows seguintes → valores
```

**Desafio:** `read-excel-file` espera `File | Blob | ArrayBuffer`. A função atual recebe `Uint8Array`. Compatível. A API de `readRows` retorna `string[][]`. Precisamos:
1. Ler todas as linhas como array 2D
2. Detectar header (mesmo algoritmo atual: scan primeiras 25 linhas por `name_en` + `name_pt`)
3. Mapear linhas de dados usando o header detectado + `COL_MAP`

#### Escrita (`ImportPage.tsx` — função `handleDownloadTemplate`)

**Antes (xlsx):**
```ts
const ws = XLSX.utils.json_to_sheet(TEMPLATE_ROWS.map(...));
ws['!cols'] = [{ wch: 28 }, ...];
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'Modelo');
XLSX.writeFile(wb, 'modelo_importacao_termos.xlsx');
```

**Depois (write-excel-file):**
```ts
import writeXlsxFile from 'write-excel-file';

const schema = [
  { column: 'Nome (EN)', type: String, width: 28 },
  { column: 'Nome (PT)', type: String, width: 28 },
  // ...
];

const data = TEMPLATE_ROWS.map(row => [
  { type: String, value: row.name_en },
  { type: String, value: row.name_pt },
  // ...
]);

const blob = await writeXlsxFile(data, { schema, fileName: 'modelo_importacao_termos.xlsx' });
```

**Desafio:** `write-excel-file` retorna `Promise<Blob>` no browser (ou escreve arquivo no Node). Para download no browser, precisamos criar um link temporário:
```ts
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'modelo_importacao_termos.xlsx';
a.click();
URL.revokeObjectURL(url);
```

#### CSV fallback

Se `read-excel-file` não suportar CSV nativamente:
- Implementar parser vanilla para CSV simples (split por `\n` e `,` ou `;`)
- Ou adicionar `papaparse` como dependência leve (~30KB min+gzip)
- CSV é funcionalidade secundária — o fluxo principal usa .xlsx

**Verificação necessária durante implementação:** `read-excel-file@9.x` suporta CSV? A documentação menciona "Read `.xlsx` files" — pode não cobrir `.csv`. Nesse caso, detectar extensão do arquivo e usar parser CSV dedicado para `.csv`.

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `apps/glossario/frontend/package.json` | Remover `xlsx`, adicionar `read-excel-file` + `write-excel-file` (+ `papaparse` se necessário) |
| `apps/glossario/frontend/src/pages/ImportPage.tsx` | Reescrever `parseSheet()` + `handleDownloadTemplate()`. Trocar `import * as XLSX from 'xlsx'` |
| `pnpm-lock.yaml` | Regenerado pelo `pnpm install` |

## Contratos/interfaces tocados

- **API interna:** `parseSheet()` retorna `ParsedTerm[]` (mesma interface de saída)
- **API interna:** `handleDownloadTemplate()` gera download (mesmo comportamento)
- **API backend:** `POST /terms/import` — não muda (payload `ParsedTerm[]` idêntico)
- **Nenhum contrato público, schema, auth ou subdomínio afetado**

## Impacto em consumidores

- **Nenhum.** `xlsx` só é importado em `ImportPage.tsx`. Nenhum outro arquivo no monorepo referencia `xlsx`.

## Rollback

- `git revert` do commit
- Restaurar `xlsx` no `package.json` + `pnpm install`
- Tag `pre-033-f4b-*` cobre o estado atual do lockfile

## Validação

1. **Build:** `pnpm --filter @artificio/glossario-frontend build` verde
2. **Turbo:** `pnpm turbo build --force` 13/13
3. **Audit:** `pnpm audit --prod` sem HIGH do xlsx
4. **Funcional (local):**
   - Download do template → arquivo .xlsx com 2 linhas + cabeçalhos
   - Upload do template preenchido → parse correto (n termos detectados)
   - Upload de .csv → parse correto
   - Fluxo completo: upload → preview → confirm → summary
5. **Testes:** verificar se há testes existentes para o glossario-frontend
