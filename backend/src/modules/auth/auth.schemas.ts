import { z } from "zod";

export const loginRequestSchema = z.object({
  login: z.string().trim().min(1).max(128),
  password: z.string().min(1).max(1024),
});

export interface AdminUserDto {
  id: string;
  login: string;
  displayName: string;
  role: "owner";
}
