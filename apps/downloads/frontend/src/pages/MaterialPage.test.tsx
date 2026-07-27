import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MaterialPage } from './MaterialPage';
import * as authClientModule from '@artificio/auth/client';
import * as useMaterialModule from '../hooks/useMaterial';
import * as useMaterialMetadataModule from '../hooks/useMaterialMetadata';
import * as useFavoritesModule from '../hooks/useFavorites';
import * as useRegisterDownloadModule from '../hooks/useRegisterDownload';
import * as analyticsModule from '@artificio/analytics';

// Fase 7 (spec 086, T7.8) — primeiro teste da ficha (MaterialPage nunca teve
// .test.tsx antes desta spec). Cobre: com/sem metadata rica, com/sem
// descrição rica, com/sem capa, ficha legada (json_ld_generic, sem os
// campos novos) sem seção vazia nem "undefined", e HTML da descrição
// renderizado (não escapado como texto).

function baseMaterial(overrides: Partial<ReturnType<typeof useMaterialModule.useMaterial>['data']> = {}) {
  return {
    id: 'material-1',
    slug: 'material-1',
    title: 'Sylvania The Cursed County',
    summary: 'Um guia sombrio.',
    description: 'Descrição em texto puro.',
    material_type: 'suplemento',
    access_kind: 'external_link' as const,
    external_url: 'https://example.com',
    creator_id: 'creator-1',
    creator_slug: null,
    destination_id: 'dest-1',
    system_id: null,
    edition_id: null,
    system_name: null,
    edition_name: null,
    cover_image_url: null,
    credits: null,
    scenario: null,
    variant_name: null,
    system_path_slug: null,
    editorial_state: 'published' as const,
    created_at: '2026-07-01T00:00:00.000Z',
    updated_at: '2026-07-01T00:00:00.000Z',
    ...overrides,
  };
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/materiais/material-1']}>
        <Routes>
          <Route path="/materiais/:materialSlug" element={<MaterialPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function mockSession(overrides: Partial<ReturnType<typeof authClientModule.useSession>> = {}) {
  vi.spyOn(authClientModule, 'useSession').mockReturnValue({
    user: null,
    loading: false,
    ...overrides,
  } as unknown as ReturnType<typeof authClientModule.useSession>);
}

function mockMaterial(data: ReturnType<typeof baseMaterial> | null, overrides: Partial<ReturnType<typeof useMaterialModule.useMaterial>> = {}) {
  vi.spyOn(useMaterialModule, 'useMaterial').mockReturnValue({
    data,
    isLoading: false,
    isError: false,
    ...overrides,
  } as unknown as ReturnType<typeof useMaterialModule.useMaterial>);
}

function mockMetadata(data: Partial<ReturnType<typeof useMaterialMetadataModule.useMaterialMetadata>['data']> | null) {
  vi.spyOn(useMaterialMetadataModule, 'useMaterialMetadata').mockReturnValue({
    data,
    isLoading: false,
  } as unknown as ReturnType<typeof useMaterialMetadataModule.useMaterialMetadata>);
}

function mockFavorites() {
  vi.spyOn(useFavoritesModule, 'useFavorites').mockReturnValue({
    data: [],
    isLoading: false,
  } as unknown as ReturnType<typeof useFavoritesModule.useFavorites>);
  vi.spyOn(useFavoritesModule, 'useAddFavorite').mockReturnValue({
    mutate: vi.fn(),
  } as unknown as ReturnType<typeof useFavoritesModule.useAddFavorite>);
  vi.spyOn(useFavoritesModule, 'useRemoveFavorite').mockReturnValue({
    mutate: vi.fn(),
  } as unknown as ReturnType<typeof useFavoritesModule.useRemoveFavorite>);
}

describe('MaterialPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('ficha legada (sem metadata rica) renderiza sem seção vazia nem "undefined"', () => {
    mockSession();
    mockMaterial(baseMaterial());
    mockMetadata(null);
    mockFavorites();

    renderPage();

    expect(screen.getByText('Sylvania The Cursed County')).toBeInTheDocument();
    // Spec 088 (T1.4b) — a ficha usa a MESMA regra de capa do card: sem capa,
    // o que aparece e o placeholder desenhado, nao mais o texto "Sem capa".
    expect(screen.queryByText('Sem capa')).not.toBeInTheDocument();
    expect(screen.getByText('Descrição em texto puro.')).toBeInTheDocument();
    expect(screen.queryByText(/undefined/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Detalhes')).not.toBeInTheDocument();
    // Achado do gate de fase (T7.10): faixa de tiles é sempre visível, no
    // padrão real do print (temp/outra captura.png) — sem cenário/formato
    // reais, mostra "N/D" (como a loja de origem), nunca esconde a seção.
    expect(screen.getAllByText('N/D').length).toBe(2);
  });

  it('renderiza capa real quando cover_image_url existe', () => {
    mockSession();
    mockMaterial(baseMaterial({ cover_image_url: 'https://cdn.example.com/capa.jpg' }));
    mockMetadata(null);
    mockFavorites();

    renderPage();

    const cover = screen.getByAltText('Capa de Sylvania The Cursed County');
    expect(cover).toHaveAttribute('src', 'https://cdn.example.com/capa.jpg');
    expect(screen.queryByText('Sem capa')).not.toBeInTheDocument();
  });

  it('ficha completa mostra cenário, autores, tiles e bloco DETALHES', () => {
    mockSession();
    mockMaterial(baseMaterial());
    mockMetadata({
      material_id: 'material-1',
      scenario: 'Warhammer',
      publisher_name: null,
      credits: 'Cam, Renan Menon',
      license_kind: null,
      license_url: null,
      file_format: 'PDF',
      file_size_text: '1,16 MB',
      page_count: 98,
      creation_method: 'Método de criação não escolhido pelo editor',
      source_category: 'Warhammer Fantasy Roleplay Fourth Edition',
      source_filters: [{ facet: 'tipoDeProduto', path: ['Aventuras', '3.ª Categoria (Níveis 11-16)'] }],
      description_html: null,
      language: 'pt',
    });
    mockFavorites();

    renderPage();

    expect(screen.getByText('Para Warhammer')).toBeInTheDocument();
    expect(screen.getByText('Por Cam, Renan Menon')).toBeInTheDocument();
    expect(screen.getAllByText('98').length).toBeGreaterThan(0);
    expect(screen.getByText('Detalhes')).toBeInTheDocument();
    expect(screen.getByText('3.ª Categoria (Níveis 11-16)')).toBeInTheDocument();
  });

  it('renderiza a descrição rica como HTML, não como texto escapado', () => {
    mockSession();
    mockMaterial(baseMaterial());
    mockMetadata({
      material_id: 'material-1',
      scenario: null,
      publisher_name: null,
      credits: null,
      license_kind: null,
      license_url: null,
      file_format: null,
      file_size_text: null,
      page_count: null,
      creation_method: null,
      source_category: null,
      source_filters: null,
      description_html: '<p>Descrição <strong>rica</strong>.</p>',
      language: 'pt',
    });
    mockFavorites();

    renderPage();

    const strong = screen.getByText('rica');
    expect(strong.tagName).toBe('STRONG');
    expect(screen.queryByText('<p>Descrição <strong>rica</strong>.</p>')).not.toBeInTheDocument();
  });
});

// Spec 088 (T1.9-T1.13) — o acesso ao material virou ancora nativa em nova
// aba. O botao anterior navegava na mesma aba e o usuario perdia a ficha que
// estava lendo.
describe('MaterialPage - acesso ao material', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function setup(material = baseMaterial()) {
    mockSession();
    mockMaterial(material);
    mockMetadata(null);
    mockFavorites();
    return renderPage();
  }

  it('abre o destino em nova aba por ancora nativa, nao por botao', () => {
    setup();

    const cta = screen.getByRole('link', { name: 'Acessar material' });
    expect(cta.tagName).toBe('A');
    expect(cta).toHaveAttribute('target', '_blank');
    // `window.open` chamado depois do await da API perderia o gesto do
    // usuario e seria bloqueado por popup blocker — por isso ancora.
    expect(screen.queryByRole('button', { name: 'Acessar material' })).not.toBeInTheDocument();
  });

  it('carrega rel="noopener noreferrer" (seguranca, nao formalidade)', () => {
    setup();

    const rel = screen.getByRole('link', { name: 'Acessar material' }).getAttribute('rel') ?? '';
    // Sem `noopener`, o destino recebe `window.opener` e pode manipular a aba
    // de origem; sem `noreferrer`, o `Referer` vaza a URL de origem.
    expect(rel).toContain('noopener');
    expect(rel).toContain('noreferrer');
  });

  it('aponta para a rota interna opaca, nunca para a URL externa', () => {
    setup(baseMaterial({ external_url: 'https://exemplo-externo.test/arquivo.pdf' }));

    const cta = screen.getByRole('link', { name: 'Acessar material' });
    // DEB-073-02 — `destination_id` opaco: a URL real nao e pre-resolvida nem
    // embutida no HTML, o que faz o link sobreviver a troca futura de slug.
    expect(cta).toHaveAttribute('href', '/ir/dest-1');
    expect(document.body.innerHTML).not.toContain('exemplo-externo.test');
  });

  // T1.11 — trocar o elemento NAO pode custar a instrumentacao de funil: o
  // handler perdeu o `navigate` final, mas mantem `trackEvent` e o registro
  // de download, disparados antes da navegacao como antes.
  it('dispara o evento de funil no clique da ancora', () => {
    const trackEvent = vi.spyOn(analyticsModule, 'trackEvent').mockImplementation(() => undefined);
    setup();

    fireEvent.click(screen.getByRole('link', { name: 'Acessar material' }));

    expect(trackEvent).toHaveBeenCalledWith(
      'download_cta_click',
      expect.objectContaining({ material_id: 'material-1', material_slug: 'material-1' }),
    );
  });

  // Spec 088 — o registro NAO acontece mais no clique: `onClick` so dispara no
  // clique primario, entao botao do meio e "Abrir em nova aba" perderiam a
  // metrica e deixariam o usuario inelegivel pra avaliar. Quem registra agora
  // e a rota `/ir/:destinationId` no backend, que toda abertura atravessa
  // (coberto em `routes/destinations.test.ts`).
  it('nao registra download no clique — quem registra e a rota de destino', () => {
    const mutate = vi.fn();
    vi.spyOn(useRegisterDownloadModule, 'useRegisterDownload').mockReturnValue({
      mutate,
    } as unknown as ReturnType<typeof useRegisterDownloadModule.useRegisterDownload>);
    vi.spyOn(analyticsModule, 'trackEvent').mockImplementation(() => undefined);
    // `as unknown as ...` e o idioma do arquivo (ver `mockSession` acima);
    // `as never` silenciava a checagem em vez de declarar o shape parcial.
    mockSession({ user: { id: 'user-1' } } as unknown as Partial<
      ReturnType<typeof authClientModule.useSession>
    >);
    mockMaterial(baseMaterial());
    mockMetadata(null);
    mockFavorites();
    renderPage();

    fireEvent.click(screen.getByRole('link', { name: 'Acessar material' }));

    expect(mutate).not.toHaveBeenCalled();
  });

  it('material sem destino segue mostrando aviso, sem link clicavel', () => {
    setup(baseMaterial({ external_url: null }));

    expect(screen.queryByRole('link', { name: 'Acessar material' })).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(/temporariamente indispon/i);
  });
});
