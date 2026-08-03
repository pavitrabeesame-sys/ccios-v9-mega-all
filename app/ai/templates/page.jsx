"use client";

const templates = [

  {
    brand:"RAV Design",
    language:"English",
    rating:"5★",
  },

  {
    brand:"Champion",
    language:"Malay",
    rating:"5★",
  },

  {
    brand:"John Langford",
    language:"English",
    rating:"4★",
  },

  {
    brand:"Beverly Hills Polo Club",
    language:"English",
    rating:"5★",
  },

  {
    brand:"Hush Puppies",
    language:"Malay",
    rating:"5★",
  },

  {
    brand:"Obermain",
    language:"English",
    rating:"5★",
  },

  {
    brand:"Nicole Collection",
    language:"English",
    rating:"5★",
  },

];

export default function AITemplatesPage(){

return(

<div className="p-8">

<h1 className="text-3xl font-bold mb-6">

AI Reply Templates

</h1>

<table className="w-full bg-white rounded-xl shadow">

<thead className="bg-slate-100">

<tr>

<th className="p-3">Brand</th>

<th className="p-3">Language</th>

<th className="p-3">Rating</th>

</tr>

</thead>

<tbody>

{templates.map((t,i)=>(

<tr key={i} className="border-t">

<td className="p-3">{t.brand}</td>

<td className="p-3">{t.language}</td>

<td className="p-3">{t.rating}</td>

</tr>

))}

</tbody>

</table>

</div>

);

}