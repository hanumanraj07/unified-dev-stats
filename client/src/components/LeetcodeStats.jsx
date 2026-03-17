import StatCard from "./StatCard";

function LeetcodeStats({ stats, username, variant = "both" }) {
  const profileUrl = username ? `https://leetcode.com/${username}` : "https://leetcode.com";
  const todaySolved = stats?.todaySolved ?? stats?.todaySolvedCount ?? 0;
  const showOverview = variant === "both" || variant === "overview";
  const showBreakdown = variant === "both" || variant === "breakdown";
  const breakdownPanelClass = showBreakdown && !showOverview ? "panel h-full" : "panel";

  if (!showOverview && !showBreakdown) {
    return null;
  }

  return (
    <div className={showOverview && showBreakdown ? "space-y-4" : ""}>
      {showOverview ? (
        <div className="panel">
          <h3 className="mb-4 text-lg font-semibold text-white">LeetCode Overview</h3>
          <div className="grid grid-cols-3 gap-3">
            <div className="mini-card">
              <p className="mini-label">Total Solved</p>
              <p className="mini-value text-accentOrange">{stats?.totalSolved ?? 0}</p>
            </div>
            <div className="mini-card">
              <p className="mini-label">Today Solved</p>
              <p className="mini-value text-accentOrange">{todaySolved}</p>
            </div>
            <div className="mini-card">
              <p className="mini-label">Rank</p>
              <p className="mini-value text-accentOrange">{stats?.ranking ?? 0}</p>
            </div>
          </div>
          <a
            href={profileUrl}
            target="_blank"
            rel="noreferrer"
            className="panel-link text-accentOrange hover:underline"
          >
            View LeetCode Profile ->
          </a>
        </div>
      ) : null}

      {showBreakdown ? (
        <div className={breakdownPanelClass}>
          <h3 className="mb-4 text-lg font-semibold text-white">LeetCode Breakdown</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <StatCard
              title="LeetCode Solved"
              value={stats?.totalSolved ?? 0}
              subValue={`@${username || "leetcode-user"}`}
              tone="orange"
            />
            <StatCard
              title="LeetCode Ranking"
              value={stats?.ranking ?? 0}
              subValue="Global ranking"
              tone="orange"
            />
            <StatCard title="Easy Solved" value={stats?.easySolved ?? 0} tone="orange" />
            <StatCard
              title="Medium / Hard Solved"
              value={`${stats?.mediumSolved ?? 0} / ${stats?.hardSolved ?? 0}`}
              tone="orange"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default LeetcodeStats;
