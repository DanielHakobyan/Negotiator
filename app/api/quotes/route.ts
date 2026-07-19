import { NextResponse } from 'next/server';
import { getQuotes, clearAllQuotes } from '@/lib/quotes';

export async function GET() {
  try {
    const quotes = await getQuotes();
    return NextResponse.json({ success: true, data: quotes });
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to read quotes" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  // Simple DEV-ONLY check
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: "Forbidden in production" }, { status: 403 });
  }

  try {
    await clearAllQuotes();
    return NextResponse.json({ success: true, message: "All quotes cleared." });
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to clear quotes" }, { status: 500 });
  }
}
