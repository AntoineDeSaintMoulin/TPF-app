import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getDb } from "./_db.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée" });

  const sql = getDb();

  try {
    // Vide toutes les tables (dans l'ordre à cause des clés étrangères)
    await sql`TRUNCATE analyst_overrides, assignment_rules, fund_reports, funds, asset_managers CASCADE`;

    await sql`
      INSERT INTO asset_managers (id, name, sales_contacts) VALUES
      ('mgr-1', 'Amundi Asset Management', ARRAY['contact@amundi.com', 'sales-fr@amundi.com']),
      ('mgr-2', 'Robeco', ARRAY['contact@robeco.nl', 'sales-team@robeco.fr']),
      ('mgr-3', 'JP Morgan Asset Management', ARRAY['sales.fr@jpmorgan.com', 'mario.draghi@jpmorgan.com'])
    `;

    await sql`
      INSERT INTO funds (id, manager_id, name, analyst_id) VALUES
      ('fund-1', 'mgr-1', 'Amundi Horizon Global Equity', 'Benoit'),
      ('fund-2', 'mgr-2', 'Robeco Global Premium Equities', 'Damien'),
      ('fund-3', 'mgr-3', 'JP Morgan Global Focus', 'Maxime'),
      ('fund-4', 'mgr-1', 'Amundi Emerging Markets Equity', 'Antoine'),
      ('fund-5', 'mgr-2', 'Robeco Sustainable Water', 'Unknown')
    `;

    await sql`
      INSERT INTO fund_reports (id, fund_id, report_date, cash_rate, performance_pct, aum_m, key_views, positioning, urgency_level, urgency_reason, raw_email_subject, extracted_by_ai, created_at) VALUES
      ('rep-1', 'fund-2', '2026-04-15', 3.2, 1.8, 1450, 'Surchauffe progressive sur la tech US. Nous maintenons un positionnement équilibré avec un biais de qualité.', 'Surpondération : Europe Value, Banques, Industrie.', 'Normal', NULL, NULL, false, '2026-04-15T10:00:00Z'),
      ('rep-2', 'fund-2', '2026-05-15', 4.8, -0.5, 1420, 'Augmentation tactique du cash face aux incertitudes de politique monétaire de la Fed.', 'Surpondération : Europe Value, Santé, Consommation de base.', 'Normal', NULL, NULL, false, '2026-05-15T11:30:00Z'),
      ('rep-3', 'fund-2', '2026-06-15', 5.5, 2.1, 1490, 'Le taux de cash atteint 5.5%%, un plus haut de 6 mois.', 'Surpondération : Europe Value, Santé, Logiciels US sélectifs.', 'Normal', NULL, 'Robeco Global Premium Equities - Rapport Mensuel Juin 2026', true, '2026-06-15T09:15:00Z'),
      ('rep-4', 'fund-1', '2026-05-10', 2.5, 0.9, 3200, 'Focus sur la croissance séculaire.', 'Surpondération : Logiciels, Transition Énergétique.', 'Normal', NULL, NULL, false, '2026-05-10T08:00:00Z'),
      ('rep-5', 'fund-1', '2026-06-12', 1.8, -3.4, 3050, 'Annonce du départ exceptionnel du gérant principal Jean-Marc Dupuis.', 'Surpondération : Cash, Grandes capitalisations US.', 'Prioritaire', 'Départ du gérant principal historique (Jean-Marc Dupuis)', 'URGENT : Changement d''équipe de gestion sur Amundi Horizon Global', true, '2026-06-12T14:22:00Z'),
      ('rep-6', 'fund-3', '2026-05-20', 1.1, 3.2, 5600, 'Forte dynamique de l''économie américaine.', 'Surpondération : Technologie US, Industrie lourde, Luxe.', 'Normal', NULL, NULL, false, '2026-05-20T16:00:00Z'),
      ('rep-7', 'fund-3', '2026-06-20', 1.4, 1.1, 5710, 'Nous maintenons notre confiance dans les méga-caps technologiques.', 'Surpondération : Semi-conducteurs, Industrie aéronautique.', 'Normal', NULL, 'JPM Global Focus - Monthly Update June 2026', true, '2026-06-20T11:00:00Z')
    `;

    await sql`
      INSERT INTO analyst_overrides (fund_id, positioning_override, analyst_comment, updated_at) VALUES
      ('fund-2', 'Surpondération modérée Europe, prudence accrue sur la tech US GARP.', 'Le gérant augmente prudemment son taux de cash.', '2026-06-16T15:30:00Z')
    `;

    await sql`
      INSERT INTO assignment_rules (pattern, analyst_id) VALUES
      ('Horizon Global', 'Benoit'),
      ('Global Premium', 'Damien'),
      ('Global Focus', 'Maxime'),
      ('Emerging Markets', 'Antoine'),
      ('Water', 'Antoine')
    `;

    const assetManagers = await sql`SELECT id, name, sales_contacts AS "salesContacts" FROM asset_managers`;
    const funds = await sql`SELECT id, manager_id AS "managerId", name, analyst_id AS "analystId" FROM funds`;
    const fundReports = await sql`SELECT id, fund_id AS "fundId", report_date AS "reportDate" FROM fund_reports`;
    const analystOverrides = await sql`SELECT fund_id AS "fundId" FROM analyst_overrides`;

    res.status(200).json({ success: true, assetManagers, funds, fundReports, analystOverrides });
  } catch (error: any) {
    console.error("Reset error:", error);
    res.status(500).json({ error: error.message || "Erreur lors de la réinitialisation" });
  }
}
