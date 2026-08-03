export default function ProductStats({ products }) {
  const total = products.length;

  const totalStock = products.reduce(
    (sum, p) => sum + Number(p.stock || 0),
    0
  );

  const totalValue = products.reduce(
    (sum, p) => sum + Number(p.stock || 0) * Number(p.price || 0),
    0
  );

  return (
    <div className="grid grid-cols-3 gap-5 mb-6">

      <div className="bg-white rounded-xl shadow p-5">
        <div className="text-gray-500">Products</div>
        <div className="text-3xl font-bold">{total}</div>
      </div>

      <div className="bg-white rounded-xl shadow p-5">
        <div className="text-gray-500">Total Stock</div>
        <div className="text-3xl font-bold">{totalStock}</div>
      </div>

      <div className="bg-white rounded-xl shadow p-5">
        <div className="text-gray-500">Inventory Value</div>
        <div className="text-3xl font-bold">
          RM {totalValue.toFixed(2)}
        </div>
      </div>

    </div>
  );
}