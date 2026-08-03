"use client";

const prompts = [

  {
    brand: "RAV Design",
    type: "Review Reply",
  },

  {
    brand: "Champion",
    type: "Review Reply",
  },

  {
    brand: "John Langford",
    type: "Review Reply",
  },

  {
    brand: "Beverly Hills Polo Club",
    type: "Review Reply",
  },

  {
    brand: "Hush Puppies",
    type: "Review Reply",
  },

  {
    brand: "Obermain",
    type: "Review Reply",
  },

  {
    brand: "Nicole Collection",
    type: "Review Reply",
  },

];

export default function PromptLibraryPage() {

  return (

    <div className="p-8">

      <h1 className="text-3xl font-bold mb-6">

        Prompt Library

      </h1>

      <table className="w-full bg-white rounded-xl shadow">

        <thead className="bg-slate-100">

          <tr>

            <th className="p-3">Brand</th>

            <th className="p-3">Prompt Type</th>

          </tr>

        </thead>

        <tbody>

          {prompts.map((p,index)=>(

            <tr key={index} className="border-t">

              <td className="p-3">{p.brand}</td>

              <td className="p-3">{p.type}</td>

            </tr>

          ))}

        </tbody>

      </table>

    </div>

  );

}