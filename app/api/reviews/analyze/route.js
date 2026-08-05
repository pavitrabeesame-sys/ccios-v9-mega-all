import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();


export async function POST(request){

  try{

    const {id}=await request.json();


    const review = await prisma.review.findUnique({

      where:{
        id
      }

    });


    if(!review){

      return Response.json(
        {
          error:"Review not found"
        },
        {
          status:404
        }
      );

    }



    let sentiment="NEUTRAL";
    let emotion="CALM";
    let category="GENERAL";
    let confidence=80;



    const text =
      (review.reviewText || "")
      .toLowerCase();



    if(
      text.includes("good") ||
      text.includes("nice") ||
      text.includes("quality") ||
      review.rating >=4
    ){

      sentiment="POSITIVE";
      emotion="HAPPY";
      category="QUALITY";
      confidence=95;

    }


    if(
      text.includes("bad") ||
      text.includes("slow") ||
      text.includes("broken") ||
      review.rating <=2
    ){

      sentiment="NEGATIVE";
      emotion="DISAPPOINTED";
      category="ISSUE";
      confidence=90;

    }



    const updated =
      await prisma.review.update({

        where:{
          id
        },


        data:{

          sentiment,

          emotion,

          category,

          confidence

        }

      });



    return Response.json({

      success:true,

      review:updated

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