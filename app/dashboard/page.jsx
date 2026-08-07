export const dynamic = 'force-dynamic';

export default function DashboardPage() {
  const cards = [
    { title: 'Total Revenue', value: 'RM 124,500', color: 'bg-blue-500' },
    { title: 'Active Orders', value: '1,429', color: 'bg-green-500' },
    { title: 'Pending Reviews', value: '38', color: 'bg-amber-500' },
    { title: 'Low Stock Items', value: '4', color: 'bg-red-500' }
  ];

  return (
    <div className="p-8">
      <h1 className="text-4xl font-bold mb-2">
        CCIOS Enterprise Dashboard
      </h1>
      <p className="text-gray-500 mb-10">
        Commerce Intelligence Operating System
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card) => (
          <div
            key={card.title}
            className="bg-white rounded-xl shadow p-6"
          >
            <div
              className={`w-12 h-12 rounded-lg ${card.color} mb-5`}
            />
            <p className="text-gray-500">
              {card.title}
            </p>
            <h2 className="text-4xl font-bold mt-2">
              {card.value}
            </h2>
          </div>
        ))}
      </div>
    </div>
  );
}