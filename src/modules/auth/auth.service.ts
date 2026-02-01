
 import bcrypt from "bcrypt";
 import jwt from "jsonwebtoken";
 import { LoginDto, SignupDto } from "./auth.dto";
 import { UserRepository } from "../users/user.repository";

 export class AuthService {
   constructor(private userRepo: UserRepository) {}

   async signup(data: SignupDto) {
     const existingUser = await this.userRepo.findByEmail(data.email);

     if (existingUser) {
       throw new Error("Email already in use");
     }

     const passwordHash = await bcrypt.hash(data.password, 10);

     const user = await this.userRepo.create({
       email: data.email,
       fullName: data.fullName,
       passwordHash,
     });

     const token = this.generateToken(user.id);

     return {
       token,
       user: {
         id: user.id,
         email: user.email,
         fullName: user.fullName,
       },
     };
   }

   async login(data: LoginDto) {
     const user = await this.userRepo.findByEmail(data.email);

     if (!user) {
       throw new Error("Invalid credentials");
     }

     const isValid = await bcrypt.compare(data.password, user.passwordHash);

     if (!isValid) {
       throw new Error("Invalid credentials");
     }

     const token = this.generateToken(user.id);

     return {
       token,
       user: {
         id: user.id,
         email: user.email,
         fullName: user.fullName,
       },
     };
   }

   private generateToken(userId: string) {
     const secret = process.env.JWT_SECRET;

     if (!secret) {
       throw new Error("JWT_SECRET is not set");
     }

     return jwt.sign({ userId }, secret, { expiresIn: "7d" });
   }
 }

