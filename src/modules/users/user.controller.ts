import { Response } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { UnauthorizedError } from '../../shared/AppError';
import { UserService } from './user.service';
import { ChangePasswordDto, DeleteAccountDto, UpdateProfileDto } from './user.dto';

export class UserController {
  constructor(private service: UserService) {}

  updateMe = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('User not authenticated');
    res.status(200).json(await this.service.updateProfile(req.user.id, req.body as UpdateProfileDto));
  };

  changePassword = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('User not authenticated');
    const { currentPassword, newPassword } = req.body as ChangePasswordDto;
    await this.service.changePassword(req.user.id, currentPassword, newPassword);
    res.status(204).send();
  };

  deleteMe = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('User not authenticated');

    const { password } = req.body as DeleteAccountDto;
    await this.service.deleteAccount(req.user.id, password);

    // 204: there is nothing left to describe. The client discards its token
    // on seeing this and returns to the sign-in screen.
    res.status(204).send();
  };
}
