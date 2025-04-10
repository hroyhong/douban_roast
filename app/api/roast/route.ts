import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import * as cheerio from 'cheerio';

interface Movie {
  title: string;
  rating: number | 'na';
  comment: string;
  date: string;
}

// @ts-expect-error
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
  const maxPages = 5; // Limit scraping to avoid long requests/potential blocks

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
      // @ts-expect-error
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

        // @ts-expect-error
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

// Updated function to call Groq
async function getRoastFromGroq(movies: Movie[], userId: string): Promise<string> {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
        console.error("GROQ_API_KEY environment variable not set.");
        throw new Error("Groq API key is not configured.");
    }

    // Format the movie list (remains the same logic)
    const movieListString = movies
        .map(m => `- 《${m.title}》(评分: ${m.rating === 'na' ? 'N/A' : m.rating + '/5'}${m.comment ? `, 短评: "${m.comment}"` : ''})`)
        .join('\n');

    // Chinese Prompt
    const prompt = `你是一位嘴臭老哥。这是豆瓣用户 (${userId}) 看过的电影列表。请用最恶毒的语气，幽默的风格，吐槽一下这位用户的观影品味，可以关注打分以及短评。

用户 ${userId} 看过的电影：
${movieListString}

请开始你的吐槽：`;

    console.log("Sending prompt to Groq (Chinese)...");

    try {
        const response = await axios.post(
            "https://api.groq.com/openai/v1/chat/completions",
            {
                model: "meta-llama/llama-4-scout-17b-16e-instruct", // Or another model supporting Chinese well
                messages: [
                    // Updated system message slightly
                    { role: "system", content: "你是一位风趣、毒舌的影评人，请用中文回答。" },
                    { role: "user", content: prompt }
                ],
                max_tokens: 400, // Allow slightly more tokens for Chinese
                temperature: 0.8,
            },
            {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                timeout: 25000 // Slightly longer timeout just in case
            }
        );

        const roast = response.data?.choices?.[0]?.message?.content?.trim();

        if (!roast) {
            console.error("Failed to get roast from Groq response:", response.data);
            throw new Error("无法生成吐槽内容。AI响应为空或无效。"); // Chinese error
        }

        console.log("Roast received from Groq.");
        return roast;

    } catch (error: unknown) {
        console.error("Error calling Groq API:");
        let errorMsg = "Failed to get roast from AI."; // Default message
        if (axios.isAxiosError(error)) {
            console.error("Status:", error.response?.status);
            console.error("Data:", error.response?.data);
            const errorDetail = error.response?.data?.error?.message || error.response?.data?.detail || error.message;
            errorMsg = `Groq API 错误: ${errorDetail}`;
        } else if (error instanceof Error) {
            console.error(error);
            errorMsg = `调用 AI 生成吐槽失败: ${error.message}`;
        } else {
             console.error("Unknown error type:", error)
             errorMsg = "调用 AI 时发生未知错误";
        }
         throw new Error(errorMsg);
    }
}

export async function POST(req: NextRequest) {
  let movies: Movie[] = [];
  try {
    const body = await req.json();
    const { userId } = body;

    if (!userId || typeof userId !== 'string') {
      return NextResponse.json({ error: '请输入有效的豆瓣用户 ID', movies: [] }, { status: 400 }); // Chinese error
    }

    console.log(`Received request for user ID: ${userId}`);
    movies = await scrapeDoubanMovies(userId);

    if (movies.length === 0) {
        return NextResponse.json({ message: '未找到电影记录或用户主页私密，无法生成吐槽。', movies: [] }, { status: 200 }); // Chinese error
    }

    try {
        const roast = await getRoastFromGroq(movies, userId);
        return NextResponse.json({ movies: movies, roast: roast }, { status: 200 });
    } catch (roastError: unknown) {
         console.error('Failed to get roast:', roastError);
         let roastErrorMessage = "生成吐槽时出错"; // Default
         if (roastError instanceof Error) {
            roastErrorMessage = roastError.message;
         }
         return NextResponse.json({
            movies: movies,
            message: "成功抓取电影列表，但" + roastErrorMessage, // Combine message
            error: roastErrorMessage // Also include specific error if needed
         }, { status: 200 });
    }

  } catch (error: unknown) {
    console.error('Error in /api/roast:', error);
    const errorMsg = error instanceof Error ? error.message : '未知错误'; // Chinese error
    const statusCode = errorMsg.includes('404') || errorMsg.includes('403') ? 400 : 500;

    return NextResponse.json({ error: errorMsg, movies: [] }, { status: statusCode });
  }
} 