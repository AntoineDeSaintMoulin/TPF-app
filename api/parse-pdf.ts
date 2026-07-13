import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée" });

  try {
    const { fileBase64 } = req.body;
    if (!fileBase64) return res.status(400).json({ error: "Fichier manquant" });

    const buffer = Buffer.from(fileBase64, "base64");

    // La version "legacy" de pdfjs-dist est conçue pour Node.js et n'a pas besoin
    // d'API navigateur comme DOMMatrix, contrairement au build standard utilisé par pdf-parse.
    const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");

    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
    const pdf = await loadingTask.promise;

    let fullText = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items.map((item: any) => item.str).join(" ");
      fullText += pageText + "\n\n";
    }

    res.status(200).json({ text: fullText.trim() });
  } catch (error: any) {
    console.error("PDF parse error:", error);
    res.status(500).json({ error: error.message || "Erreur lors de l'extraction du texte du PDF" });
  }
}
