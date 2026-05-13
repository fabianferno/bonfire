import pino from 'pino';
const level = (process.env.LOG_LEVEL ?? 'info') as pino.Level;
export const log = pino({
  level,
  transport: process.env.NODE_ENV === 'production' ? undefined : { target: 'pino-pretty' },
  redact: { paths: ['*.token', '*.apiKey', '*.botToken', '*.LLM_API_KEY', '*.TELEGRAM_BOT_TOKEN'], remove: true },
});
