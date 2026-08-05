// src/components/review/ReviewReplyEditor.jsx

"use client";

import { useState } from "react";

export default function ReviewReplyEditor({

review,

refresh,

}){

const [reply,setReply]=useState(

review.aiReply||""

);

const [loading,setLoading]=useState(false);

async function save(){

setLoading(true);

await fetch(`/api/reviews/${review.reviewId}`,{

method:"PATCH",

headers:{

"Content-Type":"application/json",

},

body:JSON.stringify({

aiReply:reply,

finalReply:reply,

}),

});

setLoading(false);

refresh();

}

return(

<div className="space-y-3">

<textarea

value={reply}

onChange={(e)=>setReply(e.target.value)}

rows={6}

className="w-full border rounded-lg p-3"

/>

<div className="flex gap-3">

<button

onClick={save}

className="bg-green-600 text-white px-5 py-2 rounded-lg"

>

{loading?"Saving...":"Save"}

</button>

</div>

</div>

);

}