"use client";

import { useEffect, useState } from "react";

export default function AnalyticsPage() {

  const [data, setData] = useState(null);

  useEffect(() => {

    fetch("/api/reviews/analytics")
      .then(r => r.json())
      .then(setData);

  }, []);

  if (!data) return <div>Loading...</div>;

  return (

    <div className="p-8">

      <h1 className="text-3xl font-bold mb-6">

        Review Analytics

      </h1>

      <pre>

        {JSON.stringify(data, null, 2)}

      </pre>

    </div>

  );

}