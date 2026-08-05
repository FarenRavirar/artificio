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
    expect(violation('https://banco.example@evil.example/login').rule).toBe('embedded_credentials');
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

  it('o resultado continua sendo markdown valido e sem sintaxe de imagem', () => {
    const result = demoteCommentImages('antes ![a](https://x.com/1.png) depois ![b](https://x.com/2.png)');
    expect(result).not.toContain('![');
    expect(result).toContain('[a — abrir imagem externa](https://x.com/1.png)');
    expect(result).toContain('[b — abrir imagem externa](https://x.com/2.png)');
  });
});
