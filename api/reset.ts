import type { VercelRequest, VercelResponse } from "@vercel/node";
import { initialAssetManagers, initialFunds, initialFundReports, initialAnalystOverrides } from "./_data";

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée" });

  res.status(200).json({
    success: true,
    assetManagers: initialAssetManagers,
    funds: initialFunds,
    fundReports: initialFundReports,
    analystOverrides: initialAnalystOverrides,
  });
}
