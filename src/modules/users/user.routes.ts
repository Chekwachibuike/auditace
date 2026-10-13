import { Router, Response } from "express";
import { authenticateToken, AuthenticatedRequest } from "../../middleware/auth.middleware";
import { asyncHandler } from "../../shared/asyncHandler";
import { validate } from "../../shared/validate";
import { UserController } from "./user.controller";
import { UserService } from "./user.service";
import { UserRepository } from "./user.repository";
import { changePasswordSchema, deleteAccountSchema, updateProfileSchema } from "./user.validation";

const router = Router();

const userRepository = new UserRepository();
const userService = new UserService(userRepository);
const userController = new UserController(userService);

/**
 * @swagger
 * /users/me:
 *   get:
 *     summary: Get current user profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/me", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    res.status(200).json({
      id: req.user.id,
      email: req.user.email,
      fullName: req.user.fullName
    });
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * @swagger
 * /users/me:
 *   delete:
 *     summary: Permanently delete the current user's account
 *     description: >
 *       Deletes the account and every record attached to it - expenses,
 *       budgets, linked accounts, imported transactions and stored inbound
 *       emails - by database cascade. There is no recovery and no soft-delete.
 *       The current password must be supplied in the body as confirmation:
 *       a valid token alone is not enough for an irreversible action.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [password]
 *             properties:
 *               password:
 *                 type: string
 *                 description: The account's current password.
 *                 example: "your-current-password"
 *     responses:
 *       204:
 *         description: Account deleted. The bearer token is now useless and should be discarded.
 *       400:
 *         description: >
 *           The password was missing or incorrect. Deliberately not 401, so a
 *           typo does not read as an expired session and end the client's login.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Missing or invalid token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
/**
 * @swagger
 * /users/me:
 *   patch:
 *     summary: Update your name or email address
 *     description: >
 *       Either field may be sent on its own. Changing the EMAIL additionally
 *       requires the account password, because the email is the login
 *       identifier - without that check, anyone reaching an unlocked session
 *       could point the account at an address they control and take it over.
 *       Changing a display name carries no such risk and asks for nothing.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: The updated profile }
 *       400: { description: Validation failed, or the password was wrong }
 *       409: { description: That email address is already in use }
 */
router.patch(
  "/me",
  authenticateToken,
  validate(updateProfileSchema),
  asyncHandler(userController.updateMe)
);

/**
 * @swagger
 * /users/me/password:
 *   post:
 *     summary: Change your password
 *     description: >
 *       Requires the current password. A token proves a session, not a person,
 *       and a password change made from a borrowed session would lock out the
 *       owner rather than the intruder.
 *
 *       Existing tokens remain valid: there is no session store to revoke
 *       against, so anyone already holding a token keeps it until it expires.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       204: { description: Password changed }
 *       400: { description: The current password was wrong, or the new one was rejected }
 */
router.post(
  "/me/password",
  authenticateToken,
  validate(changePasswordSchema),
  asyncHandler(userController.changePassword)
);

router.delete(
  "/me",
  authenticateToken,
  validate(deleteAccountSchema),
  asyncHandler(userController.deleteMe)
);

export default router;
