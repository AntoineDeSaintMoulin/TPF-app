export interface AssetManager {
  id: string;
  name: string;
  salesContacts: string[];
}

export interface Fund {
  id: string;
  managerId: string;
  name: string;
  analystId: string;
}

export interface FundReport {
  id: string;
  fundId: string;
  reportDate: string;
  cashRate: number | null;
  performancePct: number | null;
  aumM: number | null;
  keyViews: string;
  positioning: string;
  urgencyLevel: "Normal" | "Prioritaire";
  urgencyReason?: string;
  rawEmailSubject?: string;
  rawEmailBody?: string;
  extractedByAi: boolean;
  createdAt: string;
}

export interface AnalystOverride {
  fundId: string;
  positioningOverride: string;
  analystComment: string;
  updatedAt: string;
}

export interface AssignmentRule {
  pattern: string;
  analystId: string;
}

// NOTE IMPORTANT : ces données sont en mémoire. Sur Vercel (environnement
// serverless), chaque fonction peut redémarrer sur une instance fraîche,
// donc les modifications (extract/assign/override) peuvent ne pas persister
// entre deux appels. Pour une vraie persistance, il faudra brancher une
// vraie base de données (ex: Vercel Postgres, Supabase...).

export const initialAssetManagers: AssetManager[] = [
  { id: "mgr-1", name: "Amundi Asset Management", salesContacts: ["contact@amundi.com", "sales-fr@amundi.com"] },
  { id: "mgr-2", name: "Robeco", salesContacts: ["contact@robeco.nl", "sales-team@robeco.fr"] },
  { id: "mgr-3", name: "JP Morgan Asset Management", salesContacts: ["sales.fr@jpmorgan.com", "mario.draghi@jpmorgan.com"] },
];

export const initialFunds: Fund[] = [
  { id: "fund-1", managerId: "mgr-1", name: "Amundi Horizon Global Equity", analystId: "Benoit" },
  { id: "fund-2", managerId: "mgr-2", name: "Robeco Global Premium Equities", analystId: "Damien" },
  { id: "fund-3", managerId: "mgr-3", name: "JP Morgan Global Focus", analystId: "Maxime" },
  { id: "fund-4", managerId: "mgr-1", name: "Amundi Emerging Markets Equity", analystId: "Antoine" },
  { id: "fund-5", managerId: "mgr-2", name: "Robeco Sustainable Water", analystId: "Unknown" },
];

export const initialFundReports: FundReport[] = [
  {
    id: "rep-1", fundId: "fund-2", reportDate: "2026-04-15", cashRate: 3.2, performancePct: 1.8, aumM: 1450,
    keyViews: "Surchauffe progressive sur la tech US. Nous maintenons un positionnement équilibré avec un biais de qualité. Perspectives positives sur la réouverture cyclique en Europe centrale.",
    positioning: "Surpondération : Europe Value, Banques, Industrie. Sous-pondération : Semi-conducteurs US, Immobilier commercial.",
    urgencyLevel: "Normal", extractedByAi: false, createdAt: "2026-04-15T10:00:00Z"
  },
  {
    id: "rep-2", fundId: "fund-2", reportDate: "2026-05-15", cashRate: 4.8, performancePct: -0.5, aumM: 1420,
    keyViews: "Augmentation tactique du cash face aux incertitudes de politique monétaire de la Fed. Intérêt croissant pour les valeurs défensives de santé.",
    positioning: "Surpondération : Europe Value, Santé, Consommation de base. Sous-pondération : Technologie US, Banques.",
    urgencyLevel: "Normal", extractedByAi: false, createdAt: "2026-05-15T11:30:00Z"
  },
  {
    id: "rep-3", fundId: "fund-2", reportDate: "2026-06-15", cashRate: 5.5, performancePct: 2.1, aumM: 1490,
    keyViews: "Le taux de cash atteint 5.5%, un plus haut de 6 mois. Nous rachetons sélectivement des technologiques à prix raisonnable (GARP) après la correction.",
    positioning: "Surpondération : Europe Value, Santé, Logiciels US sélectifs. Sous-pondération : Matériaux de base, Utilities.",
    urgencyLevel: "Normal", extractedByAi: true, rawEmailSubject: "Robeco Global Premium Equities - Rapport Mensuel Juin 2026",
    createdAt: "2026-06-15T09:15:00Z"
  },
  {
    id: "rep-4", fundId: "fund-1", reportDate: "2026-05-10", cashRate: 2.5, performancePct: 0.9, aumM: 3200,
    keyViews: "Focus sur la croissance séculaire. Les thématiques IA et transition énergétique mondiale restent nos principaux moteurs structurels.",
    positioning: "Surpondération : Logiciels, Transition Énergétique, Équipements Médicaux. Sous-pondération : Énergie fossile, Télécoms.",
    urgencyLevel: "Normal", extractedByAi: false, createdAt: "2026-05-10T08:00:00Z"
  },
  {
    id: "rep-5", fundId: "fund-1", reportDate: "2026-06-12", cashRate: 1.8, performancePct: -3.4, aumM: 3050,
    keyViews: "Annonce du départ exceptionnel du gérant principal Jean-Marc Dupuis d'ici la fin du mois. Une co-gérance temporaire est mise en place. Nous réduisons la voilure sur les actifs risqués.",
    positioning: "Surpondération : Cash, Grandes capitalisations US. Sous-pondération : Small/Mid caps européennes.",
    urgencyLevel: "Prioritaire", urgencyReason: "Départ du gérant principal historique (Jean-Marc Dupuis)",
    rawEmailSubject: "URGENT : Changement d'équipe de gestion sur Amundi Horizon Global",
    extractedByAi: true, createdAt: "2026-06-12T14:22:00Z"
  },
  {
    id: "rep-6", fundId: "fund-3", reportDate: "2026-05-20", cashRate: 1.1, performancePct: 3.2, aumM: 5600,
    keyViews: "Forte dynamique de l'économie américaine favorisant le positionnement cyclique. Concentration sur les leaders industriels mondiaux.",
    positioning: "Surpondération : Technologie US, Industrie lourde, Luxe. Sous-pondération : Souverains, Utilities.",
    urgencyLevel: "Normal", extractedByAi: false, createdAt: "2026-05-20T16:00:00Z"
  },
  {
    id: "rep-7", fundId: "fund-3", reportDate: "2026-06-20", cashRate: 1.4, performancePct: 1.1, aumM: 5710,
    keyViews: "Nous maintenons notre confiance dans les méga-caps technologiques malgré les valorisations élevées. Renforcement tactique sur la transition industrielle.",
    positioning: "Surpondération : Semi-conducteurs, Industrie aéronautique, Luxe. Sous-pondération : Consommation de base, Services financiers.",
    urgencyLevel: "Normal", extractedByAi: true, rawEmailSubject: "JPM Global Focus - Monthly Update June 2026",
    createdAt: "2026-06-20T11:00:00Z"
  }
];

export const initialAnalystOverrides: AnalystOverride[] = [
  {
    fundId: "fund-2",
    positioningOverride: "Surpondération modérée Europe, prudence accrue sur la tech US GARP.",
    analystComment: "Le gérant augmente prudemment son taux de cash. Je partage son analyse sur la surévaluation à court terme du secteur technologique. À surveiller d'ici la rentrée.",
    updatedAt: "2026-06-16T15:30:00Z"
  }
];

export const initialAssignmentRules: AssignmentRule[] = [
  { pattern: "Horizon Global", analystId: "Benoit" },
  { pattern: "Global Premium", analystId: "Damien" },
  { pattern: "Global Focus", analystId: "Maxime" },
  { pattern: "Emerging Markets", analystId: "Antoine" },
  { pattern: "Water", analystId: "Antoine" }
];

export function getAutoAssignedAnalyst(fundName: string, rules: AssignmentRule[]): string {
  for (const rule of rules) {
    if (fundName.toLowerCase().includes(rule.pattern.toLowerCase())) {
      return rule.analystId;
    }
  }
  return "Unknown";
}
