export function getRatingColor(rating) {

  if (rating === 5) return "text-green-600";

  if (rating === 4) return "text-blue-600";

  if (rating === 3) return "text-yellow-600";

  if (rating === 2) return "text-orange-600";

  return "text-red-600";

}

export function truncate(text, length = 80) {

  if (!text) return "";

  if (text.length <= length) return text;

  return text.substring(0, length) + "...";

}

export function formatMarketplace(name) {

  return name
    .toLowerCase()
    .replace(/^./, c => c.toUpperCase());

}