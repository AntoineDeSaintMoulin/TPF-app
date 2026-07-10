import type { VercelRequest, VercelResponse } from "@vercel/node";
import { initialAnalystOverrides } from "./_data.js";

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée" });

  const { fundId, positioningOverride, analystComment } = req.body;
  const index = initialAnalystOverrides.findIndex((o) => o.fundId === fundId);
  const now = new Date().toISOString();

  if (index >= 0) {
    initialAnalystOverrides[index] = { fundId, positioningOverride, analystComment, updatedAt: now };
  } else {
    initialAnalystOverrides.push({ fundId, positioningOverride, analystComment, updatedAt: now });
  }

  res.status(200).json({ success: true, analystOverrides: initialAnalystOverrides });
}
