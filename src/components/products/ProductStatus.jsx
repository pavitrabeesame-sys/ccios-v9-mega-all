export default function ProductStatus({ status }) {

  const color =
    status === "ACTIVE"
      ? "bg-green-600"
      : "bg-gray-500";

  return (
    <span
      className={`px-3 py-1 rounded-full text-white ${color}`}
    >
      {status}
    </span>
  );

}