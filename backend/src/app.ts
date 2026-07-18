import express, { Application, Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { pinoHttp } from 'pino-http';
import { env } from './config/env';
import { logger } from './utils/logger';
import { apiRouter } from './routes';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import './utils/http'; // installs BigInt JSON serialisation

/** Node request handler mounted for the Better Auth catch-all route. */
type AuthRequestHandler = (req: Request, res: Response) => void;

export function createApp(authHandler: AuthRequestHandler): Application {
  const app = express();

  // Behind a reverse proxy (nginx) on a VPS: trust the first proxy hop.
  app.set('trust proxy', 1);

  app.use(
    helmet({
      // Streaming endpoints (especially PDFs) are nested in LMS iframes and in
      // the public /watch page iframe. SAMEORIGIN framing would show
      // "refused to connect" on external embeds.
      frameguard: false,
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: false,
    }),
  );

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow same-origin / server-to-server requests with no Origin header.
        if (!origin) {
          callback(null, true);
          return;
        }
        if (env.corsOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(new Error(`CORS blocked for origin: ${origin}`));
      },
      credentials: true,
    }),
  );

  // Better Auth catch-all. MUST be mounted before express.json(): the handler
  // needs the raw request stream, otherwise auth requests hang on "pending".
  app.all('/api/auth/*', authHandler);

  app.use(cookieParser());
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));

  if (!env.isTest) {
    app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/health' } }));
  }

  // Global, lenient rate limit on the API surface.
  app.use(
    '/api',
    rateLimit({ windowMs: 60 * 1000, max: 600, standardHeaders: true, legacyHeaders: false }),
  );

  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', service: 'cds-backend', time: new Date().toISOString() });
  });

  app.use('/api/v1', apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
