# Douban Roast 🔥

A simple Next.js application that scrapes a Douban user's watched movie list and uses Groq AI to generate a witty roast based on their taste.

## Features

*   Scrapes movie titles, ratings, and comments from a Douban user's `/collect` page.
*   Uses Groq API (Llama 3 8B model) to generate a roast.
*   Simple UI to input Douban user ID and display results.

## Setup

1.  Clone the repository.
2.  Install dependencies: `npm install` or `pnpm install` or `yarn install`
3.  Create a `.env.local` file in the project root.
4.  Add your Groq API key to `.env.local`:
    ```
    GROQ_API_KEY=your_groq_key_here
    ```
5.  Run the development server: `npm run dev` or `pnpm dev` or `yarn dev`
6.  Open [http://localhost:3000](http://localhost:3000) in your browser.

## How it Works

1.  The frontend (`app/page.tsx`) takes a Douban user ID.
2.  It sends a POST request to the backend API route (`app/api/roast/route.ts`).
3.  The backend uses `axios` and `cheerio` to scrape the user's movie collection page (`https://movie.douban.com/people/{userId}/collect`).
4.  The scraped movie list is formatted into a prompt.
5.  The prompt is sent to the Groq API (`https://api.groq.com/openai/v1/chat/completions`).
6.  The AI's response (the roast) and the scraped movie list are sent back to the frontend.
7.  The frontend displays the roast and the movie list.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
