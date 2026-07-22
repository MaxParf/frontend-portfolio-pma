import type { FastifyInstance } from "fastify";

export function registerNotFoundHandler(app: FastifyInstance): void {
  app.setNotFoundHandler((request, reply) =>
    reply.status(404).send({
      error: {
        code: "NOT_FOUND",
        message: "Route not found.",
        requestId: request.id,
      },
    }),
  );
}
