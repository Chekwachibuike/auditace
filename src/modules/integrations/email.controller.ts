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
   * The status code is a RETRY INSTRUCTION, not decoration. Postmark retries
   * any non-200 ten times over about 10.5 hours, allows two minutes per
   * attempt, and stops immediately on 403. Each outcome is mapped to the
   * behaviour we actually want:
   *
   *   200  A decision was reached and the mail is safely recorded — parsed,
   *        unparsed, duplicate or ignored. Nothing to retry.
   *
   *   403  The payload is not a readable email and never will be. Postmark
   *        stops at once rather than redelivering rubbish ten times, and the
   *        message still surfaces on its Inbound errors page.
   *
   *   500  Something on OUR side failed — the database was unreachable, say.
   *        The email is fine and a later attempt will probably work, so we ask
   *        for the retry. An earlier version answered 200 here, which threw
   *        away Postmark's safety net: a momentary database blip would have
   *        silently lost a transaction, and missing spend is the one failure an
   *        expense tracker must never hide. The two-minute timeout also means a
   *        cold start on a sleeping free-tier host is comfortably survivable.
   */
  ingest = async (req: Request, res: Response): Promise<void> => {
    try {
      res.status(200).json(await this.service.ingest(req.body));
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;

      if (status === 422) {
        // Permanent: tell Postmark to stop rather than burn ten retries.
        res.status(403).json({ message: (error as Error).message });
        return;
      }

      console.error('Inbound email ingest failed', error);
      res.status(500).json({ status: 'error', reason: 'Processing failed; please retry' });
    }
  };
}
