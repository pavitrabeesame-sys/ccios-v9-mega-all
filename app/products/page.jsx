"use client";

import { useEffect, useState } from "react";
import ProductModal from "../../src/components/products/ProductModal";
import ProductTable from "../../src/components/products/ProductTable";
import Button from "../../src/components/ui/Button"
import ProductStats from "../../src/components/products/ProductStats";

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [brands, setBrands] = useState([]);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  async function loadProducts(keyword = "") {
    const res = await fetch(`/api/products?search=${keyword}`);
    const json = await res.json();

    if (json.success) {
      setProducts(json.data);
    }
  }

  async function loadBrands() {
    const res = await fetch("/api/brands");
    const json = await res.json();

    if (json.success) {
      setBrands(json.data);
    }
  }

  useEffect(() => {
    loadProducts();
    loadBrands();
  }, []);

  async function saveProduct(data) {
    const res = await fetch("/api/products", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    const json = await res.json();

    if (json.success) {
      setOpen(false);
      loadProducts(search);
    } else {
      alert("Failed to save product.");
    }
  }

  async function deleteProduct(id) {
    if (!confirm("Delete this product?")) return;

    const res = await fetch(`/api/products/${id}`, {
      method: "DELETE",
    });

    const json = await res.json();

    if (json.success) {
      loadProducts(search);
    }
  }

  return (
    <div className="p-10">

      <div className="flex justify-between items-center mb-6">

        <div>

          <h1 className="text-3xl font-bold">
            Product Management
          </h1>

          <p className="text-gray-500">
            Manage your product catalog
          </p>

        </div>

        <Button onClick={() => setOpen(true)}>
          + New Product
        </Button>

      </div>

      <input
        className="border rounded-lg p-3 w-full mb-6"
        placeholder="Search SKU or Product..."
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          loadProducts(e.target.value);
        }}
      />

<ProductStats products={products} />
      <ProductTable
        products={products}
        onDelete={deleteProduct}
      />

      <ProductModal
        open={open}
        onClose={() => setOpen(false)}
        brands={brands}
        onSave={saveProduct}
      />

    </div>
  );
}