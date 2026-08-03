export default function Button({
  children,
  className = "",
  ...props
}) {
  return (
    <button
      {...props}
      className={`px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition ${className}`}
    >
      {children}
    </button>
  );
}