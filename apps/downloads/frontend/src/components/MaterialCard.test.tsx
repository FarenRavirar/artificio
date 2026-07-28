import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MaterialCard } from './MaterialCard';
import type { Material } from '../types/material';

// Fase 6 (spec 086, T6.4): estende cobertura pra capa condicional (onError →
// placeholder), autores (credits), cenário e cadeia de sistema/edição/variante.

// T6.2 (spec 073) — card tem alvo de clique unico e nao trunca nome cego.

const baseMaterial: Material = {
  id: 'mat-1',
  slug: 'aventura-exemplo',
  title: 'Uma Aventura de Exemplo com Nome Bem Longo',
  summary: 'Resumo curto da aventura.',
  description: null,
  material_type: 'adventure',
  access_kind: 'external_link',
  external_url: 'https://example.test/arquivo.pdf',
  creator_id: 'user-1',
  creator_slug: 'criador-exemplo',
  editorial_state: 'published',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

function renderCard(material: Material = baseMaterial) {
  return render(
    <MemoryRouter>
      <MaterialCard material={material} />
    </MemoryRouter>,
  );
}

describe('MaterialCard', () => {
  it('renderiza titulo completo sem truncar', () => {
    renderCard();
    expect(screen.getByText(baseMaterial.title)).toBeInTheDocument();
  });

  it('tem um unico link como alvo de clique, apontando para a ficha', () => {
    renderCard();
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute('href', `/materiais/${baseMaterial.slug}`);
  });

  it('mostra badge de tipo e de acesso', () => {
    renderCard();
    expect(screen.getByText('adventure')).toBeInTheDocument();
    expect(screen.getByText('Link externo')).toBeInTheDocument();
  });

  // Spec 088 (T1.8) — o placeholder deixou de ser um retangulo cinza com o
  // texto "Sem capa" e virou desenho (SVG inline). Os testes abaixo provam o
  // que mudou: nao existe mais texto anunciando a ausencia, e o desenho e
  // DECORATIVO — nao tem nome acessivel competindo com o titulo do material.
  it('mostra placeholder desenhado quando não há capa, sem texto "Sem capa"', () => {
    renderCard();
    expect(screen.queryByText('Sem capa')).not.toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('placeholder não tem nome acessível (é decorativo)', () => {
    const { container } = renderCard();
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute('aria-hidden', 'true');
  });

  // O desenho varia por `material_type` pra que uma prateleira de materiais
  // sem capa nao seja uma fileira de retangulos identicos.
  it('placeholder varia por material_type', () => {
    const { container: adventure } = renderCard({ ...baseMaterial, material_type: 'Aventura' });
    const adventurePath = adventure.querySelector('svg path')?.getAttribute('d');

    cleanup();

    const { container: setting } = renderCard({ ...baseMaterial, material_type: 'Cenário' });
    const settingPath = setting.querySelector('svg path')?.getAttribute('d');

    expect(adventurePath).toBeTruthy();
    expect(settingPath).toBeTruthy();
    expect(adventurePath).not.toBe(settingPath);
  });

  it('tipo desconhecido cai num placeholder padrão sem quebrar', () => {
    const { container } = renderCard({ ...baseMaterial, material_type: 'tipo-que-nao-existe' });
    expect(container.querySelector('svg path')?.getAttribute('d')).toBeTruthy();
  });

  it('mostra capa real quando cover_image_url existe', () => {
    renderCard({ ...baseMaterial, cover_image_url: 'https://example.test/capa.jpg' });
    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://example.test/capa.jpg');
  });

  // Spec 088 (T1.1) — a capa CONTEM, nunca corta: `object-cover` recortava
  // topo e base, justamente onde vive o titulo numa capa vertical de RPG.
  it('capa real usa object-contain e respeita piso e teto de altura', () => {
    const { container } = renderCard({ ...baseMaterial, cover_image_url: 'https://example.test/capa.jpg' });
    const img = screen.getByRole('img');
    expect(img.className).toContain('object-contain');
    expect(img.className).not.toContain('object-cover');

    // O TETO fica na imagem, nao no frame: no frame, o `overflow-hidden`
    // CORTARIA a capa alta em vez de reduzi-la proporcionalmente — e cortar e
    // o que a regra existe pra impedir (requisito 22).
    expect(img.className).toContain('max-h-44');
    // Largura deriva da altura e nunca ultrapassa o card, entao capa
    // horizontal/quadrada cai na mesma regra sem caso especial (requisito 23).
    expect(img.className).toContain('w-auto');
    expect(img.className).toContain('max-w-full');

    // O PISO fica no frame: e ele que mantem a silhueta compativel entre card
    // com capa e card sem capa (requisito 24).
    const frame = container.querySelector('.min-h-32');
    expect(frame).not.toBeNull();
    // O frame nao pode cortar nada.
    expect(frame?.className).not.toContain('overflow-hidden');
  });

  // Requisito 24 — o placeholder ocupa altura dentro da MESMA faixa da capa
  // real; se saísse dela, a prateleira desalinharia entre card com e sem capa.
  it('placeholder ocupa altura dentro da faixa piso-teto', () => {
    const { container } = renderCard();
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('class')).toContain('h-40');
  });

  it('cai pro placeholder desenhado quando a capa falha ao carregar (onError)', () => {
    const { container } = renderCard({ ...baseMaterial, cover_image_url: 'https://example.test/quebrada.jpg' });
    fireEvent.error(screen.getByRole('img'));

    // Imagem quebrada seria pior que o placeholder — o desenho E o tratamento
    // de falha, por isso nao depende de rede pra aparecer.
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(container.querySelector('svg')).not.toBeNull();
  });

  // Spec 087 (T2.5) — o credito e a ASSINATURA do card: sobe acima do titulo.
  //
  // Spec 088 (T1.5/T1.7) — o que mudou: editora e autoria viraram campos
  // DISTINTOS, cada um com seu rotulo, publicante primeiro. E o fallback
  // 'Acervo Artificio' morreu: o Artificio nao e autor de material importado
  // de terceiro, e afirmar isso contradiz o proposito do produto (D107/D119).
  // Os casos abaixo quebram se alguem reintroduzir o fallback OU passar a
  // exibir editora sob rotulo de autoria.
  it('preserva credits legado sem afirmar papel de autoria', () => {
    renderCard({ ...baseMaterial, credits: 'Autora Exemplo' });
    expect(screen.getByText('Autora Exemplo')).toBeInTheDocument();
    expect(screen.getByText('Créditos:')).toBeInTheDocument();
  });

  it('mostra a editora rotulada quando há publisher_name', () => {
    renderCard({ ...baseMaterial, publisher_name: 'Editora Exemplo' });
    expect(screen.getByText('Editora Exemplo')).toBeInTheDocument();
    expect(screen.getByText('Editora/selo:')).toBeInTheDocument();
    // Editora NUNCA aparece como autoria — nao existe rotulo "Por" aqui.
    expect(screen.queryByText('Por')).not.toBeInTheDocument();
  });

  it('mostra editora e autor juntos, publicante primeiro', () => {
    renderCard({
      ...baseMaterial,
      publisher_name: 'Editora Exemplo',
      authors: ['Autora Exemplo'],
      author_keys: ['autora exemplo'],
    });

    const eyebrow = screen.getByText('Editora Exemplo').closest('p');
    expect(eyebrow).not.toBeNull();
    // A ordem e decisao do mantenedor (2026-07-26): editora antes de autor.
    expect(eyebrow?.textContent?.indexOf('Editora Exemplo')).toBeLessThan(
      eyebrow?.textContent?.indexOf('Autora Exemplo') ?? -1,
    );
  });

  it('facetas estruturadas são links independentes e não exibem idioma', () => {
    renderCard({
      ...baseMaterial,
      publisher_name: 'Grimórios & Dados Editora',
      publisher_key: 'grimorios e dados',
      authors: ['Ágata'],
      author_keys: ['agata'],
      system_id: 'opera-rpg',
      system_name: 'OPERA RPG',
    });

    const publisherLink = screen.getByRole('link', { name: 'Grimórios & Dados Editora' });
    const authorLink = screen.getByRole('link', { name: 'Ágata' });
    const systemLink = screen.getByRole('link', { name: 'Ver materiais de OPERA RPG' });
    expect(publisherLink).toHaveAttribute('href', '/catalogo?publisher=grimorios%20e%20dados');
    expect(authorLink).toHaveAttribute('href', '/catalogo?author=agata');
    expect(systemLink).toHaveAttribute('href', '/catalogo?system_id=opera-rpg');
    for (const link of [publisherLink, authorLink, systemLink]) {
      expect(link).toHaveClass('relative', 'z-10');
      expect(link.className).toContain('focus-visible:');
    }
    expect(screen.queryByText('Em português')).not.toBeInTheDocument();
  });

  it('não inventa link de faceta quando a chave normalizada está ausente', () => {
    renderCard({ ...baseMaterial, authors: ['Autora sem chave'], author_keys: [] });
    expect(screen.getByText('Autora sem chave')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Autora sem chave' })).not.toBeInTheDocument();
  });

  it('não renderiza eyebrow quando não há editora nem autor', () => {
    renderCard();
    expect(screen.queryByText('Acervo Artifício')).not.toBeInTheDocument();
    expect(screen.queryByText('Editora')).not.toBeInTheDocument();
    expect(screen.queryByText('Por')).not.toBeInTheDocument();
  });

  // Os dois campos vem de scraper e de formulario, entao `""` e `"   "`
  // chegam ate o componente e passariam por um null-check ingenuo, deixando um
  // eyebrow em branco (achado de review da PR #214).
  it('trata string vazia e só-espaços como ausência', () => {
    renderCard({ ...baseMaterial, publisher_name: '   ', credits: '' });
    expect(screen.queryByText('Editora')).not.toBeInTheDocument();
    expect(screen.queryByText('Por')).not.toBeInTheDocument();
  });

  // T1.6 — o card sem eyebrow tem que continuar coerente na prateleira: sem
  // colapso de layout e sem titulo encostando na borda da capa. Altura
  // variavel entre cards e custo aceito da decisao; layout quebrado nao.
  it('card sem eyebrow nao deixa o titulo encostar na capa', () => {
    const { container: semCredito } = renderCard();
    // Sem eyebrow o titulo nao herda o respiro de um elemento ausente...
    expect(screen.getByRole('heading', { level: 3 }).className).not.toContain('mt-1.5');
    // ...e o card continua inteiro (nenhum colapso de estrutura).
    expect(semCredito.querySelector('article')).not.toBeNull();

    cleanup();

    renderCard({ ...baseMaterial, credits: 'Autora Exemplo' });
    // Com eyebrow, o espacamento volta.
    expect(screen.getByRole('heading', { level: 3 }).className).toContain('mt-1.5');
  });

  it('mostra estrelas e contagem quando há avaliações', () => {
    renderCard({ ...baseMaterial, avg_rating: 4.1, rating_count: 7 });
    expect(screen.getByText('4,1')).toBeInTheDocument();
    expect(screen.getByText('(7 avaliações)')).toBeInTheDocument();
    expect(screen.getByText('Avaliação 4,1 de 5 em 7 avaliações')).toBeInTheDocument();
  });

  it('não mostra bloco de avaliação quando rating_count é 0', () => {
    renderCard({ ...baseMaterial, avg_rating: null, rating_count: 0 });
    expect(screen.queryByText(/avaliaç/i)).not.toBeInTheDocument();
  });

  it('mantém alvo de clique único mesmo com estrelas presentes', () => {
    // As estrelas sao <span>, nunca <button>: se virarem focaveis, roubam o
    // clique do <Link> que cobre o card via before:absolute.
    renderCard({ ...baseMaterial, avg_rating: 4.5, rating_count: 12 });
    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('mostra "Para <cenário>" quando há cenário', () => {
    renderCard({ ...baseMaterial, scenario: 'Mundo pós-apocalíptico' });
    expect(screen.getByText('Para Mundo pós-apocalíptico')).toBeInTheDocument();
  });

  it('não mostra linha de cenário quando ausente', () => {
    renderCard();
    expect(screen.queryByText(/^Para /)).not.toBeInTheDocument();
  });

  it('mostra cadeia de sistema/edição/variante quando presente', () => {
    renderCard({ ...baseMaterial, system_name: 'D&D', edition_name: '5ª Edição', variant_name: null });
    expect(screen.getByText('D&D › 5ª Edição')).toBeInTheDocument();
  });

  it('não mostra badge de sistema quando ausente', () => {
    renderCard();
    expect(screen.queryByText(/D&D/)).not.toBeInTheDocument();
  });

  it('renderiza sem "undefined" quando nenhum campo novo está presente', () => {
    const { container } = renderCard();
    expect(container.textContent).not.toContain('undefined');
  });
});
