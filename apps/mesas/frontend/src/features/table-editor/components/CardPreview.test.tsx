// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { createDefaultEditorState } from '../hooks/useTableEditor';
import type { TableEditorState } from '../types';
import { CardPreview } from './CardPreview';
import { editorStateToCardPreview } from './cardPreviewMapping';

/**
 * Prévia do card (T4.2b): o MAPPER (estado → TableCard de leitura, com os
 * mesmos normalizadores do payload) e o COMPONENTE (TableCardComponent real +
 * "Ver como jogador"). Harness do card real igual ao TableCard.test.tsx:
 * QueryClientProvider + MemoryRouter + useAuth sem sessão (o card não faz
 * fetch de favoritos sem autenticação).
 */
vi.mock('../../../contexts/useAuth', () => ({
  useAuth: () => ({ isAuthenticated: false }),
}));
vi.mock('../../../utils/auth', () => ({ startSsoLogin: vi.fn() }));

function makeState(overrides: Partial<TableEditorState> = {}): TableEditorState {
  return { ...createDefaultEditorState(), ...overrides };
}

describe('editorStateToCardPreview — estado do editor vira TableCard de leitura', () => {
  it('preço/slots/faixa passam pelos MESMOS normalizadores do payload', () => {
    const card = editorStateToCardPreview(
      makeState({
        title: 'Aventura',
        description: 'Descrição da mesa.',
        priceType: 'paga',
        priceValue: '55',
        slotsTotal: '5',
        slotsOpen: '3',
        ageRating: '+16',
      }),
    );
    expect(card.title).toBe('Aventura');
    expect(card.description).toBe('Descrição da mesa.');
    expect(card.price_type).toBe('paga');
    expect(card.price_value).toBe(55);
    expect(card.slots_total).toBe(5);
    expect(card.slots_open).toBe(3);
    expect(card.age_rating).toBe('+16');
    // Criação: sem status no estado → 'draft' (CTA "Ver detalhes" do card).
    expect(card.status).toBe('draft');
    expect(card.featured).toBe(false);
    expect(card.gm_slug).toBeNull();
  });

  it('gratuita zera o preço — mesma regra do payload (nunca acumula da modalidade oposta)', () => {
    const card = editorStateToCardPreview(makeState({ priceType: 'gratuita', priceValue: '30' }));
    expect(card.price_type).toBe('gratuita');
    expect(card.price_value).toBeNull();
  });

  it('next_schedule deriva do deriveSchedule: normal, personalizado e a definir', () => {
    const normal = editorStateToCardPreview(makeState());
    expect(normal.next_schedule).toMatchObject({
      day_of_week: 'segunda',
      start_time: '19:00',
      schedule_day_status: 'defined',
    });

    const personalizado = editorStateToCardPreview(
      makeState({
        isPersonalizedSchedule: true,
        schedules: [
          {
            day_of_week: 'to_define',
            start_time: '',
            frequency: 'semanal',
            is_ongoing: false,
            notes: 'Combinamos no grupo.',
            sort_order: 0,
          },
        ],
      }),
    );
    expect(personalizado.next_schedule).toMatchObject({
      schedule_day_status: 'to_define',
      notes: 'Combinamos no grupo.',
    });

    const aDefinir = editorStateToCardPreview(
      makeState({
        isPersonalizedSchedule: false,
        schedules: [
          {
            day_of_week: 'to_define',
            start_time: '',
            frequency: 'semanal',
            is_ongoing: false,
            notes: '',
            sort_order: 0,
          },
        ],
      }),
    );
    // Sem linha derivada o card cai no ramo default: sem bloco de horário.
    expect(aDefinir.next_schedule).toBeNull();
  });

  it('contatos no shape de LEITURA do catálogo (label null, sort_order, vazio filtrado)', () => {
    const card = editorStateToCardPreview(
      makeState({
        contacts: [
          { channel: 'whatsapp', value: '+5511', label: 'Zap', discord_server_url: '' },
          { channel: 'discord', value: '', label: '', discord_server_url: '' },
        ],
      }),
    );
    expect(card.contacts).toEqual([
      {
        channel: 'whatsapp',
        value: '+5511',
        label: 'Zap',
        discord_server_url: null,
        sort_order: 0,
      },
    ]);
  });

  it('system_name/logo/site vêm do catálogo (options); ausentes caem no default do card', () => {
    expect(editorStateToCardPreview(makeState()).system_name).toBeNull();
    const comSistema = editorStateToCardPreview(makeState(), {
      systemName: 'Dungeons & Dragons',
      systemLogoFilename: 'dnd.png',
      systemWebsiteUrl: 'https://dnd.example.com',
    });
    expect(comSistema.system_name).toBe('Dungeons & Dragons');
    expect(comSistema.system_logo_filename).toBe('dnd.png');
    expect(comSistema.system_website_url).toBe('https://dnd.example.com');
  });

  it('banner vira cover com crop e dimensões do estado; campos não lidos ficam nos defaults', () => {
    const card = editorStateToCardPreview(
      makeState({
        bannerUrl: 'https://cdn.example.com/x.jpg',
        bannerCropData: { x: 0, y: 10, width: 800, height: 400 },
        bannerWidth: 1600,
        bannerHeight: 800,
      }),
    );
    expect(card.cover_url).toBe('https://cdn.example.com/x.jpg');
    expect(card.cover_crop_data).toEqual({ x: 0, y: 10, width: 800, height: 400 });
    expect(card.cover_width).toBe(1600);
    expect(card.cover_height).toBe(800);
    expect(card.vtt_platform).toBeUndefined(); // ramo default: sem badge de VTT
  });
});

describe('CardPreview — componente (R22/A25)', () => {
  function renderPreview(state: TableEditorState) {
    const queryClient = new QueryClient();
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <CardPreview state={state} systemName="Dungeons & Dragons" />
        </MemoryRouter>
      </QueryClientProvider>,
    );
  }

  it('renderiza o card REAL (título como heading) e desabilita "Ver como jogador" sem página pública', () => {
    renderPreview(makeState({ title: 'Mesa de teste' }));

    expect(screen.getByText('Prévia do anúncio')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Mesa de teste' })).toBeInTheDocument();
    const button = screen.getByRole('button', { name: 'Ver como jogador' });
    expect(button).toBeDisabled();
  });

  it('com slug + status active o botão vira âncora para a página pública em nova aba', () => {
    renderPreview(
      makeState({ id: 't-1', slug: 'mesa-x', status: 'active', title: 'Mesa ativa' }),
    );

    const link = screen.getByRole('link', { name: 'Ver como jogador' });
    expect(link).toHaveAttribute('href', '/mesas/mesa-x');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('o card da prévia é inerte: espelho, não navegação', () => {
    const { container } = renderPreview(
      makeState({ id: 't-1', slug: 'mesa-x', status: 'active', title: 'Mesa' }),
    );
    const cardArea = container.querySelector('.table-editor-preview-card');
    expect(cardArea).not.toBeNull();
    expect(cardArea!.hasAttribute('inert')).toBe(true);
  });
});
