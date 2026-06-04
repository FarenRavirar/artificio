# Guia de Testes — Mesas RPG Artifício

**Frameworks**: Jest (backend) + Vitest (frontend)  
**Instalação**: Abril/2026  
**Status**: Configuração inicial

---

## Onde Executar os Testes

**✅ Local** (sua máquina de desenvolvimento)  
**✅ CI/CD** (GitHub Actions — futuro)  
**❌ VM de produção/beta** (não executa testes)

**Justificativa**: Testes são ferramentas de desenvolvimento. A VM recebe apenas o código compilado (`dist/`).

---

## Backend — Jest

### Instalação

```bash
cd backend
npm install --save-dev jest @types/jest ts-jest
```

### Configuração

Criar `backend/jest.config.js`:

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.ts', '**/*.test.ts', '**/*.spec.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/server.ts',
  ],
  coverageDirectory: 'coverage',
  verbose: true,
};
```

### Scripts no package.json

Adicionar em `backend/package.json`:

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  }
}
```

### Estrutura de Testes

```
backend/
├── src/
│   ├── services/
│   │   ├── authService.ts
│   │   └── authService.test.ts
│   ├── repositories/
│   │   ├── tableRepository.ts
│   │   └── tableRepository.test.ts
│   └── utils/
│       ├── slugify.ts
│       └── slugify.test.ts
```

### Exemplo de Teste

```typescript
// backend/src/utils/slugify.test.ts
import { slugify } from './slugify';

describe('slugify', () => {
  it('deve converter texto para slug', () => {
    expect(slugify('Mesa de D&D 5e')).toBe('mesa-de-d-d-5e');
  });

  it('deve remover acentos', () => {
    expect(slugify('Aventura Épica')).toBe('aventura-epica');
  });

  it('deve lidar com caracteres especiais', () => {
    expect(slugify('Teste@#$%123')).toBe('teste-123');
  });
});
```

### Executar Testes

```bash
cd backend
npm test                  # Roda todos os testes
npm run test:watch        # Modo watch (re-executa ao salvar)
npm run test:coverage     # Gera relatório de cobertura
```

---

## Frontend — Vitest

### Instalação

```bash
cd frontend
npm install --save-dev vitest @vitest/ui
```

### Configuração

Criar `frontend/vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
  },
});
```

### Scripts no package.json

Adicionar em `frontend/package.json`:

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest run --coverage"
  }
}
```

### Estrutura de Testes

```
frontend/
├── src/
│   ├── components/
│   │   ├── TableCard.tsx
│   │   └── TableCard.test.tsx
│   ├── utils/
│   │   ├── formatDate.ts
│   │   └── formatDate.test.ts
│   └── test/
│       └── setup.ts
```

### Setup de Testes (opcional)

```typescript
// frontend/src/test/setup.ts
import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';

expect.extend(matchers);

afterEach(() => {
  cleanup();
});
```

### Exemplo de Teste

```typescript
// frontend/src/utils/formatDate.test.ts
import { describe, it, expect } from 'vitest';
import { formatDate } from './formatDate';

describe('formatDate', () => {
  it('deve formatar data no padrão brasileiro', () => {
    const date = new Date('2026-04-22T10:00:00Z');
    expect(formatDate(date)).toBe('22/04/2026');
  });

  it('deve lidar com datas inválidas', () => {
    expect(formatDate(null)).toBe('Data inválida');
  });
});
```

### Executar Testes

```bash
cd frontend
npm test                  # Roda todos os testes
npm run test:watch        # Modo watch (re-executa ao salvar)
npm run test:ui           # Interface visual (http://localhost:51204/__vitest__/)
npm run test:coverage     # Gera relatório de cobertura
```

---

## Integração com CI/CD (Futuro)

Adicionar ao `.github/workflows/ci.yml`:

```yaml
name: CI

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '22'
      
      - name: Install backend dependencies
        run: cd backend && npm ci
      
      - name: Run backend tests
        run: cd backend && npm test
      
      - name: Install frontend dependencies
        run: cd frontend && npm ci
      
      - name: Run frontend tests
        run: cd frontend && npm test
```

---

## Boas Práticas

### O que testar

✅ **Prioridade Alta**:
- Lógica de negócio (services, repositories)
- Utilitários (slugify, formatDate, validators)
- Transformações de dados
- Regras de permissão

✅ **Prioridade Média**:
- Componentes React (comportamento, não estilo)
- Hooks customizados
- Integrações de API

⚠️ **Prioridade Baixa**:
- Componentes puramente visuais
- Configurações
- Tipos TypeScript

### O que NÃO testar

❌ Código de terceiros (React, Express, Kysely)  
❌ Configurações de build (Vite, TypeScript)  
❌ Migrations SQL (validar manualmente)

### Cobertura de Código

**Meta recomendada**: 70-80% de cobertura

**Comando**:
```bash
# Backend
cd backend && npm run test:coverage

# Frontend
cd frontend && npm run test:coverage
```

**Relatório**: Gerado em `coverage/lcov-report/index.html`

---

## Troubleshooting

### Erro: "Cannot find module 'jest'"

**Solução**: Instalar dependências
```bash
cd backend && npm install
```

### Erro: "jsdom not found" (Vitest)

**Solução**: Instalar jsdom
```bash
cd frontend && npm install --save-dev jsdom
```

### Testes lentos

**Solução**: Usar `test:watch` para rodar apenas testes modificados

### Erro de importação de CSS no Vitest

**Solução**: Adicionar `css: true` no `vitest.config.ts`

---

## Próximos Passos

1. ✅ Frameworks instalados (Jest + Vitest)
2. ⏭️ Criar arquivos de configuração (`jest.config.js`, `vitest.config.ts`)
3. ⏭️ Adicionar scripts de teste no `package.json`
4. ⏭️ Escrever primeiros testes (utils, services)
5. ⏭️ Integrar com CI/CD (GitHub Actions)
6. ⏭️ Configurar cobertura de código

---

## Referências

- [Jest Documentation](https://jestjs.io/)
- [Vitest Documentation](https://vitest.dev/)
- [Testing Library](https://testing-library.com/)
- [Constitution § 5](../.specify/memory/constitution.md) — Convenções de teste do projeto
