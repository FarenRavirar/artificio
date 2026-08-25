import { Button, TextInput } from '@artificio/ui';
import { ContentEditor } from '@artificio/content-editor';
import type { TableEditorApi } from '../hooks/useTableEditor';
import { EditorField } from './EditorField';
import { ContactMethodsEditor } from '../../../components/mestre/ContactMethodsEditor';
import { EDITOR_TEXT_LIMITS } from '../utils/editorValidation';

/**
 * Parte "Mestre e contato": publicador (mestre × anunciante — cards de
 * rádio sobre `Button` do design system), nome do mestre real (obrigatório
 * se anunciante), nome de exibição do mestre, bio do mestre NESTA mesa
 * (T4.0p: herda do perfil — não editada, é omitida do payload e a mesa
 * espelha `gm_bio_long`; editada, grava `table_gm_bio` sem tocar o perfil),
 * contatos (T4.0r: o editor de contatos ÚNICO com os 7 canais, servindo
 * perfil E mesa) e dados da campanha.
 *
 * T4.0q: o botão "Sincronizar com o Perfil Principal de Mestre" aparece
 * quando um campo herdado foi editado — a única escrita mesa→perfil do
 * editor, sempre deliberada.
 *
 * O "resumo curto" do registro antigo era `listing_excerpt`, CORTADO por
 * R17/A17 (§Gap 8) — não existe editor dele aqui.
 */
interface MasterPartProps {
  api: TableEditorApi;
}

export function MasterPart({ api }: MasterPartProps) {
  const { state, patch, errors, validateFieldOnBlur } = api;
  const isAnnouncer = state.publisherRole === 'announcer';

  return (
    <div className="flex flex-col gap-3.5 max-w-[900px] h-full overflow-hidden">
      <EditorField
        fieldId="publisherRole"
        state={state}
        label="Quem está publicando esta mesa?"
        hint="Você pode publicar como mestre narrador ou como apenas anunciante."
      >
        <div className="flex flex-wrap gap-2.5" id="publisherRole">
          <Button
            type="button"
            variant={!isAnnouncer ? 'primary' : 'secondary'}
            aria-pressed={!isAnnouncer}
            onClick={() => patch({ publisherRole: 'gm' })}
            className="!items-start !gap-1 !px-3.5 !py-3 flex-col"
          >
            <span className="font-semibold">Sou o mestre desta mesa</span>
            <span className="text-xs opacity-75">Sem selo de anunciante.</span>
          </Button>
          <Button
            type="button"
            variant={isAnnouncer ? 'primary' : 'secondary'}
            aria-pressed={isAnnouncer}
            onClick={() => patch({ publisherRole: 'announcer' })}
            className="!items-start !gap-1 !px-3.5 !py-3 flex-col"
          >
            <span className="font-semibold">Sou apenas anunciante</span>
            <span className="text-xs opacity-75">A mesa exibirá o selo "Apenas anunciante".</span>
          </Button>
        </div>
      </EditorField>

      {isAnnouncer && (
        <EditorField
          fieldId="actualGmName"
          state={state}
          label="Nome do mestre real"
          error={errors.actualGmName}
        >
          <TextInput
            id="actualGmName"
            value={state.actualGmName}
            onChange={(e) => patch({ actualGmName: e.target.value })}
            onBlur={() => validateFieldOnBlur('actualGmName')}
            invalid={!!errors.actualGmName}
            placeholder="Ex: Mestre Arandur"
          />
        </EditorField>
      )}

      <EditorField
        fieldId="masterDisplayName"
        state={state}
        label="Nome de exibição do mestre"
        hint="Se não for alterado, a mesa exibe o nome do seu perfil de mestre."
      >
        <TextInput
          id="masterDisplayName"
          value={state.masterDisplayName}
          onChange={(e) => patch({ masterDisplayName: e.target.value })}
          placeholder="Ex: Mestre Arandur"
        />
      </EditorField>

      {/* Bio do mestre NESTA mesa (T4.0p): pré-carregada do perfil
          (gm_profiles.bio_long). Não editada → omitida do payload e a mesa
          espelha o perfil; editada → grava table_gm_bio, perfil intacto
          (A19). Sem marca de origem — o campo vir preenchido já comunica. */}
      <EditorField
        fieldId="tableGmBio"
        state={state}
        label="Bio do mestre nesta mesa"
        hint="Se não for alterada, a mesa exibe a bio do seu perfil de mestre."
        error={errors.tableGmBio}
      >
        <ContentEditor
          value={state.tableGmBio}
          onChange={(text) => patch({ tableGmBio: text })}
          label="Bio do mestre nesta mesa"
          maxLength={EDITOR_TEXT_LIMITS.tableGmBio[1]}
          placeholder="Conte um pouco sobre você como mestre desta campanha…"
          minHeight={120}
        />
      </EditorField>

      <EditorField
        fieldId="contacts"
        state={state}
        label="Canais de recrutamento"
        hint="Ao menos um canal para jogadores entrarem em contato."
        error={errors.contacts}
      >
        <ContactMethodsEditor
          contacts={state.contacts}
          onChange={(next) => patch({ contacts: next })}
          idPrefix="table-editor-contact"
        />
      </EditorField>

      {/* T4.0q: texto EXATO definido pelo mantenedor. Só com perfil de mestre
          E com campo herdado editado; grava nickname/bio/contatos da mesa no
          perfil via PUT /gm/profile (a única escrita mesa→perfil do editor —
          salvar a mesa sem clicar nunca toca o perfil, A20). */}
      {api.hasGmProfile && api.hasInheritedEdit && (
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            loading={api.syncingProfile}
            onClick={() => void api.syncProfileToMaster()}
            title="Grava o nome, a bio e os contatos desta mesa no seu perfil de mestre."
          >
            Sincronizar com o Perfil Principal de Mestre
          </Button>
        </div>
      )}
    </div>
  );
}
