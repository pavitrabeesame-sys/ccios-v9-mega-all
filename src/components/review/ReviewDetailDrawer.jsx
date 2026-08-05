// src/components/review/ReviewDetailDrawer.jsx

"use client";

import ReviewReplyEditor from "./ReviewReplyEditor";
import RatingStars from "./RatingStars";

export default function ReviewDetailDrawer({

review,

refresh,

onClose,

}){

if(!review)return null;

return(

<div className="fixed inset-0 bg-black/40 flex justify-end">

<div className="w-[650px] bg-white h-full overflow-auto p-6">

<div className="flex justify-between">

<h2 className="text-2xl font-bold">

Review Detail

</h2>

<button

onClick={onClose}

>

✕

</button>

</div>

<div className="mt-6 space-y-4">

<div>

<b>Brand</b>

<p>{review.brand}</p>

</div>

<div>

<b>Customer</b>

<p>{review.customerName}</p>

</div>

<div>

<b>Product</b>

<p>{review.productName}</p>

</div>

<div>

<RatingStars

rating={review.rating}

/>

</div>

<div>

<b>Review</b>

<p>{review.reviewText}</p>

</div>

<ReviewReplyEditor

review={review}

refresh={refresh}

/>

</div>

</div>

</div>

);

}