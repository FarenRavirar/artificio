import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Button, Select, TextInput } from '@artificio/ui';
import {
  discordSyncApi,
  type RoleMapping,
  type RoleMappingKind,
  type SystemOption,
} from '../../discord-sync/api/discordSyncApi';

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

/** Edição em curso de uma linha. `systemId` só é usado quando `kind === 'system'`. */
interface Rascunho {
  kind: RoleMappingKind;
  texto: string;
  systemId: string;
}

export function RoleMappingsPanel() {
  const [itens, setItens] = useState<RoleMapping[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [escopo, setEscopo] = useState<Escopo>('pendentes');
  const [salvandoId, setSalvandoId] = useState<string | null>(null);
  // Rascunho por linha: o admin edita o valor antes de confirmar, e o estado
  // não pode viver na lista (recarregar a lista apagaria o que ele digitou).
  const [rascunhos, setRascunhos] = useState<Record<string, Rascunho>>({});
  // Catálogo para o seletor de sistema. Carregado uma vez: a fila costuma ter poucos
  // itens e refazer a busca por linha multiplicaria requisição sem ganho.
  // Busca de sistema POR LINHA, não catálogo carregado de uma vez: são 1289 sistemas
  // (medido em beta, 2026-09-02) e a rota devolve 20 por página — um `<Select>` fixo
  // deixava 98% do catálogo inalcançável e o vínculo impossível de confirmar para
  // quase todos os sistemas. Achado do Codex (P1).
  const [buscaSistema, setBuscaSistema] = useState<Record<string, string>>({});
  const [achados, setAchados] = useState<Record<string, SystemOption[]>>({});
  const [buscando, setBuscando] = useState<string | null>(null);

  // Geração da requisição: trocar o filtro rápido dispara cargas concorrentes, e a que
  // chega por último vence — não a mais recente. Sem esta guarda, uma resposta lenta de
  // "pendentes" sobrescreveria a lista de "confirmados" que o admin acabou de pedir.
  // Achado do CodeRabbit.
  const geracaoRef = useRef(0);
  const buscaTimer = useRef<Record<string, number>>({});
  const buscaCtrl = useRef<Record<string, AbortController>>({});

  const carregar = useCallback(async () => {
    const minhaGeracao = ++geracaoRef.current;
    setCarregando(true);
    setErro(null);
    try {
      const dados = await discordSyncApi.listRoleMappings({ escopo });
      if (minhaGeracao !== geracaoRef.current) return;
      setItens(dados);
    } catch (err) {
      if (minhaGeracao !== geracaoRef.current) return;
      // Falha de rede não pode virar "nada a revisar": a lista vazia lê como
      // trabalho concluído e o admin nunca voltaria aqui.
      setErro(err instanceof Error ? err.message : 'Erro ao carregar mapeamentos.');
      setItens([]);
    } finally {
      // `carregando` só é liberado pela requisição vigente: a obsoleta desligando o
      // spinner deixaria a tela "pronta" enquanto a atual ainda vem.
      if (minhaGeracao === geracaoRef.current) setCarregando(false);
    }
  }, [escopo]);

  // `setTimeout(0)` tira o `setState` do corpo do efeito
  // (`react-hooks/set-state-in-effect`): a chamada síncrona encadeia render em
  // cascata. Mesmo padrão do `AdminUsersPanel` (linha 104).
  useEffect(() => {
    const timer = setTimeout(() => void carregar(), 0);
    return () => clearTimeout(timer);
  }, [carregar]);

  // Busca sob demanda, com debounce: digitar o nome filtra no servidor em vez de
  // paginar 1289 sistemas no cliente. Falha aqui NÃO derruba a fila — os outros tipos
  // (estilo, época, letra) seguem confirmáveis por texto.
  const buscarSistemas = useCallback((itemId: string, termo: string) => {
    setBuscaSistema((prev) => ({ ...prev, [itemId]: termo }));
    if (termo.trim().length < 2) {
      setAchados((prev) => ({ ...prev, [itemId]: [] }));
      return;
    }
    setBuscando(itemId);
    const ctrl = new AbortController();
    buscaCtrl.current[itemId]?.abort();
    buscaCtrl.current[itemId] = ctrl;
    window.clearTimeout(buscaTimer.current[itemId]);
    buscaTimer.current[itemId] = window.setTimeout(() => {
      void discordSyncApi
        .searchSystems(termo.trim(), ctrl.signal)
        .then((r) => setAchados((prev) => ({ ...prev, [itemId]: r })))
        .catch(() => setAchados((prev) => ({ ...prev, [itemId]: [] })))
        .finally(() => setBuscando((atual) => (atual === itemId ? null : atual)));
    }, 300);
  }, []);

  // Desmontar com busca em voo deixaria timer e requisição pendentes escrevendo em
  // estado morto. As refs são lidas dentro do cleanup, no momento em que ele roda.
  useEffect(() => {
    const timers = buscaTimer.current;
    const ctrls = buscaCtrl.current;
    return () => {
      Object.values(timers).forEach((t) => window.clearTimeout(t));
      Object.values(ctrls).forEach((c) => c.abort());
    };
  }, []);

  const rascunhoDe = (item: RoleMapping): Rascunho =>
    rascunhos[item.id] ?? {
      kind: item.kind,
      texto: item.target_text ?? item.last_seen_text ?? '',
      systemId: item.target_system_id ?? '',
    };

  const editar = (id: string, patch: Partial<Rascunho>) => {
    setRascunhos((prev) => {
      const atual = prev[id] ?? { kind: 'style' as RoleMappingKind, texto: '', systemId: '' };
      return { ...prev, [id]: { ...atual, ...patch } };
    });
  };

  const confirmar = async (item: RoleMapping) => {
    const { kind, texto, systemId } = rascunhoDe(item);

    // O alvo depende do tipo, porque a constraint da migration os separa:
    // `kind='system'` guarda o UUID (`target_text` obrigatoriamente NULL), todo o resto
    // guarda texto. Mandar texto para 'system' devolvia 400 e tornava o caso central da
    // feature (`Sistema: <@&id>`) impossível de confirmar. Achado do Codex (P1).
    const ehSistema = kind === 'system';
    if (ehSistema && !systemId) {
      toast.error('Escolha o sistema do catálogo antes de confirmar.');
      return;
    }
    if (!ehSistema && !texto.trim()) {
      toast.error('Informe o que este id significa antes de confirmar.');
      return;
    }

    const alvo = ehSistema
      ? { target_system_id: systemId, target_text: null }
      : { target_system_id: null, target_text: texto.trim() };
    const rotulo = ehSistema
      ? ((achados[item.id] ?? []).find((x) => x.id === systemId)?.name ?? 'sistema')
      : texto.trim();

    setSalvandoId(item.id);
    try {
      await discordSyncApi.updateRoleMapping(item.id, { kind, ...alvo, confirmar: true });
      toast.success(`${KIND_LABEL[kind]} "${rotulo}" confirmado.`);
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

                  {/* Sem isto, um vínculo de sistema já confirmado aparecia sem alvo
                      visível: o nome não está em `target_text` (a constraint o proíbe),
                      e a linha lia como se nada tivesse sido decidido. */}
                  {item.target_system_name && (
                    <p className="text-sm">
                      <span className="text-[var(--fg-muted)]">Sistema vinculado: </span>
                      <strong>{item.target_system_name}</strong>
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
                    {rascunho.kind === 'system' ? (
                      <div className="min-w-56 flex-1">
                        <TextInput
                          value={buscaSistema[item.id] ?? ''}
                          onChange={(e) => buscarSistemas(item.id, e.target.value)}
                          placeholder="Buscar sistema no catálogo..."
                          aria-label="Buscar sistema do catálogo"
                          className="w-full"
                        />
                        {rascunho.systemId && (
                          <p className="mt-1 text-xs text-[var(--state-success-fg)]">
                            Selecionado: {(achados[item.id] ?? []).find((x) => x.id === rascunho.systemId)?.name
                              ?? item.target_system_name
                              ?? rascunho.systemId}
                          </p>
                        )}
                        {buscando === item.id && (
                          <p className="mt-1 text-xs text-[var(--fg-muted)]">Buscando...</p>
                        )}
                        {(achados[item.id] ?? []).length > 0 && (
                          <ul className="mt-1 max-h-40 overflow-y-auto rounded border border-[var(--line)]">
                            {(achados[item.id] ?? []).map((sis) => (
                              <li key={sis.id}>
                                <button
                                  type="button"
                                  onClick={() => editar(item.id, { systemId: sis.id })}
                                  className={`w-full px-2 py-1 text-left text-sm hover:bg-[var(--fill)] ${
                                    rascunho.systemId === sis.id ? 'bg-[var(--fill)] font-semibold' : ''
                                  }`}
                                >
                                  {sis.name}
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                        {/* Termo curto demais para buscar: dizer isso evita que a lista
                            vazia leia como "não existe sistema com esse nome". */}
                        {(buscaSistema[item.id] ?? '').trim().length === 1 && (
                          <p className="mt-1 text-xs text-[var(--fg-muted)]">
                            Digite ao menos 2 letras.
                          </p>
                        )}
                      </div>
                    ) : (
                      <TextInput
                        value={rascunho.texto}
                        onChange={(e) => editar(item.id, { texto: e.target.value })}
                        placeholder="O que este id significa"
                        aria-label="Significado do id"
                        className="min-w-56 flex-1"
                      />
                    )}
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
