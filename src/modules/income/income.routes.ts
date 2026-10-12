import { Router } from 'express';
import { IncomeController } from './income.controller';
import { IncomeService } from './income.service';
import { IncomeRepository } from './income.repository';
import { authenticateToken } from '../../middleware/auth.middleware';
import { asyncHandler } from '../../shared/asyncHandler';
import { validate } from '../../shared/validate';
import { createIncomeSchema, updateIncomeSchema } from './income.validation';

const router = Router();

const incomeRepository = new IncomeRepository();
const incomeService = new IncomeService(incomeRepository);
const incomeController = new IncomeController(incomeService);

/**
 * @swagger
 * /income:
 *   post:
 *     summary: Record money received
 *     description: >
 *       Income is kept in its own table rather than as a negative expense, so
 *       budgets, the category breakdown and every existing chart continue to
 *       mean exactly what they meant before.
 *     tags: [Income]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Created }
 *       400: { description: Validation failed }
 */
router.post('/', authenticateToken, validate(createIncomeSchema), asyncHandler(incomeController.createIncome));

/**
 * @swagger
 * /income/categories:
 *   get:
 *     summary: Distinct income sources this user has used
 *     tags: [Income]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: A list of source names }
 */
router.get('/categories', authenticateToken, asyncHandler(incomeController.getCategories));

/**
 * @swagger
 * /income:
 *   get:
 *     summary: List income, newest first
 *     tags: [Income]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: month, schema: { type: string }, description: "YYYY-MM" }
 *       - { in: query, name: category, schema: { type: string } }
 *       - { in: query, name: search, schema: { type: string } }
 *     responses:
 *       200: { description: A list of income records }
 */
router.get('/', authenticateToken, asyncHandler(incomeController.getIncomes));

/**
 * @swagger
 * /income/{id}:
 *   get:
 *     summary: One income record
 *     tags: [Income]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Found }
 *       404: { description: Not found }
 */
router.get('/:id', authenticateToken, asyncHandler(incomeController.getIncome));

/**
 * @swagger
 * /income/{id}:
 *   put:
 *     summary: Update an income record
 *     tags: [Income]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Updated }
 *       404: { description: Not found }
 */
router.put('/:id', authenticateToken, validate(updateIncomeSchema), asyncHandler(incomeController.updateIncome));

/**
 * @swagger
 * /income/{id}:
 *   delete:
 *     summary: Delete an income record
 *     tags: [Income]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       204: { description: Deleted }
 *       404: { description: Not found }
 */
router.delete('/:id', authenticateToken, asyncHandler(incomeController.deleteIncome));

export default router;
