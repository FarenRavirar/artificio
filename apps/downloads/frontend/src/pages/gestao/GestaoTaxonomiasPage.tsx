import { GestaoShell } from '../../components/GestaoShell';

// T1.1 (spec 075) — taxonomias (system_id/edition_id/material_type/etc.)
// pertencem ao catalogo central do Site/062 (D021/D046 — sistemas/edicoes
// nunca copiados localmente); esta tela e so o placeholder de destino
// interno. Spec 086 moveu tipos de material para vocabulário Central
// ortogonal à árvore de sistemas; access_kind continua enum local.
export function GestaoTaxonomiasPage() {
  return (
    <GestaoShell>
      <h1 className="text-2xl font-bold text-[var(--fg)]">Taxonomias</h1>
      <p className="mt-4 text-[var(--fg-muted)]">
        Sistemas, edições e tipos de material usam o catálogo Central do Site. O Downloads lê tipos canônicos no cadastro;
        access_kind continua enum local do produto.
      </p>
    </GestaoShell>
  );
}
