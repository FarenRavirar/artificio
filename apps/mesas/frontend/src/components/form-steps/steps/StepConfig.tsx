import { useEffect } from 'react';
import type { ChangeEvent, Dispatch, InputHTMLAttributes, SelectHTMLAttributes, SetStateAction } from 'react';
import { useVttPlatforms } from '../../../hooks/useVttPlatforms'; // CORREÇÃO B02: Import hook VTT
import { useCommunicationPlatforms } from '../../../hooks/useCommunicationPlatforms';
import type { BasicFormData } from '../../../features/create-table/types/createTable.types';

interface StepConfigProps {
  form: BasicFormData;
  setForm: Dispatch<SetStateAction<BasicFormData>>;
  publisherRole: 'gm' | 'announcer';
  setPublisherRole: (role: 'gm' | 'announcer') => void;
  actualGmName: string;
  setActualGmName: (name: string) => void;
  vttPlatformId: string;
  setVttPlatformId: (id: string) => void;
  gamePlatformCustom: string;
  setGamePlatformCustom: (name: string) => void;
  communicationPlatformId: string;
  setCommunicationPlatformId: (id: string) => void;
  communicationPlatformCustom: string;
  setCommunicationPlatformCustom: (platform: string) => void;
}

function InputField({ label, id, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-white/70">{label}</label>
      <input
        id={id}
        {...props}
        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 outline-none focus:border-[var(--color-artificio-orange)]/60 focus:ring-1 focus:ring-[var(--color-artificio-orange)]/30 transition-all"
      />
    </div>
  );
}

function SelectField({ label, id, children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-white/70">{label}</label>
      <select
        id={id}
        {...props}
        className="app-select w-full px-4 py-3"
      >
        {children}
      </select>
    </div>
  );
}

export function StepConfig({
  form,
  setForm,
  publisherRole,
  setPublisherRole,
  actualGmName,
  setActualGmName,
  vttPlatformId,
  setVttPlatformId,
  gamePlatformCustom,
  setGamePlatformCustom,
  communicationPlatformId,
  setCommunicationPlatformId,
  communicationPlatformCustom,
  setCommunicationPlatformCustom,
}: StepConfigProps) {
  // CORREÇÃO B02: Consumir hook para renderizar VTTs dinamicamente
  const { platforms: vttPlatforms, loading: loadingVtts, error: errorVtts } = useVttPlatforms();
  const {
    platforms: communicationPlatforms,
    loading: loadingCommunicationPlatforms,
    error: errorCommunicationPlatforms,
  } = useCommunicationPlatforms();

  // CORREÇÃO G05: Resetar vttPlatformId se erro ao carregar VTTs
  useEffect(() => {
    if (errorVtts && vttPlatformId && vttPlatformId !== 'custom') {
      console.warn('[StepConfig] Erro ao carregar VTTs, resetando seleção');
      setVttPlatformId('');
    }
  }, [errorVtts, vttPlatformId, setVttPlatformId]);

  // Compatibilidade edição: API pode retornar UUID em vtt_platform_id,
  // enquanto o select de VTT usa slug.
  useEffect(() => {
    if (!vttPlatformId || vttPlatformId === 'custom') return;
    if (loadingVtts || vttPlatforms.length === 0) return;

    const alreadySlug = vttPlatforms.some((platform) => platform.slug === vttPlatformId);
    if (alreadySlug) return;

    const matchedById = vttPlatforms.find((platform) => platform.id === vttPlatformId);
    if (matchedById) {
      setVttPlatformId(matchedById.slug);
    }
  }, [vttPlatformId, loadingVtts, vttPlatforms, setVttPlatformId]);

  useEffect(() => {
    if (errorCommunicationPlatforms && communicationPlatformId && communicationPlatformId !== 'custom') {
      console.warn('[StepConfig] Erro ao carregar plataformas de comunicação, resetando seleção');
      setCommunicationPlatformId('');
    }
  }, [
    errorCommunicationPlatforms,
    communicationPlatformId,
    setCommunicationPlatformId,
  ]);

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const isOnline = form.modality === 'online' || form.modality === 'hibrida';

  return (
    <div className="space-y-6">
      {/* Publisher Role */}
      <div className="rounded-2xl border border-white/10 bg-[#13213f]/60 p-4 space-y-3">
        <div>
          <p className="text-sm font-semibold text-white">Quem está publicando esta mesa?</p>
          <p className="text-xs text-white/60 mt-1">Você pode publicar como mestre narrador ou como apenas anunciante.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label
            htmlFor="publisher-role-gm"
            className={`rounded-xl border p-3 cursor-pointer transition-colors ${
              publisherRole === 'gm'
                ? 'border-[var(--color-artificio-orange)] bg-[var(--color-artificio-orange)]/10'
                : 'border-white/15 bg-white/5 hover:border-white/30'
            }`}
          >
            <input
              id="publisher-role-gm"
              type="radio"
              name="publisher_role"
              className="sr-only"
              checked={publisherRole === 'gm'}
              onChange={() => setPublisherRole('gm')}
            />
            <p className="text-sm font-semibold">Sou o mestre desta mesa</p>
            <p className="text-xs text-white/60 mt-1">Sem selo de anunciante.</p>
          </label>

          <label
            htmlFor="publisher-role-announcer"
            className={`rounded-xl border p-3 cursor-pointer transition-colors ${
              publisherRole === 'announcer'
                ? 'border-[var(--color-artificio-orange)] bg-[var(--color-artificio-orange)]/10'
                : 'border-white/15 bg-white/5 hover:border-white/30'
            }`}
          >
            <input
              id="publisher-role-announcer"
              type="radio"
              name="publisher_role"
              className="sr-only"
              checked={publisherRole === 'announcer'}
              onChange={() => setPublisherRole('announcer')}
            />
            <p className="text-sm font-semibold">Sou apenas anunciante</p>
            <p className="text-xs text-white/60 mt-1">A mesa exibirá o selo "Apenas anunciante".</p>
          </label>
        </div>

        {publisherRole === 'announcer' && (
          <InputField
            label="Nome do mestre real *"
            id="actual-gm-name"
            name="actual_gm_name"
            value={actualGmName}
            onChange={(event) => setActualGmName(event.target.value)}
            placeholder="Ex: Mestre Arandur"
            required
          />
        )}
      </div>

      {/* Configurações básicas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SelectField label="Tipo de Mesa *" id="type" name="type" value={form.type} onChange={handleChange}>
          <option value="campanha">Campanha</option>
          <option value="one-shot">One-Shot</option>
          <option value="oneshot-serie">One-Shot em Série</option>
          <option value="aberta">Mesa Aberta</option>
        </SelectField>

        <SelectField label="Modalidade *" id="modality" name="modality" value={form.modality} onChange={handleChange}>
          <option value="online">Online</option>
          <option value="presencial">Presencial</option>
          <option value="hibrida">Híbrida</option>
        </SelectField>

        {/* Plataformas (apenas para online/híbrida) */}
        {isOnline && (
          <>
            <SelectField
              label="Plataforma de Jogo (VTT)"
              id="vtt_platform_id"
              name="vtt_platform_id"
              value={vttPlatformId}
              onChange={(e) => setVttPlatformId(e.target.value)}
              disabled={loadingVtts}
            >
              <option value="">
                {loadingVtts ? 'Carregando plataformas...' : 'Selecione a plataforma'}
              </option>
              {/* CORREÇÃO B02: Renderizar VTTs dinamicamente do banco */}
              {!loadingVtts && !errorVtts && vttPlatforms.map((platform) => (
                <option 
                  key={platform.id} 
                  value={platform.slug}
                  title={platform.name}
                >
                  {platform.name}
                </option>
              ))}
              <option value="custom" title="Plataforma personalizada ou outra não listada">✏️ Personalizado</option>
            </SelectField>
            {/* CORREÇÃO B02: Exibir erro se falhar ao carregar VTTs */}
            {errorVtts && (
              <p className="text-xs text-red-400 mt-1">
                ⚠️ Erro ao carregar plataformas. Você pode usar a opção "Personalizado".
              </p>
            )}

            {/* Campo customizado quando seleciona "Personalizado" */}
            {vttPlatformId === 'custom' && (
              <>
                <InputField
                  label="Nome da Plataforma Personalizada"
                  id="game_platform_custom"
                  name="game_platform_custom"
                  value={gamePlatformCustom}
                  onChange={(e) => setGamePlatformCustom(e.target.value)}
                  placeholder="Ex: Teatro da Mente, Plataforma própria"
                  required
                />
                {/* CORREÇÃO D05: Feedback visual de campo obrigatório */}
                {!gamePlatformCustom && (
                  <p className="text-xs text-amber-400 mt-1">
                    ⚠️ Este campo é obrigatório quando você seleciona "Personalizado"
                  </p>
                )}
              </>
            )}

            <SelectField
              label="Plataforma de Comunicação"
              id="communication_platform_id"
              name="communication_platform_id"
              value={communicationPlatformId}
              onChange={(e) => setCommunicationPlatformId(e.target.value)}
              disabled={loadingCommunicationPlatforms}
            >
              <option value="">
                {loadingCommunicationPlatforms ? 'Carregando plataformas...' : 'Selecione a plataforma'}
              </option>
              {!loadingCommunicationPlatforms && !errorCommunicationPlatforms && communicationPlatforms.map((platform) => (
                <option
                  key={platform.id}
                  value={platform.id}
                  title={platform.name}
                >
                  {platform.name}
                </option>
              ))}
              <option value="custom" title="Plataforma personalizada ou outra não listada">✏️ Personalizado</option>
            </SelectField>

            {errorCommunicationPlatforms && (
              <p className="text-xs text-red-400 mt-1">
                ⚠️ Erro ao carregar plataformas de comunicação. Você pode usar a opção "Personalizado".
              </p>
            )}

            {communicationPlatformId === 'custom' && (
              <>
                <InputField
                  label="Plataforma de Comunicação Personalizada"
                  id="communication_platform_custom"
                  name="communication_platform_custom"
                  value={communicationPlatformCustom}
                  onChange={(e) => setCommunicationPlatformCustom(e.target.value)}
                  placeholder="Ex: Discord da comunidade, TeamSpeak"
                  required
                />
                {!communicationPlatformCustom && (
                  <p className="text-xs text-amber-400 mt-1">
                    ⚠️ Este campo é obrigatório quando você seleciona "Personalizado"
                  </p>
                )}
              </>
            )}
          </>
        )}

        <SelectField label="Faixa Etária *" id="age_rating" name="age_rating" value={form.age_rating} onChange={handleChange}>
          <option value="livre">🟢 Livre (Todos os públicos)</option>
          <option value="+10">🟡 +10 anos</option>
          <option value="+12">🟡 +12 anos</option>
          <option value="+14">🟠 +14 anos</option>
          <option value="+16">🟠 +16 anos</option>
          <option value="+18">🔴 +18 anos</option>
        </SelectField>

        <SelectField label="Cobrança" id="price_type" name="price_type" value={form.price_type} onChange={handleChange}>
          <option value="gratuita">Gratuita</option>
          <option value="paga">Paga</option>
        </SelectField>

        {form.price_type === 'paga' && (
          <InputField
            label="Valor (R$)"
            id="price_value"
            name="price_value"
            type="number"
            min="0"
            step="0.01"
            value={form.price_value}
            onChange={handleChange}
            placeholder="Ex: 25.00"
          />
        )}

        <SelectField
          label="Nível de Experiência do Jogador"
          id="experience_level"
          name="experience_level"
          value={form.experience_level}
          onChange={handleChange}
        >
          <option value="todos">Todos os Níveis</option>
          <option value="iniciante">Iniciante</option>
          <option value="intermediario">Intermediário</option>
          <option value="veterano">Veterano</option>
        </SelectField>

        <SelectField
          label="Nível de Complexidade da Mesa"
          id="table_level"
          name="table_level"
          value={form.table_level}
          onChange={handleChange}
        >
          <option value="todos">Todos os Níveis</option>
          <option value="iniciante">Iniciante (regras simples)</option>
          <option value="intermediario">Intermediário</option>
          <option value="avancado">Avançado (regras complexas)</option>
        </SelectField>

        <InputField
          label="Idioma"
          id="language"
          name="language"
          value={form.language}
          onChange={handleChange}
          placeholder="Português"
        />
      </div>
    </div>
  );
}
