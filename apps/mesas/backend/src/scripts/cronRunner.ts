import { exec } from 'child_process';

const runCommand = (cmd: string) => {
  console.log(`[CronRunner] Executando: ${cmd} às ${new Date().toISOString()}`);
  exec(cmd, (error, stdout, stderr) => {
    if (error) console.error(`[CronRunner] Erro Mapeado: ${error.message}`);
    if (stderr) console.error(`[CronRunner] STDERR (${cmd}): ${stderr}`);
    if (stdout) console.log(`[CronRunner] STDOUT (${cmd}): ${stdout}`);
  });
};

console.log('[CronRunner] Iniciado com sucesso. Agendamentos registrados.');

// Worker de Polling OG (Roda a cada 5 minutos - lida com batches de 5)
// Se não houver pendências, o script faz exit(0) rápido de forma segura
setInterval(() => runCommand('npm run og:worker'), 5 * 60 * 1000);

// Limpeza e Invalidação (Roda 1 vez por dia)
setInterval(() => runCommand('npm run og:cleanup'), 24 * 60 * 60 * 1000);

// Retry de uploads Discord para Cloudinary (Roda 1 vez por hora)
setInterval(() => runCommand('npm run discord:retry-image-uploads'), 60 * 60 * 1000);

// WS1: Limpeza de imagens órfãs de drafts Discord (Roda 1 vez por dia)
setInterval(() => runCommand('npm run discord:cleanup-orphan-images'), 24 * 60 * 60 * 1000);

// Spec 105 M2: anula o fingerprint de evento de métrica com mais de 48 h e
// mantém a linha da série temporal (Roda 1 vez por dia)
setInterval(() => runCommand('npm run metrics:anonymize'), 24 * 60 * 60 * 1000);

// Spec 106 R19: retenção de 90 dias da telemetria de erro de cliente (1 vez por dia)
setInterval(() => runCommand('npm run client-errors:purge'), 24 * 60 * 60 * 1000);

// Spec 106 plan §11.3 e §12: fila de feedback parada e contato com cauda de Markdown (1 vez por dia)
setInterval(() => runCommand('npm run ops:alerts'), 24 * 60 * 60 * 1000);

// Execução imediata no BOOT
runCommand('npm run og:worker');
runCommand('npm run og:cleanup');
runCommand('npm run discord:retry-image-uploads');
runCommand('npm run discord:cleanup-orphan-images');
runCommand('npm run metrics:anonymize');
runCommand('npm run client-errors:purge');
runCommand('npm run ops:alerts');
