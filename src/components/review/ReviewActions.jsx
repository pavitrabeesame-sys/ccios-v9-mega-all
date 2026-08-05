// src/components/review/ReviewActions.jsx

"use client";

export default function ReviewActions({

review,

refresh,

}){

async function generate(){

await fetch(`/api/reviews/regenerate/${review.reviewId}`,{

method:"POST",

});

refresh();

}

async function approve(){

await fetch(`/api/reviews/${review.reviewId}`,{

method:"PATCH",

headers:{

"Content-Type":"application/json",

},

body:JSON.stringify({

status:"APPROVED",

}),

});

refresh();

}

async function reply(){

await fetch(`/api/reviews/reply/${review.reviewId}`,{

method:"POST",

});

refresh();

}

return(

<div className="flex gap-2">

<button
onClick={generate}
className="px-3 py-1 rounded bg-purple-600 text-white">

Generate

</button>

<button
onClick={approve}
className="px-3 py-1 rounded bg-green-600 text-white">

Approve

</button>

<button
onClick={reply}
className="px-3 py-1 rounded bg-blue-600 text-white">

Reply

</button>

</div>

);

}