import { prisma } from "../../lib/prisma";
import { getValidToken } from "./TokenService";
import { buildShopApiUrl } from "./AuthService";



// =====================================
// GET ITEM LIST
// =====================================

export async function getShopeeItems(shopId){


  const token =
    await getValidToken(shopId);



  const url =
    buildShopApiUrl(

      "/api/v2/product/get_item_list",

      token.accessToken,

      shopId,

      {

        offset:0,

        page_size:100,

        item_status:"NORMAL"

      }

    );



  console.log(
    "ITEM LIST URL:",
    url
  );



  const response =
    await fetch(url);



  const text =
    await response.text();



  console.log(
    "ITEM LIST RESPONSE:",
    text
  );



  const data =
    JSON.parse(text);



  if(data.error){

    throw new Error(
      data.message ||
      data.error
    );

  }



  return (
    data.response?.item ||
    []
  );


}







// =====================================
// GET ITEM BASE INFO
// =====================================

export async function getItemBaseInfo(
  shopId,
  itemIds
){

  const token =
    await getValidToken(shopId);



  const allItems = [];



  // SPLIT INTO 50 ITEMS PER REQUEST

  for(
    let i = 0;
    i < itemIds.length;
    i += 50
  ){


    const batch =
      itemIds.slice(
        i,
        i + 50
      );



    const url =
      buildShopApiUrl(

        "/api/v2/product/get_item_base_info",

        token.accessToken,

        shopId,

        {

          item_id_list:
          batch.join(",")

        }

      );



    console.log(
      "BASE INFO BATCH:",
      batch.length
    );



    const response =
      await fetch(url);



    const text =
      await response.text();



    console.log(
      "BASE INFO RESPONSE:",
      text.substring(0,300)
    );



    const data =
      JSON.parse(text);



    if(data.error){

      throw new Error(
        data.message ||
        data.error
      );

    }



    if(
      data.response?.item_list
    ){

      allItems.push(
        ...data.response.item_list
      );

    }


  }



  return allItems;


}








// =====================================
// SYNC PRODUCTS
// =====================================

export async function syncShopeeProducts(
  shopId
){



  const items =
    await getShopeeItems(shopId);




  console.log(
    "ITEM COUNT:",
    items.length
  );




  if(!items.length){


    return {

      synced:0,

      message:
      "No items found"

    };


  }






  const itemIds =
    items.map(
      item =>
      item.item_id
    );






  const products =
    await getItemBaseInfo(

      shopId,

      itemIds

    );







const company =
await prisma.company.findFirst();


if(!company){

  throw new Error(
    "No company found"
  );

}



async function getProductBrand(productName){


  const knownBrands = [

    "OBERMAIN",

    "RAV DESIGN",

    "HUSH PUPPIES",

    "JOHN LANG FORD",

    "BEVERLY HILLS POLO CLUB",

    "NICOLE"

  ];



  const upperName =
  productName.toUpperCase();



  for(const b of knownBrands){

    if(
      upperName.includes(b)
    ){

      return b;

    }

  }


  return "UNKNOWN";

}




async function getOrCreateBrand(
  brandName
){


  let brand =
  await prisma.brand.findFirst({

    where:{
      name:brandName
    }

  });



  if(!brand){


    brand =
    await prisma.brand.create({

      data:{


        name:brandName,


        code:
        brandName
        .replace(
          /\s+/g,
          "_"
        )
        .toUpperCase(),


        companyId:
        company.id


      }

    });


  }


  return brand;


}






  let synced = 0;





  for(
    const item of products
  ){

const brandName =
await getProductBrand(
  item.item_name
);


const brand =
await getOrCreateBrand(
  brandName
);

    await prisma.product.upsert({

      where:{

        sku:
        String(item.item_id)

      },


      update:{


        name:
        item.item_name,


        image:
        item.image
        ?.image_url_list
        ?.[0]
        ||
        null


      },



      create:{


        sku:
        String(item.item_id),



        name:
        item.item_name,



        price:
        Number(
          item.price_info?.[0]
          ?.current_price
          ||
          0
        ),



        stock:0,



        brandId:
        brand.id,



        image:
        item.image
        ?.image_url_list
        ?.[0]
        ||
        null


      }


    });



    synced++;


  }






  return {

    synced

  };


}