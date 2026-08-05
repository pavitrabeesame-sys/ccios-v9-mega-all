// src/components/review/ReviewStats.jsx

"use client";

export default function ReviewStats({ stats }) {

  const cards = [

    ["Total",stats.total],

    ["Pending",stats.pending],

    ["Generated",stats.generated],

    ["Approved",stats.approved],

    ["Replied",stats.replied],

    ["Rejected",stats.rejected],

  ];

  return (

    <div className="grid grid-cols-6 gap-4 mb-6">

      {cards.map(([title,value])=>(

        <div
          key={title}
          className="bg-white rounded-xl shadow p-5"
        >

          <div className="text-gray-500">

            {title}

          </div>

          <div className="text-3xl font-bold">

            {value}

          </div>

        </div>

      ))}

    </div>

  );

}