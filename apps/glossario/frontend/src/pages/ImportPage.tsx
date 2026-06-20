import React, { useCallback, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, BookOpenText, Download, FileUp, Asterisk } from 'lucide-react';
import ImportPreview, { type PreviewRow, type ImportAction } from '../components/ImportPreview';
import api from '../services/api';
import { apiErrorMessage } from '../lib/api-error';
import { sanitizeInlineText, decodeHtmlEntities } from '../utils/textSanitizer';
import { useAuth } from '../context/auth-context';

// ---------------------------------------------------------------------------
// Tipos que espelham a lógica do backend
// ---------------------------------------------------------------------------

type NucleusValue = 'oficial' | 'sugestao' | 'artificio';

interface ParsedTerm {
  name_en:         string;
  name_pt:         string;
  system_name?:    string;
  category_name?:  string;
  subcategory_name?: string;
  nucleus?:        NucleusValue;
  book_reference?: string;
  page_reference?: string;
  additional_info?: string;
}

// ---------------------------------------------------------------------------
// Mapeamento de colunas — aceita nomes em pt e en, case insensitive
// ---------------------------------------------------------------------------
const COL_MAP: Record<string, keyof ParsedTerm> = {
  name_en:         'name_en',
  'nome inglês':   'name_en',
  'nome ingles':   'name_en',
  'nome em inglês':'name_en',
  'nome em ingles':'name_en',
  nome_en:         'name_en',
  name_pt:         'name_pt',
  'nome português':'name_pt',
  'nome portugues':'name_pt',
  'nome em português':'name_pt',
  'nome em portugues':'name_pt',
  nome_pt:         'name_pt',
  system:          'system_name',
  sistema:         'system_name',
  system_name:     'system_name',
  category:        'category_name',
  categoria:       'category_name',
  domínio:         'category_name',
  dominio:         'category_name',
  category_name:   'category_name',
  subcategory:     'subcategory_name',
  subcategoria:    'subcategory_name',
  subdomínio:      'subcategory_name',
  subdominio:      'subcategory_name',
  subcategory_name:'subcategory_name',
  nucleus:         'nucleus',
  nucleo:          'nucleus',
  núcleo:          'nucleus',
  validacao:       'nucleus',
  validação:       'nucleus',
  book_reference:  'book_reference',
  livro:           'book_reference',
  referencia:      'book_reference',
  referência:      'book_reference',
  page_reference:  'page_reference',
  'página':        'page_reference',
  pagina:          'page_reference',
  additional_info: 'additional_info',
  informacao:      'additional_info',
  'informação':    'additional_info',
  notas:           'additional_info',
};

const TEMPLATE_ROWS: ParsedTerm[] = [
  {
    name_en: 'Fireball',
    name_pt: 'Bola de Fogo',
    system_name: 'D&D 5e',
    category_name: 'Magias',
    subcategory_name: 'Mecânicas de magias',
    nucleus: 'oficial',
    book_reference: 'Player’s Handbook',
    page_reference: '241',
    additional_info: 'Magia clássica de evocação com área de efeito.',
  },
  {
    name_en: 'Sneak Attack',
    name_pt: 'Ataque Furtivo',
    system_name: 'D&D 5e',
    category_name: 'Classes',
    subcategory_name: 'Subclasse',
    nucleus: 'sugestao',
    book_reference: '',
    page_reference: '',
    additional_info: 'Escala com o nível do Ladino.',
  },
];

const REQUIRED_COLUMNS = ['name_en', 'name_pt'] as const;
const OPTIONAL_COLUMNS = [
  'system',
  'category',
  'subcategory',
  'nucleus',
  'book_reference',
  'page_reference',
  'additional_info',
] as const;

const FLOW_STEPS = [
  {
    title: 'Baixe o modelo',
    description: 'Use o Excel base para manter os cabeçalhos corretos.',
  },
  {
    title: 'Preencha os termos',
    description: 'Mantenha name_en e name_pt em todas as linhas válidas.',
  },
  {
    title: 'Analise no preview',
    description: 'O sistema classifica inserções, atualizações e sugestões.',
  },
  {
    title: 'Confirme a importação',
    description: 'Revise o resultado e aplique as alterações no banco.',
  },
] as const;

// ---------------------------------------------------------------------------
// Parser de planilha/CSV para lista de ParsedTerm
// ---------------------------------------------------------------------------
const parseSheet = (workbook: XLSX.WorkBook): ParsedTerm[] => {
  if (!workbook.SheetNames?.length) {
    throw new Error('Arquivo não contém planilhas válidas.');
  }

  const firstSheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheetName];
  if (!sheet) return [];

  // Suporte a planilhas legadas onde a linha de cabeçalho não está na primeira
  // linha (ex: título na linha 1 e cabeçalhos na linha 3).
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });
  let headerRowIndex = 0;

  for (let i = 0; i < Math.min(rows.length, 25); i += 1) {
    const row = Array.isArray(rows[i]) ? rows[i] : [];
    const mappedKeys = row
      .map((cell) => COL_MAP[String(cell ?? '').toLowerCase().trim()])
      .filter(Boolean);

    if (mappedKeys.includes('name_en') && mappedKeys.includes('name_pt')) {
      headerRowIndex = i;
      break;
    }
  }

  const raw: Record<string, string>[] = XLSX.utils.sheet_to_json(sheet, {
    defval: '',
    range: headerRowIndex,
  });

  return raw
    .map((row) => {
      const term: Partial<ParsedTerm> = {};
      for (const [key, value] of Object.entries(row)) {
        const normalKey = key.toLowerCase().trim();
        const mapped = COL_MAP[normalKey];
        if (mapped) {
          (term as Record<string, string>)[mapped] = String(value ?? '').trim();
        }
      }
      // Sanitizar campos de texto inline
      if (term.name_en)         term.name_en         = sanitizeInlineText(term.name_en);
      if (term.name_pt)         term.name_pt         = sanitizeInlineText(term.name_pt);
      if (term.book_reference)  term.book_reference  = sanitizeInlineText(term.book_reference);
      if (term.page_reference)  term.page_reference  = sanitizeInlineText(term.page_reference);
      if (term.additional_info) term.additional_info = decodeHtmlEntities(term.additional_info);

      return term as ParsedTerm;
    })
    .filter((t) => t.name_en && t.name_pt);
};

// ---------------------------------------------------------------------------
// Mapeia resultado do backend para PreviewRow local (para exibição)
// ---------------------------------------------------------------------------
interface BackendPreviewRow {
  action: string;
  name_en: string;
  name_pt: string;
  changed_fields?: string[];
}

const toPreviewRow = (r: BackendPreviewRow, parsedTerms: ParsedTerm[]): PreviewRow => {
  const source = parsedTerms.find(
    (t) => t.name_en.toLowerCase() === r.name_en?.toLowerCase()
  );
  return {
    action:         r.action as ImportAction,
    name_en:        r.name_en,
    name_pt:        r.name_pt,
    system_name:    source?.system_name,
    category_name:  source?.category_name,
    subcategory_name: source?.subcategory_name,
    changed_fields: r.changed_fields,
  };
};

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

const ImportPage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [parsedTerms,  setParsedTerms]  = useState<ParsedTerm[]>([]);
  const [previewRows,  setPreviewRows]  = useState<PreviewRow[]>([]);
  const [fileName,     setFileName]     = useState<string>('');
  const [step,         setStep]         = useState<'idle' | 'parsed' | 'previewing' | 'done'>('idle');
  const [isLoading,    setIsLoading]    = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [summary,      setSummary]      = useState<{ total: number; inserted: number; updated: number; overrides?: number; duplicates: number } | null>(null);
  const [adminNucleus, setAdminNucleus] = useState<'oficial' | 'artificio'>('oficial');

  const handleDownloadTemplate = useCallback(() => {
    const ws = XLSX.utils.json_to_sheet(
      TEMPLATE_ROWS.map((row) => ({
        name_en: row.name_en,
        name_pt: row.name_pt,
        system: row.system_name ?? '',
        category: row.category_name ?? '',
        subcategory: row.subcategory_name ?? '',
        nucleus: row.nucleus ?? 'sugestao',
        book_reference: row.book_reference ?? '',
        page_reference: row.page_reference ?? '',
        additional_info: row.additional_info ?? '',
      }))
    );

    ws['!cols'] = [
      { wch: 28 }, { wch: 28 }, { wch: 20 }, { wch: 20 },
      { wch: 14 }, { wch: 24 }, { wch: 16 }, { wch: 42 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Modelo');
    XLSX.writeFile(wb, 'modelo_importacao_termos.xlsx');
  }, []);

  // ---- Parse local do arquivo ----
  const handleFile = useCallback((file: File) => {
    setError(null);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onerror = () => {
      setError('Falha ao ler o arquivo local. Verifique permissões e tente novamente.');
    };

    reader.onload = (e) => {
      try {
        const result = e.target?.result;
        if (!(result instanceof ArrayBuffer)) {
          setError('Erro ao ler o arquivo. O arquivo pode estar vazio, corrompido ou inacessível.');
          return;
        }

        const data = new Uint8Array(result);
        const workbook = XLSX.read(data, { type: 'array' });

        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
          setError('A planilha está vazia. Use o modelo .xlsx e preencha ao menos uma aba.');
          return;
        }

        const terms = parseSheet(workbook);

        if (terms.length === 0) {
          setError('Nenhum termo válido encontrado. Verifique se o arquivo tem colunas name_en e name_pt (ou equivalentes).');
          return;
        }
        if (terms.length > 2000) {
          setError('Limite de 2000 termos por importação. Divida o arquivo em partes menores.');
          return;
        }

        setParsedTerms(terms);
        setStep('parsed');
      } catch {
        setError('Erro ao ler o arquivo. Certifique-se de que é um .xlsx ou .csv válido.');
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  // ---- Drop e click ----
  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleDropZoneKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInputRef.current?.click();
    }
  };

  // ---- Preview: chama endpoint com dry_run simulado no frontend ----
  // A prévia é calculada localmente via endpoint de preview (dry_run=true)
  const handlePreview = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Chama o endpoint com os termos; o backend retorna a classificação sem gravar
      // Usamos um campo `dry_run: true` — o backend responde com classificação sem commits
      const { data } = await api.post('/terms/import', {
        terms:   parsedTerms,
        dry_run: true,
        import_nucleus: isAdmin ? adminNucleus : undefined,
      });
      const rows: PreviewRow[] = Array.isArray(data.results)
        ? (data.results as BackendPreviewRow[]).map(r => toPreviewRow(r, parsedTerms))
        : [];
      setPreviewRows(rows);
      setStep('previewing');
    } catch (err) {
      setError(apiErrorMessage(err, 'Erro ao gerar preview. Tente novamente.'));
    } finally {
      setIsLoading(false);
    }
  };

  // ---- Confirmação real ----
  const handleConfirm = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = { terms: parsedTerms };
      if (isAdmin) payload.import_nucleus = adminNucleus;
      const { data } = await api.post('/terms/import', payload);
      const s = data.summary;
      if (s && typeof s.total === 'number' && typeof s.inserted === 'number' && typeof s.updated === 'number' && typeof s.duplicates === 'number') {
        setSummary(s);
      }
      setStep('done');
    } catch (err) {
      setError(apiErrorMessage(err, 'Erro durante a importação. Nenhum dado foi alterado.'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setParsedTerms([]);
    setPreviewRows([]);
    setFileName('');
    setStep('idle');
    setError(null);
    setSummary(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ---- Render ----
  return (
    <div className="min-h-screen bg-[var(--surface-subtle)] py-10 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto">

        <header className="mb-8">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--surface)] shadow-[0_2px_12px_rgba(0,0,0,0.08)]">
              <FileUp size={22} className="text-[var(--fg)]" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-[var(--fg)] uppercase tracking-tight">
                Importação de Termos
              </h1>
              <p className="text-[var(--fg-muted)] text-sm mt-1">
                Envie uma planilha <strong>.xlsx</strong> (recomendado) ou arquivo <strong>.csv</strong> com seus termos.
                O sistema classifica cada linha antes de confirmar.
              </p>
            </div>
          </div>
        </header>

        <div className="space-y-8">
          <section className="rounded-xl border border-[var(--state-info-line)] bg-[var(--state-info-bg)] p-5 shadow-[0_2px_12px_rgba(0,0,0,0.08)]">
            <h2 className="text-[11px] font-black uppercase tracking-widest text-[var(--state-info-fg)]">
              Colunas esperadas
            </h2>
            <p className="mt-2 text-xs text-[var(--state-info-fg)]">
              Aceita nomes de colunas em português ou inglês.
            </p>

            <div className="mt-4">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[var(--state-info-fg)]">Obrigatórias</p>
              <div className="flex flex-wrap gap-2">
                {REQUIRED_COLUMNS.map((column) => (
                  <span
                    key={column}
                    className="inline-flex items-center gap-1 rounded-full border border-[var(--state-warning-line)] bg-[var(--state-warning-bg)] px-3 py-1 text-[11px] font-semibold text-[var(--state-warning-fg)]"
                  >
                    <Asterisk size={11} aria-hidden="true" />
                    <code className="font-mono">{column}</code>
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-4">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[var(--state-info-fg)]">Opcionais</p>
              <div className="flex flex-wrap gap-2">
                {OPTIONAL_COLUMNS.map((column) => (
                  <span
                    key={column}
                    className="inline-flex items-center rounded-full border border-[var(--state-info-line)] bg-[var(--surface-subtle)] px-3 py-1 text-[11px] font-semibold text-[var(--state-info-fg)]"
                  >
                    <code className="font-mono">{column}</code>
                  </span>
                ))}
              </div>
            </div>

            {!isAdmin && (
              <div className="mt-4 rounded-lg border border-[var(--state-warning-line)] bg-[var(--state-warning-bg)] px-3 py-2 text-[11px] text-[var(--state-warning-fg)]">
                Importações de membros sempre entram como <strong>Sugestão</strong>.
              </div>
            )}
          </section>

          <section className="border-t border-[var(--line)] pt-8">
            <div className="rounded-xl border border-[var(--state-warning-line)] bg-gradient-to-br from-[var(--state-warning-bg)] via-[var(--surface)] to-[var(--state-warning-bg)] p-6 shadow-[0_2px_12px_rgba(0,0,0,0.08)]">
              <div className="flex items-start gap-3 mb-5">
                <div className="p-2 rounded-lg bg-[var(--state-warning-bg)] border border-[var(--state-warning-line)]">
                  <BookOpenText size={18} className="text-[var(--state-warning-fg)]" />
                </div>
                <div>
                  <h2 className="text-sm font-black uppercase tracking-widest text-[var(--state-warning-fg)]">
                    Como Funciona
                  </h2>
                  <p className="text-xs text-[var(--state-warning-fg)] mt-1">
                    Fluxo colaborativo com validação prévia antes da gravação no banco.
                  </p>
                </div>
              </div>

              <ol className="space-y-4">
                {FLOW_STEPS.map((stepItem, index) => (
                  <li key={stepItem.title} className="relative pl-12">
                    {index < FLOW_STEPS.length - 1 && (
                      <span
                        aria-hidden="true"
                        className="absolute left-[15px] top-8 h-[calc(100%+8px)] w-[2px] bg-[var(--state-warning-bg)]"
                      />
                    )}
                    <span className="absolute left-0 top-0 flex h-8 w-8 items-center justify-center rounded-full bg-[var(--state-warning-bg)] text-xs font-black text-[var(--navy-block-fg)] shadow-sm">
                      {index + 1}
                    </span>
                    <p className="text-sm font-bold text-[var(--state-warning-fg)]">{stepItem.title}</p>
                    <p className="text-xs text-[var(--state-warning-fg)]">{stepItem.description}</p>
                  </li>
                ))}
              </ol>
            </div>
          </section>

          <section className="border-t border-[var(--line)] pt-8">
            <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[0_2px_12px_rgba(0,0,0,0.08)]">
              <div className="flex flex-col gap-4">
                {isAdmin && (
                  <div>
                    <label htmlFor="admin-nucleus-select" className="block text-[11px] font-black uppercase tracking-widest text-[var(--fg)] mb-1">
                      Núcleo da importação (admin)
                    </label>
                    <small className="block text-xs text-[var(--fg-muted)] mb-2">
                      Núcleo define se os termos entram como validação oficial ou como base informal de rigor editorial.
                    </small>
                    <select
                      id="admin-nucleus-select"
                      aria-label="Selecionar núcleo da importação administrativa"
                      value={adminNucleus}
                      onChange={(e) => setAdminNucleus(e.target.value as 'oficial' | 'artificio')}
                      className="w-full rounded-lg border border-[var(--state-warning-line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--fg)] transition-all duration-200 focus:border-[var(--state-warning-line)] focus:outline-none focus:ring-2 focus:ring-[var(--state-warning-line)]"
                    >
                      <option value="oficial">Oficial</option>
                      <option value="artificio">Informal (Rigor Artifício)</option>
                    </select>
                  </div>
                )}

                <div className="flex flex-wrap gap-3 items-center">
                  <button
                    id="download-import-template"
                    type="button"
                    aria-label="Baixar modelo de planilha Excel para importação de termos"
                    onClick={handleDownloadTemplate}
                    className="group inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[var(--state-warning-bg)] text-[var(--navy-block-fg)] text-xs font-bold uppercase tracking-wide transition-all duration-200 ease-out hover:bg-[var(--state-warning-bg)] hover:-translate-y-0.5 hover:shadow-[0_8px_18px_rgba(0,0,0,0.16)]"
                  >
                    <Download size={15} className="transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:rotate-12" />
                    Baixar modelo Excel (.xlsx)
                  </button>
                  <p className="text-xs text-[var(--fg-muted)]">
                    Dica: use o modelo para evitar falhas de coluna e acelerar o preview.
                  </p>
                </div>
              </div>

              {step === 'idle' && (
                <div
                  onDrop={handleDrop}
                  onDragOver={(e) => e.preventDefault()}
                  onClick={() => fileInputRef.current?.click()}
                  onKeyDown={handleDropZoneKeyDown}
                  role="button"
                  tabIndex={0}
                  aria-label="Área de envio de arquivo por arrastar e soltar ou clique para selecionar"
                  className="mt-6 border-2 border-dashed border-[var(--line)] rounded-xl p-10 sm:p-12 flex flex-col items-center justify-center gap-4 cursor-pointer hover:border-[var(--line-strong)] hover:bg-[var(--state-info-bg)] transition-all group"
                >
                  <div className="p-5 rounded-full bg-[var(--surface-subtle)] group-hover:bg-[var(--state-info-bg)] transition-colors">
                    <Upload size={32} className="text-[var(--fg-muted)] group-hover:text-[var(--fg)] transition-colors" />
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-[var(--fg)] text-sm">Arraste seu arquivo aqui</p>
                    <p className="text-[var(--fg-muted)] text-xs mt-1">ou clique para selecionar (.xlsx, .csv)</p>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.csv"
                    aria-label="Selecionar arquivo de planilha para importação"
                    className="hidden"
                    onChange={handleInputChange}
                  />
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Arquivo carregado — aguardando preview */}
        {step === 'parsed' && (
          <div className="mt-8 bg-[var(--surface)] rounded-xl border border-[var(--line)] shadow-[0_2px_12px_rgba(0,0,0,0.08)] p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-[var(--state-success-bg)] border border-[var(--state-success-line)]">
                <FileSpreadsheet size={24} className="text-[var(--state-success-fg)]" />
              </div>
              <div>
                <p className="font-bold text-[var(--fg)] text-sm">{fileName}</p>
                <p className="text-[var(--fg-muted)] text-xs">{parsedTerms.length} termos detectados</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-2 rounded-lg border border-[var(--line)] text-[var(--fg-muted)] text-xs font-bold uppercase tracking-wide hover:bg-[var(--surface-subtle)] transition-colors"
              >
                Trocar arquivo
              </button>
              <button
                type="button"
                onClick={handlePreview}
                disabled={isLoading}
                aria-label="Analisar planilha e gerar preview da importação"
                className="flex items-center gap-2 px-5 py-2 rounded-lg bg-[var(--btn-primary-bg)] text-[var(--btn-primary-fg)] text-xs font-bold uppercase tracking-wide transition-all duration-200 ease-out hover:bg-[var(--btn-primary-bg-hover)] hover:-translate-y-0.5 hover:shadow-[0_8px_18px_rgba(0,0,0,0.16)] disabled:opacity-50"
              >
                {isLoading ? 'Analisando...' : 'Analisar e ver preview'}
              </button>
            </div>
          </div>
        )}

        {/* Preview */}
        {step === 'previewing' && (
          <div className="mt-8 bg-[var(--surface)] rounded-xl border border-[var(--line)] shadow-[0_2px_12px_rgba(0,0,0,0.08)] p-6">
            <h2 className="text-sm font-black uppercase tracking-widest text-[var(--fg)] mb-5">
              Preview da importação — {fileName}
            </h2>
            <ImportPreview
              rows={previewRows}
              onConfirm={handleConfirm}
              onCancel={handleReset}
              isLoading={isLoading}
            />
          </div>
        )}

        {/* Concluído */}
        {step === 'done' && summary && (
          <div className="mt-8 bg-[var(--surface)] rounded-xl border border-[var(--state-success-line)] shadow-[0_2px_12px_rgba(0,0,0,0.08)] p-8 text-center space-y-4">
            <div className="flex justify-center">
              <div className="p-4 rounded-full bg-[var(--state-success-bg)] border border-[var(--state-success-line)]">
                <CheckCircle2 size={36} className="text-[var(--state-success-fg)]" />
              </div>
            </div>
            <h2 className="text-xl font-black text-[var(--fg)] uppercase tracking-tight">
              Importação concluída!
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-xl mx-auto">
              <div className="bg-[var(--state-success-bg)] rounded-xl p-3 border border-[var(--state-success-line)]">
                <p className="text-2xl font-black text-[var(--state-success-fg)]">{summary.inserted}</p>
                <p className="text-[10px] text-[var(--fg-muted)] uppercase tracking-widest">Inseridos</p>
              </div>
              <div className="bg-[var(--state-info-bg)] rounded-xl p-3 border border-[var(--state-info-line)]">
                <p className="text-2xl font-black text-[var(--state-info-fg)]">{summary.updated}</p>
                <p className="text-[10px] text-[var(--fg-muted)] uppercase tracking-widest">Atualizados</p>
              </div>
              <div className="bg-[var(--state-info-bg)] rounded-xl p-3 border border-[var(--state-info-line)]">
                <p className="text-2xl font-black text-[var(--state-info-fg)]">{summary.overrides ?? 0}</p>
                <p className="text-[10px] text-[var(--fg-muted)] uppercase tracking-widest">Override</p>
              </div>
              <div className="bg-[var(--state-warning-bg)] rounded-xl p-3 border border-[var(--state-warning-line)]">
                <p className="text-2xl font-black text-[var(--state-warning-fg)]">{summary.duplicates}</p>
                <p className="text-[10px] text-[var(--fg-muted)] uppercase tracking-widest">Sugestões</p>
              </div>
            </div>
            <p className="text-xs text-[var(--fg-muted)]">
              {isAdmin
                ? 'Importação administrativa aplicada com atualização imediata dos termos.'
                : 'Os termos pendentes aguardam revisão de um administrador.'}
            </p>
            <button
              type="button"
              onClick={handleReset}
              aria-label="Iniciar uma nova importação de termos"
              className="mt-2 px-5 py-2 rounded-lg bg-[var(--btn-primary-bg)] text-[var(--btn-primary-fg)] text-xs font-bold uppercase tracking-wide transition-all duration-200 ease-out hover:bg-[var(--btn-primary-bg-hover)] hover:-translate-y-0.5 hover:shadow-[0_8px_18px_rgba(0,0,0,0.16)]"
            >
              Nova importação
            </button>
          </div>
        )}

        {/* Erro */}
        {error && (
          <div className="mt-4 flex items-start gap-3 p-4 rounded-xl bg-[var(--state-danger-bg)] border border-[var(--state-danger-line)] text-[var(--state-danger-fg)] text-sm">
            <AlertCircle size={16} className="shrink-0 mt-0.5 text-[var(--state-danger-fg)]" />
            <p>{error}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImportPage;
