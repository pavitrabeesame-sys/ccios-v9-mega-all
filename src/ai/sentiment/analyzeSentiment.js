import {
  POSITIVE,
  NEGATIVE,
} from "./keywords";

export function analyzeSentiment(text = "") {

  if (!text) {
    return "NEUTRAL";
  }

  const value = text.toLowerCase();

  let positive = 0;
  let negative = 0;

  POSITIVE.forEach(word => {
    if (value.includes(word)) {
      positive++;
    }
  });

  NEGATIVE.forEach(word => {
    if (value.includes(word)) {
      negative++;
    }
  });

  if (positive > negative) {
    return "POSITIVE";
  }

  if (negative > positive) {
    return "NEGATIVE";
  }

  return "NEUTRAL";
}

export default analyzeSentiment;