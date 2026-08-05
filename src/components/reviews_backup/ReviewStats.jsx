export default function ReviewStats({ stats }) {
  const cards = [
    { title: "Total", value: stats.total || 0, color: "bg-slate-800" },
    { title: "Pending", value: stats.pending || 0, color: "bg-yellow-500" },
    { title: "Approved", value: stats.approved || 0, color: "bg-blue-600" },
    { title: "Rejected", value: stats.rejected || 0, color: "bg-red-600" },
    { title: "Replied", value: stats.replied || 0, color: "bg-green-600" },
  ];

  return (
    <div className="grid grid-cols-5 gap-4 mb-6">
      {cards.map((card) => (
        <div
          key={card.title}
          className={`${card.color} text-white rounded-xl p-5`}
        >
          <div className="text-sm opacity-80">{card.title}</div>
          <div className="text-3xl font-bold mt-2">{card.value}</div>
        </div>
      ))}
    </div>
  );
}