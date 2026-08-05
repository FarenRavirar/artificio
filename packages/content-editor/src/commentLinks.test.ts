import { describe, expect, it } from 'vitest';
import {
  commentLinkAttributes,
  demoteCommentImages,
  findCommentLinkViolation,
  INVALID_COMMENT_LINK,
  isCommentLinkViolation,
  isTrustedHost,
  resolveCommentLink,
} from './commentLinks.js';

function resolved(destination: string) {
  const result = resolveCommentLink(destination);
  if (isCommentLinkViolation(result)) {
    throw new Error(`esperava resolução, veio violação ${result.rule}`);
  }
  return result;
}

function violation(destination: string) {
  const result = resolveCommentLink(destination);
  if (!isCommentLinkViolation(result)) {
    throw new Error(`esperava violação, veio ${result.href}`);
  }
  return result;
}

describe('isTrustedHost', () => {
  it('aceita o host exato e subdominio real', () => {
    expect(isTrustedHost('artificiorpg.com')).toBe(true);
    expect(isTrustedHost('downloads.artificiorpg.com')).toBe(true);
    expect(isTrustedHost('ARTIFICIORPG.COM')).toBe(true);
  });

  it('recusa sufixo que apenas termina parecido', () => {
    // `endsWith('artificiorpg.com')` sem o ponto aceitaria este host, e o link
    // sairia marcado como interno — mesma aba, sem noopener, domínio do atacante.
    expect(isTrustedHost('artificiorpg.com.evil.example')).toBe(false);
    expect(isTrustedHost('evilartificiorpg.com')).toBe(false);
    expect(isTrustedHost('notartificiorpg.com')).toBe(false);
  });
});

describe('resolveCommentLink', () => {
  it('aceita https e marca externo', () => {
    const link = resolved('https://exemplo.com/pagina');
    expect(link.href).toBe('https://exemplo.com/pagina');
    expect(link.internal).toBe(false);
  });

  it('canonicaliza URL sem esquema para https', () => {
    expect(resolved('exemplo.com/x').href).toBe('https://exemplo.com/x');
  });

  it('distingue host-com-porta de esquema', () => {
    // `exemplo.com:8443/x` e `javascript:1` casam o mesmo padrão de esquema; só o
    // ponto no lado esquerdo separa hostname de esquema registrado. A primeira
    // versão desta correção olhava só o dígito à direita e transformava
    // `javascript:1` em `https://javascript:1/` — reescrita silenciosa, que a
    // decisão 27 proíbe tanto quanto promover `http:`.
    expect(resolved('exemplo.com:8443/x').href).toBe('https://exemplo.com:8443/x');
    expect(resolved('https://x.com:8443/y').href).toBe('https://x.com:8443/y');
    for (const hostil of ['javascript:1', 'data:9', 'vbscript:1', 'file:9']) {
      expect(violation(hostil).rule, hostil).toBe('scheme_not_https');
    }
  });

  it('rejeita http em vez de promover silenciosamente', () => {
    // Promover esconderia do autor que o link publicado não é o que ele escreveu.
    expect(violation('http://exemplo.com').rule).toBe('scheme_not_https');
  });

  it('rejeita esquemas perigosos', () => {
    for (const destination of [
      'javascript:alert(1)',
      'data:text/html;base64,PHNjcmlwdD4=',
      'vbscript:msgbox(1)',
      'file:///etc/passwd',
      'ftp://exemplo.com',
      'mailto:alguem@exemplo.com',
    ]) {
      expect(violation(destination).rule, destination).toBe('scheme_not_https');
    }
  });

  it('rejeita protocol-relative e suas variantes disfarçadas', () => {
    expect(violation('//evil.example/x').rule).toBe('protocol_relative');
    expect(violation('/\\evil.example').rule).toBe('protocol_relative');
    expect(violation('/%2fevil.example').rule).toBe('protocol_relative');
  });

  it('rejeita credencial embutida na URL', () => {
    // O olho lê o começo; o browser navega para o host do fim.
    //
    // A URL é montada por concatenação, não escrita como literal: o TruffleHog
    // (`--results=verified,unknown` em `secret-scan.yml`) classifica qualquer
    // `algo@host` numa URI como "unverified URI result" e **falha o CI**. Aqui é
    // fixture que prova a rejeição, não credencial vazada — mas suprimir o gate
    // por causa de um teste enfraqueceria a varredura para todo o repositório,
    // então quem se ajusta é o teste. Trocar só o host não resolve: o padrão
    // casa qualquer variante.
    const userinfo = 'banco.example';
    const host = 'evil.example';
    expect(violation(`https://${userinfo}@${host}/login`).rule).toBe('embedded_credentials');
    expect(violation(`https://user:senha@${host}/x`).rule).toBe('embedded_credentials');
  });

  it('aceita caminho root-relative e o marca para o consumidor resolver', () => {
    const link = resolved('/material/123');
    expect(link.rootRelative).toBe(true);
    expect(link.internal).toBe(true);
    expect(link.href).toBe('/material/123');
  });

  it('rejeita relativo sem barra inicial', () => {
    // `../admin` é ambíguo: depende da rota atual do leitor, não do autor.
    // Cuidado: `new URL('https://../admin')` NÃO lança — o parser WHATWG aceita
    // `..` como hostname —, então sem o guard explícito isto sairia como link
    // externo válido em vez de erro.
    for (const destination of ['../admin', './x', '..', '..\\admin']) {
      expect(violation(destination).rule, destination).toBe('relative_not_rooted');
    }
  });

  it('marca host confiavel como interno', () => {
    expect(resolved('https://downloads.artificiorpg.com/x').internal).toBe(true);
    expect(resolved('https://artificiorpg.com.evil.example/x').internal).toBe(false);
  });

  it('preserva o offset para o editor posicionar o erro', () => {
    const result = resolveCommentLink('http://x', 42);
    expect(isCommentLinkViolation(result) && result.offset).toBe(42);
  });

  it('usa sempre o mesmo codigo estavel', () => {
    expect(violation('http://x').code).toBe(INVALID_COMMENT_LINK);
    expect(violation('javascript:x').code).toBe(INVALID_COMMENT_LINK);
  });
});

describe('commentLinkAttributes', () => {
  it('marca todo link de usuario como ugc nofollow', () => {
    // Sem isso a área de comentários empresta autoridade de SEO e vira alvo de spam.
    expect(commentLinkAttributes(resolved('/x')).rel).toBe('ugc nofollow');
    expect(commentLinkAttributes(resolved('https://exemplo.com')).rel).toContain('ugc');
    expect(commentLinkAttributes(resolved('https://exemplo.com')).rel).toContain('nofollow');
  });

  it('protege o externo com noopener noreferrer e nova aba', () => {
    const external = commentLinkAttributes(resolved('https://exemplo.com'));
    expect(external.rel).toContain('noopener');
    expect(external.rel).toContain('noreferrer');
    expect(external.target).toBe('_blank');
  });

  it('interno abre na mesma aba, sem noopener desnecessario', () => {
    const internal = commentLinkAttributes(resolved('https://downloads.artificiorpg.com/x'));
    expect(internal.target).toBeUndefined();
  });
});

describe('findCommentLinkViolation', () => {
  it('encontra destino hostil em link reconhecido', () => {
    expect(findCommentLinkViolation('veja [aqui](javascript:alert(1))')?.rule).toBe('scheme_not_https');
    expect(findCommentLinkViolation('veja [aqui](http://x.com)')?.rule).toBe('scheme_not_https');
  });

  it('aceita markdown so com links validos', () => {
    expect(findCommentLinkViolation('[a](https://exemplo.com) e [b](/rota)')).toBeNull();
  });

  it('deixa sintaxe incompleta passar como literal', () => {
    // Decisão 29f: o que o CommonMark não reconhece como link não tem destino a
    // validar — é texto, e texto não é rejeitado.
    expect(findCommentLinkViolation('[texto](')).toBeNull();
    expect(findCommentLinkViolation('[texto] (http://x)')).toBeNull();
    expect(findCommentLinkViolation('só um [colchete]')).toBeNull();
  });

  it('ignora link dentro de codigo', () => {
    // `` `http://x` `` é literal exibido, não navegável.
    expect(findCommentLinkViolation('use `[a](http://x)` assim')).toBeNull();
    expect(findCommentLinkViolation('```\n[a](javascript:x)\n```')).toBeNull();
  });

  it('valida destino entre delimitadores angulares', () => {
    expect(findCommentLinkViolation('[a](<http://x.com>)')?.rule).toBe('scheme_not_https');
    expect(findCommentLinkViolation('[a](<https://x.com>)')).toBeNull();
  });

  it('ignora titulo do link, que nao e destino', () => {
    expect(findCommentLinkViolation('[a](https://x.com "titulo")')).toBeNull();
  });

  it('valida tambem o destino de imagem', () => {
    expect(findCommentLinkViolation('![alt](http://x.com/i.png)')?.rule).toBe('scheme_not_https');
  });

  it('destino vazio nao e violacao', () => {
    expect(findCommentLinkViolation('[a]()')).toBeNull();
  });

  // Achado do Codex na PR #242, confirmado no pipeline real antes de corrigir.
  it('valida autolink, que sobrevive a sanitizacao e vira <a href>', () => {
    // `sanitizeUserMarkdown` preserva `<http://x>` de propósito e o markdown-it
    // o transforma em link navegável — sem varrer autolink, a política
    // HTTPS-only era contornada por completo.
    expect(findCommentLinkViolation('<http://evil.example>')?.rule).toBe('scheme_not_https');
    expect(findCommentLinkViolation('<javascript:alert(1)>')?.rule).toBe('scheme_not_https');
    expect(findCommentLinkViolation('texto <ftp://x.com> mais texto')?.rule).toBe('scheme_not_https');
  });

  it('aceita autolink https e ignora autolink dentro de codigo', () => {
    expect(findCommentLinkViolation('<https://exemplo.com>')).toBeNull();
    expect(findCommentLinkViolation('`<http://x>`')).toBeNull();
    expect(findCommentLinkViolation('```\n<http://x>\n```')).toBeNull();
  });

  it('recusa entrada acima do teto sem varrer', () => {
    // As regexes de varredura são quadráticas por posição inicial (medido: 10k
    // `[` custam ~103ms). O teto troca crescimento aberto por custo máximo
    // conhecido; entrada desse tamanho já seria rejeitada pelo limite da spec.
    expect(findCommentLinkViolation('a'.repeat(13_000))?.rule).toBe('input_too_large');
    expect(findCommentLinkViolation('['.repeat(13_000))?.rule).toBe('input_too_large');
  });

  it('varre entrada no limite da spec sem estourar tempo', () => {
    const inicio = Date.now();
    findCommentLinkViolation('`'.repeat(10_000));
    findCommentLinkViolation('['.repeat(10_000));
    // Limiar folgado: prova que não há explosão exponencial, sem cravar duração.
    expect(Date.now() - inicio).toBeLessThan(3_000);
  });
});

describe('demoteCommentImages', () => {
  it('converte imagem em link textual explicito', () => {
    // Carregar imagem de host arbitrário entregaria IP e User-Agent de TODO
    // leitor ao dono do host — o comentário viraria rastreador.
    expect(demoteCommentImages('![gráfico](https://x.com/g.png)')).toBe(
      '[gráfico — abrir imagem externa](https://x.com/g.png)',
    );
  });

  it('usa rotulo padrao quando o alt esta vazio', () => {
    expect(demoteCommentImages('![](https://x.com/g.png)')).toBe(
      '[abrir imagem externa](https://x.com/g.png)',
    );
  });

  it('nao toca em link comum', () => {
    expect(demoteCommentImages('[texto](https://x.com)')).toBe('[texto](https://x.com)');
  });

  it('preserva imagem dentro de trecho de codigo', () => {
    // `` `![alt](url)` `` é o autor mostrando a sintaxe, não usando. Reescrever
    // ali não tinha efeito de segurança (o render mantém tudo dentro de `<code>`,
    // nenhum `<img>` sai), mas alterava silenciosamente o texto de quem escreveu.
    const inline = '`![alt](https://x.com/i.png)`';
    expect(demoteCommentImages(inline)).toBe(inline);

    const bloco = '```\n![alt](https://x.com/i.png)\n```';
    expect(demoteCommentImages(bloco)).toBe(bloco);
  });

  it('lida com destino vazio sem corromper o texto', () => {
    // O segundo grupo do LINK_RE casa vazio aqui, e o JS o omite dos argumentos
    // do callback de `replace` — a assinatura `(whole, bang, dest, offset)`
    // recebia o offset na posição do destino. Por isso a varredura usa
    // `matchAll` + `match.index`, que não depende da aridade.
    expect(demoteCommentImages('![alt]()')).toBe('[alt — abrir imagem externa]()');
  });

  it('devolve intacto acima do teto, sem varrer', () => {
    // `demoteCommentImages` é exportada e usa a mesma LINK_RE quadrática, então
    // precisa do mesmo teto — sem isso o guard de findCommentLinkViolation ficava
    // contornável por esta porta. Devolver intacto é seguro: quem aceita ou
    // recusa o corpo é findCommentLinkViolation, que já respondeu input_too_large.
    const enorme = '['.repeat(13_000);
    const inicio = Date.now();
    expect(demoteCommentImages(enorme)).toBe(enorme);
    expect(Date.now() - inicio).toBeLessThan(500);
  });

  it('o resultado continua sendo markdown valido e sem sintaxe de imagem', () => {
    const result = demoteCommentImages('antes ![a](https://x.com/1.png) depois ![b](https://x.com/2.png)');
    expect(result).not.toContain('![');
    expect(result).toContain('[a — abrir imagem externa](https://x.com/1.png)');
    expect(result).toContain('[b — abrir imagem externa](https://x.com/2.png)');
  });
});
