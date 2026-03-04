import { z } from "zod";

/**
 * UserRegisterSchema — validates user registration input.
 * Used in POST /api/auth/register and client-side registration form.
 */
export const UserRegisterSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters" }),
  email: z.string().email({ message: "Invalid email address" }),
  password: z
    .string()
    .min(8, { message: "Password must be at least 8 characters" }),
  role: z.enum(["driver", "admin"]).default("driver"),
  adminInviteCode: z.string().optional(),
});

/**
 * UserLoginSchema — validates user login input.
 * Used in Auth.js Credentials provider and client-side login form.
 */
export const UserLoginSchema = z.object({
  email: z.string().email({ message: "Invalid email address" }),
  password: z
    .string()
    .min(8, { message: "Password must be at least 8 characters" }),
});

export type UserRegisterInput = z.infer<typeof UserRegisterSchema>;
export type UserLoginInput = z.infer<typeof UserLoginSchema>;
