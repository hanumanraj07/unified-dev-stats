import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import ConfirmDialog from "../components/ConfirmDialog";
import Loader from "../components/Loader";
import { useToast } from "../components/ToastContext";
import { profileApi, sololearnApi, twitterApi, linkedinApi } from "../services/api";

const initialForm = {
  name: "",
  username: "",
  email: "",
  password: "",
  bio: "",
  avatar: "",
  github: "",
  leetcode: "",
  youtube: "",
  linkedinUrl: "",
  linkedinFollowers: "",
  linkedinConnections: "",
  linkedinPosts: "",
  linkedinSkills: "",
  twitterUrl: "",
  twitterFollowers: "",
  twitterFollowing: "",
  twitterPosts: "",
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

function Admin() {
  const [form, setForm] = useState(initialForm);
  const [profiles, setProfiles] = useState([]);
  const [verifiedStats, setVerifiedStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fetchingSololearn, setFetchingSololearn] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [verifyErrors, setVerifyErrors] = useState({});
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const { pushToast } = useToast();

  const loadProfiles = async () => {
    const data = await profileApi.getAll();
    setProfiles(data);
  };

  useEffect(() => {
    const run = async () => {
      try {
        await loadProfiles();
      } catch (error) {
        pushToast(error.response?.data?.message || "Could not load profiles.", "error");
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

  const clearForm = () => {
    setForm(initialForm);
    setVerifiedStats({});
    setVerifyErrors({});
    setEditingId("");
  };

  const onVerify = async () => {
    if (!form.github && !form.leetcode && !form.youtube && !form.sololearnUrl) {
      pushToast("Add at least one URL (GitHub/LeetCode/YouTube/SoloLearn).", "error");
      return;
    }

    setVerifying(true);
    try {
      const result = await profileApi.verify({
        github: form.github,
        leetcode: form.leetcode,
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

      if (form.twitterUrl) {
        try {
          const twResponse = await twitterApi.getStats(form.twitterUrl);
          if (twResponse && twResponse.data) {
            const stats = twResponse.data;
            setForm(prev => ({
              ...prev,
              twitterFollowers: stats.followers || "0",
              twitterFollowing: stats.following || "0",
              twitterPosts: stats.posts || "0"
            }));
            pushToast(`Twitter: ${stats.followers || 0} followers, ${stats.following || 0} following`, "success");
          }
        } catch (twError) {
          console.error("Twitter fetch error:", twError);
        }
      }

      const failures = Object.entries(result.errors || {}).filter(([, message]) => Boolean(message));
      if (failures.length) {
        pushToast(
          `Partial verification. Failed: ${failures.map(([platform]) => platform).join(", ")}`,
          "error"
        );
      } else {
        pushToast(`Profile verified. Computed Dev Score: ${result.devScore}`, "success");
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
    if (!form.name || !form.username) {
      pushToast("Name and username are required.", "error");
      return;
    }

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

      if (form.twitterUrl) {
        try {
          const twResponse = await twitterApi.getStats(form.twitterUrl);
          if (twResponse && twResponse.data) {
            const stats = twResponse.data;
            nextForm.twitterFollowers = stats.followers || "0";
            nextForm.twitterFollowing = stats.following || "0";
            nextForm.twitterPosts = stats.posts || "0";
          }
        } catch (twError) {
          console.error("Twitter fetch error:", twError);
        }
      }

      const payload = {
        name: nextForm.name,
        username: nextForm.username,
        email: nextForm.email,
        password: nextForm.password,
        bio: nextForm.bio,
        avatar: nextForm.avatar,
        github: normalizeGithubInput(nextForm.github),
        leetcode: normalizeLeetcodeInput(nextForm.leetcode),
        youtube: nextForm.youtube,
        linkedin: {
          url: nextForm.linkedinUrl,
          followers: Number(nextForm.linkedinFollowers || 0),
          connections: Number(nextForm.linkedinConnections || 0),
          posts: Number(nextForm.linkedinPosts || 0),
          skills: nextForm.linkedinSkills || ""
        },
        twitter: {
          url: nextForm.twitterUrl,
          followers: Number(nextForm.twitterFollowers || 0),
          following: Number(nextForm.twitterFollowing || 0),
          posts: Number(nextForm.twitterPosts || 0)
        },
        sololearn: {
          url: nextForm.sololearnUrl,
          xp: Number(nextForm.sololearnXp || 0),
          level: Number(nextForm.sololearnLevel || 0),
          streak: Number(nextForm.sololearnStreak || 0),
          badges: Number(nextForm.sololearnBadges || 0)
        },
        stats: nextStats
      };

      if (editingId) {
        await profileApi.update(editingId, payload);
        pushToast("Profile verified and updated.", "success");
      } else {
        await profileApi.create(payload);
        pushToast("Profile verified and saved to MongoDB.", "success");
      }
      await loadProfiles();
      clearForm();
    } catch (error) {
      pushToast(error.response?.data?.message || "Could not save profile.", "error");
    } finally {
      setVerifying(false);
      setSaving(false);
    }
  };

  const onEdit = (profile) => {
    setEditingId(profile._id);
    setVerifiedStats(profile.stats || {});
    setVerifyErrors({});
    setForm({
      name: profile.name || "",
      username: profile.username || "",
      email: profile.email || "",
      password: "",
      bio: profile.bio || "",
      avatar: profile.avatar || "",
      github: formatGithubInput(profile.github),
      leetcode: formatLeetcodeInput(profile.leetcode),
      youtube: formatYoutubeInput(profile.youtube),
      linkedinUrl: profile.linkedin?.url || "",
      linkedinFollowers: String(profile.linkedin?.followers ?? 0),
      linkedinConnections: String(profile.linkedin?.connections ?? 0),
      linkedinPosts: String(profile.linkedin?.posts ?? 0),
      linkedinSkills: profile.linkedin?.skills || "",
      twitterUrl: profile.twitter?.url || "",
      twitterFollowers: String(profile.twitter?.followers ?? 0),
      twitterFollowing: String(profile.twitter?.following ?? 0),
      twitterPosts: String(profile.twitter?.posts ?? 0),
      sololearnUrl: profile.sololearn?.url || "",
      sololearnXp: String(profile.sololearn?.xp ?? 0),
      sololearnLevel: String(profile.sololearn?.level ?? 0),
      sololearnStreak: String(profile.sololearn?.streak ?? 0),
      sololearnBadges: String(profile.sololearn?.badges ?? 0)
    });
    pushToast(`Editing ${profile.name}`);
  };

  const onDelete = async (id) => {
    try {
      await profileApi.remove(id);
      await loadProfiles();
      pushToast("Profile deleted.", "info");
      if (editingId === id) clearForm();
    } catch (error) {
      pushToast(error.response?.data?.message || "Could not delete profile.", "error");
    }
  };

  if (loading) return <Loader label="Loading admin dashboard..." />;

  return (
    <div className="grid gap-6 xl:grid-cols-[1.15fr_1fr]">
      <section className="panel">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">{editingId ? "Edit Developer Profile" : "Add Developer Profile"}</h2>
          {editingId ? (
            <button type="button" className="btn-secondary" onClick={clearForm}>
              Cancel Edit
            </button>
          ) : null}
        </div>

        <form className="space-y-4" onSubmit={onSave}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm text-slate-300">Name</label>
              <input name="name" className="input" value={form.name} onChange={onChange} />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-300">Username</label>
              <input name="username" className="input" value={form.username} onChange={onChange} placeholder="hanuman" />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-300">Email (for student login)</label>
              <input name="email" type="email" className="input" value={form.email} onChange={onChange} />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-300">Password (set on create)</label>
              <input name="password" type="password" className="input" value={form.password} onChange={onChange} />
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
                <label className="mb-1 block text-sm text-slate-300">LinkedIn URL</label>
                <input name="linkedinUrl" className="input" value={form.linkedinUrl} onChange={onChange} />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-300">Twitter URL</label>
                <input name="twitterUrl" className="input" value={form.twitterUrl} onChange={onChange} />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-300">Sololearn URL</label>
                <input name="sololearnUrl" className="input" value={form.sololearnUrl} onChange={onChange} />
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? "Verifying & Saving..." : editingId ? "Verify & Update Profile" : "Verify & Save Profile"}
              </button>
            </div>

            {Object.keys(verifiedStats).length ? (
              <div className="grid gap-3 rounded-xl border border-line bg-surface p-4 sm:grid-cols-3">
                <div className="rounded-lg border border-line p-3">
                  <p className="text-xs text-slate-400">GitHub Repos</p>
                  <p className="font-mono text-lg">{verifiedStats?.github?.publicRepos ?? 0}</p>
                </div>
                <div className="rounded-lg border border-line p-3">
                  <p className="text-xs text-slate-400">LeetCode Solved</p>
                  <p className="font-mono text-lg">{verifiedStats?.leetcode?.totalSolved ?? 0}</p>
                </div>
                <div className="rounded-lg border border-line p-3">
                  <p className="text-xs text-slate-400">YouTube Videos</p>
                  <p className="font-mono text-lg">{verifiedStats?.youtube?.videos ?? 0}</p>
                </div>
              </div>
            ) : null}

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
        <h3 className="text-xl font-bold text-white">Manage Profiles</h3>
        <div className="mt-4 space-y-3">
          {profiles.map((profile) => (
            <article key={profile._id} className="rounded-xl border border-line bg-surface p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-white">{profile.name}</p>
                  <p className="text-xs text-slate-400">
                    @{profile.username} | Score {profile.devScore}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Link to={`/student-dashboard/${profile.username}`} className="btn-secondary px-3 py-1 text-xs">
                    View
                  </Link>
                  <button type="button" className="btn-secondary px-3 py-1 text-xs" onClick={() => onEdit(profile)}>
                    Edit
                  </button>
                  <button type="button" className="rounded-xl border border-red-500/50 px-3 py-1 text-xs text-red-300 hover:bg-red-500/15" onClick={() => setConfirmDeleteId(profile._id)}>
                    Delete
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <ConfirmDialog
        open={!!confirmDeleteId}
        title="Delete Profile"
        message="Are you sure you want to delete this developer profile? This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={() => {
          onDelete(confirmDeleteId);
          setConfirmDeleteId(null);
        }}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  );
}

export default Admin;
