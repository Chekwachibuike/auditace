import { Response } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { UnauthorizedError } from '../../shared/AppError';
import { UserService } from './user.service';
import { DeleteAccountDto } from './user.dto';

export class UserController {
  constructor(private service: UserService) {}

  deleteMe = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('User not authenticated');

    const { password } = req.body as DeleteAccountDto;
    await this.service.deleteAccount(req.user.id, password);

    // 204: there is nothing left to describe. The client discards its token
    // on seeing this and returns to the sign-in screen.
    res.status(204).send();
  };
}
