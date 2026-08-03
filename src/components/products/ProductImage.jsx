export default function ProductImage({ image }) {
  if (!image) {

    return (
      <div className="w-20 h-20 bg-gray-200 rounded-lg flex items-center justify-center">
        No Image
      </div>
    );

  }

  return (
    <img
      src={image}
      alt=""
      className="w-20 h-20 rounded-lg object-cover"
    />
  );
}