import pg from "pg";
import { loadEnv } from "../src/config/env.js";

export type MediaOrientationDiagnostics = {
  vertical: number;
  horizontal: number;
  unresolved: number;
};

export async function verifyMediaOrientation(pool: pg.Pool): Promise<MediaOrientationDiagnostics> {
  const result = await pool.query<{ orientation: "vertical" | "horizontal" | null; count: string }>(
    "select orientation, count(*) from project_media group by orientation",
  );
  const counts = new Map(result.rows.map((row) => [row.orientation, Number(row.count)]));
  return { vertical: counts.get("vertical") ?? 0, horizontal: counts.get("horizontal") ?? 0, unresolved: counts.get(null) ?? 0 };
}

if (import.meta.url === new URL(process.argv[1], "file:").href) {
  const env = loadEnv();
  const pool = new pg.Pool({ connectionString: env.DATABASE_URL });
  try {
    console.info({ event: "media_orientation_verify_complete", ...(await verifyMediaOrientation(pool)) });
  } finally {
    await pool.end();
  }
}
