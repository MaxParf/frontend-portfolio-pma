import { z } from "zod";

export const loginRequestSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(1).max(1024),
});

export interface AdminUserDto {
  id: string;
  displayName: string;
  role: "owner";
}
