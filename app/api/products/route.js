import { NextResponse } from "next/server";
import { prisma } from "../../../src/lib/prisma";

export async function GET(request) {

  const { searchParams } = new URL(request.url);

  const search = searchParams.get("search") || "";

  const category = searchParams.get("category") || "";

  const status = searchParams.get("status") || "";

  const products = await prisma.product.findMany({

    where:{

      AND:[

        search
        ?{
          OR:[
            {name:{contains:search,mode:"insensitive"}},
            {sku:{contains:search,mode:"insensitive"}}
          ]
        }
        :{},

        category
        ?{
          category
        }
        :{},

        status
        ?{
          status
        }
        :{}

      ]

    },

    include:{
      brand:true
    },

    orderBy:{
      createdAt:"desc"
    }

  });

  return NextResponse.json({

    success:true,

    data:products

  });

}

export async function POST(request){

  const body=await request.json();

  const product=await prisma.product.create({

    data:{

      sku:body.sku,

      barcode:body.barcode,

      name:body.name,

      description:body.description,

      price:Number(body.price),

      stock:Number(body.stock),

      category:body.category,

      status:body.status,

      image:body.image,

      brandId:body.brandId

    }

  });

  return NextResponse.json({

    success:true,

    data:product

  });

}