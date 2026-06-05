import { NextResponse } from 'next/server';
import { cookieName } from '@/lib/auth';

export async function POST(request: Request) {
  const response = NextResponse.redirect(new URL('/login', request.url));
  response.cookies.delete(cookieName);
  return response;
}
