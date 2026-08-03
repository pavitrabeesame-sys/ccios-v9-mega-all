"use client";

import Button from "../ui/Button";

export default function ProductTable({
  products,
  onDelete,
}) {

  if (!products || products.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow p-10 text-center text-gray-500">
        No products found.
      </div>
    );
  }

  return (

    <div className="overflow-x-auto">

      <table className="w-full bg-white rounded-xl shadow">

        <thead className="bg-slate-100">

          <tr>

            <th className="p-3 text-left">SKU</th>

            <th className="p-3 text-left">Product</th>

            <th className="p-3 text-left">Brand</th>

            <th className="p-3 text-left">Category</th>

            <th className="p-3 text-left">Status</th>

            <th className="p-3 text-right">Price</th>

            <th className="p-3 text-center">Stock</th>

            <th className="p-3 text-center">Action</th>

          </tr>

        </thead>

        <tbody>

          {products.map((product) => (

            <tr
              key={product.id}
              className="border-t hover:bg-gray-50"
            >

              <td className="p-3 font-mono">
                {product.sku}
              </td>

              <td className="p-3">

                <div className="font-semibold">
                  {product.name}
                </div>

                <div className="text-xs text-gray-500">
                  {product.barcode || "-"}
                </div>

              </td>

              <td className="p-3">
                {product.brand?.name || "-"}
              </td>

              <td className="p-3">
                {product.category || "-"}
              </td>

              <td className="p-3">

                <span
                  className={`px-3 py-1 rounded-full text-xs font-semibold text-white ${
                    product.status === "ACTIVE"
                      ? "bg-green-600"
                      : "bg-gray-500"
                  }`}
                >
                  {product.status || "ACTIVE"}
                </span>

              </td>

              <td className="p-3 text-right font-semibold">
                RM {Number(product.price || 0).toFixed(2)}
              </td>

              <td className="p-3 text-center">

                <span
                  className={`font-bold ${
                    Number(product.stock) <= 5
                      ? "text-red-600"
                      : "text-green-600"
                  }`}
                >
                  {product.stock}
                </span>

              </td>

              <td className="p-3">

                <div className="flex justify-center gap-2">

                  <Button
                    className="bg-green-600 hover:bg-green-700"
                    onClick={() => {
                      window.location.href = `/products/${product.id}/edit`;
                    }}
                  >
                    Edit
                  </Button>

                  <Button
                    className="bg-red-600 hover:bg-red-700"
                    onClick={() => onDelete(product.id)}
                  >
                    Delete
                  </Button>

                </div>

              </td>

            </tr>

          ))}

        </tbody>

      </table>

    </div>

  );

}