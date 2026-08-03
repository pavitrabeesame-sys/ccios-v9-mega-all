import Link from "next/link";

export default function DashboardLayout({ children }) {
  return (
    <div className="flex min-h-screen bg-slate-100">

      <aside className="w-64 bg-slate-900 text-white p-6">

        <h1 className="text-2xl font-bold mb-8">
          CCIOS
        </h1>

        <nav className="space-y-3">

          <Link href="/dashboard" className="block hover:text-blue-400">
            Dashboard
          </Link>

          <Link href="/companies" className="block hover:text-blue-400">
            Companies
          </Link>

          <Link href="/brands" className="block hover:text-blue-400">
            Brands
          </Link>

          <Link href="/stores" className="block hover:text-blue-400">
            Stores
          </Link>

          <Link href="/users" className="block hover:text-blue-400">
            Users
          </Link>

          <Link href="/products" className="block hover:text-blue-400">
            Products
          </Link>

          <Link href="/orders" className="block hover:text-blue-400">
            Orders
          </Link>

          <Link href="/customers" className="block hover:text-blue-400">
            Customers
          </Link>

        </nav>

      </aside>

      <main className="flex-1 p-8">
        {children}
      </main>

    </div>
  );
}