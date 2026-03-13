export default function Loading() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-2 border-[#6C63FF] border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-400 text-sm animate-pulse">Loading your briefing…</p>
      </div>
    </div>
  );
}
