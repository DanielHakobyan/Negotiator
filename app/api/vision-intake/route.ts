import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import fs from 'fs/promises';
import path from 'path';

export async function POST(request: Request) {
  try {
    const { frames } = await request.json();

    if (!frames || !Array.isArray(frames) || frames.length === 0) {
      return NextResponse.json({ error: "No frames provided" }, { status: 400 });
    }

    console.log(`[Vision API] Received ${frames.length} frames for analysis.`);

    // 1 & 2. DEBUG MODE: Save extracted frames to local disk and log sizes
    const debugDir = path.join(process.cwd(), 'tmp', 'debug-frames');
    await fs.mkdir(debugDir, { recursive: true });

    for (let i = 0; i < frames.length; i++) {
      const base64Data = frames[i].replace(/^data:image\/jpeg;base64,/, "");
      const buffer = Buffer.from(base64Data, 'base64');
      const filePath = path.join(debugDir, `frame_${i}.jpg`);
      await fs.writeFile(filePath, buffer);
      console.log(`[Vision API] Saved debug frame: ${filePath} (Size: ${(buffer.length / 1024).toFixed(2)} KB)`);
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error("[Vision API] OPENAI_API_KEY is missing in environment variables.");
      return NextResponse.json({ error: "OpenAI API key missing" }, { status: 500 });
    }

    const openai = new OpenAI({ apiKey });

    // Build the content array for OpenAI
    const contentPayload: any[] = [
      {
        type: "text",
        text: "You are analyzing frames from a video walkthrough of someone's home before a move. Identify every distinct piece of furniture, major appliance, and notable item visible across these frames. Do not double-count the same item if it appears in multiple frames. Return ONLY a JSON array of item names, e.g. [\"sofa\", \"queen bed\", \"refrigerator\", \"dining table\", \"4 dining chairs\", \"bookshelf\"]. Be specific about quantities where visible (e.g. '4 dining chairs' not 'chairs' four times)."
      }
    ];

    for (const frame of frames) {
      contentPayload.push({
        type: "image_url",
        image_url: {
          url: frame,
          detail: "low" // saves tokens and processing time for basic item identification
        }
      });
    }

    // 3. Log the FULL raw request payload structure
    console.log("[Vision API] OpenAI Request Payload Structure:");
    const debugPayload = contentPayload.map(c => 
      c.type === 'image_url' 
        ? { type: 'image_url', url_preview: c.image_url.url.substring(0, 50) + '...' }
        : c
    );
    console.log(JSON.stringify(debugPayload, null, 2));

    // Call OpenAI
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: contentPayload
        }
      ],
      max_tokens: 500,
    });

    // 4. Log the FULL raw response
    const rawContent = response.choices[0].message.content || "";
    console.log("[Vision API] FULL Raw Response from OpenAI:");
    console.log(rawContent);

    // 5. Parse the JSON array securely
    let extractedItems = [];
    try {
      // Strip markdown backticks if present
      const cleanJson = rawContent.replace(/```json/g, '').replace(/```/g, '').trim();
      extractedItems = JSON.parse(cleanJson);
      if (!Array.isArray(extractedItems)) {
        throw new Error("Parsed JSON is not an array");
      }
      console.log("[Vision API] Successfully parsed items:", extractedItems);
    } catch (parseError) {
      console.error("[Vision API] Failed to parse OpenAI JSON response:", parseError);
      return NextResponse.json({ error: "Failed to parse item list from AI response" }, { status: 500 });
    }

    // 6. Return the extracted list
    return NextResponse.json({ 
      success: true, 
      items: extractedItems
    });
    
  } catch (error: any) {
    console.error("[Vision API] Catch-all error:", error.response?.data || error.message);
    // 8. Return explicit error, NO SILENT FALLBACKS
    return NextResponse.json({ error: `Vision extraction failed: ${error.message}` }, { status: 500 });
  }
}
