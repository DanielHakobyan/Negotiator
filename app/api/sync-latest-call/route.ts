import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import crypto from 'crypto';

export async function POST(request: Request) {
  try {
    const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
    const agentId = process.env.ELEVENLABS_AGENT_ID;
    const openaiApiKey = process.env.OPENAI_API_KEY;

    if (!elevenLabsApiKey || !agentId || !openaiApiKey) {
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

    // 2. Fetch full conversation transcript directly
    console.log(`[Parse Quote] Target conversation ID: ${conversationId}`);

    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    
    let transcriptData: any = null;
    let transcriptArray: any[] = [];
    let formattedTranscript = "";
    let callDurationSecs = 0;

    // Initial wait before first fetch
    await sleep(2000);

    for (let attempt = 1; attempt <= 3; attempt++) {
      console.log(`[Parse Quote] Fetching transcript from ElevenLabs (Attempt ${attempt}/3)`);
      const transcriptRes = await fetch(`https://api.elevenlabs.io/v1/convai/conversations/${conversationId}`, {
        headers: { 'xi-api-key': elevenLabsApiKey }
      });

      if (!transcriptRes.ok) {
        if (attempt === 3) {
          return NextResponse.json({ error: "Failed to fetch real transcript from ElevenLabs" }, { status: transcriptRes.status });
        }
        await sleep(3000);
        continue;
      }

      transcriptData = await transcriptRes.json();
      console.log(`[Parse Quote] Raw ElevenLabs Response (Attempt ${attempt}):\n${JSON.stringify(transcriptData, null, 2)}`);

      transcriptArray = transcriptData.transcript || [];
      formattedTranscript = transcriptArray.map((t: any) => `${t.role.toUpperCase()}: ${t.message}`).join('\n');
      callDurationSecs = transcriptData.metadata?.call_duration_secs || 0;
      
      const status = transcriptData.status || transcriptData.conversation_status || 'unknown';

      if (!formattedTranscript || (status !== 'done' && status !== 'completed')) {
        if (attempt < 3) {
          console.log(`[Parse Quote] Transcript empty or status is '${status}'. Waiting 3s to retry...`);
          await sleep(3000);
          continue;
        } else {
          console.log(`[Parse Quote] Exhausted retries. Final status: ${status}.`);
          return NextResponse.json({ error: "Call transcript still processing — try syncing again in a moment" }, { status: 409 });
        }
      }
      
      // Found valid completed transcript
      break;
    }

    console.log(`[Parse Quote] Extracted transcript length: ${formattedTranscript.length} characters.`);

    // 3. Extract with OpenAI
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

    // 4. Assemble Quote Object
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

    return NextResponse.json({ 
      success: true, 
      message: "Successfully synced latest call", 
      quote: newQuote 
    });

  } catch (error: any) {
    console.error("[Sync Call] Error:", error);
    return NextResponse.json({ error: "Internal server error", details: error.message }, { status: 500 });
  }
}
