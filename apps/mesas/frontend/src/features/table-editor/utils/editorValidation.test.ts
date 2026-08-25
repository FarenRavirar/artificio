import { describe, it, expect } from 'vitest';
import { createDefaultEditorState } from '../hooks/useTableEditor';
import type { TableEditorState } from '../types';
import type { SessionSchedule } from '../../../components/SessionRepeater';
import type { TableContactChannel } from '../../../types/tables';
import { validateContactValue } from '../../../utils/safeExternalUrl';
import {
  EDITOR_TEXT_LIMITS,
  MAX_SLOTS,
  RECOMMENDED_GAIN,
  fieldLevel,
  firstErrorField,
  isConditionalField,
  isFieldFilled,
  partOfField,
  pendingParts,
  validateEditorAll,
  validateEditorField,
} from './editorValidation';

/**
 * Fixture completa do estado real (mesma regra do editorMapping.test.ts:
 * o tsconfig.test.json type-checka o arquivo inteiro, então o estado
 * precisa satisfazer TableEditorState de verdade).
 */
function makeState(overrides: Partial<TableEditorState> = {}): TableEditorState {
  return {
    ...createDefaultEditorState(),
    ...overrides,
  };
}

function makeSchedule(overrides: Partial<SessionSchedule> = {}): SessionSchedule {
  return {
    day_of_week: 'segunda',
    start_time: '19:00',
    end_time: '',
    frequency: 'semanal',
    is_ongoing: false,
    notes: '',
    sort_order: 0,
    ...overrides,
  };
}

describe('EDITOR_TEXT_LIMITS — limites que sobrevivem ao corte (§Gap 8)', () => {
  it('registra o rótulo e o limite de cada campo de texto livre', () => {
    expect(EDITOR_TEXT_LIMITS.rulesNotes).toEqual(['Regras e observações', 2000]);
    expect(EDITOR_TEXT_LIMITS.technicalRequirements).toEqual(['Requisitos técnicos', 1000]);
    expect(EDITOR_TEXT_LIMITS.billingText).toEqual(['Detalhes de cobrança', 500]);
    // Campo da próxima onda (T4.0p): limite registrado para não se perder.
    expect(EDITOR_TEXT_LIMITS.tableGmBio).toEqual(['Bio do mestre nesta mesa', 2000]);
  });

  it('rulesNotes acima de 2000 acusa com a mensagem de excesso ("passou X caracteres")', () => {
    const message = validateEditorField('rulesNotes', makeState({ rulesNotes: 'x'.repeat(2001) }));
    expect(message).toBe('Regras e observações: 1 caracteres acima do limite de 2000');
    expect(validateEditorField('rulesNotes', makeState({ rulesNotes: 'x'.repeat(2000) }))).toBeNull();
  });

  it('technicalRequirements acima de 1000 acusa com a mensagem de excesso', () => {
    const message = validateEditorField(
      'technicalRequirements',
      makeState({ technicalRequirements: 'x'.repeat(1001) }),
    );
    expect(message).toBe('Requisitos técnicos: 1 caracteres acima do limite de 1000');
  });

  it('billingText acima de 500 acusa com a mensagem de excesso', () => {
    const message = validateEditorField('billingText', makeState({ billingText: 'x'.repeat(501) }));
    expect(message).toBe('Detalhes de cobrança: 1 caracteres acima do limite de 500');
  });
});

describe('título e descrição — mínimo e máximo com contagem do excesso', () => {
  it('título vazio, curto demais e acima do limite', () => {
    expect(validateEditorField('title', makeState({ title: '' }))).toBe('Título obrigatório');
    expect(validateEditorField('title', makeState({ title: 'ab' }))).toBe(
      'Título muito curto (mínimo 3 caracteres)',
    );
    expect(validateEditorField('title', makeState({ title: 'a'.repeat(201) }))).toBe(
      'Título: 1 caracteres acima do limite de 200',
    );
  });

  it('descrição vazia, curta demais e acima do limite', () => {
    expect(validateEditorField('description', makeState({ description: '' }))).toBe(
      'Descrição obrigatória',
    );
    expect(validateEditorField('description', makeState({ description: 'curta' }))).toBe(
      'Descrição muito curta (mínimo 10 caracteres)',
    );
    expect(validateEditorField('description', makeState({ description: 'a'.repeat(5001) }))).toBe(
      'Descrição: 1 caracteres acima do limite de 5000',
    );
  });
});

describe('fieldLevel — três níveis + condicionais derivados do registro único (A11)', () => {
  it('obrigatórios fixos são required', () => {
    expect(fieldLevel('title')).toBe('required');
    expect(fieldLevel('description')).toBe('required');
    expect(fieldLevel('selectedSystemId')).toBe('required');
    expect(fieldLevel('contacts')).toBe('required');
  });

  it('recomendados são recommended com frase do ganho (R6/R6.1)', () => {
    expect(fieldLevel('bannerUrl')).toBe('recommended');
    expect(fieldLevel('ageRating')).toBe('recommended');
    expect(RECOMMENDED_GAIN.bannerUrl).toBe('mesas com banner aparecem em destaque');
    expect(RECOMMENDED_GAIN.ageRating).toBe('ajuda o jogador a saber se a mesa é para ele');
  });

  it('campos comuns são optional', () => {
    expect(fieldLevel('city')).toBe('optional');
    expect(fieldLevel('rulesNotes')).toBe('optional');
    expect(fieldLevel('tableLevel')).toBe('optional');
  });

  it('isConditionalField marca exatamente os quatro condicionais', () => {
    expect(isConditionalField('actualGmName')).toBe(true);
    expect(isConditionalField('gamePlatformCustom')).toBe(true);
    expect(isConditionalField('communicationPlatformCustom')).toBe(true);
    expect(isConditionalField('priceValue')).toBe(true);
    expect(isConditionalField('title')).toBe(false);
  });

  it('actualGmName: obrigatório só quando o publicador é anunciante', () => {
    expect(fieldLevel('actualGmName', { publisherRole: 'announcer' })).toBe('required');
    expect(fieldLevel('actualGmName', { publisherRole: 'gm' })).toBe('optional');
    expect(fieldLevel('actualGmName')).toBe('optional');
  });

  it('gamePlatformCustom e communicationPlatformCustom: obrigatórios só em plataforma custom', () => {
    expect(fieldLevel('gamePlatformCustom', { vttPlatformId: 'custom' })).toBe('required');
    expect(fieldLevel('gamePlatformCustom', { vttPlatformId: 'roll20' })).toBe('optional');
    expect(fieldLevel('communicationPlatformCustom', { communicationPlatformId: 'custom' })).toBe(
      'required',
    );
    expect(fieldLevel('communicationPlatformCustom', { communicationPlatformId: 'uuid-discord' })).toBe(
      'optional',
    );
  });

  it('priceValue: obrigatório só em mesa paga (normalizePriceType aceita paid)', () => {
    expect(fieldLevel('priceValue', { priceType: 'paga' })).toBe('required');
    expect(fieldLevel('priceValue', { priceType: 'paid' })).toBe('required');
    expect(fieldLevel('priceValue', { priceType: 'gratuita' })).toBe('optional');
    expect(fieldLevel('priceValue')).toBe('optional');
  });
});

describe('isFieldFilled — preenchimento para a barra de progresso (A3)', () => {
  it('textos obrigatórios exigem conteúdo não vazio (trim)', () => {
    const empty = makeState();
    expect(isFieldFilled('title', empty)).toBe(false);
    expect(isFieldFilled('description', empty)).toBe(false);
    expect(isFieldFilled('selectedSystemId', empty)).toBe(false);

    const filled = makeState({
      title: 'Mesa nova',
      description: 'Descrição completa.',
      selectedSystemId: 'sys-1',
    });
    expect(isFieldFilled('title', filled)).toBe(true);
    expect(isFieldFilled('description', filled)).toBe(true);
    expect(isFieldFilled('selectedSystemId', filled)).toBe(true);
  });

  it('schedules/slots e contatos seguem a regra atual da barra', () => {
    const state = makeState();
    // A lista default tem UMA linha — schedules conta como preenchido (o
    // erro de "sem sessão" é o que zera a contagem quando degenera).
    expect(isFieldFilled('schedules', state)).toBe(true);
    expect(isFieldFilled('slotsTotal', state)).toBe(true); // default '4'
    expect(isFieldFilled('slotsOpen', state)).toBe(true); // default '4'
    expect(isFieldFilled('contacts', state)).toBe(false); // uma linha vazia
    expect(
      isFieldFilled(
        'contacts',
        makeState({
          contacts: [{ channel: 'email', value: 'mestre@example.com', label: '', discord_server_url: '' }],
        }),
      ),
    ).toBe(true);
  });

  it('condicionais preenchidos refletem o valor do campo', () => {
    const state = makeState({
      publisherRole: 'announcer',
      vttPlatformId: 'custom',
      communicationPlatformId: 'custom',
      priceType: 'paga',
    });
    expect(isFieldFilled('actualGmName', state)).toBe(false);
    expect(isFieldFilled('gamePlatformCustom', state)).toBe(false);
    expect(isFieldFilled('communicationPlatformCustom', state)).toBe(false);
    expect(isFieldFilled('priceValue', state)).toBe(false);

    const filled = makeState({
      ...state,
      actualGmName: 'Mestre Real',
      gamePlatformCustom: 'Teatro da Mente',
      communicationPlatformCustom: 'Discord próprio',
      priceValue: '55',
    });
    expect(isFieldFilled('actualGmName', filled)).toBe(true);
    expect(isFieldFilled('gamePlatformCustom', filled)).toBe(true);
    expect(isFieldFilled('communicationPlatformCustom', filled)).toBe(true);
    expect(isFieldFilled('priceValue', filled)).toBe(true);
  });

  it('campo desconhecido conta como preenchido (nunca trava o progresso)', () => {
    expect(isFieldFilled('campo-que-nao-existe', makeState())).toBe(true);
  });
});

describe('partOfField — erro sempre leva à parte que contém o campo', () => {
  it('mapeia campos representativos para as 7 partes', () => {
    expect(partOfField('title')).toBe('identity');
    expect(partOfField('schedules')).toBe('when');
    expect(partOfField('modality')).toBe('where');
    expect(partOfField('priceValue')).toBe('values');
    expect(partOfField('ageRating')).toBe('audience');
    expect(partOfField('contacts')).toBe('master');
    expect(partOfField('ddal')).toBe('extras');
  });

  it('campo desconhecido cai em identity (default seguro)', () => {
    expect(partOfField('campo-que-nao-existe')).toBe('identity');
  });

  it('cidade/estado pertencem a where (a condicionalidade visual é da parte)', () => {
    expect(partOfField('city')).toBe('where');
    expect(partOfField('state')).toBe('where');
  });
});

describe('validateEditorField — regras por campo', () => {
  it('selectedSystemId vazio acusa', () => {
    expect(validateEditorField('selectedSystemId', makeState())).toBe('Selecione um sistema');
  });

  it('schedules: vazio, flexível com 2+ sessões e dia ausente', () => {
    expect(validateEditorField('schedules', makeState({ schedules: [] }))).toBe(
      'Adicione pelo menos uma sessão',
    );
    expect(
      validateEditorField(
        'schedules',
        makeState({ isPersonalizedSchedule: true, schedules: [makeSchedule(), makeSchedule()] }),
      ),
    ).toBe('Use apenas uma sessão quando dia ou horário estiver a definir');
    expect(
      validateEditorField(
        'schedules',
        makeState({ schedules: [makeSchedule({ day_of_week: 'to_define' }), makeSchedule()] }),
      ),
    ).toBe('Use apenas uma sessão quando dia ou horário estiver a definir');
    expect(
      validateEditorField(
        'schedules',
        makeState({
          schedules: [
            makeSchedule({ day_of_week: '' as SessionSchedule['day_of_week'] }),
          ],
        }),
      ),
    ).toBe('Dia da semana obrigatório');
  });

  it('vagas: 1-20 válidas; fora da faixa e não numérico acusam', () => {
    expect(validateEditorField('slotsTotal', makeState({ slotsTotal: '1' }))).toBeNull();
    expect(validateEditorField('slotsTotal', makeState({ slotsTotal: '20' }))).toBeNull();
    expect(validateEditorField('slotsTotal', makeState({ slotsTotal: '0' }))).toBe('Mínimo 1 vaga');
    expect(validateEditorField('slotsTotal', makeState({ slotsTotal: '21' }))).toBe(
      `Máximo ${MAX_SLOTS} vagas`,
    );
    expect(validateEditorField('slotsTotal', makeState({ slotsTotal: 'abc' }))).toBe(
      'Número de vagas inválido',
    );
  });

  it('vagas abertas: negativa, maior que totais e acima do máximo', () => {
    expect(
      validateEditorField('slotsOpen', makeState({ slotsOpen: '1', slotsTotal: '4' })),
    ).toBeNull();
    expect(
      validateEditorField('slotsOpen', makeState({ slotsOpen: '-1', slotsTotal: '4' })),
    ).toBe('Vagas abertas não pode ser negativa');
    expect(
      validateEditorField('slotsOpen', makeState({ slotsOpen: '5', slotsTotal: '4' })),
    ).toBe('Vagas abertas não pode ser maior que vagas totais.');
    expect(
      validateEditorField('slotsOpen', makeState({ slotsOpen: '21', slotsTotal: '21' })),
    ).toBe(`Máximo ${MAX_SLOTS} vagas`);
  });

  it('contatos: nenhum preenchido e canal ausente', () => {
    expect(validateEditorField('contacts', makeState())).toBe('Adicione pelo menos um contato');
    expect(
      validateEditorField(
        'contacts',
        makeState({
          contacts: [
            {
              // Canal inválido de propósito (estado corrompido/legado): o
              // validador precisa acusar, não confiar no tipo.
              channel: '' as TableContactChannel,
              value: 'alguem',
              label: '',
              discord_server_url: '',
            },
          ],
        }),
      ),
    ).toBe('Contato 1: canal obrigatório');
  });

  it('contatos: URL de canal form inválida é rejeitada (https/resolvível)', () => {
    const javascriptUrl = validateEditorField(
      'contacts',
      makeState({
        contacts: [
          { channel: 'form', value: 'javascript:alert(1)', label: '', discord_server_url: '' },
        ],
      }),
    );
    expect(javascriptUrl).toBe('Contato 1: Somente URLs https:// são aceitas.');

    const unresolvable = validateEditorField(
      'contacts',
      makeState({
        contacts: [{ channel: 'form', value: 'uwill', label: '', discord_server_url: '' }],
      }),
    );
    expect(unresolvable).toBe(
      'Contato 1: Informe um endereço completo, como https://exemplo.com/inscricao. Se for um usuário do Discord, escolha o canal Discord.',
    );

    expect(
      validateEditorField(
        'contacts',
        makeState({
          contacts: [
            { channel: 'form', value: 'exemplo.com/inscricao', label: '', discord_server_url: '' },
          ],
        }),
      ),
    ).toBeNull();
  });

  it('contatos: Discord entra livre e discord_server_url não é validado pelo editor', () => {
    const withServerUrl = validateEditorField(
      'contacts',
      makeState({
        contacts: [
          {
            channel: 'discord',
            value: '@usuario',
            label: 'Organização',
            discord_server_url: 'nao-eh-url',
          },
        ],
      }),
    );
    expect(withServerUrl).toBeNull();
    expect(validateContactValue('discord', 'qualquer texto')).toBeNull();
  });

  it('contatos: whatsapp exige formato internacional e e-mail exige endereço válido', () => {
    expect(
      validateEditorField(
        'contacts',
        makeState({
          contacts: [
            { channel: 'whatsapp', value: '11999999999', label: '', discord_server_url: '' },
          ],
        }),
      ),
    ).toBe('Contato 1: WhatsApp deve estar no formato internacional, como +5511999999999');
    expect(
      validateEditorField(
        'contacts',
        makeState({
          contacts: [{ channel: 'email', value: 'nao-eh-email', label: '', discord_server_url: '' }],
        }),
      ),
    ).toBe('Contato 1: E-mail inválido');
  });

  it('condicionais: anunciante sem nome acusa; mestre sem nome não', () => {
    expect(
      validateEditorField('actualGmName', makeState({ publisherRole: 'announcer', actualGmName: '' })),
    ).toBe('Nome do mestre obrigatório quando você é apenas anunciante');
    expect(validateEditorField('actualGmName', makeState({ publisherRole: 'gm' }))).toBeNull();
  });

  it('condicionais: plataforma custom vazia acusa só quando o id é custom', () => {
    expect(
      validateEditorField('gamePlatformCustom', makeState({ vttPlatformId: 'custom' })),
    ).toBe('Informe a plataforma de jogo personalizada');
    expect(
      validateEditorField('gamePlatformCustom', makeState({ vttPlatformId: 'roll20' })),
    ).toBeNull();
    expect(
      validateEditorField(
        'communicationPlatformCustom',
        makeState({ communicationPlatformId: 'custom' }),
      ),
    ).toBe('Informe a plataforma de comunicação personalizada');
    expect(
      validateEditorField(
        'communicationPlatformCustom',
        makeState({ communicationPlatformId: 'uuid-discord' }),
      ),
    ).toBeNull();
  });

  it('priceValue: paga exige valor numérico não negativo; gratuita não acusa', () => {
    expect(validateEditorField('priceValue', makeState({ priceType: 'paga', priceValue: '' }))).toBe(
      'Valor por sessão é obrigatório para mesa paga',
    );
    expect(
      validateEditorField('priceValue', makeState({ priceType: 'paga', priceValue: 'abc' })),
    ).toBe('Informe um valor numérico válido');
    expect(
      validateEditorField('priceValue', makeState({ priceType: 'paga', priceValue: '-5' })),
    ).toBe('Valor não pode ser negativo');
    expect(validateEditorField('priceValue', makeState({ priceType: 'gratuita' }))).toBeNull();
  });

  it('campos sem validador (recomendados/opcionais) não acusam erro no blur', () => {
    expect(validateEditorField('ageRating', makeState())).toBeNull();
    expect(validateEditorField('bannerUrl', makeState())).toBeNull();
    expect(validateEditorField('city', makeState())).toBeNull();
  });
});

describe('validateEditorAll / pendingParts / firstErrorField — publicar com pendências (A4)', () => {
  it('estado vazio acusa os obrigatórios aplicáveis e nada de recomendado', () => {
    const errors = validateEditorAll(makeState());
    expect(errors).toMatchObject({
      title: 'Título obrigatório',
      description: 'Descrição obrigatória',
      selectedSystemId: 'Selecione um sistema',
      contacts: 'Adicione pelo menos um contato',
    });
    // Condicionais desligados e recomendados não bloqueiam.
    expect('actualGmName' in errors).toBe(false);
    expect('priceValue' in errors).toBe(false);
    expect('ageRating' in errors).toBe(false);
    expect('schedules' in errors).toBe(false);
  });

  it('pendingParts devolve as partes com erro na ordem da lateral', () => {
    expect(pendingParts(validateEditorAll(makeState()))).toEqual(['identity', 'master']);
    // Ordem independe da ordem de inserção no mapa.
    expect(
      pendingParts({
        contacts: 'x',
        slotsOpen: 'y',
        priceValue: 'z',
      }),
    ).toEqual(['when', 'values', 'master']);
  });

  it('firstErrorField é o primeiro campo com erro na ordem das partes', () => {
    expect(firstErrorField(validateEditorAll(makeState()))).toBe('title');
    expect(
      firstErrorField({
        contacts: 'x',
        slotsOpen: 'y',
      }),
    ).toBe('slotsOpen');
    expect(firstErrorField({})).toBeNull();
  });
});
