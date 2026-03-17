function YoutubeStats({ stats }) {
  return (
    <div className="panel">
      <h3 className="mb-4 text-lg font-semibold text-white">YouTube Overview</h3>
      <div className="grid grid-cols-3 gap-3">
        <div className="mini-card">
          <p className="mini-label">Subscribers</p>
          <p className="mini-value text-accentBlue">{stats?.subscribers ?? 0}</p>
        </div>
        <div className="mini-card">
          <p className="mini-label">Views</p>
          <p className="mini-value text-accentBlue">{stats?.views ?? 0}</p>
        </div>
        <div className="mini-card">
          <p className="mini-label">Videos</p>
          <p className="mini-value text-accentBlue">{stats?.videos ?? 0}</p>
        </div>
      </div>
      {stats?.channelUrl && (
        <a
          href={stats.channelUrl}
          target="_blank"
          rel="noreferrer"
          className="panel-link text-accentBlue hover:underline"
        >
          View YouTube Channel -&gt;
        </a>
      )}
    </div>
  );
}

export default YoutubeStats;
