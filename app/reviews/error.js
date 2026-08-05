// app/reviews/error.js

"use client";

export default function Error({

  error,

  reset,

}) {

  return (

    <div className="p-10">

      <h1 className="text-3xl font-bold text-red-600">

        Something went wrong

      </h1>

      <p className="mt-3">

        {error.message}

      </p>

      <button

        onClick={reset}

        className="mt-5 bg-blue-600 text-white px-5 py-2 rounded"

      >

        Retry

      </button>

    </div>

  );

}