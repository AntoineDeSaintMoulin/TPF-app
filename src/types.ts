export interface AssetManager {
  id: string;
  name: string;
  salesContacts: string[];
}

export interface Fund {
  id: string;
  managerId: string;
  name: string;
  analystId: string; // "Damien" | "Maxime" | "Benoit" | "Antoine" | "Unknown"
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

export interface PortalData {
  assetManagers: AssetManager[];
  funds: Fund[];
  fundReports: FundReport[];
  analystOverrides: AnalystOverride[];
  assignmentRules: AssignmentRule[];
}

export type PortalTab = "dashboard" | "ingestion" | "schema" | "resources";
