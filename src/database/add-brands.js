import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();


async function main(){


const company = await prisma.company.findFirst();


const brands = [

"RAV Design",
"Champion",
"John Langford",
"Beverly Hills Polo Club",
"Hush Puppies",
"Obermain",
"Nicole Collection"

];


for(const name of brands){


await prisma.brand.upsert({

where:{
code:name.toUpperCase().replace(/\s+/g,"_")
},


update:{},


create:{

name,

code:name.toUpperCase().replace(/\s+/g,"_"),

companyId:company.id

}


});


}


console.log("Brands added");


}


main()
.finally(()=>prisma.$disconnect());