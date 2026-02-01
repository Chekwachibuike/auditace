import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { UserRepository } from "../modules/users/user.repository";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    fullName: string;
  };
}

export const authenticateToken = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Access token required" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
    const userRepo = new UserRepository();
    const user = await userRepo.findById(decoded.userId);

    if (!user) {
      return res.status(401).json({ message: "Invalid token - user not found" });
    }

    req.user = {
      id: user.id,
      email: user.email,
      fullName: user.fullName
    };

    next();
  } catch (error) {
    return res.status(403).json({ message: "Invalid token" });
  }
};
