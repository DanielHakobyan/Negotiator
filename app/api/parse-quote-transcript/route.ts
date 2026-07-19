import { NextResponse } from 'next/server';
import OpenAI from 'openai';
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
    console.log(`[Parse Quote] Fetching transcript from ElevenLabs for conv: ${conversationId}`);
    const convRes = await fetch(`https://api.elevenlabs.io/v1/convai/conversations/${conversationId}`, {
      headers: {
        'xi-api-key': elevenLabsApiKey
      }
    });

    console.log(`[Parse Quote] ElevenLabs fetch complete. Status: ${convRes.status}`);

    if (!convRes.ok) {
      return NextResponse.json({ error: "Failed to fetch real transcript from ElevenLabs" }, { status: convRes.status });
    }

    const convData = await convRes.json();
    const transcriptArray = convData.transcript || [];
    const formattedTranscript = transcriptArray.map((t: any) => `${t.role.toUpperCase()}: ${t.message}`).join('\n');
    const callDurationSecs = convData.metadata?.call_duration_secs || 0;

    if (!formattedTranscript) {
      console.log(`[Parse Quote] Transcript is empty or null.`);
      return NextResponse.json({ error: "Transcript is empty" }, { status: 400 });
    }

    console.log(`[Parse Quote] Extracted transcript length: ${formattedTranscript.length} characters.`);

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

    console.log(`[Parse Quote] Sending prompt to OpenAI:`, prompt);

    const openaiRes = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }]
    });

    const rawContent = openaiRes.choices[0].message.content || "{}";
    console.log(`[Parse Quote] Raw OpenAI Response:`, rawContent);
    
    let extractedData;
    try {
      const cleanJson = rawContent.replace(/```json/g, '').replace(/```/g, '').trim();
      extractedData = JSON.parse(cleanJson);
      console.log(`[Parse Quote] Successfully parsed JSON:`, extractedData);
    } catch (parseErr: any) {
      console.error(`[Parse Quote] JSON Parse Error:`, parseErr.message, `Raw Content was:`, rawContent);
      return NextResponse.json({ error: "Failed to parse OpenAI JSON", details: parseErr.message }, { status: 500 });
    }

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

    return NextResponse.json({ success: true, quote: newQuote });

  } catch (error: any) {
    console.error("[Parse Quote] Error:", error);
    return NextResponse.json({ error: "Internal server error", details: error.message }, { status: 500 });
  }
}
