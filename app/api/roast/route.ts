import { NextRequest } from 'next/server';
import axios from 'axios';
import * as cheerio from 'cheerio';
// Import the Groq provider
import { groq } from '@ai-sdk/groq';
// Use StreamingTextResponse and streamText from the base 'ai' package
import { streamText } from 'ai';

// Remove comment referencing OpenAI client
// // Initialize OpenAI client

export const runtime = 'edge'; // Use Edge Runtime for optimal streaming performance

interface Movie {
  title: string;
  rating: number | 'na';
  comment: string;
  date: string;
}

// @ts-expect-error Type definition mismatch for Cheerio generic
function getRatingFromClass(ratingSpan: cheerio.Cheerio<cheerio.Element> | undefined): number | 'na' {
  if (ratingSpan && ratingSpan.length > 0) {
    const ratingClass = ratingSpan.attr('class') || '';
    const match = ratingClass.match(/rating(\d)-t/);
    if (match && match[1]) {
      return parseInt(match[1], 10);
    }
  }
  return 'na';
}

async function scrapeDoubanMovies(userId: string): Promise<Movie[]> {
  const allMoviesData: Movie[] = [];
  let currentPageUrl: string | null = `https://movie.douban.com/people/${userId}/collect`;
  let pageNum = 1;
  const maxPages = 5; // Keep scraping limited

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Cookie': 'bid=5MXXR16aPkQ; ck=O4RR; dbcl2="157082540:GHktgel0Ds8"; ll="118172"',
    // Add Douban cookies here if necessary, especially for private profiles or heavy scraping
    // 'Cookie': 'bid=xxx; dbcl2="USER_ID:xxx"; ck=xxx; ll="118172"; push_noty_num=0; push_doumail_num=0'
  };

  console.log(`Starting scrape for user: ${userId}`);

  while (currentPageUrl && pageNum <= maxPages) {
    console.log(`Scraping page ${pageNum}: ${currentPageUrl}`);
    try {
      const response = await axios.get(currentPageUrl, { headers, timeout: 20000 });
      // @ts-expect-error Type definition mismatch for cheerio.load return type
      const $: cheerio.CheerioAPI = cheerio.load(response.data);

      const movieItems = $('div.item');

      if (movieItems.length === 0) {
        console.log('No more movie items found on this page or profile is private/empty.');
        break;
      }

      movieItems.each((_: number, element: cheerio.Element) => {
        const item = $(element);
        const titleTag = item.find('li.title a');
        const rawTitle = titleTag.text().trim();
        const title = rawTitle.split('/')[0]?.trim() || 'N/A';

        // @ts-expect-error Type definition mismatch for Cheerio generic
        const ratingSpan: cheerio.Cheerio<cheerio.Element> = item.find('span[class^="rating"]');
        const rating = getRatingFromClass(ratingSpan);

        const commentTag = item.find('span.comment');
        const comment = commentTag.text().trim() || '';

        const dateTag = item.find('span.date');
        const date = dateTag.text().trim() || '';

        allMoviesData.push({
          title,
          rating,
          comment,
          date,
        });
      });

      // Find the next page link
      const nextLink = $('div.paginator span.next a');
      if (nextLink.length > 0) {
        const href = nextLink.attr('href');
        if (href) {
             // Explicitly type url and ensure currentPageUrl is string
             if (typeof currentPageUrl === 'string') {
                const url: URL = new URL(href, currentPageUrl);
                currentPageUrl = url.toString();
             } else {
                 // Should not happen if href is found, but good for type safety
                 console.warn('currentPageUrl became null unexpectedly');
                 currentPageUrl = null;
             }
        } else {
            currentPageUrl = null;
        }

      } else {
        currentPageUrl = null; // No next page link found
      }

      pageNum++;
      await new Promise(resolve => setTimeout(resolve, 500)); // Be polite

    } catch (error: unknown) {
        let message = 'Unknown scraping error occurred';
        if (error instanceof Error) message = error.message; // Basic type check
        if (axios.isAxiosError(error)) {
             console.error(`Error fetching page ${currentPageUrl}: ${error.message}`, error.response?.status);
             if (error.response?.status === 404) {
                 throw new Error(`User profile not found (404): ${userId}`);
             }
             if (error.response?.status === 403) {
                throw new Error(`Access denied (403). The profile might be private or requires login.`);
             }
             message = error.message; // Use Axios error message
        } else {
            console.error(`An unexpected error occurred while scraping ${currentPageUrl}:`, error);
        }
        // Throw generic error using derived message
      throw new Error(`Failed to scrape Douban page: ${message}`);
    }
  }

  console.log(`Scraping finished. Found ${allMoviesData.length} movies over ${pageNum - 1} pages.`);
  return allMoviesData;
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json();

    if (!userId || typeof userId !== 'string') {
      return new Response('请输入有效的豆瓣用户 ID', { status: 400 });
    }

    // --- Scraping Phase ---
    console.log(`Received request for user ID: ${userId}`);
    let movies: Movie[];
    try {
        movies = await scrapeDoubanMovies(userId);
    } catch (scrapeError: unknown) {
        const errorMsg = scrapeError instanceof Error ? scrapeError.message : '抓取豆瓣页面时出错';
        console.error("Scraping error:", errorMsg);
        return new Response(errorMsg, { status: 500 }); // Return error if scraping fails
    }

    if (movies.length === 0) {
      return new Response('未找到电影记录或用户主页私密，无法生成吐槽。', { status: 400 }); // Use 400 if no movies found for roast
    }

    // --- AI Roasting Phase (using Groq Streaming) ---
    const movieListString = movies
      .map(m => `- 《${m.title}》(评分: ${m.rating === 'na' ? 'N/A' : m.rating + '/5'}${m.comment ? `, 短评: "${m.comment}"` : ''})`)
      .join('\n');

    const prompt = `你是一位嘴臭老哥。这是豆瓣用户 (${userId}) 看过的电影列表。请用最恶毒的语气，幽默的风格，吐槽一下这位用户的观影品味，可以关注打分以及短评。

用户 ${userId} 看过的电影：
${movieListString}

请开始你的吐槽：`;

    console.log("Streaming prompt to Groq...");

    // Use streamText with the Groq provider
    const result = await streamText({
      // Assumes GROQ_API_KEY is set in environment variables
      model: groq('llama3-8b-8192'), // Use the groq provider
      system: '你是一位风趣、毒舌的影评人，请用中文回答。',
      prompt: prompt,
      maxTokens: 500,
    });

    // Return the response property directly
    return result.response;

  } catch (error: unknown) {
    // General error handling for request processing/JSON parsing issues
    console.error('Error in POST handler:', error);
    const errorMsg = error instanceof Error ? error.message : '处理请求时发生未知错误';
    return new Response(errorMsg, { status: 500 });
  }
} 