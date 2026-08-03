import { prisma } from "../../src/lib/prisma";

export default async function DashboardPage() {
  const [
    companies,
    brands,
    stores,
    users,
    products,
    orders,
    customers,
  ] = await Promise.all([
    prisma.company.count(),
    prisma.brand.count(),
    prisma.store.count(),
    prisma.user.count(),
    prisma.product.count(),
    prisma.order.count(),
    prisma.customer.count(),
  ]);

  const cards = [
    {
      title: "Companies",
      value: companies,
      color: "bg-blue-600",
    },
    {
      title: "Brands",
      value: brands,
      color: "bg-green-600",
    },
    {
      title: "Stores",
      value: stores,
      color: "bg-orange-600",
    },
    {
      title: "Users",
      value: users,
      color: "bg-purple-600",
    },
    {
      title: "Products",
      value: products,
      color: "bg-pink-600",
    },
    {
      title: "Orders",
      value: orders,
      color: "bg-red-600",
    },
    {
      title: "Customers",
      value: customers,
      color: "bg-cyan-600",
    },
  ];

  return (
    <div>

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