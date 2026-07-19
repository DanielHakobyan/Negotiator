import fs from 'fs/promises';
import path from 'path';

export type QuoteData = {
  id: string;
  company_name: string;
  total_price: number | null;
  fees: { name: string; amount: number }[];
  red_flags: string[];
  conversation_id: string;
  call_duration_seconds: number;
  created_at: string;
};

const QUOTES_FILE = path.join(process.cwd(), 'data', 'quotes.json');

export async function getQuotes(): Promise<QuoteData[]> {
  try {
    const data = await fs.readFile(QUOTES_FILE, 'utf-8');
    const rawQuotes: QuoteData[] = JSON.parse(data);
    
    // VALIDATION: Filter out mock or invalid quotes
    const validQuotes = rawQuotes.filter(q => {
      if (!q.conversation_id || q.conversation_id.trim() === '') {
        console.warn(`[QuoteStorage] Excluded quote ${q.id} (${q.company_name}) due to missing conversation_id`);
        return false;
      }
      if (q.conversation_id.startsWith('demo_')) {
        console.warn(`[QuoteStorage] Excluded quote ${q.id} (${q.company_name}) due to mock demo_ conversation_id`);
        return false;
      }
      return true;
    });

    return validQuotes;
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return [];
    }
    console.error("[QuoteStorage] Failed to read quotes file:", error);
    return [];
  }
}

export async function saveQuote(quote: QuoteData): Promise<void> {
  const currentQuotes = await getQuotes();
  currentQuotes.push(quote);
  
  await fs.mkdir(path.dirname(QUOTES_FILE), { recursive: true });
  await fs.writeFile(QUOTES_FILE, JSON.stringify(currentQuotes, null, 2));
}

export async function clearAllQuotes(): Promise<void> {
  await fs.mkdir(path.dirname(QUOTES_FILE), { recursive: true });
  await fs.writeFile(QUOTES_FILE, JSON.stringify([], null, 2));
}
