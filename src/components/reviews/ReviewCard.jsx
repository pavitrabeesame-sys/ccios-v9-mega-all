"use client";

export default function ReviewTable({ reviews = [] }) {

    
  return (
    <div className="bg-white rounded-xl shadow p-6">

      <h2 className="text-xl font-bold mb-4">
        Reviews
      </h2>

      {reviews.length === 0 ? (
        <p className="text-gray-500">
          No reviews available
        </p>
      ) : (
        reviews.map((review)=>(
          <div 
            key={review.id}
            className="border p-3 mb-2 rounded"
          >
            <b>{review.customerName}</b>
            <p>⭐ {review.rating}</p>
            <p>{review.reviewText}</p>
          </div>
        ))
      )}

    </div>
  );
}