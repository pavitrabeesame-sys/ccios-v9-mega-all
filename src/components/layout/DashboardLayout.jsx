"use client";

import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

export default function DashboardLayout({children}){

return(

<div className="flex">

<Sidebar/>

<div className="flex-1">

<Topbar/>

<div className="p-8">

{children}

</div>

</div>

</div>

);

}