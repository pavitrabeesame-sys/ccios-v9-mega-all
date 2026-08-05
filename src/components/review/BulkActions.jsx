"use client";

import { useState } from "react";


export default function BulkActions({
  selected = [],
  refresh
}) {


  const [loading,setLoading] = useState(false);



  async function runAction(url,name){


    if(!selected.length){

      alert("Please select reviews first");

      return;

    }



    try{


      setLoading(true);



      const res = await fetch(
        url,
        {

          method:"POST",

          headers:{
            "Content-Type":"application/json",
          },

          body:JSON.stringify({

            ids:selected

          }),

        }
      );



      const data = await res.json();



      if(!res.ok){

        throw new Error(
          data.error || "Action failed"
        );

      }



      alert(
        `${name} completed successfully`
      );



      refresh?.();



    }

    catch(error){


      alert(error.message);


    }

    finally{


      setLoading(false);


    }


  }





  return (

    <div
      className="
      flex
      gap-3
      mb-6
      flex-wrap
      "
    >




      <button

        disabled={loading}

        onClick={()=>runAction(
          "/api/reviews/generate-all",
          "AI Generate"
        )}

        className="
        bg-purple-600
        hover:bg-purple-700
        disabled:opacity-50
        text-white
        px-4
        py-2
        rounded-lg
        "

      >

        {loading ? "Processing..." : "Generate All AI"}

      </button>






      <button

        disabled={loading}

        onClick={()=>runAction(
          "/api/reviews/analyze-all",
          "Analyze"
        )}

        className="
        bg-indigo-600
        hover:bg-indigo-700
        disabled:opacity-50
        text-white
        px-4
        py-2
        rounded-lg
        "

      >

        Analyze All

      </button>






      <button

        disabled={loading}

        onClick={()=>runAction(
          "/api/reviews/approve-all",
          "Approve"
        )}

        className="
        bg-green-600
        hover:bg-green-700
        disabled:opacity-50
        text-white
        px-4
        py-2
        rounded-lg
        "

      >

        Approve All

      </button>







      {/* SHOPEE BULK REPLY */}

      <button

        disabled={loading}

        onClick={()=>runAction(
          "/api/reviews/reply-all",
          "Reply Shopee"
        )}

        className="
        bg-blue-600
        hover:bg-blue-700
        disabled:opacity-50
        text-white
        px-4
        py-2
        rounded-lg
        "

      >

        Reply Shopee All

      </button>








      <button

        disabled={loading}

        onClick={()=>runAction(
          "/api/reviews/reject-all",
          "Reject"
        )}

        className="
        bg-red-600
        hover:bg-red-700
        disabled:opacity-50
        text-white
        px-4
        py-2
        rounded-lg
        "

      >

        Reject All

      </button>







      <div

        className="
        px-4
        py-2
        bg-gray-100
        rounded-lg
        "

      >

        Selected:
        {" "}
        <b>
          {selected.length}
        </b>

      </div>





    </div>

  );

}