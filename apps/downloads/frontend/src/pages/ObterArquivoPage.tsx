import { AppShell } from '../components/AppShell';

// T4.1 (spec 073) — /obter/:fileId: download de arquivo hospedado
// (access_kind='managed_upload', storage 071). Upload/serving real de
// arquivo proprio ainda depende de credencial de provider (071 T6.2, sem
// credencial disponivel) — por ora so aviso, sem falha silenciosa.
export function ObterArquivoPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-white">Download indisponível no momento</h1>
        <p className="mt-2 text-white/70">
          O download direto de arquivos hospedados ainda está em preparação.
        </p>
      </div>
    </AppShell>
  );
}
