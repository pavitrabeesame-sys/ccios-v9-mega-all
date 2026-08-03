import { NextResponse } from "next/server";

export async function GET() {

  return NextResponse.json([

    {
      id:1,
      brand:"RAV Design",
      store:"ravdesign.os",
      model:"qwen3:4b",
      tone:"Premium",
      active:true,
    },

    {
      id:2,
      brand:"Champion",
      store:"championmy.os",
      model:"qwen3:4b",
      tone:"Sporty",
      active:true,
    },

    {
      id:3,
      brand:"John Langford",
      store:"johnlangford.os",
      model:"qwen3:4b",
      tone:"Classic",
      active:true,
    },

    {
      id:4,
      brand:"Beverly Hills Polo Club",
      store:"beverlyhillspoloclub",
      model:"qwen3:4b",
      tone:"Luxury",
      active:true,
    },

    {
      id:5,
      brand:"Hush Puppies",
      store:"hushpuppiesmy.os",
      model:"qwen3:4b",
      tone:"Friendly",
      active:true,
    },

    {
      id:6,
      brand:"Obermain",
      store:"obermain.os",
      model:"qwen3:4b",
      tone:"Rugged",
      active:true,
    },

    {
      id:7,
      brand:"Nicole Collection",
      store:"nicolecollection",
      model:"qwen3:4b",
      tone:"Elegant",
      active:true,
    }

  ]);

}