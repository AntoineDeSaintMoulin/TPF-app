import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getDb } from "./_db.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée" });

  const sql = getDb();
  const { fundId, positioningOverride, analystComment } = req.body;
  const now = new Date().toISOString();

  try {
    await sql`
      INSERT INTO analyst_overrides (fund_id, positioning_override, analyst_comment, updated_at)
      VALUES (${fundId}, ${positioningOverride}, ${analystComment}, ${now})
      ON CONFLICT (fund_id) DO UPDATE SET
        positioning_override = EXCLUDED.positioning_override,
        analyst_comment = EXCLUDED.analyst_comment,
        updated_at = EXCLUDED.updated_at
    `;

    const analystOverrides = await sql`
      SELECT fund_id AS "fundId", positioning_override AS "positioningOverride", analyst_comment AS "analystComment", updated_at AS "updatedAt"
      FROM analyst_overrides
    `;

    res.status(200).json({ success: true, analystOverrides });
  } catch (error: any) {
    console.error("Override error:", error);
    res.status(500).json({ error: error.message || "Erreur lors de la sauvegarde" });
  }
}
