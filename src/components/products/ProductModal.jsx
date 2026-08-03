"use client";

import Modal from "../ui/Modal";
import ProductForm from "./ProductForm";

export default function ProductModal({
  open,
  onClose,
  brands,
  onSave,
}) {
  return (
    <Modal
      open={open}
      title="New Product"
      onClose={onClose}
    >
      <ProductForm
        brands={brands}
        onSave={onSave}
      />
    </Modal>
  );
}