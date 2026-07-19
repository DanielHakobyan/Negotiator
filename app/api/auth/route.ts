import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { password } = await request.json();
    const correctPassword = process.env.JUDGE_ACCESS_PASSWORD;

    if (!correctPassword) {
      console.error("[Auth] Missing JUDGE_ACCESS_PASSWORD in environment variables");
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    if (password === correctPassword) {
      const response = NextResponse.json({ success: true });
      
      // Set an HTTP-only cookie to authorize the session
      // Expires in 24 hours (86400 seconds)
      response.cookies.set({
        name: 'judge_access',
        value: 'true',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24,
        path: '/',
      });

      return response;
    }

    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });

  } catch (error) {
    return NextResponse.json({ error: "Authentication failed" }, { status: 500 });
  }
}
