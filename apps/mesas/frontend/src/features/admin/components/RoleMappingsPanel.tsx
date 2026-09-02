import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Button, Select, TextInput } from '@artificio/ui';
import { discordSyncApi, type RoleMapping, type RoleMappingKind } from '../../discord-sync/api/discordSyncApi';

/**
 * Revisão dos ids de role/emoji que o parser observou (spec 099).
 *
 * Por que esta tela existe: servidores marcam o sistema com ROLE em vez de
 * texto — o anúncio traz `Sistema: <@&1118328496721248347>` e nada mais. O
 * export do Chat Exporter não carrega o nome da role (medido em 2026-09-02:
 * `mentions: []` nos três arquivos reais), então o id sozinho não diz nada.
 *
 * O parser deduz o TIPO pelo rótulo da linha e propõe um valor a partir do
 * texto vizinho — `Sistema: D&D 2024 - <@&123>` entrega os dois de uma vez.
 * Mas proposta não vira dado sem passar por aqui: dado errado no draft é pior
 * que dado ausente, porque ninguém revisa o que já parece certo.
 */

const KIND_LABEL: Record<RoleMappingKind, string> = {
  system: 'Sistema',
  style: 'Estilo',
  setting: 'Ambientação',
  era: 'Época',
  letter: 'Letra (capitular)',
};

type Escopo = 'pendentes' | 'confirmados' | 'todos';

export function RoleMappingsPanel() {
  const [itens, setItens] = useState<RoleMapping[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [escopo, setEscopo] = useState<Escopo>('pendentes');
  const [salvandoId, setSalvandoId] = useState<string | null>(null);
  // Rascunho por linha: o admin edita o valor antes de confirmar, e o estado
  // não pode viver na lista (recarregar a lista apagaria o que ele digitou).
  const [rascunhos, setRascunhos] = useState<Record<string, { kind: RoleMappingKind; texto: string }>>({});

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      setItens(await discordSyncApi.listRoleMappings({ escopo }));
    } catch (err) {
      // Falha de rede não pode virar "nada a revisar": a lista vazia lê como
      // trabalho concluído e o admin nunca voltaria aqui.
      setErro(err instanceof Error ? err.message : 'Erro ao carregar mapeamentos.');
      setItens([]);
    } finally {
      setCarregando(false);
    }
  }, [escopo]);

  // `setTimeout(0)` tira o `setState` do corpo do efeito
  // (`react-hooks/set-state-in-effect`): a chamada síncrona encadeia render em
  // cascata. Mesmo padrão do `AdminUsersPanel` (linha 104).
  useEffect(() => {
    const timer = setTimeout(() => void carregar(), 0);
    return () => clearTimeout(timer);
  }, [carregar]);

  const rascunhoDe = (item: RoleMapping) =>
    rascunhos[item.id] ?? { kind: item.kind, texto: item.target_text ?? item.last_seen_text ?? '' };

  const editar = (id: string, patch: Partial<{ kind: RoleMappingKind; texto: string }>) => {
    setRascunhos((prev) => {
      const atual = prev[id] ?? { kind: 'style' as RoleMappingKind, texto: '' };
      return { ...prev, [id]: { ...atual, ...patch } };
    });
  };

  const confirmar = async (item: RoleMapping) => {
    const { kind, texto } = rascunhoDe(item);
    if (!texto.trim()) {
      toast.error('Informe o que este id significa antes de confirmar.');
      return;
    }
    setSalvandoId(item.id);
    try {
      await discordSyncApi.updateRoleMapping(item.id, { kind, target_text: texto.trim(), confirmar: true });
      toast.success(`${KIND_LABEL[kind]} "${texto.trim()}" confirmado.`);
      await carregar();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao confirmar.');
    } finally {
      setSalvandoId(null);
    }
  };

  const descartar = async (item: RoleMapping) => {
    // Apagar ≠ rejeitar: o id volta a ser desconhecido e o parser pode
    // reobservá-lo no próximo anúncio. Serve para limpar palpite errado.
    if (!globalThis.confirm('Apagar este mapeamento? O parser poderá observá-lo de novo.')) return;
    setSalvandoId(item.id);
    try {
      await discordSyncApi.deleteRoleMapping(item.id);
      toast.success('Mapeamento apagado.');
      await carregar();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao apagar.');
    } finally {
      setSalvandoId(null);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--fg-muted)]">
        Servidores marcam sistema e estilo com <strong>roles</strong> em vez de texto, e o export do
        Discord não traz o nome delas. O parser deduz o tipo pelo rótulo da linha e sugere o valor
        pelo texto ao lado — confirme aqui para que ele passe a usar no parse.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={escopo}
          onChange={(e) => setEscopo(e.target.value as Escopo)}
          aria-label="Filtrar mapeamentos"
        >
          <option value="pendentes">Pendentes de revisão</option>
          <option value="confirmados">Confirmados</option>
          <option value="todos">Todos</option>
        </Select>
        <Button type="button" variant="secondary" size="sm" onClick={() => void carregar()}>
          Recarregar
        </Button>
      </div>

      {erro && (
        <p className="text-sm text-[var(--state-danger-fg)]" role="alert">
          {erro}
        </p>
      )}

      {(() => {
        if (carregando) {
          return <p className="text-sm text-[var(--fg-muted)]">Carregando...</p>;
        }
        if (itens.length === 0 && !erro) {
          return (
            <p className="text-sm text-[var(--fg-muted)]">
              Nenhum mapeamento {escopo === 'pendentes' ? 'pendente' : 'encontrado'}.
            </p>
          );
        }
        return (
          <ul className="flex flex-col gap-3">
            {itens.map((item) => {
              const rascunho = rascunhoDe(item);
              return (
                <li
                  key={item.id}
                  className="flex flex-col gap-2 rounded-lg border border-[var(--line)] p-3"
                >
                  <div className="flex flex-wrap items-baseline gap-2 text-xs text-[var(--fg-muted)]">
                    <span className="rounded bg-[var(--fill)] px-2 py-0.5 font-mono">
                      {item.source_type === 'role' ? '@role' : 'emoji'} {item.discord_id}
                    </span>
                    {/* Frequência é o que ordena o trabalho: id que aparece 26
                        vezes decide mais anúncios que um que apareceu 1. */}
                    <span>{item.occurrences}× visto</span>
                    {item.confirmed_at && <span className="text-[var(--state-success-fg)]">confirmado</span>}
                  </div>

                  {item.last_seen_text && (
                    <p className="text-sm">
                      <span className="text-[var(--fg-muted)]">Visto ao lado de: </span>
                      <strong>{item.last_seen_text}</strong>
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-2">
                    <Select
                      value={rascunho.kind}
                      onChange={(e) => editar(item.id, { kind: e.target.value as RoleMappingKind })}
                      aria-label="Tipo do mapeamento"
                    >
                      {(Object.keys(KIND_LABEL) as RoleMappingKind[]).map((k) => (
                        <option key={k} value={k}>
                          {KIND_LABEL[k]}
                        </option>
                      ))}
                    </Select>
                    <TextInput
                      value={rascunho.texto}
                      onChange={(e) => editar(item.id, { texto: e.target.value })}
                      placeholder="O que este id significa"
                      aria-label="Significado do id"
                      className="min-w-56 flex-1"
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => void confirmar(item)}
                      disabled={salvandoId === item.id}
                    >
                      {salvandoId === item.id ? 'Salvando...' : 'Confirmar'}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => void descartar(item)}
                      disabled={salvandoId === item.id}
                    >
                      Apagar
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        );
      })()}
    </div>
  );
}
