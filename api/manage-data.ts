import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getDb } from "./_db.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée" });

  const sql = getDb();
  const { action, id } = req.body;

  try {
    if (action === "delete_fund") {
      if (!id) return res.status(400).json({ error: "id du fonds manquant" });
      await sql`DELETE FROM fund_reports WHERE fund_id = ${id}`;
      await sql`DELETE FROM analyst_overrides WHERE fund_id = ${id}`;
      await sql`DELETE FROM funds WHERE id = ${id}`;
    } else if (action === "delete_report") {
      if (!id) return res.status(400).json({ error: "id du rapport manquant" });
      await sql`DELETE FROM fund_reports WHERE id = ${id}`;
    } else if (action === "delete_manager") {
      if (!id) return res.status(400).json({ error: "id du gérant manquant" });
      const funds = await sql`SELECT id FROM funds WHERE manager_id = ${id}`;
      for (const f of funds as any[]) {
        await sql`DELETE FROM fund_reports WHERE fund_id = ${f.id}`;
        await sql`DELETE FROM analyst_overrides WHERE fund_id = ${f.id}`;
      }
      await sql`DELETE FROM funds WHERE manager_id = ${id}`;
      await sql`DELETE FROM asset_managers WHERE id = ${id}`;
    } else if (action === "wipe_all") {
      await sql`TRUNCATE analyst_overrides, assignment_rules, fund_reports, funds, asset_managers CASCADE`;
    } else {
      return res.status(400).json({ error: "Action inconnue" });
    }

    // Renvoie l'état à jour de la base pour rafraîchir l'app immédiatement
    const assetManagers = await sql`SELECT id, name, sales_contacts AS "salesContacts" FROM asset_managers`;
    const funds = await sql`SELECT id, manager_id AS "managerId", name, analyst_id AS "analystId" FROM funds`;
    const fundReports = await sql`
      SELECT id, fund_id AS "fundId", report_date AS "reportDate", cash_rate AS "cashRate",
             performance_pct AS "performancePct", aum_m AS "aumM", key_views AS "keyViews", positioning,
             urgency_level AS "urgencyLevel", urgency_reason AS "urgencyReason",
             raw_email_subject AS "rawEmailSubject", raw_email_body AS "rawEmailBody",
             extracted_by_ai AS "extractedByAi", created_at AS "createdAt"
      FROM fund_reports ORDER BY created_at DESC
    `;
    const analystOverrides = await sql`
      SELECT fund_id AS "fundId", positioning_override AS "positioningOverride", analyst_comment AS "analystComment", updated_at AS "updatedAt"
      FROM analyst_overrides
    `;
    const assignmentRules = await sql`SELECT pattern, analyst_id AS "analystId" FROM assignment_rules`;

    res.status(200).json({ success: true, assetManagers, funds, fundReports, analystOverrides, assignmentRules });
  } catch (error: any) {
    console.error("Manage data error:", error);
    res.status(500).json({ error: error.message || "Erreur lors de la suppression" });
  }
}
