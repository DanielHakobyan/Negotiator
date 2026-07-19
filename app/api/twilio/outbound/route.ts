import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    const agentId = process.env.ELEVENLABS_AGENT_ID;
    const agentPhoneNumberId = process.env.ELEVENLABS_AGENT_PHONE_NUMBER_ID;
    const myCellPhoneNumber = process.env.MY_CELL_PHONE_NUMBER;

    if (!apiKey || !agentId || !agentPhoneNumberId || !myCellPhoneNumber) {
      console.error('[ElevenLabs Outbound] Missing required credentials in .env.local');
      return NextResponse.json({ error: "Missing configuration" }, { status: 500 });
    }

    console.log('[Env Check] ELEVENLABS_API_KEY exists:', !!apiKey);
    console.log('[Env Check] ELEVENLABS_AGENT_ID:', agentId);
    console.log('[Env Check] ELEVENLABS_AGENT_PHONE_NUMBER_ID:', agentPhoneNumberId);
    console.log(`[ElevenLabs] Initiating call to ${myCellPhoneNumber}...`);

    // Use intake data from the request body
    const requestBody = await request.json().catch(() => ({}));
    
    // Explicit phone number passed from the UI call list, falling back to .env
    const targetPhoneNumber = requestBody.to_number || myCellPhoneNumber;

    const dynamicVariables = Object.keys(requestBody).length > 0 ? requestBody : {
      customer_name: "Test Customer",
      origin: "Unknown",
      destination: "Unknown",
      distance_miles: "0",
      move_date: "TBD",
      home_size: "1BR",
      item_summary: "No items listed",
      special_items: "None",
      stairs_info: "None",
      best_quote_so_far: ""
    };
    console.log('[ElevenLabs Outbound] Injecting dynamic variables:', JSON.stringify(dynamicVariables, null, 2));

    const response = await fetch('https://api.elevenlabs.io/v1/convai/twilio/outbound-call', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': apiKey
      },
      body: JSON.stringify({
        agent_id: agentId,
        agent_phone_number_id: agentPhoneNumberId,
        to_number: targetPhoneNumber,
        conversation_initiation_client_data: {
          dynamic_variables: dynamicVariables
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[ElevenLabs Outbound] Failed to initiate call. Status:', response.status);
      console.error('[ElevenLabs Outbound] Response Body:', JSON.stringify(data, null, 2));
      return NextResponse.json({ error: "Failed to initiate call via ElevenLabs", details: data }, { status: response.status });
    }

    console.log('[ElevenLabs Outbound] Call Initiated Successfully:', data);

    return NextResponse.json({ success: true, message: "Outbound call initiated", callData: data });
  } catch (error: any) {
    console.error('[ElevenLabs Outbound] Exception failed to initiate call:', error.message);
    return NextResponse.json({ error: "Failed to initiate call", details: error.message }, { status: 500 });
  }
}
