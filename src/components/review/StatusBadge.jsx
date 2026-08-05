"use client";

export default function StatusBadge({status}) {

return (

<span className="px-3 py-1 rounded bg-gray-100">

{status || "PENDING"}

</span>

);

}