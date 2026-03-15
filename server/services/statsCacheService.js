const User = require("../models/User");
const { getGithub } = require("./githubService");
const { getLeetcode } = require("./leetcodeService");
const { getYoutube } = require("./youtubeService");
const getTwitterStats = require("./twitterScraper");
const getSololearnStats = require("./sololearnScraper");

const safeNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const computeDevScore = (stats) => {
  const githubRepos = safeNumber(stats?.github?.publicRepos);
  const leetcodeSolved = safeNumber(stats?.leetcode?.totalSolved);
  const youtubeVideos = safeNumber(stats?.youtube?.videos);
  const sololearnCerts = safeNumber(stats?.sololearn?.badges);
  return githubRepos * 2 + leetcodeSolved * 3 + youtubeVideos + sololearnCerts;
};

async function fetchPlatformStats(platforms) {
  const { github, leetcode, youtube } = platforms;

  const entries = [
    ["github", github ? getGithub(github) : Promise.resolve(null)],
    ["leetcode", leetcode ? getLeetcode(leetcode) : Promise.resolve(null)],
    ["youtube", youtube ? getYoutube(youtube) : Promise.resolve(null)]
  ];

  const settled = await Promise.allSettled(entries.map(([, promise]) => promise));
  const stats = {};
  const errors = {};

  settled.forEach((result, index) => {
    const key = entries[index][0];
    if (result.status === "fulfilled" && result.value) {
      stats[key] = { ...result.value, lastSynced: new Date() };
      return;
    }
    errors[key] = result.reason?.message || `Failed to fetch ${key} data`;
    stats[key] = { lastSynced: new Date() };
  });

  return { stats, errors };
}

async function fetchAndCacheStats(userId, platforms, options = {}) {
  const { saveToDb = true } = options;

  const { stats, errors } = await fetchPlatformStats(platforms);

  if (!saveToDb) {
    return { stats, errors };
  }

  const devScore = computeDevScore(stats);
  const lastFetchedAt = new Date();

  await User.findByIdAndUpdate(userId, {
    stats,
    lastFetchedAt,
    devScore,
    avatar: stats.github?.avatar || undefined
  });

  return { stats, errors, devScore, lastFetchedAt };
}

async function refreshAllProfiles() {
  const students = await User.find({ role: "student" }).select(
    "username github leetcode youtube linked twitter sololearn"
  );

  let successCount = 0;
  let errorCount = 0;
  const errors = [];

  for (const student of students) {
    try {
      const platforms = {
        github: student.github,
        leetcode: student.leetcode,
        youtube: student.youtube,
        linkedin: student.linkedin,
        twitter: student.twitter,
        sololearn: student.sololearn
      };

      const hasPlatforms = Object.values(platforms).some(
        (v) => v && (typeof v === "string" ? v : Object.values(v).some((vv) => vv))
      );

      if (!hasPlatforms) {
        continue;
      }

      await fetchAndCacheStats(student._id, platforms);
      successCount++;
    } catch (err) {
      errorCount++;
      errors.push({ username: student.username, error: err.message });
    }
  }

  console.log(`[StatsCache] Refresh completed. Success: ${successCount}, Errors: ${errorCount}`);
  return { successCount, errorCount, errors };
}

async function checkRedList() {
  const students = await User.find({ role: "student" });
  const threshold = 5;
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  for (const student of students) {
    const lastCheck = student.lastScoreCheckAt;
    const hasEnoughTime = !lastCheck || lastCheck < twentyFourHoursAgo;

    if (hasEnoughTime) {
      const scoreDiff = student.devScore - student.previousDevScore;
      const shouldBeRedListed = scoreDiff < threshold;

      await User.findByIdAndUpdate(student._id, {
        previousDevScore: student.devScore,
        lastScoreCheckAt: new Date(),
        isRedListed: shouldBeRedListed
      });
    }
  }

  const redListed = await User.find({ role: "student", isRedListed: true })
    .select("name username devScore previousDevScore lastScoreCheckAt");

  console.log(`[RedList] Check complete. ${redListed.length} students in red list.`);
  return redListed;
}

module.exports = {
  fetchPlatformStats,
  fetchAndCacheStats,
  refreshAllProfiles,
  computeDevScore,
  checkRedList
};
