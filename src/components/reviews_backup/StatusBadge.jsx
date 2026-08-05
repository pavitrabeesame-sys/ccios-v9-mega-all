export default function StatusBadge({ status }) {

  const colors = {
    PENDING: "bg-yellow-100 text-yellow-700",
    GENERATED: "bg-purple-100 text-purple-700",
    APPROVED: "bg-blue-100 text-blue-700",
    REJECTED: "bg-red-100 text-red-700",
    REPLIED: "bg-green-100 text-green-700",
  };

  return (
    <span
      className={`px-3 py-1 rounded-full text-xs font-semibold ${
        colors[status] || "bg-gray-100 text-gray-700"
      }`}
    >
      {status}
    </span>
  );

}