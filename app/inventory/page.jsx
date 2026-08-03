export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function InventoryPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">Inventory</h1>
      <p className="text-gray-500 mt-2">No products yet</p>
    </div>
  )
}