import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getDb } from "./_db.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const sql = getDb();

  try {
    const assetManagers = await sql`SELECT id, name, sales_contacts AS "salesContacts" FROM asset_managers`;
    const funds = await sql`SELECT id, manager_id AS "managerId", name, analyst_id AS "analystId" FROM funds`;
    const fundReports = await sql`
      SELECT
        id, fund_id AS "fundId", report_date AS "reportDate",
        cash_rate AS "cashRate", performance_pct AS "performancePct", aum_m AS "aumM",
        key_views AS "keyViews", positioning,
        urgency_level AS "urgencyLevel", urgency_reason AS "urgencyReason",
        raw_email_subject AS "rawEmailSubject", raw_email_body AS "rawEmailBody",
        extracted_by_ai AS "extractedByAi", created_at AS "createdAt"
      FROM fund_reports
      ORDER BY created_at DESC
    `;
    const analystOverrides = await sql`
      SELECT fund_id AS "fundId", positioning_override AS "positioningOverride", analyst_comment AS "analystComment", updated_at AS "updatedAt"
      FROM analyst_overrides
    `;
    const assignmentRules = await sql`SELECT pattern, analyst_id AS "analystId" FROM assignment_rules`;

    res.status(200).json({ assetManagers, funds, fundReports, analystOverrides, assignmentRules });
  } catch (error: any) {
    console.error("Data fetch error:", error);
    res.status(500).json({ error: error.message || "Erreur lors de la récupération des données" });
  }
}
