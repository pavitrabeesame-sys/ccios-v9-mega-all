// app/api/reviews/analytics/route.js

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();


export async function GET() {

  try {

    const total = await prisma.review.count();


    const pending = await prisma.review.count({
      where:{
        status:"PENDING"
      }
    });


    const generated = await prisma.review.count({
      where:{
        status:"GENERATED"
      }
    });


    const approved = await prisma.review.count({
      where:{
        status:"APPROVED"
      }
    });


    const replied = await prisma.review.count({
      where:{
        status:"REPLIED"
      }
    });


    const rejected = await prisma.review.count({
      where:{
        status:"REJECTED"
      }
    });


    return Response.json({

      total,

      pending,

      generated,

      approved,

      replied,

      rejected

    });


  } catch(error){

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