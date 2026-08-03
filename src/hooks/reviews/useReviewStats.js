"use client";

import { useEffect, useState } from "react";

export default function useReviewStats() {

  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    replied: 0,
    generated: 0,
  });

  const [loading, setLoading] = useState(true);

  async function loadStats() {

    setLoading(true);

    try {

      const res = await fetch("/api/reviews/analytics");

      const data = await res.json();

      setStats(data);

    } catch (err) {

      console.error(err);

    }

    setLoading(false);

  }

  useEffect(() => {

    loadStats();

  }, []);

  return {
    stats,
    loading,
    refresh: loadStats,
  };

}