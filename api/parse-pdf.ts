import type { VercelRequest, VercelResponse } from "@vercel/node";

// pdfjs-dist s'attend à trouver certaines API navigateur même en environnement Node,
// bien qu'elles ne soient pas réellement exploitées pour la simple extraction de texte.
// On fournit donc des remplacements minimaux avant d'importer la librairie.
if (typeof (globalThis as any).DOMMatrix === "undefined") {
  (globalThis as any).DOMMatrix = class DOMMatrix {
    constructor(_init?: any) {}
  };
}
if (typeof (globalThis as any).Path2D === "undefined") {
  (globalThis as any).Path2D = class Path2D {
    constructor(_init?: any) {}
  };
}
if (typeof (globalThis as any).ImageData === "undefined") {
  (globalThis as any).ImageData = class ImageData {
    constructor(_a?: any, _b?: any, _c?: any) {}
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée" });

  try {
    const { fileBase64 } = req.body;
    if (!fileBase64) return res.status(400).json({ error: "Fichier manquant" });

    const buffer = Buffer.from(fileBase64, "base64");

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
