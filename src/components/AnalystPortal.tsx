import React, { useState, useMemo } from "react";
import { User, Building2, TrendingUp, TrendingDown, AlertTriangle, Wallet, Layers } from "lucide-react";
import { PortalData, Fund } from "../types";

interface AnalystPortalProps {
  portalData: PortalData;
}

const ANALYSTS = [
  { name: "Damien", color: "bg-indigo-600", label: "D" },
  { name: "Maxime", color: "bg-emerald-600", label: "M" },
  { name: "Benoit", color: "bg-amber-600", label: "B" },
  { name: "Antoine", color: "bg-rose-600", label: "A" },
];

export default function AnalystPortal({ portalData }: AnalystPortalProps) {
  const [selectedAnalyst, setSelectedAnalyst] = useState<string>("Damien");

  const analystFunds = useMemo(() => {
    return portalData.funds.filter((f) => f.analystId === selectedAnalyst);
  }, [portalData.funds, selectedAnalyst]);

  const getLatestReport = (fundId: string) => {
    const reports = portalData.fundReports
      .filter((r) => r.fundId === fundId)
      .sort((a, b) => b.reportDate.localeCompare(a.reportDate));
    return reports[0] || null;
  };

  const getManagerName = (managerId: string) => {
    return portalData.assetManagers.find((m) => m.id === managerId)?.name || "Gérant inconnu";
  };

  const activeAnalyst = ANALYSTS.find((a) => a.name === selectedAnalyst);

  return (
    <div className="space-y-8 animate-fade-in text-gray-300" id="analyst-portal-container">
      {/* Header */}
      <div className="bg-[#0b0e14] rounded-xl border border-white/10 p-6 shadow-xl">
        <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
          <User className="h-5 w-5 text-indigo-400" />
          Portefeuille par Analyste
        </h2>
        <p className="text-sm text-gray-400 mt-1">
          Sélectionnez un analyste pour visualiser l'ensemble des fonds dont il a la responsabilité,
          ainsi que leur dernier état de reporting.
        </p>
      </div>

      {/* Analyst selector */}
      <div className="bg-[#0b0e14] rounded-xl border border-white/10 p-4 shadow-xl">
        <div className="flex flex-wrap gap-2">
          {ANALYSTS.map((analyst) => (
            <button
              key={analyst.name}
              onClick={() => setSelectedAnalyst(analyst.name)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border transition-all duration-150 font-medium text-sm ${
                selectedAnalyst === analyst.name
                  ? "bg-indigo-600/20 border-indigo-500/40 text-white shadow-[0_0_15px_rgba(99,102,241,0.15)]"
                  : "bg-white/5 border-white/10 text-gray-400 hover:text-white hover:bg-white/10"
              }`}
            >
              <span
                className={`h-6 w-6 rounded-full ${analyst.color} text-white flex items-center justify-center font-bold text-[11px] shrink-0`}
              >
                {analyst.label}
              </span>
              {analyst.name}
            </button>
          ))}
        </div>
      </div>

      {/* Fund list for selected analyst */}
      <div className="bg-[#0b0e14] rounded-xl border border-white/10 p-6 shadow-xl">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-white flex items-center gap-2">
            <Layers className="h-4 w-4 text-indigo-400" />
            Fonds suivis par {selectedAnalyst}
          </h3>
          <span className="text-xs bg-white/5 border border-white/10 text-gray-400 px-2.5 py-1 rounded-full font-mono">
            {analystFunds.length} fonds
          </span>
        </div>

        {analystFunds.length === 0 ? (
          <div className="text-center py-12 text-gray-500 text-sm">
            Aucun fonds n'est actuellement assigné à {selectedAnalyst}.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {analystFunds.map((fund: Fund) => {
              const latestReport = getLatestReport(fund.id);
              const isUrgent = latestReport?.urgencyLevel === "Prioritaire";

              return (
                <div
                  key={fund.id}
                  className={`rounded-xl border p-4 transition-colors ${
                    isUrgent
                      ? "bg-red-950/10 border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.08)]"
                      : "bg-[#050608] border-white/5 hover:border-white/15"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <h4 className="font-semibold text-white text-sm leading-tight">{fund.name}</h4>
                      <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                        <Building2 className="h-3 w-3" />
                        {getManagerName(fund.managerId)}
                      </p>
                    </div>
                    {isUrgent && (
                      <span className="shrink-0 flex items-center gap-1 text-[10px] font-bold bg-red-500/15 text-red-300 px-2 py-1 rounded-full border border-red-500/30">
                        <AlertTriangle className="h-3 w-3" />
                        Prioritaire
                      </span>
                    )}
                  </div>

                  {latestReport ? (
                    <>
                      <div className="grid grid-cols-3 gap-2 mb-3">
                        <div className="bg-white/5 rounded-lg p-2 text-center">
                          <div className="text-[9px] text-gray-500 uppercase tracking-wide mb-0.5">AUM</div>
                          <div className="text-xs font-bold text-white font-mono">
                            {latestReport.aumM ? `${latestReport.aumM}M` : "N/A"}
                          </div>
                        </div>
                        <div className="bg-white/5 rounded-lg p-2 text-center">
                          <div className="text-[9px] text-gray-500 uppercase tracking-wide mb-0.5 flex items-center justify-center gap-0.5">
                            <Wallet className="h-2.5 w-2.5" /> Cash
                          </div>
                          <div className="text-xs font-bold text-white font-mono">
                            {latestReport.cashRate != null ? `${latestReport.cashRate}%` : "N/A"}
                          </div>
                        </div>
                        <div className="bg-white/5 rounded-lg p-2 text-center">
                          <div className="text-[9px] text-gray-500 uppercase tracking-wide mb-0.5 flex items-center justify-center gap-0.5">
                            {latestReport.performancePct != null && latestReport.performancePct >= 0 ? (
                              <TrendingUp className="h-2.5 w-2.5 text-emerald-400" />
                            ) : (
                              <TrendingDown className="h-2.5 w-2.5 text-red-400" />
                            )}
                            Perf.
                          </div>
                          <div
                            className={`text-xs font-bold font-mono ${
                              latestReport.performancePct != null && latestReport.performancePct >= 0
                                ? "text-emerald-400"
                                : "text-red-400"
                            }`}
                          >
                            {latestReport.performancePct != null ? `${latestReport.performancePct}%` : "N/A"}
                          </div>
                        </div>
                      </div>

                      <p className="text-[11px] text-gray-400 leading-relaxed line-clamp-3">
                        {latestReport.keyViews}
                      </p>

                      <div className="mt-2 text-[10px] text-gray-600 font-mono">
                        Dernier rapport : {latestReport.reportDate}
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-gray-500 italic">Aucun rapport disponible pour ce fonds.</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
