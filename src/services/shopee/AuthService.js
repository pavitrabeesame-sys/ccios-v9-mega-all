import crypto from "crypto";


const HOST =
  process.env.SHOPEE_HOST ||
  "https://partner.shopeemobile.com";



function getConfig(){

  const partnerId =
    Number(process.env.SHOPEE_PARTNER_ID);

  const partnerKey =
    process.env.SHOPEE_PARTNER_KEY;


  if(!partnerId || !partnerKey){

    throw new Error(
      "Missing SHOPEE_PARTNER_ID or SHOPEE_PARTNER_KEY"
    );

  }


  return {
    partnerId,
    partnerKey
  };

}





function getTimestamp(){

  return Math.floor(
    Date.now()/1000
  );

}





function sign(
  baseString,
  partnerKey
){

  return crypto
    .createHmac(
      "sha256",
      partnerKey
    )
    .update(baseString)
    .digest("hex");

}





function buildUrl(
  path,
  params={}
){

  const url =
    new URL(
      HOST + path
    );


  Object.entries(params)
  .forEach(([key,value])=>{

    if(
      value !== undefined &&
      value !== null
    ){

      url.searchParams.set(
        key,
        String(value)
      );

    }

  });


  return url.toString();

}





// =============================
// AUTHORIZE
// =============================

export function buildAuthUrl(
  redirectUrl
){

  const {
    partnerId,
    partnerKey
  } = getConfig();


  const path =
    "/api/v2/shop/auth_partner";


  const timestamp =
    getTimestamp();


  const baseString =
    `${partnerId}${path}${timestamp}`;



  const signature =
    sign(
      baseString,
      partnerKey
    );



  return buildUrl(
    path,
    {

      partner_id:partnerId,

      timestamp,

      sign:signature,

      redirect:redirectUrl

    }
  );

}





// =============================
// GET TOKEN
// =============================

export async function exchangeCodeForToken(
  code
){


const {
partnerId,
partnerKey
}=getConfig();



const path =
"/api/v2/auth/token/get";



const timestamp =
getTimestamp();



const baseString =
`${partnerId}${path}${timestamp}`;



const signature =
sign(
baseString,
partnerKey
);



const url =
buildUrl(
path,
{

partner_id:partnerId,

timestamp,

sign:signature

}

);




const response =
await fetch(
url,
{

method:"POST",

headers:{
"Content-Type":"application/json"
},

body:JSON.stringify({

code,

partner_id:partnerId

})

}
);



const data =
await response.json();



if(data.error){

throw new Error(
data.message ||
data.error
);

}



return data;


}





// =============================
// REFRESH TOKEN
// =============================

export async function refreshAccessToken(
  refreshToken,
  shopId
){

const {
partnerId,
partnerKey
}=getConfig();



const path =
"/api/v2/auth/access_token/get";



const timestamp =
getTimestamp();



const baseString =
`${partnerId}${path}${timestamp}`;



const signature =
sign(
baseString,
partnerKey
);



const url =
buildUrl(
path,
{

partner_id:partnerId,

timestamp,

sign:signature

}

);



const body={

partner_id:partnerId,

refresh_token:refreshToken,

shop_id:Number(shopId)

};




const response =
await fetch(
url,
{

method:"POST",

headers:{
"Content-Type":"application/json"
},

body:JSON.stringify(body)

}

);



const data =
await response.json();



console.log(
"SHOPEE REFRESH RESPONSE",
data
);



if(data.error){

throw new Error(
data.message ||
data.error
);

}



return data;


}





// =============================
// SHOP API URL
// =============================

export function buildShopApiUrl(
path,
accessToken,
shopId,
params={}
){


const {
partnerId,
partnerKey
}=getConfig();



const timestamp =
getTimestamp();



const baseString =
`${partnerId}${path}${timestamp}${accessToken}${shopId}`;



const signature =
sign(
baseString,
partnerKey
);



return buildUrl(
path,
{

partner_id:partnerId,

timestamp,

access_token:accessToken,

shop_id:shopId,

sign:signature,

...params

}

);


}




export const createAuthURL =
buildAuthUrl;