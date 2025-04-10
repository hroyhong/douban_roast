'use client'; // Needed for useState and event handlers

import { useState, FormEvent } from 'react';

// Add Movie interface back, as we will display movies
interface Movie {
  title: string;
  rating: number | 'na';
  comment: string;
  date: string;
}

// Define an interface for the API response
interface ApiResponse {
  movies?: Movie[]; // Add movies back
  roast?: string;
  message?: string;
  error?: string;
}

export default function Home() {
  const [userId, setUserId] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [result, setResult] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setResult(null);
    setError(null);

    if (!userId.trim()) {
        setError('Please enter a Douban User ID.');
        setIsLoading(false);
        return;
    }

    try {
      const response = await fetch('/api/roast', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: userId.trim() }),
      });

      // Expect both movies and potentially roast/message/error
      const data: ApiResponse = await response.json();

      if (!response.ok && !data.movies) { // Only throw hard error if scraping itself failed
        throw new Error(data.error || `API Error: ${response.statusText}`);
      }
      // If response is ok OR if we got movies even with a roast error, set the result
      setResult(data);

    } catch (err: any) {
      console.error('API call failed:', err);
      setError(err.message || 'An unexpected error occurred.');
      setResult(null); // Clear previous results on hard error
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-12 bg-gray-50">
      <div className="w-full max-w-lg bg-white p-8 rounded-lg shadow-md"> {/* Increased max-width */}
        <h1 className="text-2xl font-bold text-center text-gray-800 mb-6">
          豆瓣电影吐槽 🔥
        </h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="userId" className="block text-sm font-medium text-gray-700 mb-1">
              Douban User ID:
            </label>
            <input
              type="text"
              id="userId"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="e.g., ahbei"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Roasting...' : 'Get Roasted'}
          </button>
        </form>

        {/* Display Area */}
        <div className="mt-6 space-y-4"> {/* Add space between elements */}
          {isLoading && (
            <div className="text-center text-gray-600">Loading...</div>
          )}
          {/* General Error Display (for fetch/network errors) */}
          {error && (
            <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              <p className="font-semibold">Error:</p>
              <p>{error}</p>
            </div>
          )}

          {/* Results Display Area */}
          {result && (
            <div className="p-4 bg-gray-50 border border-gray-200 rounded space-y-4">

              {/* Display message (e.g., "No movies found" or "Failed to generate roast") */}
              {result.message && (
                <p className="text-gray-700 italic">{result.message}</p>
              )}

              {/* Display the roast if available (Moved UP) */}
              {result.roast && (
                <div>
                    <h3 className="text-md font-semibold text-gray-700 mb-1">毒舌吐槽:</h3> {/* Changed title */}
                    <p className="text-gray-800 whitespace-pre-wrap bg-white p-3 rounded border border-gray-200">{result.roast}</p>
                </div>
              )}

              {/* Display specific API error if present (e.g., Groq error) */}
              {result.error && !result.roast && ( // Only show if roast isn't already displayed
                <div className="p-3 bg-yellow-100 border border-yellow-400 text-yellow-800 rounded">
                    <p className="font-semibold">API 通知:</p> {/* Changed title */}
                    <p>{result.error}</p>
                </div>
              )}

               {/* Display scraped movies if available (Moved DOWN) */}
               {result.movies && result.movies.length > 0 && (
                 <div>
                     <h3 className="text-md font-semibold text-gray-700 mb-2">抓取的电影 ({result.movies.length}):</h3> {/* Changed title */}
                     <pre className="text-xs text-gray-600 overflow-x-auto bg-white p-2 rounded border border-gray-200 max-h-60">
                         {JSON.stringify(result.movies, null, 2)}
                     </pre>
                 </div>
              )}

            </div>
          )}
        </div>
      </div>
    </main>
  );
}
