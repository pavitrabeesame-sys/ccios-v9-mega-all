export default function ProductCard({ product }) {
  return (
    <div className="bg-white rounded-xl shadow p-5">

      <h2 className="font-bold text-lg">
        {product.name}
      </h2>

      <p className="text-gray-500 mt-2">
        SKU: {product.sku}
      </p>

      <p className="mt-2">
        RM {Number(product.price).toFixed(2)}
      </p>

      <p>
        Stock: {product.stock}
      </p>

    </div>
  );
}