import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();


export async function POST(request){

  try{

    const { ids } = await request.json();


    const reviews = await prisma.review.findMany({

      where:{
        id:{
          in:ids
        }
      }

    });



    for(const review of reviews){


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
        review.rating <=2
      ){

        sentiment="NEGATIVE";
        emotion="DISAPPOINTED";
        category="ISSUE";
        confidence=90;

      }



      await prisma.review.update({

        where:{
          id:review.id
        },

        data:{
          sentiment,
          emotion,
          category,
          confidence
        }

      });


    }



    return Response.json({

      success:true,

      analyzed:reviews.length

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