import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const readRepoFile = (path) => readFileSync(resolve(repoRoot, path), 'utf8');

const files = {
  mesasNginx: readRepoFile('apps/mesas/frontend/nginx.conf'),
  mesasProdCompose: readRepoFile('apps/mesas/docker-compose.prod.yml'),
  mesasBetaCompose: readRepoFile('apps/mesas/docker-compose.beta.yml'),
  glossarioNginx: readRepoFile('apps/glossario/frontend/nginx.conf.template'),
  glossarioProdCompose: readRepoFile('apps/glossario/docker-compose.prod.yml'),
  glossarioBetaCompose: readRepoFile('apps/glossario/docker-compose.beta.yml'),
  accountsApp: readRepoFile('apps/accounts/src/app.ts'),
  accountsEnv: readRepoFile('apps/accounts/src/env.ts'),
  accountsCompose: readRepoFile('apps/accounts/docker-compose.yml'),
  siteServer: readRepoFile('apps/site/server/server.ts'),
  siteCompose: readRepoFile('apps/site/docker-compose.beta.yml'),
  mesasBackend: readRepoFile('apps/mesas/backend/src/server.ts'),
  glossarioBackend: readRepoFile('apps/glossario/backend/src/index.ts'),
};

const failures = [];

function expect(condition, message) {
  if (!condition) failures.push(message);
}

function checkNginx(name, content) {
  expect(
    content.includes('set_real_ip_from ${TRUSTED_REAL_IP_FROM};'),
    `${name}: deve confiar somente no proxy interno configurado por TRUSTED_REAL_IP_FROM.`
  );
  expect(
    content.includes('real_ip_header CF-Connecting-IP;'),
    `${name}: deve usar CF-Connecting-IP como fonte do IP real.`
  );
  expect(
    content.includes('real_ip_recursive on;'),
    `${name}: deve manter real_ip_recursive on.`
  );
  expect(
    !content.includes('$proxy_add_x_forwarded_for'),
    `${name}: nao pode usar $proxy_add_x_forwarded_for.`
  );
  expect(
    !content.includes('proxy_set_header X-Real-IP $http_cf_connecting_ip;'),
    `${name}: X-Real-IP nao deve repassar CF-Connecting-IP cru.`
  );
  expect(
    !content.includes('proxy_set_header X-Forwarded-For $http_cf_connecting_ip;'),
    `${name}: X-Forwarded-For nao deve repassar CF-Connecting-IP cru.`
  );

  const forwardedForLines = content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('proxy_set_header X-Forwarded-For '));

  expect(forwardedForLines.length > 0, `${name}: deve configurar X-Forwarded-For.`);
  expect(
    forwardedForLines.every((line) => line === 'proxy_set_header X-Forwarded-For $remote_addr;'),
    `${name}: todo X-Forwarded-For deve usar $remote_addr validado pelo RealIP.`
  );

  const realIpLines = content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('proxy_set_header X-Real-IP '));

  expect(realIpLines.length > 0, `${name}: deve configurar X-Real-IP.`);
  expect(
    realIpLines.every((line) => line === 'proxy_set_header X-Real-IP $remote_addr;'),
    `${name}: todo X-Real-IP deve usar $remote_addr validado pelo RealIP.`
  );
}

function checkComposeEnv(name, content, envName) {
  expect(
    content.includes(`${envName}=\${${envName}:-172.18.0.0/16}`),
    `${name}: deve definir ${envName} com default 172.18.0.0/16.`
  );
}

checkNginx('mesas nginx', files.mesasNginx);
checkNginx('glossario nginx', files.glossarioNginx);

for (const [name, content] of [
  ['mesas prod compose', files.mesasProdCompose],
  ['mesas beta compose', files.mesasBetaCompose],
  ['glossario prod compose', files.glossarioProdCompose],
  ['glossario beta compose', files.glossarioBetaCompose],
]) {
  checkComposeEnv(name, content, 'TRUSTED_REAL_IP_FROM');
}

expect(
  files.accountsEnv.includes('TRUSTED_PROXY_CIDR: z.string().default("172.18.0.0/16")'),
  'accounts env deve tipar TRUSTED_PROXY_CIDR com default 172.18.0.0/16.'
);
expect(
  files.accountsApp.includes('app.set("trust proxy", env.TRUSTED_PROXY_CIDR);'),
  'accounts deve usar TRUSTED_PROXY_CIDR no trust proxy.'
);
expect(
  !files.accountsApp.includes('app.set("trust proxy", 1);'),
  'accounts nao deve usar trust proxy = 1.'
);
expect(
  files.siteServer.includes('app.set("trust proxy", process.env.TRUSTED_PROXY_CIDR || "172.18.0.0/16");'),
  'site deve usar TRUSTED_PROXY_CIDR no trust proxy.'
);
expect(
  !files.siteServer.includes('app.set("trust proxy", 1);'),
  'site nao deve usar trust proxy = 1.'
);

checkComposeEnv('accounts compose', files.accountsCompose, 'TRUSTED_PROXY_CIDR');
checkComposeEnv('site compose', files.siteCompose, 'TRUSTED_PROXY_CIDR');

for (const [name, content] of [
  ['mesas backend', files.mesasBackend],
  ['glossario backend', files.glossarioBackend],
]) {
  expect(
    content.includes("app.set('trust proxy', process.env.TRUSTED_PROXY_CIDR || '172.18.0.0/16');"),
    `${name}: deve usar TRUSTED_PROXY_CIDR no trust proxy.`
  );
  expect(
    !content.includes("app.set('trust proxy', 1);"),
    `${name}: nao deve usar trust proxy = 1.`
  );
}

for (const [name, content] of [
  ['mesas prod compose', files.mesasProdCompose],
  ['mesas beta compose', files.mesasBetaCompose],
  ['glossario prod compose', files.glossarioProdCompose],
  ['glossario beta compose', files.glossarioBetaCompose],
]) {
  checkComposeEnv(name, content, 'TRUSTED_PROXY_CIDR');
}

if (failures.length > 0) {
  console.error('Ingress RealIP contract smoke falhou:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('Ingress RealIP contract smoke OK.');
