"use client";

import DashboardCards from "./DashboardCards";
import DashboardCharts from "./DashboardCharts";
import DashboardInsights from "./DashboardInsights";

export default function Dashboard({

  stats = {},

  report = {},

  health = {},

  brands = {},

}) {

  const insights = [];

  if ((stats.pending || 0) > 20)
    insights.push("High number of pending reviews.");

  if ((stats.rejected || 0) > 0)
    insights.push("Some reviews require manual review.");

  if ((health.health?.negative || 0) > 10)
    insights.push("Negative reviews are increasing.");

  if ((report.ratings?.oneStar || 0) > 0)
    insights.push("One-star reviews detected.");

  return (

    <div className="space-y-6">

      <DashboardCards
        stats={stats}
      />

      <DashboardCharts
        report={report}
      />

      <DashboardInsights
        insights={insights}
      />

    </div>

  );

}