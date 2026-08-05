// src/components/review/ImageViewer.jsx

"use client";

export default function ImageViewer({

images=[],

}){

if(images.length===0)return null;

return(

<div className="flex gap-3 flex-wrap">

{images.map((img,index)=>(

<img

key={index}

src={img}

alt="review"

className="w-28 h-28 rounded-lg border object-cover"

/>

))}

</div>

);

}