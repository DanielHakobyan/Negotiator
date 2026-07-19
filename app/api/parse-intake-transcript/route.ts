import { NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(request: Request) {
  try {
    const { conversationId } = await request.json();

    if (!conversationId) {
      return NextResponse.json({ error: "No conversationId provided" }, { status: 400 });
    }

    const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
    if (!elevenLabsApiKey) {
      return NextResponse.json({ error: "Missing ELEVENLABS_API_KEY" }, { status: 500 });
    }

    console.log(`[Parse Transcript] Fetching conversation ${conversationId} from ElevenLabs...`);

    // 1. Fetch the conversation transcript from ElevenLabs
    const convRes = await fetch(`https://api.elevenlabs.io/v1/convai/conversations/${conversationId}`, {
      headers: {
        'xi-api-key': elevenLabsApiKey
      }
    });

    if (!convRes.ok) {
      const errData = await convRes.json().catch(() => ({}));
      console.error("[Parse Transcript] Failed to fetch ElevenLabs conversation:", errData);
      return NextResponse.json({ error: "Failed to fetch conversation transcript", details: errData }, { status: convRes.status });
    }

    const convData = await convRes.json();
    console.log("[Parse Transcript] Successfully fetched conversation from ElevenLabs.");

    // Format the transcript
    // The transcript array usually looks like: [{ role: 'agent', message: 'Hello' }, { role: 'user', message: 'Hi' }]
    const transcriptArray = convData.transcript || [];
    const formattedTranscript = transcriptArray.map((t: any) => `${t.role.toUpperCase()}: ${t.message}`).join('\n');
    
    if (!formattedTranscript) {
      return NextResponse.json({ error: "Conversation transcript is empty" }, { status: 400 });
    }

    console.log("[Parse Transcript] Formatted Transcript for OpenAI:");
    console.log(formattedTranscript);

    // 2. Send to OpenAI for extraction
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      return NextResponse.json({ error: "Missing OPENAI_API_KEY" }, { status: 500 });
    }

    console.log("[Parse Transcript] Sending transcript to OpenAI gpt-4o for extraction...");

    const openai = new OpenAI({ apiKey: openaiApiKey });

    const prompt = `You are a data extraction assistant. Read the following conversation transcript between an AI intake agent and a user planning a move. 
Extract the following details from the conversation and return ONLY a valid JSON object matching this exact schema (use empty strings "" if a value is not mentioned):

{
  "customer_name": "extracted name",
  "email": "extracted email",
  "phone": "extracted phone",
  "origin": "extracted origin address/city",
  "destination": "extracted destination address/city",
  "move_date": "extracted move date",
  "home_size": "extracted home size (e.g. Studio, 1BR, 2BR, 3BR, 4BR+)",
  "item_summary": "comma separated list of all inventory/furniture mentioned",
  "special_items": "any special or heavy items like pianos or safes",
  "stairs_info": "information about stairs or elevators"
}

Transcript:
${formattedTranscript}
`;

    const openaiRes = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }]
    });

    const rawContent = openaiRes.choices[0].message.content || "{}";
    console.log("[Parse Transcript] Raw OpenAI Response:");
    console.log(rawContent);

    // 3. Parse JSON safely
    let extractedData = {};
    try {
      const cleanJson = rawContent.replace(/```json/g, '').replace(/```/g, '').trim();
      extractedData = JSON.parse(cleanJson);
      console.log("[Parse Transcript] Successfully parsed JSON:", extractedData);
    } catch (parseError) {
      console.error("[Parse Transcript] JSON Parse Error:", parseError);
      return NextResponse.json({ error: "Failed to parse OpenAI JSON" }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: extractedData });

  } catch (error: any) {
    console.error("[Parse Transcript] Catch-all error:", error);
    return NextResponse.json({ error: "Internal server error", details: error.message }, { status: 500 });
  }
}
