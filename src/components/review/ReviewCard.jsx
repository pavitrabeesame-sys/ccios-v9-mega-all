// src/components/review/ReviewCard.jsx

"use client";

import RatingStars from "./RatingStars";
import StatusBadge from "./StatusBadge";

export default function ReviewCard({

review,

}){

return(

<div className="bg-white rounded-xl shadow p-5 space-y-3">

<div className="flex justify-between">

<h3 className="font-bold">

{review.productName}

</h3>

<StatusBadge

status={review.status}

/>

</div>

<div>

{review.customerName}

</div>

<RatingStars

rating={review.rating}

/>

<p>

{review.reviewText}

</p>

<div className="border-t pt-3">

<b>AI Reply</b>

<p>

{review.aiReply}

</p>

</div>

</div>

);

}