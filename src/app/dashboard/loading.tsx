export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header skeleton */}
        <div className="flex items-center justify-between">
          <div className="h-8 w-48 bg-gray-800 rounded-lg animate-pulse" />
          <div className="h-10 w-32 bg-gray-800 rounded-lg animate-pulse" />
        </div>

        {/* Briefing cards skeleton */}
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-5 w-5 bg-gray-800 rounded animate-pulse" />
              <div className="h-5 w-64 bg-gray-800 rounded animate-pulse" />
            </div>
            <div className="space-y-2">
              <div className="h-4 w-full bg-gray-800/60 rounded animate-pulse" />
              <div className="h-4 w-3/4 bg-gray-800/60 rounded animate-pulse" />
              <div className="h-4 w-1/2 bg-gray-800/60 rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
