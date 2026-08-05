import { prisma } from "../lib/prisma.js";


async function main(){


const oldBrand =
await prisma.brand.findUnique({

where:{
code:"SHOPEE"
}

});


const newBrand =
await prisma.brand.findUnique({

where:{
code:"OBERMAIN"
}

});


if(!oldBrand || !newBrand){

throw new Error(
"Brand not found"
);

}



const result =
await prisma.product.updateMany({

where:{
brandId:oldBrand.id
},

data:{
brandId:newBrand.id
}

});


console.log(
"UPDATED PRODUCTS:",
result.count
);



}



main()

.then(()=>process.exit(0))

.catch(error=>{

console.error(error);

process.exit(1);

});