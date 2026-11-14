import type { VercelRequest, VercelResponse } from "@vercel/node";
import { runExtraction } from "./_extract-logic.js";
import { saveExtractedReport, getAutoAssignedAnalyst } from "./_persist.js";
import { findOrCreateFund, findOrCreateManager } from "./_identity.js";
import { getDb } from "./_db.js";

// Page d'ingestion manuelle, en deux temps :
//   action "preview" (par défaut) : extraction par l'IA + fonds proposé, SANS rien enregistrer
//   action "save"                 : enregistre l'extraction dans le fonds choisi (ou un nouveau fonds)
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Méthode non autorisée" });
  }

  const { action = "preview", emailSubject, emailText } = req.body || {};

  if (action === "save") {
    const { extraction, targetFundId } = req.body;
    if (!extraction) return res.status(400).json({ error: "Extraction manquante" });
    try {
      const result = await saveExtractedReport(
        extraction,
        emailSubject || "Extraction manuelle",
        emailText || "",
        targetFundId && targetFundId !== "new" ? targetFundId : undefined
      );
      if (!result.saved) return res.status(400).json({ error: result.reason || "Rapport non enregistré" });
      return res.status(200).json(result);
    } catch (error: any) {
      console.error("Save extraction error:", error);
      return res.status(500).json({ error: error.message || "Erreur lors de l'enregistrement" });
    }
  }

  if (!emailText) {
    return res.status(400).json({ error: "Le texte de l'email est obligatoire" });
  }

  try {
    const result = await runExtraction(emailSubject, emailText);

    // Fonds existant correspondant au texte (ISIN, IA, alias, nom), sans rien créer
    let suggestion: { fundId: string; fundName: string; managerName?: string; matchedBy: string } | null = null;
    try {
      const found = await findOrCreateFund(
        result.raw_extraction,
        () => findOrCreateManager(result.raw_extraction, false),
        getAutoAssignedAnalyst,
        false
      );
      if (!("error" in found)) {
        const sql = getDb();
        const rows = (await sql`SELECT m.name FROM funds f JOIN asset_managers m ON m.id = f.manager_id WHERE f.id = ${found.id}`) as any[];
        suggestion = { fundId: found.id, fundName: found.name, managerName: rows[0]?.name, matchedBy: found.matchedBy };
      }
    } catch (err) {
      console.error("Suggestion de fonds impossible:", err);
    }

    res.status(200).json({ ...result, suggestion });
  } catch (error: any) {
    console.error("Extraction Error:", error);
    res.status(500).json({ error: error.message || "Erreur lors de l'extraction par l'IA" });
  }
}
