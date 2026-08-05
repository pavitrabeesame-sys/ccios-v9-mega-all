"use client";

import { useState } from "react";


export default function ReplyEditor({
  review,
  refresh
}) {


  const [reply,setReply] = useState(
    review?.aiReply || ""
  );



  async function saveReply(){


    try{


      const res = await fetch(
        "/api/reviews/reply",
        {

          method:"POST",

          headers:{
            "Content-Type":"application/json",
          },

          body:JSON.stringify({

            id:review.id,

            reply

          }),

        }
      );



      const data = await res.json();



      if(!res.ok){

        throw new Error(
          data.error || "Save failed"
        );

      }



      alert("Reply approved");

      refresh?.();



    }catch(error){

      alert(error.message);

    }


  }





  return (

    <div className="
      bg-white
      rounded-xl
      shadow
      p-5
      mt-4
    ">


      <h3 className="
        font-bold
        mb-3
      ">

        AI Reply Editor

      </h3>



      <textarea

        value={reply}

        onChange={(e)=>setReply(e.target.value)}

        className="
        w-full
        border
        rounded-lg
        p-3
        min-h-32
        "

      />



      <button

        onClick={saveReply}

        className="
        mt-3
        bg-green-600
        text-white
        px-5
        py-2
        rounded-lg
        "

      >

        Approve & Save Reply

      </button>



    </div>

  );

}