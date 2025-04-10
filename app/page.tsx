'use client';

// Remove useState, FormEvent imports if no longer needed directly
// import { useState, FormEvent } from 'react';
import { useChat } from 'ai/react'; // Import useChat

// Remove ApiResponse interface
// interface ApiResponse { ... }
// Remove Movie interface (movie list display is removed for now)
// interface Movie { ... }

export default function Home() {
  // Use the useChat hook
  const { messages, input, handleInputChange, handleSubmit, isLoading, error } = useChat({
    api: '/api/roast', // Point to our API route
    // We need to send the userId in the body
    body: {
        userId: typeof window !== 'undefined' ? (document.getElementById('userId') as HTMLInputElement)?.value : '' // Get value directly on submit
    },
    // Clear messages on submit to show only the new roast
     onFinish: () => {
         // Optionally clear input after successful submission
         //setInput(''); // This might conflict if using controlled input directly
         // Resetting the form might be better if needed
    }
  });

  // We still need a separate state for the input field if we want it controlled
  // Or we can rely on the 'input' state from useChat if we map it directly
  // For simplicity now, let's use an uncontrolled input and get the value on submit via the body object above.

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-12 bg-gray-50">
      <div className="w-full max-w-lg bg-white p-8 rounded-lg shadow-md">
        <h1 className="text-2xl font-bold text-center text-gray-800 mb-6">
          豆瓣电影吐槽 🔥
        </h1>
        {/* Use the handleSubmit from useChat */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="userId" className="block text-sm font-medium text-gray-700 mb-1">
              Douban User ID:
            </label>
            {/* Use a standard uncontrolled input for userId */}
             <input
              type="text"
              id="userId" // ID used by useChat body logic
              name="userId" // Good practice for forms
              // No value or onChange needed here for uncontrolled
              placeholder="e.g., ahbei"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-gray-800"
            />
            {/* Example if using the controlled input from useChat:
            <input
              id="userId" // Still useful for label
              value={input} // Use input state from useChat
              onChange={handleInputChange} // Use handler from useChat
              placeholder="Enter Douban User ID..."
              required
              className="..."
            />
             */}
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Roasting...' : 'Get Roasted'}
          </button>
        </form>

        {/* Display Area - Simplified for streaming */}
        <div className="mt-6 space-y-4">
          {/* Display errors from the useChat hook */}
          {error && (
            <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              <p className="font-semibold">Error:</p>
              <p>{error.message}</p>
            </div>
          )}

          {/* Display the streaming roast */}
          {messages.length > 0 && (
             messages.map(m => (
                m.role === 'assistant' && m.content ? (
                    <div key={m.id} className="p-4 bg-gray-50 border border-gray-200 rounded space-y-2">
                         <h3 className="text-md font-semibold text-gray-700">毒舌吐槽:</h3>
                         <p className="text-gray-800 whitespace-pre-wrap bg-white p-3 rounded border border-gray-200">{m.content}</p>
                    </div>
                ) : null // Only display assistant messages with content
             ))
          )}
           {/* Removed the old static result display section */}
        </div>
      </div>
    </main>
  );
}

