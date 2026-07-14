import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getDb } from "./_db.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const aiConfigured = !!process.env.TPF_AI_Key;
  let usageToday = 0;

  try {
    const sql = getDb();
    await sql`
      CREATE TABLE IF NOT EXISTS ai_usage_log (
        id SERIAL PRIMARY KEY,
        success BOOLEAN NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `;
    const rows = await sql`
      SELECT COUNT(*) AS count FROM ai_usage_log
      WHERE created_at >= date_trunc('day', now())
    `;
    usageToday = Number((rows[0] as any)?.count || 0);
  } catch (err) {
    console.error("Erreur lors de la lecture du compteur d'usage IA:", err);
  }

  res.status(200).json({ aiConfigured, usageToday, quotaLimit: 20 });
}
