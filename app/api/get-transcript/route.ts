import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get('conversationId');

    if (!conversationId) {
      return NextResponse.json({ error: "No conversationId provided" }, { status: 400 });
    }

    if (conversationId.startsWith('demo_')) {
      return NextResponse.json({ error: "Invalid conversation ID" }, { status: 400 });
    }

    const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
    if (!elevenLabsApiKey) {
      return NextResponse.json({ error: "Missing ELEVENLABS_API_KEY" }, { status: 500 });
    }

    // Fetch real transcript
    const convRes = await fetch(`https://api.elevenlabs.io/v1/convai/conversations/${conversationId}`, {
      headers: {
        'xi-api-key': elevenLabsApiKey
      }
    });

    if (!convRes.ok) {
      return NextResponse.json({ error: "Failed to fetch transcript from ElevenLabs" }, { status: convRes.status });
    }

    const convData = await convRes.json();
    const transcriptArray = convData.transcript || [];

    if (!transcriptArray || transcriptArray.length === 0) {
      return NextResponse.json({ error: "Transcript is empty" }, { status: 404 });
    }

    return NextResponse.json({ success: true, transcript: transcriptArray });

  } catch (error: any) {
    return NextResponse.json({ error: "Internal server error", details: error.message }, { status: 500 });
  }
}
