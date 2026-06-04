Abaixo está o plano mais seguro para esse projeto, com um ajuste importante logo no início:

**correção crítica do plano anterior:** no estado atual da documentação oficial, o **PMD CPD suporta TypeScript**, mas os flags `--ignore-identifiers` e `--ignore-literals` documentados oficialmente **não se aplicam a TypeScript**. Eles aparecem como suportados para **Java e C++**, não para TS. Então o CPD **não pode** ser usado, neste projeto, como “confirmador de clones estruturais com variáveis renomeadas” em TypeScript. Isso muda a estratégia. ([PMD][1])

Com isso, o fluxo realmente seguro para o **Artifício Mesas** fica assim:

1. **congelar uma linha de base**
2. **mapear duplicação literal com jscpd**
3. **triagem humana por categorias**
4. **refatorar só em blocos pequenos e isolados**
5. **validar a cada extração**
6. **só depois ligar governança contínua com SonarQube e ESLint/SonarJS**

Esse fluxo conversa com o seu cenário real: base **100% TypeScript**, frontend com **TSX**, backend com **Node + Express + Kysely**, suspeitas já conhecidas em `gmPanel.ts`, `gm.ts`, `tables.ts`, `TableCard.tsx`, `MesaPage.tsx` e `MestrePage.tsx`, além de duplicação estimada de 15 a 20%. Isso vem diretamente do diagnóstico que foi colado na conversa.

---

# 1. O que não fazer

Antes do passo a passo, vale fixar quatro proibições. Elas evitam quebrar código.

## 1.1 Não sair extraindo função em lote

Nada de pegar 20 ocorrências do relatório e já criar um utilitário genérico. Primeiro se mede, depois se agrupa, depois se extrai **uma família por vez**.

## 1.2 Não usar CPD em TypeScript esperando “ignorar identificadores”

Esse é o erro mais perigoso nas respostas anteriores. Em TS, o PMD CPD é útil como detector secundário, mas **não** como detector estrutural com renomeações ignoradas. ([PMD][1])

## 1.3 Não ligar quality gate no legado inteiro logo no começo

O Sonar way foca em **novo código**, e a condição padrão dele mantém a duplicação em código novo em **até 3%**. Para um legado já conhecido como duplicado, travar o repositório inteiro no dia 1 só cria ruído. ([Sonar Documentation][2])

## 1.4 Não confiar que o ESLint substitui detector de clones

O `eslint-plugin-sonarjs` é útil para reforço local e qualidade geral, mas ele não substitui a auditoria de duplicação do jscpd nem a medição do SonarQube. O plugin atual também mudou bastante: hoje a linha 3.x é a vigente, e a configuração difere entre ESLint 8 e 9. ([npm][3])

---

# 2. Ferramentas que entram, em qual ordem, e por quê

## 2.1 Ferramenta principal: jscpd

Ele é a ferramenta certa para a primeira varredura porque foi feito para esse tipo de uso, trabalha por CLI, suporta **150+ formatos**, usa **Rabin-Karp**, gera relatórios em **HTML, JSON e XML**, e foi desenhado para uso em CI. O relatório HTML oficial gera uma visão navegável com lista de duplicações e comparação lado a lado. ([jscpd][4])

## 2.2 Ferramenta secundária: PMD CPD

Ele entra como **segunda opinião**, não como ferramenta principal. É útil porque suporta TypeScript para CPD e tem boa integração CLI. Mas, para este projeto, deve ser usado apenas como **detector secundário em `.ts`**, não como detector de renomeações em TS. ([PMD][1])

## 2.3 Governança contínua: SonarQube Community Build

Ele entra **depois** da primeira limpeza. O motivo é simples: o Sonar mede duplicação com critérios próprios. Em projetos não Java, ele exige **100 tokens sucessivos duplicados** distribuídos em pelo menos **10 linhas** para outras linguagens, e o quality gate padrão Sonar way limita a duplicação no **novo código** a **3%**. Também permite excluir arquivos da checagem com `sonar.cpd.exclusions`. ([Sonar Documentation][5])

## 2.4 ESLint com sonarjs

Entra por último, como reforço local de qualidade. O plugin atual `eslint-plugin-sonarjs` está na faixa **3.0.5**, foi publicado há poucos dias, e a configuração recomendada muda conforme a versão do ESLint: `recommended` no ESLint 9 e `recommended-legacy` no ESLint 8. ([npm][3])

## 2.5 O que fica fora do fluxo principal

`dcd`, `NiCad`, `Deckard`, `SourcererCC` e similares podem existir como camada exploratória, mas **não** entram no procedimento principal “à prova de falhas”. O motivo é prático: para este projeto, eles aumentam setup, ambiguidade e custo de interpretação. O fluxo principal precisa ser estável, simples e reproduzível.

---

# 3. Visão geral do procedimento

## Fase A, preparação e linha de base

Objetivo: garantir que toda mudança posterior possa ser revertida.

## Fase B, auditoria de duplicação

Objetivo: obter relatórios confiáveis sem tocar no código.

## Fase C, triagem e priorização

Objetivo: separar duplicação que deve ser unificada da duplicação que deve ser ignorada.

## Fase D, refatoração segura

Objetivo: extrair um utilitário ou repositório por vez, com validação a cada passo.

## Fase E, blindagem

Objetivo: impedir regressão futura com Sonar e lint.

---

# 4. Fase A, preparação e linha de base

## 4.1 Criar uma branch exclusiva

Checklist:

* [ ] confirmar branch atual
* [ ] salvar estado limpo
* [ ] criar branch de trabalho só para duplicação
* [ ] não misturar com feature nova

Comandos:

```bash
git rev-parse --show-toplevel
git branch --show-current
git status
git checkout -b chore/dedup-audit
```

Critério de saída:

* a branch nova existe
* `git status` está limpo ou os arquivos já alterados foram conscientemente preservados

## 4.2 Descobrir o gerenciador e scripts reais, sem adivinhação

Não presumir `npm`, `pnpm` ou `yarn`. Primeiro verificar.

Checklist:

* [ ] existe `package-lock.json`?
* [ ] existe `pnpm-lock.yaml`?
* [ ] existe `yarn.lock`?
* [ ] listar scripts reais do root, backend e frontend

Comandos:

```bash
ls
ls backend
ls frontend
cat package.json
cat backend/package.json
cat frontend/package.json
```

Se houver `jq`:

```bash
cat package.json | jq '.scripts'
cat backend/package.json | jq '.scripts'
cat frontend/package.json | jq '.scripts'
```

Critério de saída:

* sabe-se exatamente quais scripts já existem para build, lint, test e dev
* não se inventa comando

## 4.3 Registrar baseline do estado atual

Isso é obrigatório porque a limpeza de duplicação costuma mover arquivos, extrair funções e alterar imports.

Checklist:

* [ ] rodar typecheck atual
* [ ] rodar lint atual
* [ ] rodar build atual
* [ ] salvar saída em pasta de baseline
* [ ] registrar hash do commit

Estrutura sugerida:

```bash
mkdir -p reports/baseline
git rev-parse HEAD > reports/baseline/commit.txt
```

Agora use **os comandos reais do projeto**, não comandos presumidos. Exemplo de processo:

```bash
# exemplo, substituir pelos scripts reais encontrados
npm run lint > reports/baseline/lint.txt 2>&1
npm run build > reports/baseline/build.txt 2>&1
npm run test > reports/baseline/test.txt 2>&1
```

Se backend e frontend têm scripts separados:

```bash
cd backend && npm run lint > ../reports/baseline/backend-lint.txt 2>&1
cd backend && npm run build > ../reports/baseline/backend-build.txt 2>&1
cd frontend && npm run lint > ../reports/baseline/frontend-lint.txt 2>&1
cd frontend && npm run build > ../reports/baseline/frontend-build.txt 2>&1
```

Critério de saída:

* há um retrato objetivo do estado antes da refatoração
* qualquer quebra posterior pode ser comparada contra esse baseline

## 4.4 Criar um inventário de hotspots já conhecidos

Antes de qualquer ferramenta, fixar os alvos conhecidos do diagnóstico:

* backend:

  * `backend/src/routes/tables.ts`
  * `backend/src/routes/gm.ts`
  * `backend/src/routes/gmPanel.ts`
* frontend:

  * `frontend/src/components/TableCard.tsx`
  * `frontend/src/pages/MesaPage.tsx`
  * `frontend/src/pages/MestrePage.tsx`

Também marcar arquivos estruturalmente perigosos:

* `gmPanel.ts`, arquivo muito grande
* `MestrePage.tsx`, página grande
* tipos duplicados entre backend e frontend
* possíveis utilitários espalhados por páginas e componentes

Critério de saída:

* há uma lista de alvos “suspeitos” antes da ferramenta apontar dezenas de casos menores

---

# 5. Fase B, auditoria de duplicação

# 5.1 Instalar jscpd localmente, não globalmente

A instalação local evita variação entre máquinas.

Checklist:

* [ ] instalar no root
* [ ] confirmar versão
* [ ] não rodar com threshold que falha build ainda

Comando:

```bash
npm install --save-dev jscpd
npx jscpd --version
```

Se o projeto usar `pnpm`:

```bash
pnpm add -D jscpd
pnpm exec jscpd --version
```

## 5.2 Criar configuração dedicada do jscpd

A ideia é padronizar a execução. O relatório HTML oficial é suportado e pode ser redirecionado para uma pasta customizada por `.jscpd.json`. ([jscpd][6])

Arquivo sugerido: `.jscpd.json`

```json
{
  "reporters": ["console", "html", "json"],
  "output": "./reports/jscpd",
  "minLines": 8,
  "minTokens": 60,
  "threshold": 100,
  "ignore": [
    "**/node_modules/**",
    "**/dist/**",
    "**/build/**",
    "**/coverage/**",
    "**/.vite/**",
    "**/*.d.ts",
    "**/database/**",
    "**/backend/src/migrations/**",
    "**/*.sql",
    "**/*.spec.*",
    "**/*.test.*"
  ]
}
```

### Por que esses valores

`minLines: 8` e `minTokens: 60` são um ponto inicial conservador para TS/TSX. Não são “padrões oficiais”. São valores operacionais para reduzir ruído em imports, guards curtos e helpers muito pequenos. O jscpd documenta o conceito de threshold, relatórios e uso em CLI/CI, mas a calibragem fina é da equipe. ([jscpd][4])

### Por que `threshold: 100`

Porque no começo **não se quer quebrar a execução**. A própria homepage do jscpd destaca que threshold serve para falhar build. No estágio inicial, isso deve ficar desligado na prática. Um threshold alto evita interromper a auditoria. ([jscpd][4])

## 5.3 Rodar o jscpd em modo de auditoria

Comando:

```bash
npx jscpd backend/src frontend/src
```

Se não usar o arquivo de config:

```bash
npx jscpd backend/src frontend/src \
  --min-lines 8 \
  --min-tokens 60 \
  --reporters console,html,json \
  --output reports/jscpd
```

Resultado esperado:

* console com pares de clones
* JSON para processamento posterior
* HTML em `reports/jscpd/html/index.html` quando a saída é customizada, ou em `./report/html/index.html` por padrão quando não há `output` customizado. ([jscpd][6])

## 5.4 Ler o relatório corretamente

O jscpd é muito bom como **mapa inicial**, mas o relatório vem em pares. Então um mesmo bloco repetido 4 vezes pode aparecer como vários pares. Isso não é erro, é característica do tipo de saída que ele mostra na documentação e na homepage. ([jscpd][4])

### Como ler sem se enganar

Separar cada ocorrência em uma destas classes:

**Classe A, duplicação operacional**
Trechos que fazem a mesma regra de negócio e devem virar função compartilhada ou repositório.

**Classe B, duplicação de apresentação**
Formatação de preço, vagas, horários, rótulos, badges, datas.

**Classe C, duplicação aceitável**
Guard clauses curtas, estruturas de rota muito simples, boilerplate mínimo de React ou Express.

**Classe D, falso positivo prático**
Trechos pequenos que são iguais por obrigação do framework.

## 5.5 Criar planilha ou markdown de triagem

Arquivo sugerido: `reports/jscpd/TRIAGEM.md`

Modelo:

```md
# Triagem de duplicações

## Prioridade 1
- backend/src/routes/tables.ts ↔ backend/src/routes/gm.ts
  - tipo: lógica de consulta
  - candidato: backend/src/repositories/tableRepository.ts
  - ação: extrair query base

- frontend/src/components/TableCard.tsx ↔ frontend/src/pages/MestrePage.tsx
  - tipo: formatação de mesa
  - candidato: frontend/src/utils/tableFormatters.ts
  - ação: extrair formatadores puros

## Prioridade 2
- ...
```

Critério de saída:

* toda duplicação relevante já está transformada em “candidato a extração”
* nada ainda foi alterado no código

---

# 6. Fase C, detector secundário e checagem de consistência

## 6.1 Instalar PMD CPD como segunda opinião

O PMD CPD continua útil porque suporta TypeScript no modo CPD. Só não deve ser usado com a expectativa errada de ignorar identificadores em TS. ([PMD][1])

## 6.2 Rodar o PMD CPD nos diretórios certos

Primeiro nos `.ts` de backend. Depois, se fizer sentido, nos utilitários e hooks do frontend. Evitar começar por páginas TSX.

Comandos:

```bash
pmd cpd --minimum-tokens 60 --dir backend/src/routes --language ts --format xml --report-file reports/cpd-backend-routes.xml --no-fail-on-violation
```

Depois:

```bash
pmd cpd --minimum-tokens 60 --dir backend/src/services --language ts --format xml --report-file reports/cpd-backend-services.xml --no-fail-on-violation
```

Depois, se houver muitos `.ts` úteis no frontend:

```bash
pmd cpd --minimum-tokens 60 --dir frontend/src/utils --language ts --format xml --report-file reports/cpd-frontend-utils.xml --no-fail-on-violation
```

### Por que `--language ts`

Porque a documentação oficial do PMD informa que TypeScript tem suporte CPD com id `ts`. ([PMD][1])

### Por que `--no-fail-on-violation`

Porque o comportamento padrão do CPD é sair com código não zero quando encontra duplicação. Para auditoria inicial isso atrapalha. A documentação oficial mostra isso claramente. ([PMD][7])

### Por que não usar `--ignore-identifiers` em TS

Porque a documentação oficial lista esse flag como aplicável a **Java e C++**, não a TypeScript. Mesma limitação para `--ignore-literals`. ([PMD][7])

## 6.3 O que o CPD deve responder neste projeto

O CPD deve ser usado aqui para:

* confirmar duplicações fortes em backend `.ts`
* encontrar blocos repetidos que o jscpd pegou em pares diferentes
* agrupar melhor famílias de duplicação

O CPD **não** deve ser tratado, neste projeto, como detector “near miss” com variáveis renomeadas em TypeScript.

Critério de saída:

* há confirmação independente para as duplicações críticas de backend
* as prioridades 1 e 2 continuam as mesmas, ou foram refinadas

---

# 7. Fase D, priorização real do que será refatorado primeiro

A ordem segura para o seu projeto não é “maior arquivo primeiro”. É esta:

## 7.1 Primeiro, formatadores puros no frontend

Exemplos prováveis:

* preço
* vagas
* horários
* labels de status
* fragmentos de data/hora
* textos derivados de `TableCard`, `MesaPage` e `MestrePage`

### Por que começar por isso

Porque são funções puras, com baixo acoplamento, baixo risco e validação fácil.

### Resultado esperado

Novo arquivo:

```ts
frontend/src/utils/tableFormatters.ts
```

Com funções como:

```ts
export function formatTablePrice(/* ... */) { /* ... */ }
export function formatTableSlots(/* ... */) { /* ... */ }
export function formatTableSchedules(/* ... */) { /* ... */ }
```

## 7.2 Segundo, constantes hardcoded

Antes de mexer em query de backend, extrair constantes repetidas reduz ruído e já diminui parte da duplicação.

Exemplo:

```ts
export const PAGINATION = {
  DEFAULT_LIMIT: 12,
  MAX_LIMIT: 50,
} as const;

export const METRICS_THRESHOLDS = {
  HIGH_VIEWS: 50,
  LOW_VIEWS: 10,
  GOOD_CONVERSION: 5,
} as const;
```

## 7.3 Terceiro, tipos duplicados

Se houver o mesmo union type em `backend/src/domain` e `frontend/src/types`, consolidar isso cedo reduz divergência, mas só se a extração for pequena.

## 7.4 Quarto, queries repetidas do backend

Só agora entram `tables.ts`, `gm.ts` e `gmPanel.ts`.

### Meta

Criar uma camada única com base compartilhada.

Exemplo estrutural:

```ts
// backend/src/repositories/tableRepository.ts
export interface PublicTableFilters {
  gmId?: string;
  onlyActive?: boolean;
  // o mínimo necessário no começo
}

export class TableRepository {
  static buildBaseQuery(db: DB) {
    return db
      .selectFrom('tables')
      // joins mínimos comuns
      // selects mínimos comuns
  }

  static findPublicTables(db: DB, filters: PublicTableFilters) {
    let query = this.buildBaseQuery(db);

    if (filters.onlyActive) {
      query = query.where('tables.status', '=', 'active');
    }

    if (filters.gmId) {
      query = query.where('tables.gm_id', '=', filters.gmId);
    }

    return query.execute();
  }
}
```

### Regra de segurança

Na primeira extração, **não** tentar parametrizar tudo. Apenas o que é visivelmente comum.

---

# 8. Fase E, procedimento seguro de refatoração, um bloco por vez

Essa é a parte mais importante.

## 8.1 Regra de ouro

Cada refatoração deve mexer em **uma única família de duplicação**.

Não misturar:

* extração de formatadores
* troca de imports
* reorganização de componentes
* path aliases
* mudança de comportamento

Tudo isso em um único commit aumenta muito o risco.

## 8.2 Sequência de execução de cada refatoração

### Passo 1, copiar o comportamento atual

Antes de extrair, salvar o trecho original em um arquivo de trabalho temporário ou em diff local.

### Passo 2, criar a nova função sem apagar o original

Primeiro criar a função nova.

### Passo 3, trocar só uma ocorrência

Aplicar a nova função em apenas um arquivo.

### Passo 4, validar

Rodar:

* typecheck
* lint
* build
* teste local daquela tela/rota

### Passo 5, trocar a segunda ocorrência

Repetir.

### Passo 6, apagar a duplicação antiga

Só depois que as duas ou três ocorrências passaram nos checks.

## 8.3 Checklist obrigatório por refatoração

Para cada extração, preencher:

* [ ] a nova função é pura ou tem dependências explícitas
* [ ] a assinatura não foi “generalizada demais”
* [ ] o nome descreve o comportamento, não o contexto antigo
* [ ] a função não importa componente React se deveria ser utilitário puro
* [ ] a função não acopla backend e frontend
* [ ] a saída antes e depois é igual nos casos conhecidos
* [ ] typecheck passou
* [ ] lint passou
* [ ] build passou
* [ ] diff ficou pequeno
* [ ] commit ficou temático

---

# 9. Procedimento específico por área do projeto

# 9.1 Frontend, formatadores de mesa

## Alvos

* `TableCard.tsx`
* `MesaPage.tsx`
* `MestrePage.tsx`

## O que extrair

Extrair apenas lógica derivada, não JSX no primeiro momento.

### Pode extrair

* preço formatado
* total de vagas e vagas preenchidas
* texto de frequência e agenda
* rótulos de status
* normalização de listas

### Não extrair ainda

* JSX inteiro de badge
* subárvores grandes de layout
* hooks
* blocos com `useMemo`, `useEffect`, `useNavigate`

## Exemplo seguro

Antes:

```ts
const slotsText =
  totalSlots > 0
    ? `${filledSlots}/${totalSlots} vagas`
    : 'Vagas não informadas';
```

Depois:

```ts
// utils/tableFormatters.ts
export function formatTableSlots(totalSlots?: number, filledSlots?: number) {
  if (!totalSlots || totalSlots <= 0) return 'Vagas não informadas';
  return `${filledSlots ?? 0}/${totalSlots} vagas`;
}
```

Uso:

```ts
const slotsText = formatTableSlots(totalSlots, filledSlots);
```

## Validação local

* abrir catálogo
* abrir página de mesa
* abrir página de mestre
* comparar os mesmos casos antes e depois

Checklist:

* [ ] mesa paga continua paga
* [ ] mesa gratuita continua gratuita
* [ ] caso sem horários não quebra
* [ ] caso sem vagas não quebra
* [ ] caso sem preço não quebra

---

# 9.2 Backend, queries repetidas

## Alvos

* `tables.ts`
* `gm.ts`
* `gmPanel.ts`

## O que extrair primeiro

Extrair apenas a **base comum de select/join/where triviais**.

### Pode extrair

* select comum
* joins comuns
* filtros comuns de status
* ordenação comum

### Não extrair no primeiro corte

* paginação complexa
* métricas
* tracking
* transformação final de payload se diferir por rota

## Exemplo seguro

Antes:

```ts
router.get('/tables', async (req, res) => {
  const rows = await db
    .selectFrom('tables')
    .selectAll()
    .where('status', '=', 'active')
    .execute();

  res.json(rows);
});
```

Depois:

```ts
// repository
export class TableRepository {
  static baseActiveTables(db: DB) {
    return db
      .selectFrom('tables')
      .selectAll()
      .where('status', '=', 'active');
  }
}
```

Na rota:

```ts
router.get('/tables', async (req, res) => {
  const rows = await TableRepository.baseActiveTables(db).execute();
  res.json(rows);
});
```

### Segunda etapa

Só depois criar métodos especializados:

```ts
static findPublicTables(db: DB, filters: PublicTableFilters) { ... }
static findByGmId(db: DB, gmId: string) { ... }
```

## Checklist obrigatório no backend

* [ ] mesma quantidade de registros antes e depois
* [ ] mesma ordenação antes e depois
* [ ] mesmo filtro de status antes e depois
* [ ] mesma estrutura JSON antes e depois
* [ ] nenhuma coluna sumiu
* [ ] nenhuma rota mudou status code
* [ ] erro continua tratado do mesmo modo

---

# 10. Procedimento para arquivos grandes

## 10.1 `gmPanel.ts`

Não começar dividindo em três arquivos de uma vez. Isso é arriscado.

### Ordem segura

1. extrair repositório
2. extrair schemas/validação
3. extrair helpers puros
4. só então dividir rotas por responsabilidade

### Sequência sugerida

* `backend/src/repositories/tableRepository.ts`
* `backend/src/schemas/tableSchema.ts`
* `backend/src/routes/gmTables.ts`
* `backend/src/routes/gmMetrics.ts`
* `backend/src/routes/gmTracking.ts`

## 10.2 `MestrePage.tsx`

Também não começar quebrando layout. Primeiro separar lógica pura.

### Ordem segura

1. extrair formatadores
2. extrair seletores derivados
3. extrair hook `useMestreProfile`
4. só então quebrar UI em subcomponentes

---

# 11. Como saber se uma duplicação deve virar utilitário, hook, componente ou repositório

Use esta matriz.

## 11.1 Vai para `utils/` quando:

* não depende de React
* não depende de request/response
* recebe entrada e devolve saída
* pode ser testado como função pura

## 11.2 Vai para `hooks/` quando:

* depende de estado React
* usa `useMemo`, `useEffect`, `useState`, `useContext`
* encapsula comportamento de tela

## 11.3 Vai para `components/` quando:

* a duplicação é majoritariamente JSX
* o comportamento visual é o mesmo
* as variações cabem em props claras

## 11.4 Vai para `repositories/` quando:

* a duplicação é de acesso a banco
* o mesmo select/join/filter aparece em mais de uma rota
* a regra de negócio não deveria morar em Express route

## 11.5 Vai para `shared/types/` quando:

* o mesmo tipo existe em backend e frontend
* há risco de drift contratual
* o tipo é de contrato de domínio e não apenas de view

---

# 12. Como lidar com falsos positivos

Toda ferramenta de clone detection gera ruído. A disciplina correta é esta:

## 12.1 Ignorar conscientemente

Criar `reports/jscpd/IGNORADOS.md`

Exemplo:

```md
- hooks simples com mesma assinatura, mantidos separados por contexto
- guard clauses curtas de autenticação
- boilerplate mínimo de rota
- trechos de teste
```

## 12.2 Não abrir tarefa para:

* imports
* 3 ou 4 linhas triviais
* pequenas variações inevitáveis do framework
* JSX muito parecido mas com intenção de layout diferente

## 12.3 Abrir tarefa apenas quando:

* há 2 ou mais ocorrências relevantes
* o comportamento deveria ser único
* a manutenção paralela custa caro
* o acoplamento novo será menor que o atual

---

# 13. Como organizar os commits

Regra: **um commit, uma família de duplicação**.

Exemplos bons:

* `refactor(frontend): extrai formatadores de mesa para utils compartilhados`
* `refactor(backend): extrai query base de mesas para TableRepository`
* `chore(quality): adiciona jscpd e baseline de relatórios`
* `chore(sonar): configura análise de duplicação para novo código`

Exemplos ruins:

* `refactor geral`
* `limpeza`
* `corrige duplicação`
* `ajustes`

---

# 14. Blindagem contínua

# 14.1 SonarQube Community Build

## Instalação

O SonarScanner CLI atual exige, em geral, **Java 21 ou superior**, com observações específicas sobre auto-provisioning a partir das versões recentes do scanner. ([Sonar Documentation][8])

## Configuração mínima

Arquivo `sonar-project.properties`:

```properties
sonar.projectKey=artificio-mesas
sonar.projectName=Artifício Mesas
sonar.sources=backend/src,frontend/src
sonar.tests=backend/test,frontend/src
sonar.test.inclusions=**/*.spec.*,**/*.test.*
sonar.cpd.exclusions=**/*.spec.*,**/*.test.*,**/*.d.ts,**/dist/**,**/build/**,**/coverage/**,**/database/**,**/backend/src/migrations/**
```

### Observações importantes

`sonar.sources` e `sonar.tests` devem ser definidos com cuidado porque Sonar separa claramente código-fonte e código de teste. Se source e test se sobrepõem, a análise pode falhar. A documentação também destaca que o projeto deve definir escopo inicial por `sonar.sources` e `sonar.tests`, e que `sonar.cpd.exclusions` exclui arquivos da checagem de duplicação. ([Sonar Documentation][9])

### Limitação relevante para o seu frontend

O SonarQube Community Build informa que a detecção de duplicação **não é suportada para CSS**, além de Dart e Terraform/IaC similares. Como o frontend usa CSS vanilla, isso significa que o CSS não deve entrar na expectativa de métrica de duplicação. ([Sonar Documentation][5])

## Gate inicial recomendado

Não travar o legado inteiro. Aplicar o gate em **new code** apenas. O Sonar way padrão mantém:

* sem novos issues
* review de hotspots
* cobertura mínima no código novo
* duplicação em código novo <= 3% ([Sonar Documentation][2])

## Checklist Sonar

* [ ] servidor sobe
* [ ] scanner roda
* [ ] sources e tests não se sobrepõem
* [ ] testes estão fora da duplicação quando necessário
* [ ] quality gate avalia novo código, não o legado inteiro

---

# 14.2 ESLint com sonarjs

## Primeiro, descobrir a versão real do ESLint

Comando:

```bash
npx eslint -v
```

## Depois, instalar a versão atual do plugin

Comando:

```bash
npm install --save-dev eslint-plugin-sonarjs
```

O pacote atual está na linha 3.x e a documentação diferencia claramente ESLint 8 e 9. ([npm][3])

## Se for ESLint 9

`eslint.config.js`:

```js
import sonarjs from 'eslint-plugin-sonarjs';

export default [
  sonarjs.configs.recommended,
  {
    rules: {
      'sonarjs/no-identical-functions': 'error',
      'sonarjs/no-duplicated-branches': 'error',
      'sonarjs/no-duplicate-string': 'warn',
      'sonarjs/cognitive-complexity': ['warn', 15],
    },
  },
];
```

## Se for ESLint 8

`.eslintrc.json`:

```json
{
  "plugins": ["sonarjs"],
  "extends": ["plugin:sonarjs/recommended-legacy"],
  "rules": {
    "sonarjs/no-identical-functions": "error",
    "sonarjs/no-duplicated-branches": "error",
    "sonarjs/no-duplicate-string": "warn",
    "sonarjs/cognitive-complexity": ["warn", 15]
  }
}
```

## Importante

Não reutilizar a referência antiga de `eslint-plugin-sonarjs` `^0.25.0` que apareceu no material colado. O pacote atual está em outra geração de configuração e compatibilidade. ([npm][3])

---

# 15. Checklist final de execução, do começo ao fim

## Etapa 0, segurança

* [ ] branch exclusiva criada
* [ ] baseline salvo
* [ ] scripts reais identificados
* [ ] nenhum comando foi presumido

## Etapa 1, auditoria

* [ ] jscpd instalado localmente
* [ ] `.jscpd.json` criado
* [ ] relatório HTML gerado
* [ ] relatório JSON gerado
* [ ] triagem escrita em markdown

## Etapa 2, validação secundária

* [ ] PMD CPD instalado
* [ ] CPD rodado em `backend/src/routes`
* [ ] CPD rodado em `backend/src/services`
* [ ] sem uso incorreto de `--ignore-identifiers` em TS

## Etapa 3, prioridade 1

* [ ] formatadores de mesa extraídos para `frontend/src/utils/tableFormatters.ts`
* [ ] typecheck passou
* [ ] lint passou
* [ ] build passou
* [ ] catálogo, mesa e mestre conferidos

## Etapa 4, prioridade 2

* [ ] constantes hardcoded relevantes centralizadas
* [ ] nenhuma regressão visual
* [ ] nenhum texto mudou indevidamente

## Etapa 5, prioridade 3

* [ ] query base de mesas extraída
* [ ] rotas preservaram payload
* [ ] resultados antes e depois comparados

## Etapa 6, governança

* [ ] Sonar configurado
* [ ] `sonar.cpd.exclusions` configurado
* [ ] escopo de tests separado corretamente
* [ ] gate aplicado só em novo código
* [ ] `eslint-plugin-sonarjs` ajustado à versão real do ESLint

---

# 16. Plano mínimo de rollback

Se qualquer etapa quebrar:

## Rollback curto

```bash
git status
git diff
git restore <arquivo>
```

## Rollback do bloco atual

```bash
git reset --hard HEAD
```

## Voltar ao baseline conhecido

```bash
git checkout chore/dedup-audit
git reset --hard <hash_salvo_em_reports/baseline/commit.txt>
```

## Regra

Nunca continuar “corrigindo por cima” depois que uma extração alterou comportamento. Volta, reduz o escopo, refaz menor.

---

# 17. Ordem exata que eu seguiria no seu projeto

Sem inventar nada além do que o cenário já mostra, a ordem seria esta:

1. baseline completo
2. jscpd no repositório inteiro
3. triagem só dos hotspots conhecidos
4. extração de `tableFormatters.ts`
5. validação visual e de build
6. extração de constantes hardcoded
7. validação
8. criação de `TableRepository` base
9. migração de `tables.ts`
10. validação
11. migração de `gm.ts`
12. validação
13. migração de parte de `gmPanel.ts`
14. validação
15. SonarQube em novo código
16. ESLint/SonarJS como reforço local

Esse fluxo é o mais seguro porque começa pelo **baixo risco e alta repetição**, e só depois entra em backend e arquivo grande.

---

# 18. Conclusão operacional

O plano anterior precisava de uma correção central: **PMD CPD não deve ser tratado como detector de renomeação estrutural para TypeScript**, porque a documentação oficial atual não sustenta isso. Com essa correção, o pipeline robusto para o **Artifício Mesas** fica:

**jscpd para mapa inicial**,
**PMD CPD como segunda opinião em `.ts`**,
**refatoração manual guiada e pequena**,
**SonarQube Community Build para novo código**,
**eslint-plugin-sonarjs como reforço de lint local**. ([jscpd][4])

Se for útil, a próxima resposta pode transformar isso em um **checklist executável em Markdown**, já no formato de `docs/PIPELINE_DEDUP.md`, pronto para colar no repositório.

[1]: https://pmd.github.io/pmd/pmd_languages_js_ts.html?utm_source=chatgpt.com "JavaScript and TypeScript support | PMD Source Code Analyzer"
[2]: https://docs.sonarsource.com/sonarqube-community-build/quality-standards-administration/managing-quality-gates/introduction-to-quality-gates/?utm_source=chatgpt.com "Understanding quality gates | SonarQube Community Build | Sonar Documentation"
[3]: https://www.npmjs.com/package/eslint-plugin-sonarjs?utm_source=chatgpt.com "eslint-plugin-sonarjs - npm"
[4]: https://jscpd.dev/?utm_source=chatgpt.com "jscpd - Copy/Paste Detector for Source Code - jscpd"
[5]: https://docs.sonarsource.com/sonarqube-community-build/user-guide/code-metrics/metrics-definition "Understanding measures and metrics | SonarQube Community Build | Sonar Documentation"
[6]: https://jscpd.dev/reporters/html?utm_source=chatgpt.com "HTML Reporter - jscpd"
[7]: https://pmd.github.io/pmd/pmd_userdocs_cpd.html "Finding duplicated code with CPD | PMD Source Code Analyzer"
[8]: https://docs.sonarsource.com/sonarqube-server/latest/analyzing-source-code/scanners/sonarscanner/?utm_source=chatgpt.com "SonarScanner CLI | SonarQube Server | Sonar Documentation"
[9]: https://docs.sonarsource.com/sonarqube-community-build/project-administration/setting-analysis-scope/setting-initial-scope/?utm_source=chatgpt.com "Setting initial scope | Sonar Documentation"
