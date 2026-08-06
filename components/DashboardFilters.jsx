'use client';

import { useRouter, useSearchParams } from 'next/navigation';

export default function DashboardFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentMarketplace = searchParams.get('marketplace') || 'ALL';
  const currentBrand = searchParams.get('brand') || 'ALL';

  const handleFilterChange = (key, value) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === 'ALL') {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    router.push(`?${params.toString()}`);
  };

  return (
    <div className="flex flex-wrap items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6">
      {/* Marketplace Filter */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Marketplace</label>
        <select
          value={currentMarketplace}
          onChange={(e) => handleFilterChange('marketplace', e.target.value)}
          className="bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 outline-none"
        >
          <option value="ALL">All Marketplaces</option>
          <option value="SHOPEE">Shopee</option>
          <option value="LAZADA">Lazada</option>
        </select>
      </div>

      {/* Brand Filter */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Brand</label>
        <select
          value={currentBrand}
          onChange={(e) => handleFilterChange('brand', e.target.value)}
          className="bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 outline-none"
        >
          <option value="ALL">All Brands</option>
          <option value="Nicole">Nicole</option>
          <option value="RAV">RAV</option>
          <option value="Obermain">Obermain</option>
          <option value="Hush Puppies">Hush Puppies</option>
          <option value="BHPC">BHPC</option>
        </select>
      </div>
    </div>
  );
}