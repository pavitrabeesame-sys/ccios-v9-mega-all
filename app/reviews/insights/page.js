"use client";

import { useEffect, useState } from "react";

export default function InsightsPage() {

  const [items, setItems] = useState([]);

  useEffect(() => {

    fetch("/api/reviews/insights")
      .then(r => r.json())
      .then(d => setItems(d.insights));

  }, []);

  return (

    <div className="p-8">

      <h1 className="text-3xl font-bold mb-6">

        NOVA Insights

      </h1>

      {items.map((item, index) => (

        <div
          key={index}
          className="bg-white p-4 rounded shadow mb-3"
        >
          {item}
        </div>

      ))}

    </div>

  );

}