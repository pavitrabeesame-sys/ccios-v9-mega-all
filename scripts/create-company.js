import { prisma } from "../lib/prisma.js";


async function main(){


const company =
await prisma.company.upsert({

where:{

code:"BEESAME"

},

update:{},


create:{

name:"BeeSame",

code:"BEESAME",

description:
"Commerce Intelligence OS"

}

});


console.log(
"COMPANY CREATED:",
company
);


}



main()

.then(()=>{

process.exit(0);

})

.catch(error=>{

console.error(error);

process.exit(1);

});