/**
 * Aviso de backend indisponível (DT-012; migrado de `App.tsx` na spec 102 T4.2).
 *
 * Vive em módulo próprio desde que o framework mode substituiu o `App.tsx`: o
 * componente continua sendo o que o visitante vê durante um deploy, e perdê-lo
 * na migração deixaria a promoção beta→prod sem nenhum aviso na tela.
 *
 * O estado `loading` NÃO bloqueia mais o render da aplicação (ver `root.tsx`):
 * sob SSR isso faria todo request — inclusive o do crawler, que não executa JS —
 * renderizar a tela de espera no lugar da mesa.
 */
export function BackendStatusScreen({ status }: Readonly<{ status: 'loading' | 'unavailable' }>) {
  const unavailable = status === 'unavailable';
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: 'var(--surface)',
        color: 'var(--fg)',
      }}
    >
      <div style={{ textAlign: 'center', maxWidth: '500px', padding: '32px' }}>
        {unavailable && <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏳</div>}
        <div style={{ fontSize: '24px', marginBottom: '16px', fontWeight: unavailable ? 'bold' : undefined }}>
          {unavailable ? 'Atualização sendo executada' : 'Conectando ao backend...'}
        </div>
        <div style={{ fontSize: '14px', opacity: unavailable ? 0.8 : 0.6, marginBottom: unavailable ? '24px' : undefined }}>
          {unavailable
            ? 'Estamos trazendo a versão beta para a principal, aguarde um instante para terminarmos.'
            : 'Aguarde'}
        </div>
        {unavailable && (
          <button
            onClick={() => window.location.reload()}
            style={{ padding: '12px 24px', fontSize: '16px', cursor: 'pointer', borderRadius: '8px', border: 'none', backgroundColor: 'var(--color-artificio-orange)', color: 'white' }}
          >
            Tentar novamente
          </button>
        )}
      </div>
    </div>
  );
}
