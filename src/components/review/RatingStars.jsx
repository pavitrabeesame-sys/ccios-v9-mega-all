// src/components/review/RatingStars.jsx

"use client";

export default function RatingStars({ rating = 0 }) {

  return (

    <div className="flex items-center gap-1">

      {[1,2,3,4,5].map((star)=>(

        <span
          key={star}
          className={`text-lg ${
            star <= rating
              ? "text-yellow-400"
              : "text-gray-300"
          }`}
        >
          ★
        </span>

      ))}

      <span className="ml-2 text-sm text-gray-500">

        {rating}/5

      </span>

    </div>

  );

}