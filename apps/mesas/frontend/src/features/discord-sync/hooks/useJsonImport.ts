import { useCallback, useEffect, useRef, useState, type DragEvent, type ChangeEvent } from 'react';
import toast from 'react-hot-toast';
import { discordSyncApi } from '../api/discordSyncApi';
import { formatFileSize } from '../draftFormUtils';

export type ImportState = 'empty' | 'previewing' | 'preview_ok' | 'preview_error' | 'sending' | 'success' | 'error';

export interface ImportResult {
  total: number;
  inserted: number;
  updated: number;
  ignored: number;
  failed: number;
  auto_parse: {
    total: number;
    parsed: number;
    discarded: number;
    ignored: number;
    errors: number;
  } | null;
}

export interface PreviewResult {
  guild: { id: string; name: string };
  channel: { id: string; name: string };
  dateRange: { after?: string | null; before?: string | null } | null;
  exportedAt: string | null;
  messageCount: number;
  totalAttachments: number;
  totalEmbeds: number;
}

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const FILE_TEXTAREA_THRESHOLD = 50 * 1024; // <50KB → textarea; >=50KB → backend

export function useJsonImport() {
  const [rawJson, setRawJson] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [state, setState] = useState<ImportState>('empty');
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewReqId = useRef(0);

  const importToastMessage = (data: ImportResult): string => {
    if (data.auto_parse) {
      return `${data.auto_parse.parsed} rascunhos gerados, ${data.auto_parse.discarded} descartados, ${data.auto_parse.ignored} inválidos.`;
    }
    return `${data.inserted} mensagens importadas, ${data.updated} atualizadas.`;
  };

  const loadPreview = useCallback(async (json: string) => {
    if (!json.trim()) {
      setState('empty');
      setPreview(null);
      return;
    }

    const reqId = ++previewReqId.current;
    setState('previewing');
    setPreview(null);
    setErrorMessage('');

    try {
      const data = await discordSyncApi.previewJson({ json });
      if (reqId !== previewReqId.current) return;
      setPreview(data);
      setState('preview_ok');
    } catch (err) {
      if (reqId !== previewReqId.current) return;
      setPreview(null);
      setState('preview_error');
      setErrorMessage(err instanceof Error ? err.message : 'Erro ao analisar JSON.');
    }
  }, []);

  const schedulePreview = useCallback((value: string) => {
    previewReqId.current++;
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
    if (selectedFile) {
      setState('sending');
      setErrorMessage('');
      try {
        const data = await discordSyncApi.importFile(selectedFile);
        setResult(data);
        setState('success');
        toast.success(importToastMessage(data));
      } catch (err) {
        setState('error');
        setErrorMessage(err instanceof Error ? err.message : 'Erro ao importar arquivo.');
      }
      return;
    }

    if (!rawJson.trim()) return;

    setState('sending');
    setErrorMessage('');

    try {
      const data = await discordSyncApi.importJson({ json: rawJson });
      setResult(data);
      setState('success');
      toast.success(importToastMessage(data));
    } catch (err) {
      setState('error');
      setErrorMessage(err instanceof Error ? err.message : 'Erro ao importar JSON.');
    }
  }, [selectedFile, rawJson]);

  const handleClear = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setRawJson('');
    setSelectedFile(null);
    setState('empty');
    setPreview(null);
    setResult(null);
    setErrorMessage('');
  }, []);

  const showFileError = useCallback((msg: string) => {
    setPreview(null);
    setState('preview_error');
    setErrorMessage(msg);
  }, []);

  const previewForFile = useCallback(async (file: File) => {
    // CodeRabbit: guard reqId p/ descartar resposta fora de ordem (trocar arquivo rápido).
    const reqId = ++previewReqId.current;
    setState('previewing');
    setPreview(null);
    setErrorMessage('');

    try {
      const data = await discordSyncApi.previewFile(file);
      if (reqId !== previewReqId.current) return;
      setPreview(data);
      setState('preview_ok');
    } catch (err) {
      if (reqId !== previewReqId.current) return;
      setPreview(null);
      setState('preview_error');
      setErrorMessage(err instanceof Error ? err.message : 'Erro ao analisar arquivo.');
    }
  }, []);

  // REV-016: helper DRY — elimina duplicação entre handleFileSelect e handleDrop
  const processJsonFile = useCallback((file: File, errorVerb: string): boolean => {
    if (!file.name.toLowerCase().endsWith('.json')) {
      showFileError(`Formato inválido. ${errorVerb} apenas arquivos .json.`);
      return false;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      showFileError(`Arquivo muito grande (${formatFileSize(file.size)}). O limite é 10 MB.`);
      return false;
    }
    if (file.size < FILE_TEXTAREA_THRESHOLD) {
      file.text()
        .then((content) => schedulePreview(content))
        .catch(() => showFileError('Erro ao ler o arquivo. Tente novamente.'));
      return true;
    }
    setSelectedFile(file);
    setRawJson('');
    previewForFile(file);
    return true;
  }, [schedulePreview, previewForFile, showFileError, setSelectedFile, setRawJson]);

  const handleFileSelect = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) return;

    processJsonFile(file, 'Selecione');
  }, [processJsonFile]);

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

    processJsonFile(file, 'Solte');
  }, [processJsonFile, setIsDragOver]);

  return {
    rawJson, selectedFile, state, preview, result, errorMessage, isDragOver,
    fileInputRef,
    handleChange, handleSubmit, handleClear,
    handleFileSelect, handleDragOver, handleDragLeave, handleDrop,
  };
}
