import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();


export async function POST(request){

  try{

    const { ids } = await request.json();


    const updated = await prisma.review.updateMany({

      where:{
        id:{
          in:ids
        }
      },

      data:{
        status:"REJECTED"
      }

    });


    return Response.json({

      success:true,

      updated:updated.count

    });


  }catch(error){

    return Response.json(
      {
        error:error.message
      },
      {
        status:500
      }
    );

  }

}