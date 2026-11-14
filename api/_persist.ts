import { getDb } from "./_db.js";
import { findOrCreateManager, findOrCreateFund, attachToFund } from "./_identity.js";

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

// targetFundId : fonds choisi manuellement (page d'ingestion). Sinon, rapprochement automatique.
export async function saveExtractedReport(data: any, subject: string, body: string, targetFundId?: string): Promise<{ saved: boolean; reason?: string; fundId?: string; fundName?: string; fundCreated?: boolean; matchedBy?: string }> {
  const sql = getDb();

  // Rapprochement gérant / fonds (ISIN, proposition de Gemini, alias, nom normalisé) — voir _identity.ts
  let fund: { id: string; name: string; created: boolean; matchedBy: string };
  if (targetFundId) {
    const attached = await attachToFund(data, targetFundId);
    if (!attached) return { saved: false, reason: "Le fonds choisi n'existe plus" };
    fund = { ...attached, created: false, matchedBy: "manual" };
  } else {
    const found = await findOrCreateFund(data, () => findOrCreateManager(data), getAutoAssignedAnalyst);
    if ("error" in found) return { saved: false, reason: found.error };
    fund = found;
  }

  // Sauvegarde le rapport
  const newRepId = `rep-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
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

  return { saved: true, fundId: fund.id, fundName: fund.name, fundCreated: fund.created, matchedBy: fund.matchedBy };
}
