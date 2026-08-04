import keywords from "./keywords";

export function classifyReview(text = "") {

  const value = text.toLowerCase();

  for (const category in keywords) {

    const words = keywords[category];

    if (words.some(word => value.includes(word))) {
      return category;
    }

  }

  return "OTHER";
}

export default classifyReview;