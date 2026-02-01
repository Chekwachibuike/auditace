import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Expense Tracker Backend API',
      version: '1.0.0',
      description: 'A simple, clean expense-tracking web app backend API',
    },
    servers: [
      {
        url: process.env.API_BASE_URL || 'http://localhost:3000',
        description: process.env.NODE_ENV === 'production' ? 'Production server' : 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            email: { type: 'string', format: 'email' },
            fullName: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Expense: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            amount: { type: 'number' },
            description: { type: 'string' },
            category: { type: 'string' },
            date: { type: 'string', format: 'date' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
            userId: { type: 'string' },
          },
        },
        Budget: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            amount: { type: 'number' },
            category: { type: 'string' },
            period: { type: 'string', enum: ['monthly', 'weekly', 'yearly'] },
            startDate: { type: 'string', format: 'date' },
            endDate: { type: 'string', format: 'date' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
            userId: { type: 'string' },
          },
        },
        CreateExpenseDto: {
          type: 'object',
          required: ['amount', 'category', 'date'],
          properties: {
            amount: { type: 'number', minimum: 0.01 },
            description: { type: 'string' },
            category: { type: 'string' },
            date: { type: 'string', format: 'date' },
          },
        },
        CreateBudgetDto: {
          type: 'object',
          required: ['name', 'amount', 'period', 'startDate', 'endDate'],
          properties: {
            name: { type: 'string' },
            amount: { type: 'number', minimum: 0.01 },
            category: { type: 'string' },
            period: { type: 'string', enum: ['monthly', 'weekly', 'yearly'] },
            startDate: { type: 'string', format: 'date' },
            endDate: { type: 'string', format: 'date' },
          },
        },
        LoginDto: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 6 },
          },
        },
        SignupDto: {
          type: 'object',
          required: ['email', 'fullName', 'password'],
          properties: {
            email: { type: 'string', format: 'email' },
            fullName: { type: 'string' },
            password: { type: 'string', minLength: 6 },
          },
        },
        Error: {
          type: 'object',
          properties: {
            message: { type: 'string' },
          },
        },
      },
    },
  },
  apis: ['./src/**/*.ts'], // Path to the API docs
};

export const swaggerSpec = swaggerJsdoc(options);

export const swaggerUiOptions = {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Expense Tracker API Documentation',
};
