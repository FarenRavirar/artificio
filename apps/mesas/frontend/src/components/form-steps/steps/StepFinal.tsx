import { useState, useEffect } from 'react';
import { Crown, ShieldCheck } from 'lucide-react';
// REMOVIDO: bannerPlaceholder (modo review desacoplado)
import { SettingStylesField } from '../../SettingStylesField';
import { ContactsFormBlock, type ContactFormEntry } from '../../ContactsFormBlock';
import { MarkdownEditor } from '../../MarkdownEditor';
import { ImageUploader } from '../../ImageUploader';
import type {
  ChangeEvent,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from 'react';


interface DdalFormState {
  is_ddal: boolean;
  ddal_code: string;
  ddal_name: string;
  ddal_tier: string;
  ddal_season: string;
  ddal_duration: string;
  ddal_format: string;
  ddal_org_code: string;
  ddal_setting: string;
  ddal_rules_notes: string;
}

interface StepFinalProps {
  selectedScenarioName?: string | null;
  rulesNotes: string;
  setRulesNotes: (notes: string) => void;
  bannerUrl: string;
  setBannerUrl: (url: string) => void;
  bannerCropData: { x: number; y: number; width: number; height: number } | null;
  setBannerCropData: (data: { x: number; y: number; width: number; height: number } | null) => void;
  bannerError: boolean;
  setBannerError: (error: boolean) => void;
  gmAvatarUrl: string;
  setGmAvatarUrl: (url: string) => void;
  avatarError: boolean;
  setAvatarError: (error: boolean) => void;
  isCovilMesa: boolean;
  setIsCovilMesa: (is: boolean) => void;
  userRole?: string; // Role do usuário para controlar visibilidade de campos admin
  // REMOVIDO: mode (sistema de ingestão desacoplado)
  // mode: 'create' | 'review';
  isDdalEligibleSelection: boolean;
  ddal: DdalFormState;
  setDdal: (ddal: DdalFormState | ((prev: DdalFormState) => DdalFormState)) => void;
  // Campos avançados
  masterDisplayName: string;
  setMasterDisplayName: (name: string) => void;
  campaignLength: string;
  setCampaignLength: (length: string) => void;
  levelRange: string;
  setLevelRange: (range: string) => void;
  billingText: string;
  setBillingText: (text: string) => void;
  sessionZeroFree: boolean;
  setSessionZeroFree: (free: boolean) => void;
  synopsis: string;
  setSynopsis: (synopsis: string) => void;
  styleText: string;
  setStyleText: (text: string) => void;
  listingExcerpt: string;
  setListingExcerpt: (excerpt: string) => void;
  technicalRequirements: string;
  setTechnicalRequirements: (req: string) => void;
  requiresPc: boolean;
  setRequiresPc: (req: boolean) => void;
  requiresCamera: boolean;
  setRequiresCamera: (req: boolean) => void;
  requiresMicrophone: boolean;
  setRequiresMicrophone: (req: boolean) => void;
  settingName: string;
  setSettingName: (name: string) => void;
  settingStyles: string[];
  setSettingStyles: (styles: string[]) => void;
  priceType: string;
  // Contatos
  contacts: ContactFormEntry[];
  setContacts: (contacts: ContactFormEntry[]) => void;
  contactsError: string | null;
  setContactsError: (error: string | null) => void;
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

function SelectField({
  label,
  id,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string; children: ReactNode }) {
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

export function StepFinal(props: StepFinalProps) {
  // DEBUG: Verificar se userRole está chegando corretamente
  useEffect(() => {
    console.log('[StepFinal DEBUG] userRole recebido:', props.userRole);
    console.log('[StepFinal DEBUG] userRole === "admin"?', props.userRole === 'admin');
  }, [props.userRole]);

  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleDdalChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    props.setDdal((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <div className="space-y-6">
      {/* Contatos */}
      <ContactsFormBlock
        contacts={props.contacts}
        onChange={(next) => {
          props.setContacts(next);
          if (props.contactsError) props.setContactsError(null);
        }}
        error={props.contactsError}
      />

      {/* Banner */}
      <ImageUploader
        idPrefix="stepfinal-banner"
        manualInputId="banner_url"
        label="Banner da Mesa (opcional)"
        value={props.bannerUrl}
        onChange={(url) => {
          props.setBannerUrl(url);
          props.setBannerError(false);
        }}
        onError={props.setBannerError}
        hasError={props.bannerError}
        initialCropData={props.bannerCropData}
        onCropChange={props.setBannerCropData}
      />

      {/* Rules Notes */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-white/70">Regras/Observações da Mesa (opcional)</label>
        <MarkdownEditor
          value={props.rulesNotes}
          onChange={(text) => props.setRulesNotes(text.slice(0, 1500))}
          placeholder="Ex: Usamos regras homebrew para combate, proibido PvP, etc."
          height={200}
        />
        <p className="text-xs text-white/40 text-right">{props.rulesNotes.length}/1500</p>
      </div>

      {/* Toggle Campos Avançados */}
      <button
        type="button"
        onClick={() => setShowAdvanced((v) => !v)}
        className="w-full px-4 py-3 rounded-xl border border-white/20 hover:border-[var(--color-artificio-orange)] text-white transition-colors text-sm font-medium"
      >
        {showAdvanced ? '▼ Ocultar' : '▶ Mostrar'} opções avançadas
      </button>

      {/* Campos Avançados (colapsável) */}
      {showAdvanced && (
        <section className="rounded-2xl border border-white/10 bg-[#13213f]/60 p-5 space-y-4">
          <div>
            <h3 className="text-lg font-bold text-white mb-1">Campos Avançados (Opcional)</h3>
            <p className="text-xs text-white/60">Informações adicionais para enriquecer o anúncio da mesa</p>
          </div>

          {/* Identificação do mestre */}
          <div className="space-y-3">
            <p className="text-sm font-semibold text-white/80">Identificação do Mestre</p>
            <InputField
              label="Nome de Exibição do Mestre (opcional)"
              id="master_display_name"
              value={props.masterDisplayName}
              onChange={(e) => props.setMasterDisplayName(e.target.value)}
              placeholder="Ex: Mestre Arandur"
            />
            <p className="text-xs text-white/50">Útil se você usa um nome artístico diferente do seu perfil</p>
          </div>

          {/* Detalhes da campanha */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InputField
              label="Duração da Campanha (opcional)"
              id="campaign_length"
              value={props.campaignLength}
              onChange={(e) => props.setCampaignLength(e.target.value)}
              placeholder="Ex: 6 meses, 12 sessões, Indeterminada"
            />
            <InputField
              label="Faixa de Nível (opcional)"
              id="level_range"
              value={props.levelRange}
              onChange={(e) => props.setLevelRange(e.target.value)}
              placeholder="Ex: 1-5, 10-15, Épico 20+"
            />
          </div>

          {/* Cobrança detalhada */}
          {(props.priceType === 'paga' || props.billingText) && (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-white/80">Detalhes de Cobrança</p>
              <div className="flex flex-col gap-1">
                <label htmlFor="billing_text" className="text-sm font-medium text-white/70">
                  Texto Descritivo sobre Cobrança
                </label>
                <textarea
                  id="billing_text"
                  value={props.billingText}
                  onChange={(e) => props.setBillingText(e.target.value)}
                  rows={2}
                  placeholder="Ex: Pagamento via PIX após cada sessão, Mensalidade com desconto para trimestre"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 outline-none focus:border-[var(--color-artificio-orange)]/60 transition-all resize-none"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="session_zero_free"
                  checked={props.sessionZeroFree}
                  onChange={(e) => props.setSessionZeroFree(e.target.checked)}
                  className="h-4 w-4 rounded border-white/20 bg-white/10 text-[var(--color-artificio-orange)] focus:ring-[var(--color-artificio-orange)]"
                />
                <label htmlFor="session_zero_free" className="text-sm text-white/70 cursor-pointer">
                  Sessão zero é gratuita
                </label>
              </div>
            </div>
          )}

          {/* Descrições expandidas */}
          <div className="space-y-3">
            <p className="text-sm font-semibold text-white/80">Descrições Expandidas</p>
            
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-white/70">Sinopse Narrativa (opcional)</label>
              <MarkdownEditor
                value={props.synopsis}
                onChange={(text) => props.setSynopsis(text.slice(0, 2000))}
                placeholder="Uma sinopse mais longa e imersiva da campanha..."
                height={250}
              />
              <p className="text-xs text-white/40 text-right">{props.synopsis.length}/2000</p>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-white/70">Estilo de Jogo (opcional)</label>
              <MarkdownEditor
                value={props.styleText}
                onChange={(text) => props.setStyleText(text.slice(0, 500))}
                placeholder="Ex: Roleplay pesado, Combate tático, Sandbox político"
                height={180}
              />
              <p className="text-xs text-white/40 text-right">{props.styleText.length}/500</p>
            </div>
            
            <InputField
              label="Resumo Curto (opcional)"
              id="listing_excerpt"
              value={props.listingExcerpt}
              onChange={(e) => props.setListingExcerpt(e.target.value)}
              placeholder="Resumo alternativo para listagens"
            />
          </div>

          {/* Requisitos técnicos */}
          <div className="space-y-3">
            <p className="text-sm font-semibold text-white/80">Requisitos Técnicos</p>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-white/70">Requisitos Detalhados (opcional)</label>
              <MarkdownEditor
                value={props.technicalRequirements}
                onChange={(text) => props.setTechnicalRequirements(text.slice(0, 1000))}
                placeholder="Ex: Roll20 + Discord, Foundry VTT com módulos X, Y"
                height={180}
              />
              <p className="text-xs text-white/40 text-right">{props.technicalRequirements.length}/1000</p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="requires_pc"
                  checked={props.requiresPc}
                  onChange={(e) => props.setRequiresPc(e.target.checked)}
                  className="h-4 w-4 rounded border-white/20 bg-white/10 text-[var(--color-artificio-orange)] focus:ring-[var(--color-artificio-orange)]"
                />
                <label htmlFor="requires_pc" className="text-sm text-white/70 cursor-pointer">
                  Requer computador (não funciona em mobile)
                </label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="requires_camera"
                  checked={props.requiresCamera}
                  onChange={(e) => props.setRequiresCamera(e.target.checked)}
                  className="h-4 w-4 rounded border-white/20 bg-white/10 text-[var(--color-artificio-orange)] focus:ring-[var(--color-artificio-orange)]"
                />
                <label htmlFor="requires_camera" className="text-sm text-white/70 cursor-pointer">
                  Requer câmera ligada durante as sessões
                </label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="requires_microphone"
                  checked={props.requiresMicrophone}
                  onChange={(e) => props.setRequiresMicrophone(e.target.checked)}
                  className="h-4 w-4 rounded border-white/20 bg-white/10 text-[var(--color-artificio-orange)] focus:ring-[var(--color-artificio-orange)]"
                />
                <label htmlFor="requires_microphone" className="text-sm text-white/70 cursor-pointer">
                  Requer microfone funcional (obrigatório)
                </label>
              </div>
            </div>
          </div>

          {/* Cenário e Estilos */}
          <div className="space-y-3">
            <p className="text-sm font-semibold text-white/80">Cenário e Estilos</p>
            <SettingStylesField
              settingName={props.settingName}
              settingStyles={props.settingStyles}
              onSettingNameChange={props.setSettingName}
              onSettingStylesChange={props.setSettingStyles}
              selectedScenarioName={props.selectedScenarioName}
            />
          </div>
        </section>
      )}

      {/* DDAL (se elegível) */}
      {props.isDdalEligibleSelection && (
        <section className="rounded-2xl border border-amber-300/30 bg-amber-500/10 p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-amber-100 inline-flex items-center gap-2">
                <ShieldCheck className="w-4 h-4" /> Caminho elegível para selo DDAL
              </p>
              <p className="text-xs text-amber-100/80 mt-1">Ative apenas para módulos Adventurers League.</p>
            </div>

            <label htmlFor="ddal-toggle" className="inline-flex items-center gap-2 text-sm text-amber-100">
              <input
                id="ddal-toggle"
                type="checkbox"
                checked={props.ddal.is_ddal}
                onChange={(e) => props.setDdal((prev) => ({ ...prev, is_ddal: e.target.checked }))}
                className="h-4 w-4 rounded border-white/20 bg-white/10"
              />
              É DDAL
            </label>
          </div>

          {props.ddal.is_ddal && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InputField
                label="Código da Aventura *"
                id="ddal_code"
                name="ddal_code"
                value={props.ddal.ddal_code}
                onChange={handleDdalChange}
                placeholder="Ex: DDAL05-01"
                required
              />

              <InputField
                label="Nome da Aventura *"
                id="ddal_name"
                name="ddal_name"
                value={props.ddal.ddal_name}
                onChange={handleDdalChange}
                placeholder="Ex: Treasure of the Broken Hoard"
                required
              />

              <SelectField
                label="Tier *"
                id="ddal_tier"
                name="ddal_tier"
                value={props.ddal.ddal_tier}
                onChange={handleDdalChange}
                required
              >
                <option value="">Selecione</option>
                <option value="1">Tier 1</option>
                <option value="2">Tier 2</option>
                <option value="3">Tier 3</option>
                <option value="4">Tier 4</option>
              </SelectField>

              <InputField
                label="Season"
                id="ddal_season"
                name="ddal_season"
                value={props.ddal.ddal_season}
                onChange={handleDdalChange}
                placeholder="Ex: Season 10"
              />

              <InputField
                label="Duração esperada"
                id="ddal_duration"
                name="ddal_duration"
                value={props.ddal.ddal_duration}
                onChange={handleDdalChange}
                placeholder="Ex: 4h"
              />

              <InputField
                label="Formato"
                id="ddal_format"
                name="ddal_format"
                value={props.ddal.ddal_format}
                onChange={handleDdalChange}
                placeholder="Ex: modulo, hardcover ou ccc"
              />

              <InputField
                label="Código expandido / organização"
                id="ddal_org_code"
                name="ddal_org_code"
                value={props.ddal.ddal_org_code}
                onChange={handleDdalChange}
                placeholder="Ex: CCC-BMG-01"
              />

              <InputField
                label="Ambientação"
                id="ddal_setting"
                name="ddal_setting"
                value={props.ddal.ddal_setting}
                onChange={handleDdalChange}
                placeholder="Ex: Forgotten Realms"
              />

              <div className="md:col-span-2 flex flex-col gap-1">
                <label htmlFor="ddal_rules_notes" className="text-sm font-medium text-white/70">
                  Notas de regras da temporada
                </label>
                <textarea
                  id="ddal_rules_notes"
                  name="ddal_rules_notes"
                  value={props.ddal.ddal_rules_notes}
                  onChange={handleDdalChange}
                  rows={3}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 outline-none focus:border-[var(--color-artificio-orange)]/60 transition-all resize-none"
                  placeholder="Observações úteis para jogadores e organização"
                />
              </div>
            </div>
          )}
        </section>
      )}

      {/* Covil do Lich (admin only) */}
      {props.userRole === 'admin' && (
        <section className="rounded-2xl border border-purple-400/30 bg-purple-500/10 p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-purple-200 inline-flex items-center gap-2">
                <Crown className="w-4 h-4" /> Selo Covil do Lich
              </p>
              <p className="text-xs text-purple-200/80 mt-1">
                Marque esta mesa como parte do programa Covil do Lich — mesas com curadoria e padrão elevado de qualidade.
              </p>
            </div>

            <label htmlFor="covil-toggle" className="inline-flex items-center gap-2 text-sm text-purple-200">
              <input
                id="covil-toggle"
                type="checkbox"
                checked={props.isCovilMesa}
                onChange={(e) => props.setIsCovilMesa(e.target.checked)}
                className="h-4 w-4 rounded border-white/20 bg-white/10"
              />
              É Covil do Lich
            </label>
          </div>

          {props.isCovilMesa && (
            <div className="rounded-xl border border-purple-300/20 bg-purple-900/20 p-3">
              <p className="text-xs text-purple-200/90">
                ✓ Esta mesa será exibida com o selo oficial do Covil do Lich em todos os locais onde aparecer.
              </p>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
