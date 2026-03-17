const axios = require("axios");

const GRAPHQL_ENDPOINT = "https://leetcode.com/graphql";
const USER_AGENT = "dev-profile-aggregator";

// Keep a short in-memory cache to reduce rate limits and speed up verify/save.
const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map(); // username -> { expiresAt, data, promise }

function readCountFromArray(items, difficulty) {
  if (!Array.isArray(items)) return 0;
  const row = items.find(
    (entry) => String(entry?.difficulty).toLowerCase() === difficulty.toLowerCase()
  );
  return Number(row?.count || 0);
}

function startOfTodayUtcSeconds(nowMs = Date.now()) {
  const now = new Date(nowMs);
  return Math.floor(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) / 1000);
}

async function fetchLeetcodeFromGraphql(username) {
  const query = `query userProfile($username: String!, $limit: Int!) {
    matchedUser(username: $username) {
      username
      profile { ranking }
      submitStatsGlobal { acSubmissionNum { difficulty count submissions } }
    }
    recentAcSubmissionList(username: $username, limit: $limit) {
      id
      timestamp
    }
  }`;

  const { data } = await axios.post(
    GRAPHQL_ENDPOINT,
    { query, variables: { username, limit: 20 } },
    {
      timeout: 12000,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": USER_AGENT,
        Referer: "https://leetcode.com"
      }
    }
  );

  if (data?.errors?.length) {
    const message = data.errors?.[0]?.message || "LeetCode GraphQL request failed.";
    throw new Error(message);
  }

  const matched = data?.data?.matchedUser;
  if (!matched) {
    throw new Error("LeetCode username not found.");
  }

  const acSubmissionNum = matched?.submitStatsGlobal?.acSubmissionNum || [];
  const totalSolved = readCountFromArray(acSubmissionNum, "All");
  const easySolved = readCountFromArray(acSubmissionNum, "Easy");
  const mediumSolved = readCountFromArray(acSubmissionNum, "Medium");
  const hardSolved = readCountFromArray(acSubmissionNum, "Hard");
  const ranking = Number(matched?.profile?.ranking || 0);

  const recent = Array.isArray(data?.data?.recentAcSubmissionList)
    ? data.data.recentAcSubmissionList
    : [];
  const todayStart = startOfTodayUtcSeconds();
  const todaySolved = recent.filter((row) => Number(row?.timestamp || 0) >= todayStart).length;

  return {
    username,
    profileUrl: `https://leetcode.com/${username}`,
    totalSolved: Number(totalSolved || 0),
    easySolved: Number(easySolved || 0),
    mediumSolved: Number(mediumSolved || 0),
    hardSolved: Number(hardSolved || 0),
    ranking,
    todaySolved,
    lastSynced: new Date()
  };
}

async function getLeetcode(username) {
  const key = String(username || "").trim();
  if (!key) return null;

  const now = Date.now();
  const cached = cache.get(key);
  if (cached?.data && cached.expiresAt > now) return cached.data;
  if (cached?.promise) return cached.promise;

  const promise = fetchLeetcodeFromGraphql(key)
    .then((data) => {
      cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
      return data;
    })
    .catch((error) => {
      cache.delete(key);
      throw error;
    });

  cache.set(key, { promise });
  return promise;
}

module.exports = { getLeetcode };
