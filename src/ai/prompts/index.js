// src/ai/prompts/index.js

import obermain from "./obermain";
import hushpuppies from "./hushpuppies";
import johnlangford from "./johnlangford";
import bhpc from "./bhpc";
import nicole from "./nicole";

const BRAND_PROMPTS = {

  OBERMAIN: obermain,

  "HUSH PUPPIES": hushpuppies,

  BHPC: bhpc,

  "BEVERLY HILLS POLO CLUB": bhpc,

  "JOHN LANGFORD": johnlangford,

  NICOLE: nicole,

};

export function getBrandPrompt(brand = "OBERMAIN") {

  const key = brand.toUpperCase();

  return (

    BRAND_PROMPTS[key] ||

    BRAND_PROMPTS.OBERMAIN

  );

}

export default BRAND_PROMPTS;