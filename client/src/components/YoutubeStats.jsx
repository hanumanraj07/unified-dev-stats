function YoutubeStats({ stats }) {
  return (
    <div className="panel">
      <h3 className="mb-4 text-lg font-semibold text-white">YouTube Overview</h3>
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-line bg-surface p-3 text-center">
          <p className="text-xs text-slate-400">Subscribers</p>
          <p className="text-lg font-bold text-accentBlue">{stats?.subscribers ?? 0}</p>
        </div>
        <div className="rounded-lg border border-line bg-surface p-3 text-center">
          <p className="text-xs text-slate-400">Views</p>
          <p className="text-lg font-bold text-accentBlue">{stats?.views ?? 0}</p>
        </div>
        <div className="rounded-lg border border-line bg-surface p-3 text-center">
          <p className="text-xs text-slate-400">Videos</p>
          <p className="text-lg font-bold text-accentBlue">{stats?.videos ?? 0}</p>
        </div>
      </div>
      {stats?.channelUrl && (
        <a
          href={stats.channelUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-3 block text-sm text-accentBlue hover:underline"
        >
          View YouTube Channel →
        </a>
      )}
    </div>
  );
}

export default YoutubeStats;
