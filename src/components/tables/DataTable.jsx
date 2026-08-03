export default function DataTable({
  columns,
  children,
}) {
  return (

    <table className="w-full bg-white rounded-xl overflow-hidden shadow">

      <thead className="bg-slate-100">

        <tr>

          {columns.map((column) => (

            <th
              key={column}
              className="text-left p-4"
            >
              {column}
            </th>

          ))}

        </tr>

      </thead>

      <tbody>

        {children}

      </tbody>

    </table>

  );
}