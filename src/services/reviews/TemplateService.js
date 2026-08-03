export function getTemplate(templates, brand, rating) {

  const template = templates.find(
    (t) => t.brand === brand && t.rating === rating
  );

  return template ? template.template : "";

}

export function applyTemplate(template, review) {

  return template
    .replaceAll("{customer}", review.customerName)
    .replaceAll("{product}", review.productName)
    .replaceAll("{rating}", review.rating)
    .replaceAll("{marketplace}", review.marketplace);

}