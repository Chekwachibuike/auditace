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
import { AppError } from "./shared/AppError";

// express-rate-limit's default `message` option is sent as-is via res.send(),
// which produces a text/html response - inconsistent with every other
// response in this API being JSON. A handler keeps the format consistent.
const jsonRateLimitHandler = (message: string) => (_req: Request, res: Response) => {
  res.status(429).json({ message });
};

export function createApp() {
  const app = express();

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
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      
      // In production, be more restrictive
      if (process.env.NODE_ENV === 'production') {
        const allowedOrigins = [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:5173',
        'https://localhost:3000',
        'https://localhost:3001',
        'https://localhost:5173'
        ];
        
        // Add production frontend URL from environment variable
        if (process.env.FRONTEND_URL) {
          allowedOrigins.push(process.env.FRONTEND_URL);
        }
        
        if (allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      } else {
        // In development, allow all origins
        callback(null, true);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }));
  
  // Rate limiting
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    handler: jsonRateLimitHandler('Too many requests from this IP, please try again later.')
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
