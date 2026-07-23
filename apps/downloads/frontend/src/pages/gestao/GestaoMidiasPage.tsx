import { GestaoShell } from '../../components/GestaoShell';

// T1.1 (spec 075) — mídias: sem tabela propria de midia/imagem de capa hoje
// (D106/spec 061 previu derivado Cloudinary de capa, ainda nao implementado
// em nenhum app de downloads); placeholder ate existir dado real.
export function GestaoMidiasPage() {
  return (
    <GestaoShell>
      <h1 className="text-2xl font-bold text-[var(--fg)]">Mídias</h1>
      <p className="mt-4 text-[var(--fg-muted)]">
        Gestão de mídias (capas/imagens) ainda não tem dado real por trás — nenhuma tabela/rota de mídia foi implementada
        para o downloads nesta rodada (débito documentado).
      </p>
    </GestaoShell>
  );
}
