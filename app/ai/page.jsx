"use client";

import Link from "next/link";

const modules = [

  { name: "AI Brands", href: "/ai/brands" },

  { name: "Knowledge Base", href: "/ai/knowledge" },

  { name: "Prompt Library", href: "/ai/prompts" },

  { name: "Templates", href: "/ai/templates" },

  { name: "AI Testing", href: "/ai/testing" },

  { name: "Models", href: "/ai/models" },

  { name: "Settings", href: "/ai/settings" },

];

export default function AIHomePage() {

  return (

    <div className="p-8">

      <h1 className="text-3xl font-bold mb-8">

        NOVA AI Center

      </h1>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-6">

        {modules.map((item) => (

          <Link
            key={item.href}
            href={item.href}
            className="bg-white rounded-xl shadow hover:shadow-lg transition p-6"
          >

            <h2 className="text-xl font-semibold">

              {item.name}

            </h2>

          </Link>

        ))}

      </div>

    </div>

  );

}