import { NextResponse } from "next/server";


export async function POST(request){

try{


const body = await request.json();


const {
commentId,
comment
}=body;



if(!commentId || !comment){

return NextResponse.json(
{
error:"commentId and comment required"
},
{
status:400
}
);

}





const response = await fetch(
"https://partner.shopeemobile.com/api/v2/product/reply_comment",
{

method:"POST",

headers:{

"Content-Type":
"application/json"

},

body:JSON.stringify({

comment_list:[

{

comment_id:Number(commentId),

comment:comment

}

]

})

}

);





const data = await response.json();





return NextResponse.json(data);



}

catch(error){


console.error(
"SHOPEE REPLY ERROR",
error
);



return NextResponse.json(

{
error:error.message
},

{
status:500
}

);


}


}