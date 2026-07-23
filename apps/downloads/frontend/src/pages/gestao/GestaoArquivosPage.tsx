import { useRef, useState } from 'react';
import { GestaoShell } from '../../components/GestaoShell';

// T6.2 (spec 075) — upload admin validando magic bytes reforcado, mesmo sem
// storage real conectado (DEB-073-03/071 T6.2: upload real bloqueado por
// falta de credencial de provider). Contrato aceito nominalmente pelo
// mantenedor: valida e persiste registro de evidencia, sem storage real.
export function GestaoArquivosPage() {
  const [materialId, setMaterialId] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleUpload() {
    const file = fileInputRef.current?.files?.[0];
    if (!materialId.trim() || !file) {
      setStatus('Informe o ID do material e escolha um arquivo.');
      return;
    }

    setIsUploading(true);
    try {
      const buffer = await file.arrayBuffer();
      // apiPost so serializa JSON; upload binario usa fetch direto.
      const raw = await fetch(
        `${import.meta.env.VITE_API_URL ?? ''}/api/v1/admin/materials/${materialId}/evidence/upload?filename=${encodeURIComponent(file.name)}`,
        { method: 'POST', credentials: 'include', body: buffer, headers: { 'Content-Type': 'application/octet-stream' } },
      );

      if (!raw.ok) {
        setStatus(`Falha: HTTP ${raw.status}`);
        return;
      }
      setStatus('Evidência registrada com sucesso.');
    } catch (error) {
      setStatus(error instanceof Error ? `Erro: ${error.message}` : 'Falha inesperada ao enviar arquivo.');
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <GestaoShell>
      <h1 className="text-2xl font-bold text-[var(--fg)]">Arquivos</h1>
      <p className="mt-2 text-sm text-[var(--fg-muted)]">
        Upload de evidência com validação real de tipo (magic bytes). Storage real de arquivo (071 T6.2) ainda depende de
        credencial de provider — este fluxo valida e registra a evidência, sem armazenar o binário.
      </p>

      <div className="mt-6 flex flex-col gap-3 sm:max-w-md">
        <input
          type="text"
          value={materialId}
          onChange={(e) => setMaterialId(e.target.value)}
          placeholder="ID do material"
          className="min-h-[44px] rounded-md border border-[var(--line)] bg-transparent px-3 py-2 text-sm text-[var(--fg)]"
        />
        <input ref={fileInputRef} type="file" accept=".pdf,.md,.doc,.docx" className="text-sm text-[var(--fg-muted)]" />
        <button
          type="button"
          onClick={() => handleUpload()}
          disabled={isUploading}
          className="min-h-[44px] rounded-md border border-[var(--line)] px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {isUploading ? 'Enviando...' : 'Enviar'}
        </button>
        {status && <p className="text-sm text-[var(--fg-muted)]">{status}</p>}
      </div>
    </GestaoShell>
  );
}
