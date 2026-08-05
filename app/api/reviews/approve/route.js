import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();


export async function POST(request){

  try{

    const {id}=await request.json();


    if(!id){

      return Response.json(
        {
          error:"Missing review id"
        },
        {
          status:400
        }
      );

    }


    const review = await prisma.review.update({

      where:{
        id
      },

      data:{
        status:"APPROVED"
      }

    });



    return Response.json({

      success:true,

      review

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