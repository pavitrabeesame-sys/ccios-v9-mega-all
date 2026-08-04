import obermain from "./obermain";
import hushpuppies from "./hushpuppies";
import johnlangford from "./johnlangford";
import bhpc from "./bhpc";
import nicole from "./nicole";

export function getBrandPrompt(brand = "") {

  switch (brand.toLowerCase()) {

    case "obermain":
      return obermain;

    case "hush puppies":
      return hushpuppies;

    case "john langford":
      return johnlangford;

    case "beverly hills polo club":
      return bhpc;

    case "nicole":
      return nicole;

    default:
      return obermain;
  }

}