function GithubStats({ stats, username, variant = "both" }) {
  const profileUrl = username ? `https://github.com/${username}` : "https://github.com";
  const showOverview = variant === "both" || variant === "overview";
  const showContribution = variant === "both" || variant === "contribution";
  const contributionPanelClass = showContribution && !showOverview ? "panel h-full" : "panel";

  if (!showOverview && !showContribution) {
    return null;
  }

  return (
    <div className={showOverview && showContribution ? "space-y-4" : ""}>
      {showOverview ? (
        <div className="panel">
          <h3 className="mb-4 text-lg font-semibold text-white">GitHub Overview</h3>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-line bg-surface p-3 text-center">
              <p className="text-xs text-slate-400">Repositories</p>
              <p className="text-lg font-bold text-accentGreen">{stats?.publicRepos ?? 0}</p>
            </div>
            <div className="rounded-lg border border-line bg-surface p-3 text-center">
              <p className="text-xs text-slate-400">Followers</p>
              <p className="text-lg font-bold text-accentGreen">{stats?.followers ?? 0}</p>
            </div>
            <div className="rounded-lg border border-line bg-surface p-3 text-center">
              <p className="text-xs text-slate-400">Following</p>
              <p className="text-lg font-bold text-accentGreen">{stats?.following ?? 0}</p>
            </div>
          </div>
          <a
            href={profileUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-3 block text-sm text-accentGreen hover:underline"
          >
            View GitHub Profile →
          </a>
        </div>
      ) : null}
      {showContribution && stats?.contributionGraph ? (
        <div className={contributionPanelClass}>
          <p className="mb-4 text-lg font-semibold text-white">Contribution Streak Graph</p>
          <img src={stats.contributionGraph} alt="GitHub contribution streak" className="w-full rounded-xl border border-line" />
        </div>
      ) : null}
    </div>
  );
}

export default GithubStats;
