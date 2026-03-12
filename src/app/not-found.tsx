import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center">
      <div className="text-6xl mb-4">📰</div>
      <h1 className="text-4xl font-bold mb-2">404</h1>
      <p className="text-xl text-gray-400 mb-6">
        This page didn&apos;t make the morning edition.
      </p>
      <Link
        href="/"
        className="px-6 py-3 bg-[#6C63FF] hover:bg-[#5a52d5] text-white rounded-lg font-medium transition-colors"
      >
        Back to Briefing
      </Link>
    </div>
  );
}
