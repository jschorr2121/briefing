"use client";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center">
      <div className="text-6xl mb-4">⚡</div>
      <h1 className="text-3xl font-bold mb-2">Something went wrong</h1>
      <p className="text-lg text-gray-400 mb-6">
        We hit a snag loading this page.
      </p>
      <button
        onClick={reset}
        className="px-6 py-3 bg-[#6C63FF] hover:bg-[#5a52d5] text-white rounded-lg font-medium transition-colors"
      >
        Try again
      </button>
    </div>
  );
}
