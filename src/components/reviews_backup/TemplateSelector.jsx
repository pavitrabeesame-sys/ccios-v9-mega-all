"use client";

export default function TemplateSelector({
  templates = [],
  onSelect,
}) {
  return (
    <select
      className="w-full border rounded-lg p-3"
      onChange={(e) => onSelect(e.target.value)}
      defaultValue=""
    >
      <option value="">Select Template</option>

      {templates.map((template) => (
        <option key={template.id} value={template.template}>
          {template.brand} | {template.rating}★ | {template.title}
        </option>
      ))}
    </select>
  );
}