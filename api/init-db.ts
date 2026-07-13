import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getDb } from "./_db.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Sécurise cette route sensible : seul toi peux l'appeler, avec le CRON_SECRET
  const authHeader = req.headers.authorization;
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Non autorisé" });
  }

  const sql = getDb();

  try {
    // 1. Création des tables
    await sql`
      CREATE TABLE IF NOT EXISTS asset_managers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        sales_contacts TEXT[] NOT NULL DEFAULT '{}'
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS funds (
        id TEXT PRIMARY KEY,
        manager_id TEXT NOT NULL REFERENCES asset_managers(id),
        name TEXT NOT NULL,
        analyst_id TEXT NOT NULL
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS fund_reports (
        id TEXT PRIMARY KEY,
        fund_id TEXT NOT NULL REFERENCES funds(id),
        report_date TEXT NOT NULL,
        cash_rate NUMERIC,
        performance_pct NUMERIC,
        aum_m NUMERIC,
        key_views TEXT,
        positioning TEXT,
        urgency_level TEXT NOT NULL DEFAULT 'Normal',
        urgency_reason TEXT,
        raw_email_subject TEXT,
        raw_email_body TEXT,
        extracted_by_ai BOOLEAN NOT NULL DEFAULT false,
        created_at TEXT NOT NULL
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS analyst_overrides (
        fund_id TEXT PRIMARY KEY REFERENCES funds(id),
        positioning_override TEXT,
        analyst_comment TEXT,
        updated_at TEXT NOT NULL
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS assignment_rules (
        pattern TEXT PRIMARY KEY,
        analyst_id TEXT NOT NULL
      )
    `;

    // 2. Vérifie si des données existent déjà, pour ne pas dupliquer si on relance
    const existing = await sql`SELECT COUNT(*) as count FROM asset_managers`;
    if (Number(existing[0].count) > 0) {
      return res.status(200).json({ success: true, message: "Tables déjà initialisées avec des données, rien à faire." });
    }

    // 3. Insertion des données de départ
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
      ('rep-1', 'fund-2', '2026-04-15', 3.2, 1.8, 1450, 'Surchauffe progressive sur la tech US. Nous maintenons un positionnement équilibré avec un biais de qualité. Perspectives positives sur la réouverture cyclique en Europe centrale.', 'Surpondération : Europe Value, Banques, Industrie. Sous-pondération : Semi-conducteurs US, Immobilier commercial.', 'Normal', NULL, NULL, false, '2026-04-15T10:00:00Z'),
      ('rep-2', 'fund-2', '2026-05-15', 4.8, -0.5, 1420, 'Augmentation tactique du cash face aux incertitudes de politique monétaire de la Fed. Intérêt croissant pour les valeurs défensives de santé.', 'Surpondération : Europe Value, Santé, Consommation de base. Sous-pondération : Technologie US, Banques.', 'Normal', NULL, NULL, false, '2026-05-15T11:30:00Z'),
      ('rep-3', 'fund-2', '2026-06-15', 5.5, 2.1, 1490, 'Le taux de cash atteint 5.5%%, un plus haut de 6 mois. Nous rachetons sélectivement des technologiques à prix raisonnable (GARP) après la correction.', 'Surpondération : Europe Value, Santé, Logiciels US sélectifs. Sous-pondération : Matériaux de base, Utilities.', 'Normal', NULL, 'Robeco Global Premium Equities - Rapport Mensuel Juin 2026', true, '2026-06-15T09:15:00Z'),
      ('rep-4', 'fund-1', '2026-05-10', 2.5, 0.9, 3200, 'Focus sur la croissance séculaire. Les thématiques IA et transition énergétique mondiale restent nos principaux moteurs structurels.', 'Surpondération : Logiciels, Transition Énergétique, Équipements Médicaux. Sous-pondération : Énergie fossile, Télécoms.', 'Normal', NULL, NULL, false, '2026-05-10T08:00:00Z'),
      ('rep-5', 'fund-1', '2026-06-12', 1.8, -3.4, 3050, 'Annonce du départ exceptionnel du gérant principal Jean-Marc Dupuis d''ici la fin du mois. Une co-gérance temporaire est mise en place. Nous réduisons la voilure sur les actifs risqués.', 'Surpondération : Cash, Grandes capitalisations US. Sous-pondération : Small/Mid caps européennes.', 'Prioritaire', 'Départ du gérant principal historique (Jean-Marc Dupuis)', 'URGENT : Changement d''équipe de gestion sur Amundi Horizon Global', true, '2026-06-12T14:22:00Z'),
      ('rep-6', 'fund-3', '2026-05-20', 1.1, 3.2, 5600, 'Forte dynamique de l''économie américaine favorisant le positionnement cyclique. Concentration sur les leaders industriels mondiaux.', 'Surpondération : Technologie US, Industrie lourde, Luxe. Sous-pondération : Souverains, Utilities.', 'Normal', NULL, NULL, false, '2026-05-20T16:00:00Z'),
      ('rep-7', 'fund-3', '2026-06-20', 1.4, 1.1, 5710, 'Nous maintenons notre confiance dans les méga-caps technologiques malgré les valorisations élevées. Renforcement tactique sur la transition industrielle.', 'Surpondération : Semi-conducteurs, Industrie aéronautique, Luxe. Sous-pondération : Consommation de base, Services financiers.', 'Normal', NULL, 'JPM Global Focus - Monthly Update June 2026', true, '2026-06-20T11:00:00Z')
    `;

    await sql`
      INSERT INTO analyst_overrides (fund_id, positioning_override, analyst_comment, updated_at) VALUES
      ('fund-2', 'Surpondération modérée Europe, prudence accrue sur la tech US GARP.', 'Le gérant augmente prudemment son taux de cash. Je partage son analyse sur la surévaluation à court terme du secteur technologique. À surveiller d''ici la rentrée.', '2026-06-16T15:30:00Z')
    `;

    await sql`
      INSERT INTO assignment_rules (pattern, analyst_id) VALUES
      ('Horizon Global', 'Benoit'),
      ('Global Premium', 'Damien'),
      ('Global Focus', 'Maxime'),
      ('Emerging Markets', 'Antoine'),
      ('Water', 'Antoine')
    `;

    res.status(200).json({ success: true, message: "Base de données initialisée avec succès." });
  } catch (error: any) {
    console.error("Init DB Error:", error);
    res.status(500).json({ error: error.message || "Erreur lors de l'initialisation de la base" });
  }
}
