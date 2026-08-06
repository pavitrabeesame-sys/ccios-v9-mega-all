"use client";

import { useEffect, useState } from "react";

import ReviewStats from "@/src/components/review/ReviewStats";
import ReviewSearch from "@/src/components/review/ReviewSearch";
import ReviewFilters from "@/src/components/review/ReviewFilters";
import ReviewTable from "@/src/components/review/ReviewTable";
import BulkActions from "@/src/components/review/BulkActions";

export default function ReviewsPage() {
  const [reviews, setReviews] = useState([]);
  const [stats, setStats] = useState({});
  const [brands, setBrands] = useState([]);
  const [selected, setSelected] = useState([]);

  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [brandFilter, setBrandFilter] = useState("ALL");
  const [platformFilter, setPlatformFilter] = useState("ALL");

  async function load(customSearch = searchQuery, customStatus = statusFilter, customBrand = brandFilter, customPlatform = platformFilter) {
    try {
      const params = new URLSearchParams();
      if (customSearch) params.append("search", customSearch);
      if (customStatus && customStatus !== "ALL") params.append("status", customStatus);
      if (customBrand && customBrand !== "ALL") params.append("brand", customBrand);
      if (customPlatform && customPlatform !== "ALL") params.append("platform", customPlatform);

      const [reviewRes, statsRes, brandRes] = await Promise.all([
        fetch(`/api/reviews?${params.toString()}`),
        fetch("/api/reviews/analytics"),
        fetch("/api/brands?all=true")
      ]);

      const reviewData = await reviewRes.json();
      const statsData = await statsRes.json();
      const brandData = await brandRes.json();

      setReviews(reviewData.reviews || []);
      setStats(statsData || {});
      setBrands(brandData.brands || brandData.data || []);
    } catch (error) {
      console.error("Review loading error:", error);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const handleSearch = (term) => {
    setSearchQuery(term);
    load(term, statusFilter, brandFilter, platformFilter);
  };

  const handleStatusChange = (status) => {
    setStatusFilter(status);
    load(searchQuery, status, brandFilter, platformFilter);
  };

  const handleBrandChange = (brand) => {
    setBrandFilter(brand);
    load(searchQuery, statusFilter, brand, platformFilter);
  };

  const handlePlatformChange = (platform) => {
    setPlatformFilter(platform);
    load(searchQuery, statusFilter, brandFilter, platform);
  };

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">
        NOVA Review Intelligence
      </h1>

      <ReviewStats
        stats={stats}
      />

      <div className="mt-6">
        <BulkActions
          selected={selected}
          refresh={() => load()}
        />
      </div>

      <div className="mt-6">
        <ReviewSearch
          onSearch={handleSearch}
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-4 items-center">
        {/* Brand Filter Dropdown */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">Brand:</span>
          <select
            value={brandFilter}
            onChange={(e) => handleBrandChange(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">All Brands</option>
            {brands.map((b) => (
              <option key={b.id || b.name} value={b.name}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        {/* Platform Filter Dropdown */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">Platform:</span>
          <select
            value={platformFilter}
            onChange={(e) => handlePlatformChange(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">All Platforms</option>
            <option value="Shopee">Shopee</option>
            <option value="Lazada">Lazada</option>
            <option value="TikTok">TikTok</option>
          </select>
        </div>

        <ReviewFilters
          onSearch={(status) => handleStatusChange(status)}
        />
      </div>

      <div className="mt-6">
        <ReviewTable
          reviews={reviews}
          refresh={() => load()}
          selected={selected}
          setSelected={setSelected}
        />
      </div>
    </div>
  );
}