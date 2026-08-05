// src/components/review/DashboardCharts.jsx

"use client";

export default function DashboardCharts({

  report = {},

}) {

  const ratings = report.ratings || {};

  return (

    <div className="bg-white rounded-xl shadow p-6">

      <h2 className="text-xl font-bold mb-5">

        Rating Distribution

      </h2>

      <div className="grid grid-cols-5 gap-4">

        <div className="text-center">
          <div className="text-3xl">⭐⭐⭐⭐⭐</div>
          <div className="text-2xl font-bold">
            {ratings.fiveStar || 0}
          </div>
        </div>

        <div className="text-center">
          <div className="text-3xl">⭐⭐⭐⭐</div>
          <div className="text-2xl font-bold">
            {ratings.fourStar || 0}
          </div>
        </div>

        <div className="text-center">
          <div className="text-3xl">⭐⭐⭐</div>
          <div className="text-2xl font-bold">
            {ratings.threeStar || 0}
          </div>
        </div>

        <div className="text-center">
          <div className="text-3xl">⭐⭐</div>
          <div className="text-2xl font-bold">
            {ratings.twoStar || 0}
          </div>
        </div>

        <div className="text-center">
          <div className="text-3xl">⭐</div>
          <div className="text-2xl font-bold text-red-600">
            {ratings.oneStar || 0}
          </div>
        </div>

      </div>

    </div>

  );

}