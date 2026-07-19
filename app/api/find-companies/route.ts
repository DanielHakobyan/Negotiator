import { NextResponse } from 'next/server';

// In-memory cache for session. Key: location (lowercase), Value: mapped companies array
// In Next.js dev, this might reset on hot reloads, but survives standard client navigation.
const cache = new Map<string, any[]>();

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const location = searchParams.get('location');
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;

    if (!location) {
      return NextResponse.json({ error: "Missing location parameter" }, { status: 400 });
    }
    
    if (!apiKey) {
      console.error("[Google Places] Missing GOOGLE_PLACES_API_KEY environment variable");
      return NextResponse.json({ error: "Server configuration error. Missing GOOGLE_PLACES_API_KEY." }, { status: 500 });
    }
    console.log('[Env Check] GOOGLE_PLACES_API_KEY exists:', !!apiKey, apiKey ? `(Starts with ${apiKey.substring(0, 4)}...)` : '');

    const normalizedLocation = location.toLowerCase().trim();

    if (cache.has(normalizedLocation)) {
      console.log(`[Google Places] Cache hit for "${normalizedLocation}"`);
      return NextResponse.json({ success: true, companies: cache.get(normalizedLocation) });
    }

    console.log(`[Google Places] Fetching text search (NEW API) for moving companies in "${normalizedLocation}"...`);
    
    const textSearchUrl = `https://places.googleapis.com/v1/places:searchText`;
    const textSearchRes = await fetch(textSearchUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.nationalPhoneNumber,places.id'
      },
      body: JSON.stringify({
        textQuery: `moving companies in ${location}`
      })
    });

    const textSearchData = await textSearchRes.json();

    // Log the raw response for the very first test
    console.log("[Google Places] Raw Response Data:", JSON.stringify(textSearchData, null, 2));

    if (!textSearchRes.ok) {
      console.error("[Google Places] Text search error. FULL Response:", JSON.stringify(textSearchData, null, 2));
      return NextResponse.json({ error: "Google Places API error", details: textSearchData }, { status: textSearchRes.status });
    }

    const places = textSearchData.places || [];
    console.log(`[Google Places] Found ${places.length} initial results. Filtering for phone numbers...`);

    const topPlaces = places.slice(0, 10);
    const finalCompanies = [];

    for (const place of topPlaces) {
      if (place.nationalPhoneNumber) {
        let rawPhone = place.nationalPhoneNumber;
        let cleanPhone = rawPhone.replace(/[^\d+]/g, '');
        if (!cleanPhone.startsWith('+')) {
          // Assume US country code +1 if it has 10 digits
          if (cleanPhone.length === 10) {
            cleanPhone = '+1' + cleanPhone;
          } else if (cleanPhone.length === 11 && cleanPhone.startsWith('1')) {
            cleanPhone = '+' + cleanPhone;
          }
        }

        finalCompanies.push({
          name: place.displayName?.text || "Unknown Company",
          phone: cleanPhone,
          displayPhone: rawPhone,
          rating: place.rating || null,
          review_count: place.userRatingCount || 0,
          address: place.formattedAddress,
          place_id: place.id
        });
      }
    }

    console.log(`[Google Places] Retained ${finalCompanies.length} companies with valid phone numbers.`);

    cache.set(normalizedLocation, finalCompanies);

    return NextResponse.json({ success: true, companies: finalCompanies });

  } catch (error: any) {
    console.error("[Google Places] Unexpected error:", error);
    return NextResponse.json({ error: "Internal server error", details: error.message }, { status: 500 });
  }
}
