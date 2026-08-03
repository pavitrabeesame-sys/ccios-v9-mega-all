"use client";

import { useEffect, useState } from "react";
import ReviewTable from "../../../src/components/reviews/ReviewTable";

export default function GeneratedReviewsPage() {

  const [reviews, setReviews] = useState([]);

  useEffect(() => {
    load();
  }, []);

  async function load() {

    const res = await fetch("/api/reviews?status=GENERATED");

    const data = await res.json();

    setReviews(data.data || []);

  }

  return (

    <div className="p-8">

      <h1 className="text-3xl font-bold mb-6">
        AI Generated Replies
      </h1>

      <ReviewTable reviews={reviews} />

    </div>

  );

}