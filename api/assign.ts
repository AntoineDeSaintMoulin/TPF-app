import type { VercelRequest, VercelResponse } from "@vercel/node";
import { initialFunds, initialAssignmentRules } from "./_data";

// ⚠️ Ces modifications ne persistent PAS entre deux appels dans cet environnement
// serverless (pas de vraie base de données branchée). Voir la note dans _data.ts.
export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée" });

  const { fundId, analystId, pattern } = req.body;
  const fund = initialFunds.find((f) => f.id === fundId);
  if (!fund) return res.status(404).json({ error: "Fonds non trouvé" });

  fund.analystId = analystId;
  if (pattern && !initialAssignmentRules.some((r) => r.pattern.toLowerCase() === pattern.toLowerCase())) {
    initialAssignmentRules.push({ pattern, analystId });
  }

  res.status(200).json({ success: true, funds: initialFunds, assignmentRules: initialAssignmentRules });
}
