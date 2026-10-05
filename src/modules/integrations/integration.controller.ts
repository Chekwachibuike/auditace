import { Request, Response } from 'express';
import { IntegrationService } from './integration.service';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { UnauthorizedError } from '../../shared/AppError';

export class IntegrationController {
  constructor(private integrationService: IntegrationService) {}

  linkAccount = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('User not authenticated');

    const account = await this.integrationService.linkAccount(req.user.id, req.body.code);
    res.status(201).json(account);
  };

  listAccounts = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('User not authenticated');

    const accounts = await this.integrationService.listAccounts(req.user.id);
    res.status(200).json(accounts);
  };

  unlinkAccount = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('User not authenticated');

    await this.integrationService.unlinkAccount(req.user.id, req.params.id);
    res.status(204).send();
  };

  syncAccount = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('User not authenticated');

    const result = await this.integrationService.syncAccount(req.user.id, req.params.id, {
      start: req.body?.start,
      end: req.body?.end,
      realTime: req.body?.realTime,
    });
    res.status(200).json(result);
  };

  syncAll = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('User not authenticated');

    const results = await this.integrationService.syncAllAccounts(req.user.id);
    res.status(200).json(results);
  };

  listTransactions = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('User not authenticated');

    // Defaults to the review queue, which is what this endpoint is for.
    const status = (req.query.status as string) ?? 'pending';

    const transactions = await this.integrationService.listTransactions(req.user.id, {
      status: status === 'all' ? undefined : status,
      linkedAccountId: req.query.accountId as string | undefined,
      type: req.query.type as string | undefined,
      source: req.query.source as string | undefined,
    });
    res.status(200).json(transactions);
  };

  countPending = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('User not authenticated');

    const pending = await this.integrationService.countPending(req.user.id);
    res.status(200).json({ pending });
  };

  acceptTransaction = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('User not authenticated');

    const expense = await this.integrationService.acceptTransaction(req.user.id, req.params.id, {
      category: req.body.category,
      description: req.body.description,
      amount: req.body.amount,
    });
    res.status(201).json(expense);
  };

  ignoreTransaction = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('User not authenticated');

    const transaction = await this.integrationService.ignoreTransaction(req.user.id, req.params.id);
    res.status(200).json(transaction);
  };

  /**
   * Mono's webhook receiver.
   *
   * Unauthenticated in the usual sense — there is no user session on an
   * inbound webhook — so the shared secret checked in the route is the only
   * thing standing between this endpoint and anyone who knows the URL.
   *
   * Always answers 200 once the secret checks out. A webhook sender treats a
   * non-2xx as "retry", and retrying an event we failed to process for a
   * permanent reason (unknown event, account not linked here) just produces
   * noise. Genuine failures are logged, not signalled upstream.
   */
  handleWebhook = async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await this.integrationService.handleWebhook(req.body);
      res.status(200).json(result);
    } catch (error) {
      console.error('Mono webhook processing failed', error);
      res.status(200).json({ handled: false, reason: 'processing error' });
    }
  };
}
