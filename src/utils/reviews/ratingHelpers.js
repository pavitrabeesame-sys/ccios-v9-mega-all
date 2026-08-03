export function getRatingLabel(rating) {

  switch (rating) {

    case 5:
      return "Excellent";

    case 4:
      return "Good";

    case 3:
      return "Average";

    case 2:
      return "Poor";

    case 1:
      return "Very Poor";

    default:
      return "Unknown";

  }

}

export function shouldAutoReply(rating) {

  return rating >= 4;

}

export function requiresApproval(rating) {

  return rating <= 3;

}

export function getStars(rating) {

  return "⭐".repeat(rating);

}