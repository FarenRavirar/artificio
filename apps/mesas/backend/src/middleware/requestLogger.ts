import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- augmentação do namespace global Express (padrão @types/express) para adicionar requestId ao Request; mesmo padrão de src/middleware/auth.ts.
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

// Diretório de logs dentro do /app onde o container tem permissão
const LOG_DIR = '/app/logs';
const LOG_FILE = path.join(LOG_DIR, 'routes.log');

// WS4: flag que desabilita escrita em arquivo após primeiro EACCES,
// evitando re-tentar (e logar erro) a cada request.
let loggerDisabled = false;
let loggerDisabledReason: string | null = null;

// Criar diretório se não existir
try {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true, mode: 0o755 });
  }
} catch (error) {
  loggerDisabled = true;
  loggerDisabledReason = `mkdir EACCES: ${error instanceof Error ? error.message : String(error)}`;
  console.warn('[RequestLogger] Diretório de logs inacessível, degradando para stdout:', loggerDisabledReason);
}

interface LogEntry {
  timestamp: string;
  method: string;
  path: string;
  params: Record<string, unknown>;
  query: Record<string, unknown>;
  ip: string;
  userAgent: string;
  requestId: string;
}

interface ErrorLogEntry extends LogEntry {
  error: {
    message: string;
    code?: string;
    stack?: string;
  };
  duration: number;
}

/**
 * Gera ID único para cada requisição
 */
function generateRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Formata entrada de log como linha de texto
 */
function formatLogLine(entry: LogEntry | ErrorLogEntry): string {
  const base = `[${entry.timestamp}] ${entry.method} ${entry.path} | ReqID: ${entry.requestId}`;
  
  if ('error' in entry) {
    return `${base} | ERROR: ${entry.error.message} | Code: ${entry.error.code || 'N/A'} | Duration: ${entry.duration}ms | Params: ${JSON.stringify(entry.params)} | Query: ${JSON.stringify(entry.query)}\n`;
  }
  
  return `${base} | Params: ${JSON.stringify(entry.params)} | Query: ${JSON.stringify(entry.query)} | IP: ${entry.ip}\n`;
}

/**
 * Escreve log no arquivo. Degrada para stdout no primeiro EACCES (WS4).
 */
function writeLog(line: string): void {
  if (loggerDisabled) {
    // stdout silencioso (sem prefixo de erro) — o aviso já foi emitido uma vez
    process.stdout.write(line);
    return;
  }
  try {
    fs.appendFileSync(LOG_FILE, line, { encoding: 'utf8', mode: 0o644 });
  } catch (error) {
    // EACCES/EPERM/EROFS: bind mount ou filesystem read-only — degrada p/ stdout
    // em vez de tentar gravar a cada request (REV-028).
    const code = error instanceof Error ? (error as NodeJS.ErrnoException).code : undefined;
    const isPermission = code === 'EACCES' || code === 'EPERM' || code === 'EROFS';
    if (isPermission) {
      loggerDisabled = true;
      loggerDisabledReason = `${code}: ${error instanceof Error ? error.message : String(error)}`;
      console.warn('[RequestLogger] Arquivo de log inacessível, degradando para stdout:', loggerDisabledReason);
      // Escreve esta linha no stdout também
      process.stdout.write(line);
      return;
    }
    console.error('[RequestLogger] Erro ao escrever log:', error);
  }
}

/**
 * Middleware de logging de requisições
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const requestId = generateRequestId();
  const startTime = Date.now();
  
  // Adicionar requestId ao objeto de requisição para uso posterior
  req.requestId = requestId;
  
  // Log de entrada
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.path,
    params: req.params,
    query: req.query,
    ip: req.ip || req.socket.remoteAddress || 'unknown',
    userAgent: req.get('user-agent') || 'unknown',
    requestId,
  };
  
  writeLog(formatLogLine(entry));
  
  // Interceptar resposta para log de erro
  const originalSend = res.send;
  res.send = function(data: unknown): Response {
    const duration = Date.now() - startTime;

    // Se status >= 400, logar como erro
    if (res.statusCode >= 400) {
      let errorMessage = 'Unknown error';

      try {
        const errorData: unknown = typeof data === 'string' ? JSON.parse(data) : data;
        if (errorData && typeof errorData === 'object') {
          const record = errorData as Record<string, unknown>;
          const parsedError = record.error;
          const parsedMessage = record.message;
          if (typeof parsedError === 'string') {
            errorMessage = parsedError;
          } else if (typeof parsedMessage === 'string') {
            errorMessage = parsedMessage;
          }
        }
      } catch {
        errorMessage = String(data).substring(0, 200);
      }
      
      const errorEntry: ErrorLogEntry = {
        ...entry,
        timestamp: new Date().toISOString(),
        error: {
          message: errorMessage,
          code: res.statusCode.toString(),
        },
        duration,
      };
      
      writeLog(formatLogLine(errorEntry));
    }
    
    return originalSend.call(this, data);
  };
  
  next();
}

/**
 * Função auxiliar para logar erros de query do banco
 */
export function logDatabaseError(
  req: Request,
  error: unknown,
  context: { route: string; operation: string }
): void {
  const requestId = req.requestId || 'unknown';

  const errorRecord = error && typeof error === 'object' ? (error as Record<string, unknown>) : undefined;
  const errorCode = typeof errorRecord?.code === 'string' ? errorRecord.code : undefined;
  const errorMessage = error instanceof Error
    ? error.message
    : (typeof errorRecord?.message === 'string' ? errorRecord.message : undefined);
  const errorStack = error instanceof Error ? error.stack : undefined;

  const errorEntry: ErrorLogEntry = {
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.path,
    params: req.params,
    query: req.query,
    ip: req.ip || 'unknown',
    userAgent: req.get('user-agent') || 'unknown',
    requestId,
    error: {
      message: errorMessage || 'Database error',
      code: errorCode || 'DB_ERROR',
      stack: errorStack?.split('\n').slice(0, 3).join(' | '),
    },
    duration: 0,
  };
  
  const line = `[${errorEntry.timestamp}] DB_ERROR in ${context.route} (${context.operation}) | ReqID: ${requestId} | Error: ${errorEntry.error.message} | PG Code: ${errorEntry.error.code} | Params: ${JSON.stringify(errorEntry.params)}\n`;
  
  writeLog(line);
  console.error(`[DB_ERROR] ${context.route}:`, error);
}

/**
 * Rotaciona logs quando arquivo fica muito grande (> 10MB).
 * Respeita loggerDisabled (WS4): se arquivo inacessível, rotaciona é no-op.
 */
export function rotateLogs(): void {
  if (loggerDisabled) return; // WS4: sem arquivo, sem rotação
  try {
    const stats = fs.statSync(LOG_FILE);
    const maxSize = 10 * 1024 * 1024; // 10MB
    
    if (stats.size > maxSize) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const archiveFile = path.join(LOG_DIR, `routes-${timestamp}.log`);
      
      fs.renameSync(LOG_FILE, archiveFile);
      console.log(`[RequestLogger] Log rotacionado: ${archiveFile}`);
      
      // Manter apenas últimos 5 arquivos
      const files = fs.readdirSync(LOG_DIR)
        .filter(f => f.startsWith('routes-') && f.endsWith('.log'))
        .sort()
        .reverse();
      
      if (files.length > 5) {
        files.slice(5).forEach(f => {
          fs.unlinkSync(path.join(LOG_DIR, f));
          console.log(`[RequestLogger] Log antigo removido: ${f}`);
        });
      }
    }
  } catch (error) {
    console.error('[RequestLogger] Erro ao rotacionar logs:', error);
  }
}

// Rotacionar logs a cada 6 horas
setInterval(rotateLogs, 6 * 60 * 60 * 1000);
