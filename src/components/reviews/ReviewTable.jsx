export default function ReviewTable({ reviews = [], onAction }) {
  return (
    <div className="overflow-x-auto bg-white rounded-lg shadow">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Marketplace</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Brand</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product Name & SKU</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rating</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Review & AI Reply</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {(!reviews || reviews.length === 0) ? (
            <tr>
              <td colSpan="8" className="px-6 py-8 text-center text-sm text-gray-500">
                No reviews found.
              </td>
            </tr>
          ) : (
            reviews.map((review) => (
              <tr key={review.id || review.reviewId} className="align-top">
                {/* Customer */}
                <td className="px-4 py-4 text-sm font-medium text-gray-900 whitespace-nowrap">
                  {review.customerName || '—'}
                </td>

                {/* Marketplace */}
                <td className="px-4 py-4 whitespace-nowrap">
                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                    {review.marketplace || 'SHOPEE'}
                  </span>
                </td>

                {/* Brand */}
                <td className="px-4 py-4 text-sm font-semibold text-gray-900 whitespace-nowrap">
                  {review.brand || '—'}
                </td>

                {/* Product Name & SKU */}
                <td className="px-4 py-4 text-sm max-w-xs">
                  <div className="font-medium text-gray-900">{review.productName || '—'}</div>
                  <div className="text-xs text-gray-400 mt-1">SKU: {review.productSku || '—'}</div>
                </td>

                {/* Rating */}
                <td className="px-4 py-4 whitespace-nowrap text-sm text-yellow-500">
                  {'★'.repeat(review.rating || 5)}{'☆'.repeat(5 - (review.rating || 5))}
                </td>

                {/* Review Text & AI Reply */}
                <td className="px-4 py-4 text-sm text-gray-900 max-w-sm">
                  <div className="text-gray-700">{review.reviewText || "No review text"}</div>
                  {review.aiReply && (
                    <div className="mt-2 p-2.5 bg-green-50 border border-green-200 rounded text-xs text-green-900">
                      <span className="font-semibold block mb-0.5">AI Reply:</span> 
                      <p>{review.aiReply}</p>
                    </div>
                  )}
                </td>

                {/* Status */}
                <td className="px-4 py-4 whitespace-nowrap">
                  <span className="px-2.5 py-1 inline-flex text-xs leading-4 font-semibold rounded-full bg-gray-100 text-gray-800">
                    {review.status || 'GENERATED'}
                  </span>
                </td>

                {/* Action Buttons */}
                <td className="px-4 py-4 text-right whitespace-nowrap">
                  <div className="flex flex-col gap-1.5 w-28 ml-auto">
                    <button onClick={() => onAction?.('generate', review.id)} className="w-full px-2 py-1 bg-purple-600 text-white rounded text-xs hover:bg-purple-700 transition">AI Generate</button>
                    <button onClick={() => onAction?.('analyze', review.id)} className="w-full px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 transition">Analyze</button>
                    <button onClick={() => onAction?.('approve', review.id)} className="w-full px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 transition">Approve</button>
                    <button onClick={() => onAction?.('reject', review.id)} className="w-full px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700 transition">Reject</button>
                    <button onClick={() => onAction?.('reply', review.id)} className="w-full px-2 py-1 bg-indigo-600 text-white rounded text-xs hover:bg-indigo-700 transition">Reply Shopee</button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}