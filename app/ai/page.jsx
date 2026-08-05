"use client";

import Link from "next/link";

const modules = [
  {
    name: "AI Brands",
    description: "Manage brand personality, tone and rules",
    href: "/ai/brands",
    icon: "🏷️",
  },

  {
    name: "Knowledge Base",
    description: "Upload SOP, product and company knowledge",
    href: "/ai/knowledge",
    icon: "📚",
  },

  {
    name: "Prompt Library",
    description: "Manage reusable AI prompts",
    href: "/ai/prompts",
    icon: "🧠",
  },

  {
    name: "Templates",
    description: "AI response templates",
    href: "/ai/templates",
    icon: "📝",
  },

  {
    name: "AI Testing",
    description: "Test AI outputs before production",
    href: "/ai/testing",
    icon: "🧪",
  },

  {
    name: "Models",
    description: "Manage AI models and providers",
    href: "/ai/models",
    icon: "🤖",
  },

  {
    name: "Settings",
    description: "AI configuration and controls",
    href: "/ai/settings",
    icon: "⚙️",
  },
];


export default function AIHomePage() {

  return (

    <div className="p-8 bg-gray-50 min-h-screen">


      <h1 className="text-4xl font-bold mb-2">
        NOVA AI Center
      </h1>


      <p className="text-gray-500 mb-8">
        Central intelligence layer for CCIOS ecommerce operations
      </p>


      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">


        {modules.map((item)=>(


          <Link
            key={item.href}
            href={item.href}
            className="
            bg-white
            rounded-2xl
            shadow
            hover:shadow-xl
            transition
            p-6
            border
            "
          >


            <div className="text-4xl mb-4">
              {item.icon}
            </div>


            <h2 className="text-xl font-bold">
              {item.name}
            </h2>


            <p className="text-gray-500 mt-2">
              {item.description}
            </p>


          </Link>


        ))}


      </div>


    </div>

  );

}