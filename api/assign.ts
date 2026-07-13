import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getDb } from "./_db.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée" });

  const sql = getDb();
  const { fundId, analystId, pattern } = req.body;

  try {
    const fund = await sql`SELECT id FROM funds WHERE id = ${fundId}`;
    if (fund.length === 0) return res.status(404).json({ error: "Fonds non trouvé" });

    await sql`UPDATE funds SET analyst_id = ${analystId} WHERE id = ${fundId}`;

    if (pattern) {
      const existingRule = await sql`SELECT pattern FROM assignment_rules WHERE LOWER(pattern) = LOWER(${pattern})`;
      if (existingRule.length === 0) {
        await sql`INSERT INTO assignment_rules (pattern, analyst_id) VALUES (${pattern}, ${analystId})`;
      }
    }

    const funds = await sql`SELECT id, manager_id AS "managerId", name, analyst_id AS "analystId" FROM funds`;
    const assignmentRules = await sql`SELECT pattern, analyst_id AS "analystId" FROM assignment_rules`;

    res.status(200).json({ success: true, funds, assignmentRules });
  } catch (error: any) {
    console.error("Assign error:", error);
    res.status(500).json({ error: error.message || "Erreur lors de l'assignation" });
  }
}
