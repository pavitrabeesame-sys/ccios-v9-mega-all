"use client";

import { useEffect, useState } from "react";

export default function useReviews() {

  const [reviews, setReviews] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);

  async function loadReviews(search = "", status = "") {

    setLoading(true);

    let url = `/api/reviews?search=${encodeURIComponent(search)}`;

    if (status) {
      url += `&status=${status}`;
    }

    const res = await fetch(url);

    const json = await res.json();

    setReviews(json.data || []);
    setStats(json.stats || {});

    setLoading(false);

  }

  useEffect(() => {
    loadReviews();
  }, []);

  return {
    reviews,
    stats,
    loading,
    loadReviews,
  };

}