import CredentialsProviderImport from "next-auth/providers/credentials";
const CredentialsProvider = CredentialsProviderImport.default || CredentialsProviderImport;
import { PrismaClient } from "@prisma/client";
import { verifyPassword } from "./password";

const prisma = new PrismaClient();

export const authOptions = {
  secret: process.env.NEXTAUTH_SECRET,

  session: {
    strategy: "jwt",
  },

  providers: [
    CredentialsProvider({
      name: "Credentials",

      credentials: {
        email: {
          label: "Email",
          type: "email",
        },

        password: {
          label: "Password",
          type: "password",
        },
      },

      async authorize(credentials) {
        try {
          console.log("=================================");
          console.log("NEXTAUTH LOGIN ATTEMPT");
          console.log("Email:", credentials?.email);
          console.log("=================================");

          if (!credentials?.email || !credentials?.password) {
            console.log("Missing email or password");
            return null;
          }

          const user = await prisma.user.findUnique({
            where: {
              email: credentials.email,
            },
          });

          console.log("User exists:", !!user);

          if (!user) {
            console.log("User not found");
            return null;
          }

          console.log("Checking password...");

          const valid = await verifyPassword(
            credentials.password,
            user.password
          );

          console.log("Password valid:", valid);

          if (!valid) {
            console.log("Invalid password");
            return null;
          }

          console.log("Login SUCCESS");

          return {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
          };

        } catch (err) {
          console.error("AUTHORIZE ERROR");
          console.error(err);
          throw err;
        }
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      try {
        if (user) {
          token.id = user.id;
          token.role = user.role;
        }

        return token;
      } catch (err) {
        console.error("JWT CALLBACK ERROR");
        console.error(err);
        throw err;
      }
    },

    async session({ session, token }) {
      try {
        if (session.user) {
          session.user.id = token.id;
          session.user.role = token.role || "STAFF";
        }

        return session;
      } catch (err) {
        console.error("SESSION CALLBACK ERROR");
        console.error(err);
        throw err;
      }
    },
  },

  pages: {
    signIn: "/login",
  },

  debug: true,
};