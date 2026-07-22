import type { FastifyInstance } from "fastify";
import type { AppEnv } from "../../config/env.js";
import type { PortfolioDatabase } from "../../db/client.js";
import { AuthRepository } from "./auth.repository.js";
import { loginRequestSchema } from "./auth.schemas.js";
import { AuthService } from "./auth.service.js";

export function createAuthService(env: AppEnv, db: PortfolioDatabase): AuthService {
  return new AuthService(env, new AuthRepository(db));
}

export function registerAuthRoutes(app: FastifyInstance, env: AppEnv, db: PortfolioDatabase): AuthService {
  const authService = createAuthService(env, db);

  app.post(
    "/api/v1/admin/auth/login",
    {
      config: {
        rateLimit: {
          max: env.LOGIN_RATE_LIMIT,
          timeWindow: "1 minute",
        },
      },
    },
    async (request, reply) => {
      const body = loginRequestSchema.parse(request.body);
      const user = await authService.login({ ...body, request, reply });
      return { data: user };
    },
  );

  app.post("/api/v1/admin/auth/logout", async (request, reply) => {
    await authService.logout(request, reply);
    return { data: { loggedOut: true } };
  });

  app.get("/api/v1/admin/auth/me", async (request) => {
    const context = await authService.authenticate(request);
    return { data: context.user };
  });

  return authService;
}
