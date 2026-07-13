import { getDb } from "./_db.js";

export async function getAutoAssignedAnalyst(fundName: string): Promise<string> {
  const sql = getDb();
  const rules = await sql`SELECT pattern, analyst_id AS "analystId" FROM assignment_rules`;
  for (const rule of rules as any[]) {
    if (fundName.toLowerCase().includes(rule.pattern.toLowerCase())) {
      return rule.analystId;
    }
  }
  return "Unknown";
}

export async function saveExtractedReport(data: any, subject: string, body: string) {
  const sql = getDb();

  // Cherche ou crée le gérant
  const managers = await sql`SELECT id, name FROM asset_managers`;
  let mgr = (managers as any[]).find(
    (m) => m.name.toLowerCase().includes(data.asset_manager.toLowerCase()) || data.asset_manager.toLowerCase().includes(m.name.toLowerCase())
  );

  if (!mgr && data.asset_manager && data.asset_manager !== "N/A") {
    const newId = `mgr-${Date.now()}`;
    await sql`
      INSERT INTO asset_managers (id, name, sales_contacts)
      VALUES (${newId}, ${data.asset_manager}, ${data.sales_email ? [data.sales_email] : []})
    `;
    mgr = { id: newId, name: data.asset_manager };
  }

  if (!mgr) return;

  // Cherche ou crée le fonds
  const funds = await sql`SELECT id, name FROM funds`;
  let fund = (funds as any[]).find(
    (f) => f.name.toLowerCase().includes(data.fund_name.toLowerCase()) || data.fund_name.toLowerCase().includes(f.name.toLowerCase())
  );

  if (!fund && data.fund_name && data.fund_name !== "N/A") {
    const newId = `fund-${Date.now()}`;
    const assignedAnalyst = await getAutoAssignedAnalyst(data.fund_name);
    await sql`
      INSERT INTO funds (id, manager_id, name, analyst_id)
      VALUES (${newId}, ${mgr.id}, ${data.fund_name}, ${assignedAnalyst})
    `;
    fund = { id: newId, name: data.fund_name };
  }

  if (!fund) return;

  // Sauvegarde le rapport
  const newRepId = `rep-${Date.now()}`;
  await sql`
    INSERT INTO fund_reports (
      id, fund_id, report_date, cash_rate, performance_pct, aum_m,
      key_views, positioning, urgency_level, urgency_reason,
      raw_email_subject, raw_email_body, extracted_by_ai, created_at
    ) VALUES (
      ${newRepId}, ${fund.id}, ${data.report_date || new Date().toISOString().split("T")[0]},
      ${typeof data.cash_rate === "number" ? data.cash_rate : null},
      ${typeof data.performance_pct === "number" ? data.performance_pct : null},
      ${typeof data.aum_m === "number" ? data.aum_m : null},
      ${data.key_views || "Aucune perspective de gérance extraite."},
      ${data.positioning || "Aucun positionnement extrait."},
      ${data.is_emergency ? "Prioritaire" : "Normal"},
      ${data.emergency_reason || null},
      ${subject},
      ${body},
      true,
      ${new Date().toISOString()}
    )
  `;
}
