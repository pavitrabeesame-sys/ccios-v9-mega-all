// src/components/review/DashboardCards.jsx

"use client";

export default function DashboardCards({

  stats = {},

}) {

  const cards = [

    {
      title: "Total",
      value: stats.total || 0,
      color: "bg-blue-500",
    },

    {
      title: "Pending",
      value: stats.pending || 0,
      color: "bg-yellow-500",
    },

    {
      title: "Generated",
      value: stats.generated || 0,
      color: "bg-purple-500",
    },

    {
      title: "Approved",
      value: stats.approved || 0,
      color: "bg-green-500",
    },

    {
      title: "Replied",
      value: stats.replied || 0,
      color: "bg-indigo-500",
    },

    {
      title: "Rejected",
      value: stats.rejected || 0,
      color: "bg-red-500",
    },

  ];

  return (

    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-5">

      {cards.map((card) => (

        <div
          key={card.title}
          className="bg-white rounded-xl shadow p-5 border"
        >

          <div
            className={`w-3 h-3 rounded-full ${card.color} mb-3`}
          />

          <div className="text-gray-500 text-sm">

            {card.title}

          </div>

          <div className="text-4xl font-bold mt-2">

            {card.value}

          </div>

        </div>

      ))}

    </div>

  );

}