import { NextResponse } from "next/server";

export async function POST(request){

try{

const formData=await request.formData();

const file=formData.get("file");

if(!file){

return NextResponse.json(
{error:"No file uploaded."},
{status:400}
);

}

return NextResponse.json({

success:true,

filename:file.name,

size:file.size,

message:"CSV uploaded successfully."

});

}catch(error){

return NextResponse.json(

{error:error.message},

{status:500}

);

}

}