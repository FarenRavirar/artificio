import { useState } from 'react';
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import { Button, Field, TextInput } from '@artificio/ui';
import type { ContactMethodInput, TableContactChannel } from '../../types/tables';
import { TABLE_CONTACT_CHANNELS } from '../../types/tables';
import {
  INVALID_DISCORD_INVITE_MESSAGE,
  toSafeDiscordInviteUrl,
  URL_VALUE_CHANNELS,
  validateContactValue,
  validateHttpsUrl,
} from '../../utils/safeExternalUrl';
import { CONTACT_CHANNEL_META } from './channelMeta';

/**
 * Editor de contatos ÚNICO, servindo perfil E mesa (T4.0r, spec 096 R12).
 *
 * Base: a estrutura do antigo editor de perfil (ícone por canal, ordenação
 * por setas ↑↓ — NUNCA drag-and-drop, decisão revogada pelo mantenedor em
 * 2026-08-24 —, menu de adicionar com TODOS os 7 canais, erro próprio por
 * linha, rótulo opcional e campo extra de link do servidor só no Discord),
 * com as capacidades do ContactsFormBlock preservadas (placeholder por canal,
 * hint de URL alcançável). A ordem é a do array — a página pública exibe por
 * `sort_order`, que o backend deriva da ordem recebida.
 *
 * Dois modos:
 * - controlado (`onChange`): usado no editor de mesa — o estado vive no
 *   TableEditorState e quem grava é o publish/autosave, nunca este componente;
 * - painel (`onSave`): usado no PainelMestrePage — estado local + botão
 *   "Salvar" com validação bloqueante, o mesmo contrato do editor antigo
 *   (o teste contactXss.test.tsx fixa esse modo).
 *
 * Metadados por canal (ícone/label/placeholder/cor/rótulo do valor) vêm de
 * `channelMeta.ts` — fonte única compartilhada com a página pública (A1,
 * revisão adversarial Fase 4). Aqui só mora o específico da edição: os hints
 * (URL alcançável e link do servidor Discord) e o qualificador "(abre
 * WhatsApp)" do canal telefone.
 */

/** Hint para canais cujo valor é URL (mesmo texto do fluxo antigo). */
const URL_CHANNEL_HINT =
  'Informe o endereço completo, como exemplo.com/inscricao — será salvo como https://. Nome de usuário sozinho não funciona como link; se for seu @ do Discord, escolha o canal Discord.';

const DISCORD_SERVER_HINT =
  'Discord não oferece link direto por @usuário. Se tiver servidor, informe aqui um convite HTTPS opcional.';

/**
 * Label do canal no contexto de EDIÇÃO. O módulo channelMeta guarda o label
 * canônico ("Telefone", usado na página pública); o qualificador "(abre
 * WhatsApp)" é informação de edição — lembra o mestre que o contato abre
 * conversa, não o discador (decisão 2026-08-03, ver toWhatsAppUrl).
 */
const editorChannelLabel = (channel: TableContactChannel): string =>
  channel === 'phone'
    ? `${CONTACT_CHANNEL_META[channel].label} (abre WhatsApp)`
    : CONTACT_CHANNEL_META[channel].label;

/**
 * Erro de UM contato — fonte única da validação por linha (T4.0r). Regra por
 * canal via `validateContactValue` (utils/safeExternalUrl), a mesma que o
 * backend espelha (`canonicalizeContactValue`) e que a validação do publish
 * da mesa usa; o link do servidor do Discord tem regra própria
 * (`validateHttpsUrl` + `toSafeDiscordInviteUrl`), herdada do editor antigo.
 */
// Local de propósito (react-refresh/only-export-components) — sem consumidor
// externo (medido); a fonte única da regra por canal é validateContactValue.
function validateContactMethod(contact: ContactMethodDraft): string | null {
  const valueError = validateContactValue(contact.channel, contact.value);
  if (valueError) return valueError;

  const serverUrl = contact.discord_server_url ?? '';
  if (contact.channel === 'discord' && serverUrl.trim()) {
    const result = validateHttpsUrl(serverUrl);
    if (!result.success) return result.message;
    if (!toSafeDiscordInviteUrl(serverUrl)) {
      return INVALID_DISCORD_INVITE_MESSAGE;
    }
  }

  return null;
}

/**
 * Contato como o perfil do mestre devolve (`GET /gm/me`): `label` e
 * `discord_server_url` ausentes/null quando vazios — diferente do shape de
 * edição (`ContactMethodInput`), que materializa ''.
 */
export interface ContactMethodDraft {
  channel: TableContactChannel;
  value: string;
  label?: string | null;
  discord_server_url?: string | null;
}

interface ContactMethodsEditorBaseProps {
  /** Erro geral (ex.: erro do publish da mesa) — renderizado pelo pai. */
  error?: string | null;
  /** Prefixo dos ids dos controles (evita duplicação entre painel e editor). */
  idPrefix?: string;
}

export type ContactMethodsEditorProps = ContactMethodsEditorBaseProps &
  (
    | {
        contacts: ContactMethodInput[];
        onChange: (next: ContactMethodInput[]) => void;
        onSave?: never;
      }
    | {
        contacts: ContactMethodDraft[];
        onChange?: never;
        onSave: (contacts: ContactMethodInput[]) => Promise<void>;
      }
  );

export function ContactMethodsEditor({
  contacts,
  onChange,
  onSave,
  error,
  idPrefix = 'contact-methods',
}: ContactMethodsEditorProps) {
  const isPanel = typeof onSave === 'function';
  const [localContacts, setLocalContacts] = useState<ContactMethodDraft[]>(contacts);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showAddMenu, setShowAddMenu] = useState(false);

  const current: ContactMethodDraft[] = isPanel ? localContacts : contacts;

  const apply = (next: ContactMethodDraft[]) => {
    if (isPanel) setLocalContacts(next);
    onChange?.(next as ContactMethodInput[]);
  };

  const addContact = (channel: TableContactChannel) => {
    apply([...current, { channel, value: '', label: '', discord_server_url: '' }]);
    setShowAddMenu(false);
  };

  const removeContact = (index: number) => {
    apply(current.filter((_, i) => i !== index));
  };

  const updateContact = (index: number, field: keyof ContactMethodInput, value: string) => {
    const updated = [...current];
    updated[index] = { ...updated[index], [field]: value };
    apply(updated);
  };

  const moveUp = (index: number) => {
    if (index === 0) return;
    const updated = [...current];
    [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
    apply(updated);
  };

  const moveDown = (index: number) => {
    if (index === current.length - 1) return;
    const updated = [...current];
    [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
    apply(updated);
  };

  const handleSave = async () => {
    if (!onSave) return;
    // Linha sem value é descartada, não validada: validar primeiro fazia o
    // salvamento travar em "Corrija os erros" por causa de linha em branco que
    // o próprio filtro abaixo ia jogar fora — o mestre não tinha o que corrigir.
    const filled = current.filter((c) => c.value.trim());
    const errors = filled.map(validateContactMethod);
    if (errors.some((e) => e !== null)) {
      setSaveError('Corrija os erros antes de salvar');
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      // Limpar campos opcionais vazios (mesma regra do editor antigo — o
      // perfil não grava linha sem value).
      const validContacts: ContactMethodInput[] = filled
        .map((c) => ({
          channel: c.channel,
          value: c.value,
          label: (c.label ?? '').trim(),
          discord_server_url: (c.discord_server_url ?? '').trim(),
        }));

      await onSave(validContacts);
    } catch (err: unknown) {
      setSaveError(err instanceof Error && err.message ? err.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Lista de contatos */}
      <div className="space-y-3">
        {current.map((contact, index) => {
          const config = CONTACT_CHANNEL_META[contact.channel] ?? CONTACT_CHANNEL_META.whatsapp;
          const Icon = config.icon;
          const validationError = validateContactMethod(contact);

          return (
            <div key={`${idPrefix}-contact-${index}`} className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--fill-5)] p-4 space-y-3">
              {/* Cabeçalho com tipo e ações (ordenar é por setas ↑↓, sem
                  arrastar — decisão revogada pelo mantenedor em 2026-08-24). */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon className={`w-5 h-5 ${config.iconClass}`} aria-hidden="true" />
                  <span className="font-[var(--weight-medium)] text-[var(--fg)]">{editorChannelLabel(contact.channel)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => moveUp(index)}
                    disabled={index === 0}
                    title="Mover para cima"
                    aria-label="Mover contato para cima"
                    leftIcon={<ChevronUp className="w-4 h-4" />}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => moveDown(index)}
                    disabled={index === current.length - 1}
                    title="Mover para baixo"
                    aria-label="Mover contato para baixo"
                    leftIcon={<ChevronDown className="w-4 h-4" />}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeContact(index)}
                    title="Remover"
                    aria-label="Remover contato"
                    leftIcon={<Trash2 className="w-4 h-4 text-[var(--state-danger-fg)]" />}
                  />
                </div>
              </div>

              {/* Campos */}
              <div className="space-y-2">
                <Field
                  id={`${idPrefix}-value-${index}`}
                  label={config.valueLabel}
                  error={validationError ?? undefined}
                  required
                >
                  <TextInput
                    id={`${idPrefix}-value-${index}`}
                    type="text"
                    value={contact.value}
                    onChange={(e) => updateContact(index, 'value', e.target.value)}
                    placeholder={config.placeholder}
                    invalid={!!validationError}
                    // D7 (revisão adversarial Fase 4): limites do backend
                    // (tableValidators.ts:52 — value max 500).
                    maxLength={500}
                  />
                </Field>
                {/* Hint de URL como texto PRÓPRIO, não como hint do Field:
                    quando há erro de validação o Field substitui o hint pelo
                    erro e a regra sumia da tela — o teste contactXss fixa a
                    regra SEMPRE visível (capacidade do ContactsFormBlock que
                    não pode se perder, T4.0r). */}
                {URL_VALUE_CHANNELS.has(contact.channel) && (
                  <p className="text-[length:var(--text-label)] leading-[var(--leading-label)] text-[var(--fg-faint)]">{URL_CHANNEL_HINT}</p>
                )}

                <Field id={`${idPrefix}-label-${index}`} label="Label personalizado (opcional)">
                  <TextInput
                    id={`${idPrefix}-label-${index}`}
                    type="text"
                    value={contact.label ?? ''}
                    onChange={(e) => updateContact(index, 'label', e.target.value)}
                    placeholder="Ex: WhatsApp comercial"
                    // D7: limite do backend (tableValidators.ts:53 — label max 100).
                    maxLength={100}
                  />
                </Field>

                {contact.channel === 'discord' && (
                  <Field
                    id={`${idPrefix}-discord-server-${index}`}
                    label="Link do servidor Discord (opcional)"
                    hint={DISCORD_SERVER_HINT}
                  >
                    <TextInput
                      id={`${idPrefix}-discord-server-${index}`}
                      type="text"
                      value={contact.discord_server_url ?? ''}
                      onChange={(e) => updateContact(index, 'discord_server_url', e.target.value)}
                      placeholder="https://discord.gg/..."
                      // D7: limite do backend (tableValidators.ts:54 —
                      // discord_server_url max 500).
                      maxLength={500}
                    />
                  </Field>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Botão adicionar + menu com TODOS os 7 canais (ordem canônica do
          backend, TABLE_CONTACT_CHANNELS). */}
      <div className="relative">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setShowAddMenu(!showAddMenu)}
          aria-expanded={showAddMenu}
          leftIcon={<Plus className="w-4 h-4" />}
          className="w-full"
        >
          Adicionar contato
        </Button>

        {showAddMenu && (
          <div className="absolute top-full mt-2 left-0 right-0 p-2 rounded-[var(--radius-md)] bg-[var(--surface-input)] border border-[var(--border)] shadow-[var(--shadow-float)] z-10 grid grid-cols-2 gap-2">
            {TABLE_CONTACT_CHANNELS.map((channel) => {
              const config = CONTACT_CHANNEL_META[channel];
              const Icon = config.icon;
              return (
                <Button
                  key={channel}
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => addContact(channel)}
                  leftIcon={<Icon className={`w-4 h-4 ${config.iconClass}`} />}
                  className="justify-start"
                >
                  {editorChannelLabel(channel)}
                </Button>
              );
            })}
          </div>
        )}
      </div>

      {/* Rodapé: só no modo painel (perfil) — a mesa salva no publish, nunca
          aqui (A20: a única escrita mesa→perfil é o botão de sincronizar do
          MasterPart, e ela nunca passa por este componente). */}
      {isPanel && (
        <div className="flex items-center justify-between pt-4 border-t border-[var(--border)]">
          <p className="text-[length:var(--text-support)] leading-[var(--leading-support)] text-[var(--fg-low)]">
            {current.length} {current.length === 1 ? 'contato' : 'contatos'}
          </p>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => void handleSave()}
            loading={saving}
          >
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      )}

      {(error || saveError) && (
        <div className="p-3 rounded-[var(--radius-md)] bg-[var(--state-danger-bg)] border border-[var(--state-danger-line)]">
          <p className="text-[var(--state-danger-fg)] text-[length:var(--text-support)] leading-[var(--leading-support)]">{saveError ?? error}</p>
        </div>
      )}
    </div>
  );
}
