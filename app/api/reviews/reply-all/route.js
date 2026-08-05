import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();


export async function POST(req){

try{


const {ids}=await req.json();



const reviews = await prisma.review.findMany({

where:{
id:{
in:ids
}
}

});



const replyList = reviews
.filter(
review =>
review.reviewId &&
review.aiReply
)
.map(review=>({

comment_id:Number(review.reviewId),

comment:review.aiReply

}));





if(!replyList.length){

return Response.json({

error:"No AI replies available"

},{
status:400
});

}





// TEMP LOG - check Shopee payload

console.log(
"SHOPEE REPLY PAYLOAD",
{
comment_list:replyList
}
);





/*

NEXT CONNECT:

Shopee API

POST:
https://partner.shopeemobile.com/api/v2/product/reply_comment


Need:

partner_id
shop_id
access_token
timestamp
sign


*/





for(const review of reviews){


await prisma.review.update({

where:{
id:review.id
},


data:{

status:"REPLIED",

repliedAt:new Date(),

finalReply:
review.aiReply || ""

}

});


}





return Response.json({

success:true,

updated:reviews.length,

shopeePayload:{
comment_list:replyList
}

});




}catch(error){


console.error(
"REPLY ALL ERROR",
error
);



return Response.json({

error:error.message

},{
status:500
});


}


}