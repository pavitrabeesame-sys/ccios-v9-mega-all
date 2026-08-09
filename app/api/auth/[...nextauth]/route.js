import NextAuthImport from "next-auth";
const NextAuth = NextAuthImport.default || NextAuthImport;
import { authOptions } from "../../../../src/lib/auth/authOptions";

export const dynamic = "force-dynamic";

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };