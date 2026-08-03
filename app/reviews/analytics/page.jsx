"use client";

import { useEffect, useState } from "react";
import ReviewStats from "../../../src/components/reviews/ReviewStats";

export default function AnalyticsPage() {

  const [stats, setStats] = useState({});

  useEffect(() => {
    load();
  }, []);

  async function load() {

    const res = await fetch("/api/reviews/analytics");

    const data = await res.json();

    setStats(data);

  }

  return (

    <div className="p-8">

      <h1 className="text-3xl font-bold mb-6">
        Review Analytics
      </h1>

      <ReviewStats stats={stats} />

    </div>

  );

}