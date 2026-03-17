import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { FaGithub, FaYoutube } from "react-icons/fa";
import { SiLeetcode, SiSololearn } from "react-icons/si";
import GithubStats from "../components/GithubStats";
import LeetcodeStats from "../components/LeetcodeStats";
import Loader from "../components/Loader";
import ProfileCard from "../components/ProfileCard";
import StatCard from "../components/StatCard";
import { useToast } from "../components/ToastContext";
import YoutubeStats from "../components/YoutubeStats";
import { profileApi } from "../services/api";

function StudentPublicDashboard() {
  const { username } = useParams();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const { pushToast } = useToast();

  const ensureUrl = (value, fallback) => {
    if (!value) return fallback;
    if (value.startsWith("http://") || value.startsWith("https://")) return value;
    return `https://${value}`;
  };

  useEffect(() => {
    const run = async () => {
      try {
        const data = await profileApi.getPublicProfile(username);
        setProfile(data);
      } catch (error) {
        pushToast(error.response?.data?.message || "Could not load student profile.", "error");
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [username, pushToast]);

  const scoreBreakdown = useMemo(() => {
    const repos = profile?.stats?.github?.publicRepos ?? 0;
    const solved = profile?.stats?.leetcode?.totalSolved ?? 0;
    const videos = profile?.stats?.youtube?.videos ?? 0;
    return {
      repos,
      solved,
      videos,
      total: repos * 2 + solved * 3 + videos
    };
  }, [profile]);

  const youtubeUrl = (() => {
    const channel = profile?.youtube?.trim();
    if (!channel) return "https://www.youtube.com";
    if (channel.startsWith("http://") || channel.startsWith("https://")) return channel;
    if (channel.startsWith("@")) return `https://www.youtube.com/${channel}`;
    if (channel.startsWith("UC")) return `https://www.youtube.com/channel/${channel}`;
    return `https://www.youtube.com/@${channel}`;
  })();

  const platformLinks = [
    {
      label: "GitHub",
      href: profile?.github ? `https://github.com/${profile.github}` : "https://github.com",
      Icon: FaGithub,
      accent: "hover:border-accentGreen/80 hover:text-accentGreen"
    },
    {
      label: "LeetCode",
      href: profile?.leetcode ? `https://leetcode.com/${profile.leetcode}` : "https://leetcode.com",
      Icon: SiLeetcode,
      accent: "hover:border-accentOrange/80 hover:text-accentOrange"
    },
    {
      label: "YouTube",
      href: youtubeUrl,
      Icon: FaYoutube,
      accent: "hover:border-accentBlue/80 hover:text-accentBlue"
    },
    {
      label: "Sololearn",
      href: ensureUrl(profile?.sololearn?.url, "https://www.sololearn.com"),
      Icon: SiSololearn,
      accent: "hover:border-accentGreen/80 hover:text-accentGreen"
    }
  ];

  if (loading) return <Loader label="Loading student profile dashboard..." />;

  if (!profile) {
    return (
      <div className="panel text-center">
        <p className="text-slate-300">Student profile not found.</p>
        <Link to="/leaderboard" className="btn-secondary mt-3 inline-flex">
          Back to Leaderboard
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="panel flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-white">{profile.name}&apos;s Profile Dashboard</h2>
          <p className="text-sm text-slate-400">Unified platform details for @{profile.username}.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-xl border border-accentGreen/60 bg-accentGreen/15 px-3 py-2 font-mono text-sm text-accentGreen">
            Dev Score: {profile.devScore ?? scoreBreakdown.total}
          </span>
          <Link to="/leaderboard" className="btn-secondary">
            Back to Leaderboard
          </Link>
        </div>
      </section>

      <ProfileCard profile={profile} />

      <section className="panel">
        <h3 className="text-xl font-semibold text-white">Developer Score Formula</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-line bg-surface p-3 font-mono text-sm">
            GitHub Repos: {scoreBreakdown.repos} x 2
          </div>
          <div className="rounded-xl border border-line bg-surface p-3 font-mono text-sm">
            LeetCode Solved: {scoreBreakdown.solved} x 3
          </div>
          <div className="rounded-xl border border-line bg-surface p-3 font-mono text-sm">
            YouTube Videos: {scoreBreakdown.videos} x 1
          </div>
          <div className="rounded-xl border border-accentGreen/70 bg-accentGreen/15 p-3 font-mono text-sm text-accentGreen">
            Total Dev Score: {scoreBreakdown.total}
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="GitHub Repos" value={profile?.stats?.github?.publicRepos ?? 0} tone="green" />
        <StatCard title="LeetCode Solved" value={profile?.stats?.leetcode?.totalSolved ?? 0} tone="orange" />
        <StatCard title="YouTube Subscribers" value={profile?.stats?.youtube?.subscribers ?? 0} tone="blue" />
        <StatCard title="Sololearn Certificates" value={profile?.sololearn?.badges ?? 0} tone="green" />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="space-y-4">
          <LeetcodeStats stats={profile?.stats?.leetcode} username={profile?.leetcode} variant="overview" />
          <div className="panel">
            <h3 className="mb-4 text-lg font-semibold text-white">Sololearn Overview</h3>
            <div className="grid grid-cols-4 gap-3">
              <div className="mini-card">
                <p className="mini-label">XP</p>
                <p className="mini-value text-accentGreen">{profile?.sololearn?.xp ?? 0}</p>
              </div>
              <div className="mini-card">
                <p className="mini-label">Level</p>
                <p className="mini-value text-accentGreen">{profile?.sololearn?.level ?? 0}</p>
              </div>
              <div className="mini-card">
                <p className="mini-label">Certs</p>
                <p className="mini-value text-accentGreen">{profile?.sololearn?.badges ?? 0}</p>
              </div>
              <div className="mini-card">
                <p className="mini-label">Streak</p>
                <p className="mini-value text-accentGreen">{profile?.sololearn?.streak ?? 0}</p>
              </div>
            </div>
            {profile?.sololearn?.url && (
              <a
                href={ensureUrl(profile?.sololearn?.url, "https://www.sololearn.com")}
                target="_blank"
                rel="noreferrer"
                className="panel-link text-accentGreen hover:underline"
              >
                View SoloLearn Profile ->
              </a>
            )}
          </div>
        </div>
        <div className="space-y-4">
          <GithubStats stats={profile?.stats?.github} username={profile?.github} variant="overview" />
          <YoutubeStats stats={profile?.stats?.youtube} />
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2 items-stretch">
        <LeetcodeStats stats={profile?.stats?.leetcode} username={profile?.leetcode} variant="breakdown" />
        <GithubStats stats={profile?.stats?.github} username={profile?.github} variant="contribution" />
      </section>

      <section className="panel">
        <h3 className="text-xl font-bold text-white">Quick Platform Links</h3>
        <p className="mt-1 text-sm text-slate-400">Click any icon to open this student&apos;s platform profile.</p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {platformLinks.map(({ label, href, Icon, accent }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noreferrer"
              className={`flex flex-col items-center gap-2 rounded-2xl border border-line bg-surface p-3 text-slate-200 transition ${accent}`}
            >
              <Icon className="text-2xl" />
              <span className="text-xs font-semibold">{label}</span>
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}

export default StudentPublicDashboard;
