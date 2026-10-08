import express, { NextFunction, Request, Response } from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec, swaggerUiOptions } from './config/swagger';
import authRoutes from "./modules/auth/auth.routes";
import userRoutes from "./modules/users/user.routes";
import expenseRoutes from "./modules/expenses/expense.routes";
import budgetRoutes from "./modules/budgets/budget.routes";
import dashboardRoutes from "./modules/dashboard/dashboard.routes";
import integrationRoutes from "./modules/integrations/integration.routes";
import { AppError } from "./shared/AppError";

// express-rate-limit's default `message` option is sent as-is via res.send(),
// which produces a text/html response - inconsistent with every other
// response in this API being JSON. A handler keeps the format consistent.
const jsonRateLimitHandler = (message: string) => (_req: Request, res: Response) => {
  res.status(429).json({ message });
};

/**
 * Browser origins allowed to call this API in production.
 *
 * Read from CORS_ORIGINS (comma-separated), with FRONTEND_URL kept as a
 * single-value fallback so existing deployments keep working. Adding a
 * deployment is therefore an environment change, not a code change.
 *
 * Trailing slashes are stripped because an `Origin` header never carries one:
 * "https://app.example.com/" in the variable would silently never match, which
 * is a maddening half-hour to diagnose.
 */
const allowedOrigins = (process.env.CORS_ORIGINS ?? process.env.FRONTEND_URL ?? '')
  .split(',')
  .map((value) => value.trim().replace(/\/$/, ''))
  .filter(Boolean);

/**
 * Preview-deployment patterns, derived from the configured origins.
 *
 * Vercel gives every branch and every commit its own hostname
 * (auditace-frontend-git-fix-abc123.vercel.app), so a fixed list breaks every
 * preview build. Configuring https://auditace-frontend.vercel.app therefore
 * also admits that project's previews — and ONLY that project's.
 *
 * The narrowness matters: a blanket /\.vercel\.app$/ would let anyone deploy a
 * site to Vercel and make credentialed cross-origin calls to this API with a
 * victim's token. The project name is the thing doing the authorising here.
 */
const previewOriginPatterns = allowedOrigins
  .map((origin) => /^https:\/\/([a-z0-9-]+)\.vercel\.app$/.exec(origin)?.[1])
  .filter((project): project is string => Boolean(project))
  .map((project) => new RegExp(`^https://${project}-[a-z0-9-]+\\.vercel\\.app$`));

function isOriginAllowed(origin: string): boolean {
  return (
    allowedOrigins.includes(origin) ||
    previewOriginPatterns.some((pattern) => pattern.test(origin))
  );
}

export function createApp() {
  const app = express();

  /**
   * Render (like Vercel, Heroku and every other managed host) terminates TLS
   * at its edge and forwards to this container over one internal hop. Without
   * this, `req.ip` is that proxy's address — identical for every visitor on
   * earth — so both rate limiters below collapse into a single global bucket:
   * 100 requests per 15 minutes for ALL users combined, and 5 login attempts
   * total, meaning one person mistyping their password five times locks out
   * everyone until the window rolls.
   *
   * `1` rather than `true` on purpose. `true` trusts the entire
   * X-Forwarded-For chain, so anyone could send a made-up header and get a
   * fresh bucket per request — strictly worse than no limiting at all. `1`
   * trusts exactly the one hop we actually have.
   */
  app.set('trust proxy', 1);

  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "http://localhost:3000", "https://localhost:3000", process.env.API_BASE_URL || ""].filter(Boolean)
      }
    }
  }));
  app.use(cors({
    origin: function (origin, callback) {
      // No Origin header at all: curl, server-to-server calls, and the
      // inbound-email webhook. There is no browser to protect here, and CORS
      // is only ever a browser mechanism.
      if (!origin) return callback(null, true);

      // Development trusts any origin so a teammate on a LAN address or a
      // phone on the same network can point at a local server.
      if (process.env.NODE_ENV !== 'production') return callback(null, true);

      if (isOriginAllowed(origin)) return callback(null, true);

      /**
       * Rejected. `callback(null, false)` — NOT `callback(new Error(...))`.
       *
       * Passing an Error makes cors call next(err), which hands the request to
       * the error handler and returns a 500 with no CORS headers. The browser
       * then reports only "No 'Access-Control-Allow-Origin' header is
       * present", which looks identical to the server being misconfigured,
       * down, or asleep — and says nothing about the origin being the problem.
       * Answering `false` omits the header with a clean 204 and, crucially,
       * lets us log the exact origin that was turned away, so the fix is
       * "add this string to CORS_ORIGINS" instead of a guessing game.
       */
      console.warn(
        `CORS: refused origin ${origin}. Allowed: ${allowedOrigins.join(', ') || '(none configured — set CORS_ORIGINS)'}`
      );
      callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }));
  
  // Rate limiting
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    handler: jsonRateLimitHandler('Too many requests from this IP, please try again later.'),
    // Mono's webhooks all arrive from a small set of their IPs, so a busy
    // account's events would otherwise burn through one shared bucket and get
    // 429'd. A rate-limited webhook is a dropped (or endlessly retried) event,
    // and the endpoint has its own shared-secret gate, so it opts out here.
    skip: (req: Request) =>
      req.path === '/integrations/mono/webhook' ||
      req.path === '/integrations/email/inbound'
  });
  app.use(limiter);

  // Stricter rate limiting for auth endpoints
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // limit each IP to 5 auth requests per windowMs
    handler: jsonRateLimitHandler('Too many authentication attempts, please try again later.')
  });

  app.use(express.json());

  /**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check endpoint
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Server is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "ok"
 */
app.get("/health", (_req: Request, res: Response) => {
    res.status(200).json({ status: "ok" });
  });

  // Swagger documentation
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerUiOptions));

  app.use("/auth", authLimiter, authRoutes);
  app.use("/users", userRoutes);
  app.use("/expenses", expenseRoutes);
  app.use("/budgets", budgetRoutes);
  app.use("/dashboard", dashboardRoutes);
  app.use("/integrations", integrationRoutes);

  // Catch-all for undefined routes. Without this, unmatched requests fall
  // through to Express's default handler, which returns bare HTML ("Cannot
  // GET /x") instead of the JSON this API uses everywhere else.
  app.use((req: Request, res: Response) => {
    res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
  });

  // Central error handler. AppError (and its subclasses) carry the correct
  // HTTP status; anything else is an unexpected failure and must surface as
  // a 500, not a 400 - conflating "you sent bad input" with "the server
  // broke" misleads API consumers and hides real bugs. Unexpected errors are
  // logged server-side and given a generic client-facing message so internal
  // details (stack traces, third-party library errors) never leak in the
  // response body.
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ message: err.message });
      return;
    }

    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  });

  return app;
}
