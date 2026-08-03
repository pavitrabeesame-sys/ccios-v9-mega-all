export default function Select({
  label,
  children,
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

      <select
        {...props}
        className={`w-full border rounded-lg p-3 ${className}`}
      >
        {children}
      </select>

    </div>
  );
}