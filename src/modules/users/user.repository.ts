import { User } from "./user.model";
import { prisma } from "../../database/prisma";

export class UserRepository {
  async findByEmail(email: string): Promise<User | null> {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });
    
    if (!user) return null;
    
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      passwordHash: user.passwordHash,
      createdAt: user.createdAt
    };
  }

  async findById(id: string): Promise<User | null> {
    const user = await prisma.user.findUnique({
      where: { id }
    });
    
    if (!user) return null;
    
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      passwordHash: user.passwordHash,
      createdAt: user.createdAt
    };
  }

  async create(data: {
    email: string;
    fullName: string;
    passwordHash: string;
  }): Promise<User> {
    const user = await prisma.user.create({
      data: {
        email: data.email.toLowerCase(),
        fullName: data.fullName,
        passwordHash: data.passwordHash
      }
    });
    
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      passwordHash: user.passwordHash,
      createdAt: user.createdAt
    };
  }

  async updateProfile(
    id: string,
    data: { fullName?: string; email?: string },
  ): Promise<User> {
    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(data.fullName !== undefined ? { fullName: data.fullName } : {}),
        ...(data.email !== undefined ? { email: data.email.toLowerCase() } : {}),
      },
    });

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      passwordHash: user.passwordHash,
      createdAt: user.createdAt,
    };
  }

  async updatePassword(id: string, passwordHash: string): Promise<void> {
    await prisma.user.update({ where: { id }, data: { passwordHash } });
  }

  /**
   * Removes the user row. Dependent rows go with it via ON DELETE CASCADE on
   * every userId foreign key, so this one statement is the whole deletion —
   * see the note in UserService.deleteAccount.
   */
  async deleteById(id: string): Promise<void> {
    await prisma.user.delete({ where: { id } });
  }
}
