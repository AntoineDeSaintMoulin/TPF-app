import { extractText, getDocumentProxy } from "unpdf";

// Extrait le texte d'un PDF (renvoie "" si le PDF ne contient pas de texte, ex. PDF scanné)
export async function extractPdfText(data: Uint8Array): Promise<string> {
  const pdf = await getDocumentProxy(data);
  const { text } = await extractText(pdf, { mergePages: true });
  return (text || "").trim();
}
