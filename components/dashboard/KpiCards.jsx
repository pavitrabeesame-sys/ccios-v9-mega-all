export default function KpiCards({ products }) {
  const total = products.length;

  const active = products.filter(
    (p) => p.status === "Active"
  ).length;

  const inactive = total - active;

  const lowStock = products.filter(
    (p) => (p.available || 0) < 10
  ).length;

  return (
    <div className="grid grid-cols-4 gap-6 mb-6">

      <Card title="Total Products" value={total} />

      <Card title="Active" value={active} />

      <Card title="Inactive" value={inactive} />

      <Card title="Low Stock" value={lowStock} />

    </div>
  );
}

function Card({ title, value }) {
  return (
    <div className="bg-white rounded-xl shadow p-6">

      <div className="text-gray-500">
        {title}
      </div>

      <div className="text-3xl font-bold mt-2">
        {value}
      </div>

    </div>
  );
}