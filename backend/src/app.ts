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

export function createApp(): Application {
  const app = express();

  // Behind a reverse proxy (nginx) on a VPS: trust the first proxy hop.
  app.set('trust proxy', 1);

  app.use(
    helmet({
      // Streaming endpoints are embedded in LMS/iframes, so disable COEP and
      // allow cross-origin resource loading for media.
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
