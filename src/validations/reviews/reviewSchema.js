export function validateReview(data) {

  const errors = {};

  if (!data.customerName?.trim()) {
    errors.customerName = "Customer name is required.";
  }

  if (!data.productName?.trim()) {
    errors.productName = "Product name is required.";
  }

  if (
    typeof data.rating !== "number" ||
    data.rating < 1 ||
    data.rating > 5
  ) {
    errors.rating = "Rating must be between 1 and 5.";
  }

  if (!data.marketplace) {
    errors.marketplace = "Marketplace is required.";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };

}