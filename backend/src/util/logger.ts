import pino from 'pino';

const level = (process.env.LOG_LEVEL ?? 'info') as pino.Level;

export const log = pino({
  level,
  transport: process.env.NODE_ENV === 'production' ? undefined : { target: 'pino-pretty' },
  redact: {
    paths: [
      'password',
      'currentPassword',
      'newPassword',
      'passwordHash',
      'token',
      'jwt',
      'JWT_SECRET',
      'authorization',
      'req.headers.authorization',
      'err.config.headers.authorization',
    ],
    remove: true,
  },
});
