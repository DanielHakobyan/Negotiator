import { NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(request: Request) {
  try {
    // 1. Read raw quotes from request body
    const body = await request.json().catch(() => ({}));
    const quotesArray = body.quotes || [];

    if (!quotesArray || quotesArray.length === 0) {
      return NextResponse.json({ error: "No quotes available to analyze" }, { status: 400 });
    }

    // 2. Send to OpenAI
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      return NextResponse.json({ error: "Missing OPENAI_API_KEY" }, { status: 500 });
    }

    const openai = new OpenAI({ apiKey: openaiApiKey });

    const prompt = `You are analyzing competing moving company quotes gathered by phone for the same customer job. Here are the quotes: 
${JSON.stringify(quotesArray, null, 2)}

For each quote, note: total price, itemized fees, any red flags (already marked), and how they compare to each other.

Return JSON with exactly this structure:
{
  "ranked_quotes": [
    { "company_name": "", "total_price": null, "rank": 1, "why_this_rank": "", "conversation_id": "", "call_duration_seconds": 0 }
  ],
  "recommended_company": "",
  "recommended_price": null,
  "recommendation_explanation": "", 
  "warnings": [
    { "company_name": "", "reason": "" }
  ]
}

Ensure "recommendation_explanation" is 2-4 sentences in plain language explaining WHY this is the best deal — cite specific details (e.g., 'lowest total price with no hidden fees, and explicitly confirmed no long-carry charge'). "warnings" should list quotes flagged as suspiciously low or with concerning terms, with a brief reason each. Include the original "conversation_id" in the ranked_quotes array items.`;

    console.log("[Analyze Quotes] Sending payload to OpenAI gpt-4o...");
    
    const openaiRes = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }]
    });

    const rawContent = openaiRes.choices[0].message.content || "{}";
    console.log("[Analyze Quotes] Raw OpenAI Response:");
    console.log(rawContent);

    // 3. Parse JSON safely
    let extractedData = {};
    try {
      const cleanJson = rawContent.replace(/```json/g, '').replace(/```/g, '').trim();
      extractedData = JSON.parse(cleanJson);
      console.log("[Analyze Quotes] Successfully parsed analysis JSON.");
    } catch (parseError) {
      console.error("[Analyze Quotes] JSON Parse Error:", parseError);
      return NextResponse.json({ error: "Failed to parse OpenAI JSON" }, { status: 500 });
    }

    return NextResponse.json({ success: true, analysis: extractedData });

  } catch (error: any) {
    console.error("[Analyze Quotes] Catch-all error:", error);
    return NextResponse.json({ error: "Internal server error", details: error.message }, { status: 500 });
  }
}
