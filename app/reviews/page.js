"use client";

import { useEffect, useState } from "react";

import ReviewStats from "@/src/components/review/ReviewStats";
import ReviewSearch from "@/src/components/review/ReviewSearch";
import ReviewFilters from "@/src/components/review/ReviewFilters";
import ReviewTable from "@/src/components/review/ReviewTable";
import BulkActions from "@/src/components/review/BulkActions";


export default function ReviewsPage() {


  const [reviews, setReviews] = useState([]);

  const [stats, setStats] = useState({});

  const [selected, setSelected] = useState([]);




  async function load(search = "") {


    try {


      const reviewRes = await fetch(
        `/api/reviews?search=${search}`
      );


      const reviewData = await reviewRes.json();




      const statsRes = await fetch(
        "/api/reviews/analytics"
      );


      const statsData = await statsRes.json();




      setReviews(
        reviewData.reviews || []
      );


      setStats(
        statsData || {}
      );



    } catch(error) {


      console.error(
        "Review loading error:",
        error
      );


    }


  }






  useEffect(() => {

    load();

  }, []);






  return (

    <div className="p-8">


      <h1 className="text-3xl font-bold mb-6">
        NOVA Review Intelligence
      </h1>





      <ReviewStats
        stats={stats}
      />





      <div className="mt-6">

        <BulkActions

          selected={selected}

          refresh={load}

        />

      </div>





      <div className="mt-6">

        <ReviewSearch
          onSearch={load}
        />

      </div>





      <div className="mt-4">

        <ReviewFilters
          onSearch={load}
        />

      </div>





      <div className="mt-6">

        <ReviewTable

          reviews={reviews}

          refresh={load}

          selected={selected}

          setSelected={setSelected}

        />

      </div>




    </div>

  );


}