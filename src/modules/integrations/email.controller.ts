import { Request, Response } from 'express';
import { EmailIngestService } from './email.service';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { UnauthorizedError } from '../../shared/AppError';

export class EmailController {
  constructor(private service: EmailIngestService) {}

  getIngestAddress = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('User not authenticated');
    res.status(200).json(await this.service.getIngestAddress(req.user.id));
  };

  rotateIngestAddress = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('User not authenticated');
    res.status(200).json(await this.service.rotateIngestAddress(req.user.id));
  };

  listEmails = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('User not authenticated');
    const status = req.query.status as string | undefined;
    res.status(200).json(await this.service.listEmails(req.user.id, status === 'all' ? undefined : status));
  };

  listSenders = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('User not authenticated');
    res.status(200).json(await this.service.listSenders(req.user.id));
  };

  reparse = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('User not authenticated');
    res.status(200).json(await this.service.reparseUnparsed(req.user.id));
  };

  /**
   * Inbound webhook from the email provider.
   *
   * Answers 200 for anything it understood well enough to make a decision
   * about — including "ignored" and "unparsed". A mail provider reads a non-2xx
   * as "retry", and retrying an email we will never be able to route (wrong
   * recipient, unknown account) just generates noise forever. Only a payload we
   * genuinely could not read gets a 4xx.
   */
  ingest = async (req: Request, res: Response): Promise<void> => {
    try {
      res.status(200).json(await this.service.ingest(req.body));
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode ?? 500;
      if (status === 422) {
        res.status(422).json({ message: (error as Error).message });
        return;
      }
      console.error('Inbound email ingest failed', error);
      // Deliberately 200: the provider cannot fix a server-side failure by
      // resending, and the raw mail is already stored if it got that far.
      res.status(200).json({ status: 'error', reason: 'Processing failed; logged for review' });
    }
  };
}
