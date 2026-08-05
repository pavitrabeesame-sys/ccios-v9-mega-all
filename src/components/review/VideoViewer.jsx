// src/components/review/VideoViewer.jsx

"use client";

export default function VideoViewer({

videos=[],

}){

if(videos.length===0)return null;

return(

<div className="space-y-3">

{videos.map((video,index)=>(

<video

key={index}

controls

className="w-80 rounded-lg"

>

<source

src={video}

/>

</video>

))}

</div>

);

}