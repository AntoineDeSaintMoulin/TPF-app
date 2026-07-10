import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  initialAssetManagers,
  initialFunds,
  initialFundReports,
  initialAnalystOverrides,
  initialAssignmentRules,
} from "./_data.js";

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.status(200).json({
    assetManagers: initialAssetManagers,
    funds: initialFunds,
    fundReports: initialFundReports,
    analystOverrides: initialAnalystOverrides,
    assignmentRules: initialAssignmentRules,
  });
}
