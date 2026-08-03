"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const menus = [
  { name:"Dashboard",href:"/dashboard"},
  { name:"Companies",href:"/companies"},
  { name:"Brands",href:"/brands"},
  { name:"Stores",href:"/stores"},
  { name:"Products",href:"/products"},
  { name:"Orders",href:"/orders"},
  { name:"Users",href:"/users"},
];

export default function Sidebar(){

const pathname=usePathname();

return(

<div className="w-64 bg-slate-900 text-white min-h-screen">

<div className="text-3xl font-bold p-6 border-b border-slate-700">

CCIOS

</div>

<nav className="mt-4">

{menus.map(menu=>(

<Link
key={menu.href}
href={menu.href}
className={`block px-6 py-3 transition ${
pathname===menu.href
?"bg-blue-600"
:"hover:bg-slate-800"
}`}
>

{menu.name}

</Link>

))}

</nav>

</div>

);

}