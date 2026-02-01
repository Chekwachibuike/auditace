import { Router } from 'express';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { DashboardRepository } from './dashboard.repository';
import { authenticateToken } from '../../middleware/auth.middleware';

const router = Router();

const asyncHandler =
  (fn: (req: import('express').Request, res: import('express').Response) => Promise<void>) =>
  (req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) =>
    Promise.resolve(fn(req, res)).catch(next);

const dashboardRepository = new DashboardRepository();
const dashboardService = new DashboardService(dashboardRepository);
const dashboardController = new DashboardController(dashboardService);

/**
 * @swagger
 * components:
 *   schemas:
 *     MonthlySummary:
 *       type: object
 *       properties:
 *         month:
 *           type: string
 *           example: "2024-01"
 *         totalSpent:
 *           type: number
 *           example: 1250.50
 *         expenseCount:
 *           type: integer
 *           example: 15
 *         averageExpense:
 *           type: number
 *           example: 83.37
 *     CategoryBreakdown:
 *       type: object
 *       properties:
 *         category:
 *           type: string
 *           example: "Food"
 *         totalSpent:
 *           type: number
 *           example: 450.00
 *         expenseCount:
 *           type: integer
 *           example: 8
 *         percentage:
 *           type: number
 *           example: 36.0
 *     BudgetComparison:
 *       type: object
 *       properties:
 *         budgetId:
 *           type: string
 *         budgetName:
 *           type: string
 *           example: "Monthly Food Budget"
 *         budgetAmount:
 *           type: number
 *           example: 500.00
 *         totalSpent:
 *           type: number
 *           example: 450.00
 *         remaining:
 *           type: number
 *           example: 50.00
 *         percentageUsed:
 *           type: number
 *           example: 90.0
 *         status:
 *           type: string
 *           enum: [under, on-track, over]
 *           example: "on-track"
 *     DashboardOverview:
 *       type: object
 *       properties:
 *         totalSpent:
 *           type: number
 *           example: 2500.00
 *         totalExpenses:
 *           type: integer
 *           example: 45
 *         averageMonthlyExpense:
 *           type: number
 *           example: 833.33
 *         currentMonthSpent:
 *           type: number
 *           example: 650.00
 *         currentMonthExpenses:
 *           type: integer
 *           example: 12
 */

/**
 * @swagger
 * /dashboard/monthly-summaries:
 *   get:
 *     summary: Get monthly expense summaries
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: months
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 24
 *           default: 12
 *         description: Number of months to include (1-24)
 *     responses:
 *       200:
 *         description: Monthly summaries retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/MonthlySummary'
 *       401:
 *         description: Unauthorized
 */
router.get('/monthly-summaries', authenticateToken, asyncHandler(dashboardController.getMonthlySummaries));

/**
 * @swagger
 * /dashboard/category-breakdown:
 *   get:
 *     summary: Get category breakdown
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: month
 *         schema:
 *           type: string
 *           pattern: '^[0-9]{4}-[0-9]{2}$'
 *           example: "2024-01"
 *         description: Filter by specific month (YYYY-MM format)
 *     responses:
 *       200:
 *         description: Category breakdown retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/CategoryBreakdown'
 *       401:
 *         description: Unauthorized
 */
router.get('/category-breakdown', authenticateToken, asyncHandler(dashboardController.getCategoryBreakdown));

/**
 * @swagger
 * /dashboard/budget-comparisons:
 *   get:
 *     summary: Get budget vs expense comparisons
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Budget comparisons retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/BudgetComparison'
 *       401:
 *         description: Unauthorized
 */
router.get('/budget-comparisons', authenticateToken, asyncHandler(dashboardController.getBudgetComparisons));

/**
 * @swagger
 * /dashboard/overview:
 *   get:
 *     summary: Get dashboard overview
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard overview retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DashboardOverview'
 *       401:
 *         description: Unauthorized
 */
router.get('/overview', authenticateToken, asyncHandler(dashboardController.getDashboardOverview));

export default router;
