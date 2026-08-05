// src/components/review/ReviewPagination.jsx

"use client";

export default function ReviewPagination({

page,

totalPages,

onPage,

}){

return(

<div className="flex justify-center items-center gap-3 mt-6">

<button

disabled={page<=1}

onClick={()=>onPage(page-1)}

className="px-4 py-2 rounded bg-gray-200"

>

Previous

</button>

<span>

Page {page} / {totalPages}

</span>

<button

disabled={page>=totalPages}

onClick={()=>onPage(page+1)}

className="px-4 py-2 rounded bg-gray-200"

>

Next

</button>

</div>

);

}