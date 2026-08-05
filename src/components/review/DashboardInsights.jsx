// src/components/review/DashboardInsights.jsx

"use client";

export default function DashboardInsights({

  stats = {},

  report = {},

  health = {},

}) {

  const insights = [];

  if ((stats.pending || 0) > 10)
    insights.push("⚠️ Pending reviews are increasing.");

  if ((stats.generated || 0) > 20)
    insights.push("🤖 AI generated replies waiting for approval.");

  if ((stats.replied || 0) > 50)
    insights.push("✅ Excellent reply automation performance.");

  if ((report.ratings?.oneStar || 0) > 0)
    insights.push("⭐ One-star reviews detected. Manual attention recommended.");

  if ((report.ratings?.twoStar || 0) > 5)
    insights.push("⭐⭐ Two-star reviews are increasing.");

  if ((health.health?.negative || 0) > 10)
    insights.push("📉 Negative sentiment trend detected.");

  if (insights.length === 0)
    insights.push("🎉 No critical issues detected.");

  return (

    <div className="bg-white rounded-xl shadow p-6">

      <h2 className="text-2xl font-bold mb-5">

        NOVA AI Insights

      </h2>

      <div className="space-y-3">

        {insights.map((item, index) => (

          <div
            key={index}
            className="border rounded-lg p-4 bg-gray-50"
          >

            {item}

          </div>

        ))}

      </div>

    </div>

  );

}