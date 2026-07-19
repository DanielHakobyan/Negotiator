import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { saveQuote } from '@/lib/quotes';
import crypto from 'crypto';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const conversationId = body.conversation_id;

    // Strict validation
    if (!conversationId || typeof conversationId !== 'string' || conversationId.trim() === '') {
      return NextResponse.json({ error: "Missing conversation_id" }, { status: 400 });
    }
    if (conversationId.startsWith('demo_')) {
      return NextResponse.json({ error: "Cannot ingest mock/demo conversation IDs" }, { status: 400 });
    }

    const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
    const openaiApiKey = process.env.OPENAI_API_KEY;

    if (!elevenLabsApiKey || !openaiApiKey) {
      return NextResponse.json({ error: "Missing API keys" }, { status: 500 });
    }

    // 1. Fetch from ElevenLabs
    const convRes = await fetch(`https://api.elevenlabs.io/v1/convai/conversations/${conversationId}`, {
      headers: {
        'xi-api-key': elevenLabsApiKey
      }
    });

    if (!convRes.ok) {
      return NextResponse.json({ error: "Failed to fetch real transcript from ElevenLabs" }, { status: convRes.status });
    }

    const convData = await convRes.json();
    const transcriptArray = convData.transcript || [];
    const formattedTranscript = transcriptArray.map((t: any) => `${t.role.toUpperCase()}: ${t.message}`).join('\n');
    const callDurationSecs = convData.metadata?.call_duration_secs || 0;

    if (!formattedTranscript) {
      return NextResponse.json({ error: "Transcript is empty" }, { status: 400 });
    }

    // 2. Extract with OpenAI
    const openai = new OpenAI({ apiKey: openaiApiKey });

    const prompt = `You are a data extraction assistant. The following is a raw transcript of a phone conversation between an AI negotiating agent and a moving company representative.
Extract the details of the moving quote they discussed.

Transcript:
${formattedTranscript}

Return JSON with exactly this structure:
{
  "company_name": "", // Name of the moving company (infer if not stated)
  "total_price": null, // Number (null if not provided)
  "fees": [
    { "name": "", "amount": 0 }
  ],
  "red_flags": [] // Array of strings (e.g. refused flat rate, extremely low estimate, deposit required)
}`;

    const openaiRes = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }]
    });

    const rawContent = openaiRes.choices[0].message.content || "{}";
    const cleanJson = rawContent.replace(/```json/g, '').replace(/```/g, '').trim();
    const extractedData = JSON.parse(cleanJson);

    // 3. Save Quote
    const newQuote = {
      id: crypto.randomUUID(),
      company_name: extractedData.company_name || "Unknown Company",
      total_price: extractedData.total_price || null,
      fees: extractedData.fees || [],
      red_flags: extractedData.red_flags || [],
      conversation_id: conversationId,
      call_duration_seconds: callDurationSecs,
      created_at: new Date().toISOString()
    };

    await saveQuote(newQuote);

    return NextResponse.json({ success: true, quote: newQuote });

  } catch (error: any) {
    console.error("[Parse Quote] Error:", error);
    return NextResponse.json({ error: "Internal server error", details: error.message }, { status: 500 });
  }
}
