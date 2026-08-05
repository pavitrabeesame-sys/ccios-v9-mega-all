"use client";

import { useState } from "react";
import StatusBadge from "./StatusBadge";
import ReplyEditor from "./ReplyApproval/ReplyEditor";


export default function ReviewTable({

  reviews = [],
  refresh,
  selected = [],
  setSelected

}) {


const [activeReply,setActiveReply] = useState(null);



function toggleSelect(id){

if(selected.includes(id)){

setSelected(
selected.filter(
item=>item!==id
)
);

}else{

setSelected([
...selected,
id
]);

}

}





function toggleAll(){

if(selected.length===reviews.length){

setSelected([]);

}else{

setSelected(
reviews.map(
r=>r.id
)
);

}

}






async function generate(id){

try{

const res = await fetch(
"/api/reviews/generate",
{
method:"POST",
headers:{
"Content-Type":"application/json"
},
body:JSON.stringify({
id
})
}
);


const data = await res.json();


if(!res.ok){

throw new Error(
data.error || "Generate failed"
);

}


refresh?.();


}catch(error){

alert(error.message);

}

}







async function analyze(id){

try{


await fetch(
"/api/reviews/analyze",
{

method:"POST",

headers:{
"Content-Type":"application/json"
},

body:JSON.stringify({
id
})

}
);


refresh?.();


}catch(error){

alert(error.message);

}

}







async function approve(id){

await fetch(
"/api/reviews/approve",
{

method:"POST",

headers:{
"Content-Type":"application/json"
},

body:JSON.stringify({
id
})

}
);


refresh?.();

}








async function reject(id){

await fetch(
"/api/reviews/reject",
{

method:"POST",

headers:{
"Content-Type":"application/json"
},

body:JSON.stringify({
id
})

}
);


refresh?.();

}









async function replyShopee(id){

try{


const review =
reviews.find(
r=>r.id===id
);



if(!review){

throw new Error(
"Review not found"
);

}




if(!review.aiReply){

throw new Error(
"Generate AI reply first"
);

}




const res = await fetch(
"/api/shopee/reply-comment",
{

method:"POST",

headers:{
"Content-Type":"application/json"
},

body:JSON.stringify({

commentId:
review.reviewId,

comment:
review.aiReply

})

}

);



const data =
await res.json();



if(!res.ok){

throw new Error(
data.error ||
"Shopee reply failed"
);

}



alert(
"Shopee reply sent successfully"
);


refresh?.();



}catch(error){

alert(
error.message
);

}


}








return (

<div className="bg-white rounded-xl shadow overflow-hidden mt-6">


<table className="w-full">


<thead className="bg-slate-100">

<tr>


<th className="p-3">

<input

type="checkbox"

checked={
selected.length===reviews.length &&
reviews.length>0
}

onChange={toggleAll}

/>

</th>



<th className="p-3 text-left">
Customer
</th>



<th className="p-3 text-left">
Marketplace
</th>



<th className="p-3 text-left">
Product
</th>



<th className="p-3 text-left">
Rating
</th>



<th className="p-3 text-left">
Review
</th>



<th className="p-3 text-left">
Status
</th>



<th className="p-3 text-left">
Action
</th>



</tr>

</thead>





<tbody>


{
reviews.map((r)=>(


<>

<tr
key={r.id}
className="border-t align-top"
>


<td className="p-3">

<input

type="checkbox"

checked={
selected.includes(r.id)
}

onChange={()=>
toggleSelect(r.id)
}

/>

</td>





<td className="p-3">

{r.customerName}

</td>





<td className="p-3">

<span className="
px-3
py-1
rounded-full
text-xs
bg-blue-100
text-blue-700
">

{r.marketplace}

</span>

</td>





<td className="p-3">

<div className="font-semibold">

{r.productName || "Unknown Product"}

</div>


<div className="text-xs text-gray-500">

SKU:
{r.productSku || "-"}

</div>



{r.productBrand && (

<div className="
text-xs
text-blue-600
mt-1
">

Brand:
{" "}
{r.productBrand}

</div>

)}



{r.productCategory && (

<div className="
text-xs
text-purple-600
mt-1
">

Category:
{" "}
{r.productCategory}

</div>

)}


</td>






<td className="p-3">

{"⭐".repeat(
r.rating || 0
)}

</td>






<td className="p-3 max-w-xl">


<div>

{
r.reviewText ||
"No review text"
}

</div>






{r.aiReply && (

<div className="
mt-3
bg-green-50
border
border-green-300
rounded-lg
p-3
">


<div className="
font-semibold
text-green-700
">

AI Reply

</div>


<div>

{r.aiReply}

</div>


<button

onClick={()=>setActiveReply(r)}

className="
mt-2
bg-blue-600
text-white
px-3
py-1
rounded
"

>

Edit Reply

</button>


</div>

)}





{r.sentiment && (

<div className="text-xs mt-2">

Sentiment:
<b>
{r.sentiment}
</b>

</div>

)}



</td>







<td className="p-3">

<StatusBadge
status={r.status}
/>

</td>








<td className="p-3">


<div className="flex flex-col gap-2">



<button
onClick={()=>generate(r.id)}
className="bg-purple-600 text-white px-3 py-2 rounded"
>
AI Generate
</button>




<button
onClick={()=>analyze(r.id)}
className="bg-indigo-600 text-white px-3 py-2 rounded"
>
Analyze
</button>




<button
onClick={()=>approve(r.id)}
className="bg-green-600 text-white px-3 py-2 rounded"
>
Approve
</button>




<button
onClick={()=>reject(r.id)}
className="bg-red-600 text-white px-3 py-2 rounded"
>
Reject
</button>




<button
onClick={()=>replyShopee(r.id)}
className="bg-blue-600 text-white px-3 py-2 rounded"
>
Reply Shopee
</button>



</div>


</td>



</tr>





{
activeReply?.id===r.id && (

<tr>

<td colSpan="8" className="p-4">

<ReplyEditor

review={r}

refresh={()=>{

setActiveReply(null);

refresh?.();

}}

/>

</td>

</tr>

)

}




</>


))
}



</tbody>


</table>


</div>

);


}