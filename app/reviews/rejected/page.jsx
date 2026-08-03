"use client";

import { useEffect, useState } from "react";
import ReviewTable from "../../../src/components/reviews/ReviewTable";

export default function RejectedReviewsPage() {

  const [reviews, setReviews] = useState([]);

  useEffect(() => {
    load();
  }, []);

  async function load() {

    const res = await fetch("/api/reviews?status=REJECTED");

    const data = await res.json();

    setReviews(data.data || []);

  }

  return (

    <div className="p-8">

      <h1 className="text-3xl font-bold mb-6">
        Rejected Reviews
      </h1>

      <ReviewTable reviews={reviews} />

    </div>

  );

}