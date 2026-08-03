"use client";

import { useState } from "react";
import Input from "../ui/Input";
import Select from "../ui/Select";
import Button from "../ui/Button";

export default function ProductForm({ brands, onSave }) {
  const [form, setForm] = useState({
    sku: "",
    barcode: "",
    name: "",
    description: "",
    price: "",
    stock: "",
    category: "",
    status: "ACTIVE",
    image: "",
    brandId: "",
  });

  function handleChange(e) {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  }

  async function submit(e) {
    e.preventDefault();

    await onSave(form);

    setForm({
      sku: "",
      barcode: "",
      name: "",
      description: "",
      price: "",
      stock: "",
      category: "",
      status: "ACTIVE",
      image: "",
      brandId: "",
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">

      <Input label="SKU" name="sku" value={form.sku} onChange={handleChange} />
      <Input label="Barcode" name="barcode" value={form.barcode} onChange={handleChange} />
      <Input label="Product Name" name="name" value={form.name} onChange={handleChange} />
      <Input label="Description" name="description" value={form.description} onChange={handleChange} />

      <Input type="number" label="Price" name="price" value={form.price} onChange={handleChange} />
      <Input type="number" label="Stock" name="stock" value={form.stock} onChange={handleChange} />

      <Input
        label="Image URL"
        name="image"
        value={form.image}
        onChange={handleChange}
      />

      <Input
        label="Category"
        name="category"
        value={form.category}
        onChange={handleChange}
      />

      <Select
        label="Status"
        name="status"
        value={form.status}
        onChange={handleChange}
      >
        <option value="ACTIVE">ACTIVE</option>
        <option value="DRAFT">DRAFT</option>
      </Select>

      <Select
        label="Brand"
        name="brandId"
        value={form.brandId}
        onChange={handleChange}
      >
        <option value="">Select Brand</option>

        {brands.map((brand) => (
          <option key={brand.id} value={brand.id}>
            {brand.name}
          </option>
        ))}

      </Select>

      <Button type="submit">
        Save Product
      </Button>

    </form>
  );
}