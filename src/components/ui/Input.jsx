export default function Input({
  label,
  className = "",
  ...props
}) {
  return (
    <div className="space-y-1">
      {label && (
        <label className="text-sm font-medium">
          {label}
        </label>
      )}

      <input
        {...props}
        className={`w-full border rounded-lg p-3 outline-none focus:ring-2 focus:ring-blue-500 ${className}`}
      />
    </div>
  );
}