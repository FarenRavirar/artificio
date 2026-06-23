import { useCallback, useEffect, useRef, useState, type DragEvent, type ChangeEvent } from 'react';
import toast from 'react-hot-toast';
import { discordSyncApi } from '../api/discordSyncApi';

export type ImportState = 'empty' | 'previewing' | 'preview_ok' | 'preview_error' | 'sending' | 'success' | 'error';

export interface ImportResult {
  total: number;
  inserted: number;
  updated: number;
  ignored: number;
  failed: number;
}

export interface PreviewResult {
  guild: { id: string; name: string };
  channel: { id: string; name: string };
  dateRange: { after?: string; before?: string } | null;
  exportedAt: string | null;
  messageCount: number;
  totalAttachments: number;
  totalEmbeds: number;
}

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function useJsonImport() {
  const [rawJson, setRawJson] = useState('');
  const [state, setState] = useState<ImportState>('empty');
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadPreview = useCallback(async (json: string) => {
    if (!json.trim()) {
      setState('empty');
      setPreview(null);
      return;
    }

    setState('previewing');
    setPreview(null);
    setErrorMessage('');

    try {
      const data = await discordSyncApi.previewJson({ json });
      setPreview(data);
      setState('preview_ok');
    } catch (err) {
      setPreview(null);
      setState('preview_error');
      setErrorMessage(err instanceof Error ? err.message : 'Erro ao analisar JSON.');
    }
  }, []);

  const schedulePreview = useCallback((value: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => loadPreview(value), 400);
    setRawJson(value);
  }, [loadPreview]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleChange = useCallback((value: string) => {
    schedulePreview(value);
  }, [schedulePreview]);

  const handleSubmit = useCallback(async () => {
    if (!rawJson.trim()) return;

    setState('sending');
    setErrorMessage('');

    try {
      const data = await discordSyncApi.importJson({ json: rawJson });
      setResult(data);
      setState('success');
      toast.success(`${data.inserted} mensagens importadas, ${data.updated} atualizadas.`);
    } catch (err) {
      setState('error');
      setErrorMessage(err instanceof Error ? err.message : 'Erro ao importar JSON.');
    }
  }, [rawJson]);

  const handleClear = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setRawJson('');
    setState('empty');
    setPreview(null);
    setResult(null);
    setErrorMessage('');
  }, []);

  const showFileError = useCallback((msg: string) => {
    setPreview(null);
    setState('error');
    setErrorMessage(msg);
  }, []);

  const handleFileSelect = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) return;

    if (!file.name.endsWith('.json')) {
      showFileError('Formato inválido. Selecione um arquivo .json.');
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      showFileError(`Arquivo muito grande (${formatFileSize(file.size)}). O limite é 10 MB.`);
      return;
    }

    file.text()
      .then((content) => {
        schedulePreview(content);
      })
      .catch(() => {
        showFileError('Erro ao ler o arquivo. Tente novamente.');
      });
  }, [schedulePreview, showFileError]);

  const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(false);

    const file = event.dataTransfer.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      showFileError('Formato inválido. Solte apenas arquivos .json.');
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      showFileError(`Arquivo muito grande (${formatFileSize(file.size)}). O limite é 10 MB.`);
      return;
    }

    file.text()
      .then((content) => {
        schedulePreview(content);
      })
      .catch(() => {
        showFileError('Erro ao ler o arquivo. Tente novamente.');
      });
  }, [schedulePreview, showFileError]);

  return {
    rawJson, state, preview, result, errorMessage, isDragOver,
    fileInputRef,
    handleChange, handleSubmit, handleClear,
    handleFileSelect, handleDragOver, handleDragLeave, handleDrop,
  };
}
