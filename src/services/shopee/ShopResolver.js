export function resolveShopeeShop(storeName) {

  const store = (storeName || "").toLowerCase();

  switch (store) {

    case "ravdesign.os":
      return {
        shopId: Number(process.env.RAV_SHOP_ID),
        accessToken: process.env.ACCESS_TOKEN_MAIN,
      };

    case "championmy.os":
      return {
        shopId: Number(process.env.CHAMPION_SHOP_ID),
        accessToken: process.env.ACCESS_TOKEN_MAIN,
      };

    case "johnlangford.os":
      return {
        shopId: Number(process.env.JL_SHOP_ID),
        accessToken: process.env.ACCESS_TOKEN_MAIN,
      };

    case "obermain.os":
      return {
        shopId: Number(process.env.OBERMAIN_SHOP_ID),
        accessToken: process.env.ACCESS_TOKEN_MAIN,
      };

    case "hushpuppiesmy.os":
      return {
        shopId: Number(process.env.HUSHPUPPIES_SHOP_ID),
        accessToken: process.env.ACCESS_TOKEN_MAIN,
      };

    case "beverlyhillspoloclub":
      return {
        shopId: Number(process.env.BHPC_SHOP_ID),
        accessToken: process.env.ACCESS_TOKEN_MAIN,
      };

    case "nicolecollection":
      return {
        shopId: Number(process.env.NICOLE_SHOP_ID),
        accessToken: process.env.ACCESS_TOKEN_NICOLE_MY,
      };

    default:
      throw new Error(`Unknown Shopee Store: ${storeName}`);

  }

}