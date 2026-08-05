"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";


export default function LoginPage() {


  const router = useRouter();


  const [email, setEmail] = useState("");

  const [password, setPassword] = useState("");

  const [error, setError] = useState("");

  const [loading, setLoading] = useState(false);



  async function handleSubmit(e) {

    e.preventDefault();


    setError("");

    setLoading(true);



    const result = await signIn("credentials", {

      email,

      password,

      redirect: false,

    });



    if (result?.error) {


      setError(
        "Invalid email or password"
      );


      setLoading(false);


      return;


    }



    router.push("/dashboard");


  }





  return (


    <div
      className="min-h-screen flex items-center justify-center bg-gray-950"
    >



      <form

        onSubmit={handleSubmit}

        className="w-[380px] bg-gray-900 p-8 rounded-2xl shadow-xl"

      >



        <h1
          className="text-3xl font-bold text-white text-center mb-2"
        >

          CCIOS

        </h1>



        <p
          className="text-gray-400 text-center mb-6"
        >

          Commerce Intelligence OS

        </p>





        {error && (

          <div
            className="bg-red-500/20 text-red-300 p-3 rounded-lg mb-4 text-sm"
          >

            {error}

          </div>

        )}






        <input

          type="email"

          placeholder="Email"

          value={email}

          onChange={(e)=>setEmail(e.target.value)}

          className="w-full p-3 rounded-lg bg-gray-800 text-white border border-gray-700 mb-4"

          required

        />






        <input

          type="password"

          placeholder="Password"

          value={password}

          onChange={(e)=>setPassword(e.target.value)}

          className="w-full p-3 rounded-lg bg-gray-800 text-white border border-gray-700 mb-6"

          required

        />







        <button

          type="submit"

          disabled={loading}

          className="w-full bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-lg font-semibold"

        >


          {loading ? "Logging in..." : "Login"}


        </button>




      </form>


    </div>


  );


}