import { google } from "googleapis";

export function getGmailClient() {
  const { GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN } = process.env;

  if (!GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET || !GMAIL_REFRESH_TOKEN) {
    throw new Error("Variables d'environnement Gmail manquantes (GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET / GMAIL_REFRESH_TOKEN)");
  }

  const oAuth2Client = new google.auth.OAuth2(
    GMAIL_CLIENT_ID,
    GMAIL_CLIENT_SECRET,
    "https://developers.google.com/oauthplayground"
  );

  oAuth2Client.setCredentials({ refresh_token: GMAIL_REFRESH_TOKEN });

  return google.gmail({ version: "v1", auth: oAuth2Client });
}

// Décode le corps d'un message Gmail (base64url) en texte brut
export function extractPlainTextBody(payload: any): string {
  if (!payload) return "";

  const decode = (data: string) =>
    Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");

  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return decode(payload.body.data);
  }

  if (payload.parts) {
    // Cherche en priorité une partie text/plain
    const plainPart = payload.parts.find((p: any) => p.mimeType === "text/plain" && p.body?.data);
    if (plainPart) return decode(plainPart.body.data);

    // Sinon, essaie text/html et retire les balises grossièrement
    const htmlPart = payload.parts.find((p: any) => p.mimeType === "text/html" && p.body?.data);
    if (htmlPart) {
      const html = decode(htmlPart.body.data);
      return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    }

    // Sinon on descend récursivement dans les sous-parties (emails multipart imbriqués)
    for (const part of payload.parts) {
      const nested = extractPlainTextBody(part);
      if (nested) return nested;
    }
  }

  return "";
}

export interface PdfAttachmentRef {
  filename: string;
  attachmentId?: string;
  inlineData?: string; // base64url, quand le PDF est directement inclus dans le message
  size: number;
}

// Liste récursivement les pièces jointes PDF d'un message Gmail
export function findPdfAttachments(payload: any): PdfAttachmentRef[] {
  const found: PdfAttachmentRef[] = [];
  const walk = (part: any) => {
    if (!part) return;
    const filename: string = part.filename || "";
    const isPdf = part.mimeType === "application/pdf" || filename.toLowerCase().endsWith(".pdf");
    if (isPdf && (part.body?.attachmentId || part.body?.data)) {
      found.push({
        filename: filename || "document.pdf",
        attachmentId: part.body.attachmentId,
        inlineData: part.body.data,
        size: part.body.size || 0,
      });
    }
    (part.parts || []).forEach(walk);
  };
  walk(payload);
  return found;
}

// Télécharge le contenu binaire d'une pièce jointe
export async function downloadAttachment(gmail: any, messageId: string, ref: PdfAttachmentRef): Promise<Buffer> {
  let data = ref.inlineData;
  if (!data && ref.attachmentId) {
    const res = await gmail.users.messages.attachments.get({ userId: "me", messageId, id: ref.attachmentId });
    data = res.data.data;
  }
  if (!data) throw new Error("Pièce jointe vide");
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function getHeader(headers: any[], name: string): string {
  const h = headers?.find((h: any) => h.name.toLowerCase() === name.toLowerCase());
  return h?.value || "";
}

export { getHeader };
