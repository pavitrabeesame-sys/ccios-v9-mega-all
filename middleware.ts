import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const ALLOWED_USERS: Record<string, string> = {
  'Lucas': 'Beesame@168',
  'Pavitra': 'Pavitra2026!',
};

export function middleware(request: NextRequest) {
  const url = request.nextUrl;

  // Only run auth checks if the path starts with /reviews
  const authHeader = request.headers.get('authorization');

  if (authHeader) {
    const authValue = authHeader.split(' ')[1];
    const decoded = Buffer.from(authValue, 'base64').toString();
    const colonIndex = decoded.indexOf(':');
    
    const user = decoded.substring(0, colonIndex);
    const pwd = decoded.substring(colonIndex + 1);

    if (ALLOWED_USERS[user] && ALLOWED_USERS[user] === pwd) {
      return NextResponse.next();
    }
  }

  return new NextResponse('Access Denied. Authentication Required.', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="CCIOS Secure Reviews Dashboard"',
    },
  });
}

// STRICT MATCHER: This ensures middleware ONLY triggers on the /reviews page 
// and never touches your JavaScript bundles, CSS, or images.
export const config = {
  matcher: ['/reviews/:path*', '/reviews'],
};