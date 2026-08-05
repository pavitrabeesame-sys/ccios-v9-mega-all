import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();


export async function POST(request){

try{

const {id, reply}=await request.json();


const review = await prisma.review.update({

where:{
id
},

data:{

finalReply:reply,

status:"REPLIED",

repliedAt:new Date()

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