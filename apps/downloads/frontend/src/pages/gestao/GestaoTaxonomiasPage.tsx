import { GestaoShell } from '../../components/GestaoShell';

// T1.1 (spec 075) — taxonomias (system_id/edition_id/material_type/etc.)
// pertencem ao catalogo central do Site/062 (D021/D046 — sistemas/edicoes
// nunca copiados localmente); esta tela e so o placeholder de destino
// interno enquanto material_type/access_kind seguem enum fixo no proprio
// downloads (nao ha taxonomia editavel local hoje).
export function GestaoTaxonomiasPage() {
  return (
    <GestaoShell>
      <h1 className="text-2xl font-bold text-[var(--fg)]">Taxonomias</h1>
      <p className="mt-4 text-[var(--fg-muted)]">
        Sistemas e edições são geridos no Site (link "Sistemas e edições" na sidebar). material_type/access_kind são enums
        fixos no backend do downloads, sem taxonomia editável local hoje.
      </p>
    </GestaoShell>
  );
}
