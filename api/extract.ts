import type { VercelRequest, VercelResponse } from "@vercel/node";
import { runExtraction } from "./_extract-logic.js";
import { saveExtractedReport } from "./_persist.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Méthode non autorisée" });
  }

  const { emailSubject, emailText } = req.body;

  if (!emailText) {
    return res.status(400).json({ error: "Le texte de l'email est obligatoire" });
  }

  try {
    const result = await runExtraction(emailSubject, emailText);

    if (!result.raw_extraction.is_noise) {
      await saveExtractedReport(result.raw_extraction, emailSubject || "Extraction manuelle", emailText);
    }

    res.status(200).json(result);
  } catch (error: any) {
    console.error("Extraction Error:", error);
    res.status(500).json({ error: error.message || "Erreur lors de l'extraction par l'IA" });
  }
}
