import { NextFunction, Request, Response, Router } from 'express';
import { timingSafeEqual } from 'crypto';
import { IntegrationController } from './integration.controller';
import { IntegrationService } from './integration.service';
import { IntegrationRepository } from './integration.repository';
import { authenticateToken } from '../../middleware/auth.middleware';
import { asyncHandler } from '../../shared/asyncHandler';
import { validate } from '../../shared/validate';
import {
  acceptTransactionSchema,
  linkAccountSchema,
  syncAccountSchema,
} from './integration.validation';
import { EmailIngestService } from './email.service';
import { EmailController } from './email.controller';

const router = Router();

const integrationRepository = new IntegrationRepository();
const integrationService = new IntegrationService(integrationRepository);
const integrationController = new IntegrationController(integrationService);

const emailService = new EmailIngestService(integrationRepository);
const emailController = new EmailController(emailService);

/**
 * Gate the webhook on a shared secret.
 *
 * ⚠️ UNVERIFIED: the header name below is taken from Mono's documentation and
 * has not been confirmed against a real delivery. Check it against an actual
 * webhook before relying on this in production.
 *
 * Uses a length check plus a constant-time compare. A plain `!==` on secrets
 * leaks their length and content through timing, which is cheap to avoid.
 */
function verifyWebhookSecret(req: Request, res: Response, next: NextFunction) {
  const expected = process.env.MONO_WEBHOOK_SECRET;

  if (!expected) {
    // Fail closed. An unsecured webhook endpoint lets anyone who finds the URL
    // inject transactions into someone's account, so a missing secret must
    // disable the endpoint rather than open it.
    res.status(503).json({ message: 'Webhook endpoint is not configured.' });
    return;
  }

  const received = req.headers['mono-webhook-secret'];
  const provided = Array.isArray(received) ? received[0] : received;

  if (typeof provided !== 'string' || provided.length !== expected.length) {
    res.status(401).json({ message: 'Invalid webhook signature.' });
    return;
  }

  // timingSafeEqual requires equal-length buffers, which the check above ensures.
  const ok = timingSafeEqual(Buffer.from(provided), Buffer.from(expected));

  if (!ok) {
    res.status(401).json({ message: 'Invalid webhook signature.' });
    return;
  }

  next();
}

/**
 * @swagger
 * /integrations/mono/accounts:
 *   post:
 *     summary: Link a bank account using a Mono Connect code
 *     tags: [Integrations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code]
 *             properties:
 *               code:
 *                 type: string
 *                 description: The single-use code returned by the Mono Connect widget
 *     responses:
 *       201:
 *         description: Account linked
 *       409:
 *         description: Account already linked to another user
 */
router.post(
  '/mono/accounts',
  authenticateToken,
  validate(linkAccountSchema),
  asyncHandler(integrationController.linkAccount),
);

/**
 * @swagger
 * /integrations/mono/accounts:
 *   get:
 *     summary: List linked bank accounts
 *     tags: [Integrations]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Linked accounts
 */
router.get('/mono/accounts', authenticateToken, asyncHandler(integrationController.listAccounts));

/**
 * @swagger
 * /integrations/mono/accounts/{id}:
 *   delete:
 *     summary: Unlink a bank account
 *     tags: [Integrations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Unlinked
 */
router.delete(
  '/mono/accounts/:id',
  authenticateToken,
  asyncHandler(integrationController.unlinkAccount),
);

/**
 * @swagger
 * /integrations/mono/accounts/{id}/sync:
 *   post:
 *     summary: Pull new transactions for one linked account
 *     description: >
 *       Safe to re-run. Overlapping windows are absorbed by a unique constraint
 *       on (userId, monoTxnId), so this never duplicates transactions.
 *     tags: [Integrations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Sync summary
 */
router.post(
  '/mono/accounts/:id/sync',
  authenticateToken,
  validate(syncAccountSchema),
  asyncHandler(integrationController.syncAccount),
);

/**
 * @swagger
 * /integrations/mono/sync:
 *   post:
 *     summary: Sync every linked account
 *     tags: [Integrations]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Per-account sync summaries
 */
router.post('/mono/sync', authenticateToken, asyncHandler(integrationController.syncAll));

/**
 * @swagger
 * /integrations/mono/transactions:
 *   get:
 *     summary: Imported transactions awaiting review
 *     tags: [Integrations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, accepted, ignored, all]
 *         description: Defaults to pending
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [debit, credit]
 *     responses:
 *       200:
 *         description: Imported transactions
 */
router.get(
  '/mono/transactions',
  authenticateToken,
  asyncHandler(integrationController.listTransactions),
);

/**
 * @swagger
 * /integrations/mono/transactions/pending-count:
 *   get:
 *     summary: How many transactions are awaiting review
 *     tags: [Integrations]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Pending count
 */
router.get(
  '/mono/transactions/pending-count',
  authenticateToken,
  asyncHandler(integrationController.countPending),
);

/**
 * @swagger
 * /integrations/mono/transactions/{id}/accept:
 *   post:
 *     summary: Turn an imported transaction into an expense
 *     description: Only debits can be accepted; credits are not spending.
 *     tags: [Integrations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       201:
 *         description: The created expense
 */
router.post(
  '/mono/transactions/:id/accept',
  authenticateToken,
  validate(acceptTransactionSchema),
  asyncHandler(integrationController.acceptTransaction),
);

/**
 * @swagger
 * /integrations/mono/transactions/{id}/ignore:
 *   post:
 *     summary: Dismiss an imported transaction without creating an expense
 *     tags: [Integrations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: The updated transaction
 */
router.post(
  '/mono/transactions/:id/ignore',
  authenticateToken,
  asyncHandler(integrationController.ignoreTransaction),
);

/**
 * @swagger
 * /integrations/mono/webhook:
 *   post:
 *     summary: Mono webhook receiver
 *     description: >
 *       Authenticated by a shared secret header, not a bearer token. Always
 *       answers 200 once the secret is valid, so Mono does not retry events we
 *       cannot process.
 *     tags: [Integrations]
 *     responses:
 *       200:
 *         description: Acknowledged
 *       401:
 *         description: Invalid webhook secret
 */
router.post('/mono/webhook', verifyWebhookSecret, asyncHandler(integrationController.handleWebhook));

/* ---- Forwarded bank alerts ---------------------------------------------- */

/**
 * @swagger
 * /integrations/email/address:
 *   get:
 *     summary: This user's personal alert-forwarding address
 *     description: >
 *       Minted on first call. Forward bank alerts here with a Gmail filter.
 *       The address is a bearer secret - anyone holding it can deliver mail to
 *       this account's review queue.
 *     tags: [Integrations]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: The ingest address
 */
router.get('/email/address', authenticateToken, asyncHandler(emailController.getIngestAddress));

/**
 * @swagger
 * /integrations/email/address/rotate:
 *   post:
 *     summary: Issue a new forwarding address, invalidating the old one
 *     tags: [Integrations]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: The new ingest address
 */
router.post(
  '/email/address/rotate',
  authenticateToken,
  asyncHandler(emailController.rotateIngestAddress),
);

/**
 * @swagger
 * /integrations/email/messages:
 *   get:
 *     summary: Inbound alert emails, including ones no parser could read
 *     tags: [Integrations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, parsed, unparsed, ignored, all]
 *     responses:
 *       200:
 *         description: Inbound emails
 */
router.get('/email/messages', authenticateToken, asyncHandler(emailController.listEmails));

/**
 * @swagger
 * /integrations/email/status:
 *   get:
 *     summary: Forwarding address plus a summary of what has arrived
 *     description: >
 *       `discarded` counts non-bank mail whose body was deliberately not
 *       stored - a non-zero value means the user's Gmail filter is forwarding
 *       more than their bank alerts.
 *     tags: [Integrations]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Status summary
 */
router.get('/email/status', authenticateToken, asyncHandler(emailController.status));

/**
 * @swagger
 * /integrations/email/senders:
 *   get:
 *     summary: Distinct senders seen, with counts
 *     description: >
 *       Provenance for the UI, not a filter. Senders are never used to decide
 *       whether an email is processed.
 *     tags: [Integrations]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Senders
 */
router.get('/email/senders', authenticateToken, asyncHandler(emailController.listSenders));

/**
 * @swagger
 * /integrations/email/reparse:
 *   post:
 *     summary: Re-run parsers over previously unreadable emails
 *     description: Use after a parser is fixed or a new bank format is added.
 *     tags: [Integrations]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: How many were re-read
 */
router.post('/email/reparse', authenticateToken, asyncHandler(emailController.reparse));

/**
 * @swagger
 * /integrations/email/inbound:
 *   post:
 *     summary: Inbound webhook for the email provider
 *     description: >
 *       Authenticated by the secret token in the recipient address rather than
 *       by a bearer token, since the caller is a mail provider. Accepts the
 *       payload shapes of Cloudflare Email Routing, SendGrid Inbound Parse and
 *       Postmark.
 *     tags: [Integrations]
 *     responses:
 *       200:
 *         description: Outcome (parsed, unparsed, duplicate or ignored)
 *       422:
 *         description: Payload could not be read as an email
 */
router.post('/email/inbound', asyncHandler(emailController.ingest));

export default router;
