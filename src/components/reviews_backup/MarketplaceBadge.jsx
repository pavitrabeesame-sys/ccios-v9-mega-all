export default function MarketplaceBadge({ marketplace }) {

  const colors = {
    SHOPEE: "bg-orange-100 text-orange-700",
    LAZADA: "bg-blue-100 text-blue-700",
    TIKTOK: "bg-black text-white",
    WEBSITE: "bg-green-100 text-green-700",
  };

  return (
    <span
      className={`px-3 py-1 rounded-full text-xs font-semibold ${
        colors[marketplace] || "bg-gray-100 text-gray-700"
      }`}
    >
      {marketplace}
    </span>
  );

}