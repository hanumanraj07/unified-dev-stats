import { useEffect, useState } from "react";
import Loader from "../components/Loader";
import ProfileCard from "../components/ProfileCard";
import { useToast } from "../components/ToastContext";
import { profileApi, sololearnApi } from "../services/api";

const initialForm = {
  name: "",
  username: "",
  bio: "",
  avatar: "",
  github: "",
  leetcode: "",
  youtube: "",
  sololearnUrl: "",
  sololearnXp: "",
  sololearnLevel: "",
  sololearnStreak: "",
  sololearnBadges: ""
};

const formatGithubInput = (value) => {
  if (!value) return "";
  const trimmed = String(value).trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://github.com/${trimmed.replace(/^@/, "")}`;
};

const formatLeetcodeInput = (value) => {
  if (!value) return "";
  const trimmed = String(value).trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://leetcode.com/${trimmed.replace(/^@/, "")}`;
};

const formatYoutubeInput = (value) => {
  if (!value) return "";
  const trimmed = String(value).trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("@")) return `https://www.youtube.com/${trimmed}`;
  if (trimmed.startsWith("UC")) return `https://www.youtube.com/channel/${trimmed}`;
  return `https://www.youtube.com/@${trimmed}`;
};

const normalizeGithubInput = (value) => {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  const lower = trimmed.toLowerCase();
  if (lower.includes("github.com")) {
    const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    try {
      const url = new URL(withScheme);
      const parts = url.pathname.split("/").filter(Boolean);
      return parts[0] || "";
    } catch {
      return trimmed;
    }
  }
  return trimmed.replace(/^@/, "");
};

const normalizeLeetcodeInput = (value) => {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  const lower = trimmed.toLowerCase();
  if (lower.includes("leetcode.com")) {
    const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    try {
      const url = new URL(withScheme);
      const parts = url.pathname.split("/").filter(Boolean);
      if (!parts.length) return "";
      if (["u", "profile", "users"].includes(parts[0])) {
        return parts[1] || "";
      }
      return parts[0] || "";
    } catch {
      return trimmed;
    }
  }
  return trimmed.replace(/^@/, "");
};

function Student() {
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [verifiedStats, setVerifiedStats] = useState({});
  const [verifyErrors, setVerifyErrors] = useState({});
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [fetchingSololearn, setFetchingSololearn] = useState(false);
  const { pushToast } = useToast();

  const hydrateForm = (data) => {
    setForm({
      name: data?.name || "",
      username: data?.username || "",
      bio: data?.bio || "",
      avatar: data?.avatar || "",
      github: formatGithubInput(data?.github),
      leetcode: formatLeetcodeInput(data?.leetcode),
      youtube: formatYoutubeInput(data?.youtube),
      sololearnUrl: data?.sololearn?.url || "",
      sololearnXp: String(data?.sololearn?.xp ?? 0),
      sololearnLevel: String(data?.sololearn?.level ?? 0),
      sololearnStreak: String(data?.sololearn?.streak ?? 0),
      sololearnBadges: String(data?.sololearn?.badges ?? 0)
    });
  };

  const loadData = async () => {
    const [me, leaders] = await Promise.all([profileApi.getMe(), profileApi.leaderboard()]);
    setProfile(me);
    setVerifiedStats(me.stats || {});
    hydrateForm(me);
    setLeaderboard(leaders);
  };

  useEffect(() => {
    const run = async () => {
      try {
        await loadData();
      } catch (error) {
        pushToast(error.response?.data?.message || "Could not load student data.", "error");
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [pushToast]);

  const onChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const onVerify = async () => {
    if (!form.github && !form.leetcode && !form.youtube && !form.sololearnUrl) {
      pushToast("Add at least one platform URL (GitHub/LeetCode/YouTube/SoloLearn).", "error");
      return;
    }

    setVerifying(true);
    try {
      const result = await profileApi.verify({
        github: normalizeGithubInput(form.github),
        leetcode: normalizeLeetcodeInput(form.leetcode),
        youtube: form.youtube
      });
      setVerifiedStats(result.stats || {});
      setVerifyErrors(result.errors || {});
      if (result.stats?.github?.avatar) {
        setForm((prev) => ({ ...prev, avatar: result.stats.github.avatar }));
      }
      if (!form.bio && result.stats?.github?.bio) {
        setForm((prev) => ({ ...prev, bio: result.stats.github.bio }));
      }

      if (form.sololearnUrl) {
        try {
          const slResponse = await sololearnApi.getStats(form.sololearnUrl);
          if (slResponse && slResponse.data) {
            const stats = slResponse.data;
            setForm(prev => ({
              ...prev,
              sololearnXp: stats.xp || "0",
              sololearnLevel: stats.level || "0",
              sololearnStreak: stats.streak || "0",
              sololearnBadges: stats.certificates || "0"
            }));
            pushToast(`SoloLearn: ${stats.xp || 0} XP, Lvl ${stats.level || 0}, ${stats.certificates || 0} certs`, "success");
          }
        } catch (slError) {
          console.error("SoloLearn fetch error:", slError);
        }
      }

      const failures = Object.entries(result.errors || {}).filter(([, value]) => Boolean(value));
      if (failures.length) {
        pushToast(`Partial verify failed for: ${failures.map(([k]) => k).join(", ")}`, "error");
      } else {
        pushToast("All platform stats verified.", "success");
      }
    } catch (error) {
      pushToast(error.response?.data?.message || "Verification failed.", "error");
    } finally {
      setVerifying(false);
    }
  };

  const onFetchSololearn = async () => {
    if (!form.sololearnUrl) {
      pushToast("Please enter a Sololearn profile URL first.", "error");
      return;
    }

    setFetchingSololearn(true);
    try {
      const response = await sololearnApi.getStats(form.sololearnUrl);
      if (response && response.data) {
        const stats = response.data;
        setForm(prev => ({
          ...prev,
          sololearnXp: stats.xp || prev.sololearnXp,
          sololearnBadges: stats.certificates || stats.badges || prev.sololearnBadges
        }));
        pushToast(`Sololearn stats fetched: ${stats.xp || 0} XP`, "success");
      } else if (response && response.success === false) {
        pushToast(response.message || "Failed to fetch Sololearn data", "error");
      }
    } catch (error) {
      pushToast(error.response?.data?.message || "Failed to fetch Sololearn data.", "error");
    } finally {
      setFetchingSololearn(false);
    }
  };

  const onSave = async (event) => {
    event.preventDefault();
    
    if (!form.github && !form.leetcode && !form.youtube && !form.sololearnUrl) {
      pushToast("Add at least one platform URL (GitHub/LeetCode/YouTube/SoloLearn).", "error");
      return;
    }

    setVerifying(true);
    setSaving(true);
    try {
      const result = await profileApi.verify({
        github: normalizeGithubInput(form.github),
        leetcode: normalizeLeetcodeInput(form.leetcode),
        youtube: form.youtube
      });
      const nextStats = result.stats || {};
      setVerifiedStats(nextStats);
      setVerifyErrors(result.errors || {});
      const nextForm = { ...form };
      if (nextStats?.github?.avatar) {
        nextForm.avatar = nextStats.github.avatar;
      }
      if (!nextForm.bio && nextStats?.github?.bio) {
        nextForm.bio = nextStats.github.bio;
      }

      if (form.sololearnUrl) {
        try {
          const slResponse = await sololearnApi.getStats(form.sololearnUrl);
          if (slResponse && slResponse.data) {
            const stats = slResponse.data;
            nextForm.sololearnXp = stats.xp || "0";
            nextForm.sololearnLevel = stats.level || "0";
            nextForm.sololearnStreak = stats.streak || "0";
            nextForm.sololearnBadges = stats.certificates || "0";
          }
        } catch (slError) {
          console.error("SoloLearn fetch error:", slError);
        }
      }

      const payload = {
        name: nextForm.name,
        username: nextForm.username,
        bio: nextForm.bio,
        avatar: nextForm.avatar,
        github: normalizeGithubInput(nextForm.github),
        leetcode: normalizeLeetcodeInput(nextForm.leetcode),
        youtube: nextForm.youtube,
        sololearn: {
          url: nextForm.sololearnUrl,
          xp: Number(nextForm.sololearnXp || 0),
          level: Number(nextForm.sololearnLevel || 0),
          streak: Number(nextForm.sololearnStreak || 0),
          badges: Number(nextForm.sololearnBadges || 0)
        },
        stats: nextStats
      };

      const updated = await profileApi.updateMe(payload);
      setProfile(updated);
      setVerifiedStats(updated.stats || {});
      hydrateForm(updated);
      pushToast("Profile verified and saved successfully!", "success");
      const leaders = await profileApi.leaderboard();
      setLeaderboard(leaders);
    } catch (error) {
      pushToast(error.response?.data?.message || "Could not save profile.", "error");
    } finally {
      setVerifying(false);
      setSaving(false);
    }
  };

  if (loading) return <Loader label="Loading student dashboard..." />;

  return (
    <div className="space-y-6">
      <ProfileCard profile={profile} />

      <section className="panel">
        <h2 className="text-xl font-bold text-white">Student Profile Route</h2>
        <p className="mt-1 text-sm text-slate-400">
          Add/edit your details for GitHub, LeetCode, YouTube, and Sololearn.
        </p>

        <form className="mt-5 space-y-4" onSubmit={onSave}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm text-slate-300">Name</label>
              <input name="name" className="input" value={form.name} onChange={onChange} />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-300">Username</label>
              <input name="username" className="input" value={form.username} onChange={onChange} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm text-slate-300">GitHub URL</label>
              <input name="github" className="input" value={form.github} onChange={onChange} />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-300">LeetCode URL</label>
              <input name="leetcode" className="input" value={form.leetcode} onChange={onChange} />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-300">YouTube URL</label>
              <input name="youtube" className="input" value={form.youtube} onChange={onChange} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm text-slate-300">Sololearn URL</label>
              <input name="sololearnUrl" className="input" value={form.sololearnUrl} onChange={onChange} />
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Verifying & Saving..." : "Verify & Save Profile"}
            </button>
          </div>

          {Object.keys(verifyErrors).length ? (
            <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
              {Object.entries(verifyErrors)
                .filter(([, message]) => Boolean(message))
                .map(([platform, message]) => (
                  <p key={platform}>
                    {platform}: {message}
                  </p>
                ))}
            </div>
          ) : null}
        </form>
      </section>

      <section className="panel">
        <h3 className="text-xl font-bold text-white">Leaderboard</h3>
        <p className="mt-1 text-sm text-slate-400">Students can always view leaderboard from this route.</p>
        <div className="mt-4 overflow-hidden rounded-xl border border-line">
          <table className="min-w-full divide-y divide-line text-left text-sm">
            <thead className="bg-surface">
              <tr>
                <th className="px-4 py-3">Rank</th>
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {leaderboard.slice(0, 10).map((entry, index) => (
                <tr key={entry._id}>
                  <td className="px-4 py-3 font-mono text-accentBlue">#{index + 1}</td>
                  <td className="px-4 py-3">{entry.name}</td>
                  <td className="px-4 py-3 font-mono text-accentGreen">{entry.devScore}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default Student;
