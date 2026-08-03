"use client";

export default function AIKnowledgePage() {

  const knowledge = [

    "Brand Story",
    "Leather Materials",
    "Warranty Policy",
    "Shipping Policy",
    "Return & Refund",
    "Care Instructions",
    "Product FAQ",
    "Customer Service SOP",

  ];

  return (

    <div className="p-8">

      <h1 className="text-3xl font-bold mb-6">

        AI Knowledge Base

      </h1>

      <div className="grid grid-cols-2 gap-5">

        {knowledge.map((item)=>(

          <div
            key={item}
            className="bg-white rounded-xl shadow p-5"
          >

            <h2 className="font-semibold">

              {item}

            </h2>

          </div>

        ))}

      </div>

    </div>

  );

}