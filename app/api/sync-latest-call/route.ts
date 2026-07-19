import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
    const agentId = process.env.ELEVENLABS_AGENT_ID;

    if (!elevenLabsApiKey || !agentId) {
      return NextResponse.json({ error: "Missing configuration" }, { status: 500 });
    }

    // 1. Fetch recent conversations for our Negotiation Agent
    const convRes = await fetch(`https://api.elevenlabs.io/v1/convai/conversations?agent_id=${agentId}`, {
      headers: {
        'xi-api-key': elevenLabsApiKey
      }
    });

    if (!convRes.ok) {
      return NextResponse.json({ error: "Failed to fetch conversations from ElevenLabs" }, { status: convRes.status });
    }

    const convData = await convRes.json();
    const conversations = convData.conversations || [];

    if (conversations.length === 0) {
      return NextResponse.json({ error: "No conversations found for this agent" }, { status: 404 });
    }

    // Sort by start_time descending to get the absolute latest call
    conversations.sort((a: any, b: any) => b.start_time_unix_secs - a.start_time_unix_secs);
    const latestConversation = conversations[0];
    const conversationId = latestConversation.conversation_id;

    if (!conversationId) {
      return NextResponse.json({ error: "Latest conversation has no ID" }, { status: 400 });
    }

    // 2. Pass this conversation ID to our ingestor endpoint
    const host = request.headers.get('host');
    const protocol = host?.includes('localhost') ? 'http' : 'https';
    const ingestUrl = `${protocol}://${host}/api/parse-quote-transcript`;

    const ingestRes = await fetch(ingestUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ conversation_id: conversationId })
    });

    const ingestData = await ingestRes.json();

    if (!ingestRes.ok) {
      return NextResponse.json({ error: "Failed to parse and save quote", details: ingestData }, { status: ingestRes.status });
    }

    return NextResponse.json({ 
      success: true, 
      message: "Successfully synced latest call", 
      quote: ingestData.quote 
    });

  } catch (error: any) {
    console.error("[Sync Call] Error:", error);
    return NextResponse.json({ error: "Internal server error", details: error.message }, { status: 500 });
  }
}
