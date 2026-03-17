const axios = require("axios");
const { randomUUID } = require("crypto");

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const PUBLIC_TOKEN_URL = "https://www.sololearn.com/user/publicToken";
const PROFILE_ENDPOINT = (profileId) =>
  `https://api2.sololearn.com/v2/userinfo/v3/profile/${profileId}?sections=1,3,7,8`;
const STREAK_ENDPOINT = (profileId) =>
  `https://api2.sololearn.com/v2/streak/api/streaks/${profileId}`;

const TOKEN_REFRESH_SAFETY_MS = 60 * 1000;
let cachedAccessToken = null;
let cachedAccessTokenExpiresAt = 0;
let tokenPromise = null;

function formatTimezoneOffset() {
  const offsetHours = -new Date().getTimezoneOffset() / 60;
  const sign = offsetHours >= 0 ? "+" : "-";
  const abs = Math.abs(offsetHours);
  const value = abs % 1 === 0 ? abs.toFixed(0) : abs.toFixed(1);
  return `${sign}${value}`;
}

function extractSololearnProfileId(profileUrl) {
  if (!profileUrl) return null;
  try {
    const url = new URL(profileUrl);
    const match = url.pathname.match(/profile\/(\d+)/i);
    if (match) return match[1];
    const numeric = url.pathname.match(/(\d{5,})/);
    return numeric ? numeric[1] : null;
  } catch {
    const fallback = String(profileUrl).match(/(\d{5,})/);
    return fallback ? fallback[1] : null;
  }
}

async function requestPublicAccessToken() {
  const { data } = await axios.post(
    PUBLIC_TOKEN_URL,
    {
      subject: randomUUID(),
      checkboxCaptcha: false
    },
    {
      timeout: 12000,
      headers: {
        Origin: "https://www.sololearn.com",
        Referer: "https://www.sololearn.com/",
        "User-Agent": USER_AGENT,
        Accept: "application/json",
        "Content-Type": "application/json"
      }
    }
  );

  const accessToken = data?.accessToken;
  const expiresInSeconds = Number(data?.expiresIn || 3600);

  if (!accessToken || typeof accessToken !== "string") {
    throw new Error("SoloLearn public token request failed.");
  }

  cachedAccessToken = accessToken;
  cachedAccessTokenExpiresAt = Date.now() + expiresInSeconds * 1000 - TOKEN_REFRESH_SAFETY_MS;
  return accessToken;
}

async function getPublicAccessToken() {
  const now = Date.now();
  if (cachedAccessToken && cachedAccessTokenExpiresAt > now) return cachedAccessToken;
  if (tokenPromise) return tokenPromise;

  tokenPromise = requestPublicAccessToken()
    .catch((error) => {
      cachedAccessToken = null;
      cachedAccessTokenExpiresAt = 0;
      throw error;
    })
    .finally(() => {
      tokenPromise = null;
    });

  return tokenPromise;
}

function buildSoloLearnApiHeaders(accessToken) {
  return {
    Authorization: `Bearer ${accessToken}`,
    Origin: "https://www.sololearn.com",
    Referer: "https://www.sololearn.com/",
    "User-Agent": USER_AGENT,
    Accept: "application/json",
    "Accept-Language": "en-US,en;q=0.9",
    "SL-Locale": "en",
    "SL-Time-Zone": formatTimezoneOffset(),
    "SL-Plan-Id": ""
  };
}

async function fetchSololearnApi(profileId, attempt = 0) {
  const accessToken = await getPublicAccessToken();
  const headers = buildSoloLearnApiHeaders(accessToken);

  const [profileResult, streakResult] = await Promise.allSettled([
    axios.get(PROFILE_ENDPOINT(profileId), { headers, timeout: 12000, validateStatus: () => true }),
    axios.get(STREAK_ENDPOINT(profileId), { headers, timeout: 12000, validateStatus: () => true })
  ]);

  const profileResponse = profileResult.status === "fulfilled" ? profileResult.value : null;
  const streakResponse = streakResult.status === "fulfilled" ? streakResult.value : null;

  const authFailed =
    [profileResponse?.status, streakResponse?.status].some((status) => status === 401 || status === 403);

  if (authFailed && attempt < 1) {
    cachedAccessToken = null;
    cachedAccessTokenExpiresAt = 0;
    return fetchSololearnApi(profileId, attempt + 1);
  }

  if (!profileResponse || profileResponse.status !== 200) {
    const status = profileResponse?.status;
    throw new Error(
      `Failed to fetch SoloLearn profile data${status ? ` (HTTP ${status})` : ""}.`
    );
  }

  const userDetails = profileResponse.data?.userDetails || {};
  const xp = Number(userDetails?.xp || 0);
  const level = Number(userDetails?.level || 0);

  const certificates = Array.isArray(profileResponse.data?.certificates)
    ? profileResponse.data.certificates.length
    : Number(userDetails?.badges || 0);

  const streak =
    streakResponse && streakResponse.status === 200
      ? Number(streakResponse.data?.daysCount || 0)
      : 0;

  const username = String(userDetails?.userName || userDetails?.name || "").trim();

  return {
    xp: Number.isFinite(xp) ? String(xp) : "0",
    level: Number.isFinite(level) ? String(level) : "0",
    streak: Number.isFinite(streak) ? String(streak) : "0",
    certificates: Number.isFinite(certificates) ? String(certificates) : "0",
    username
  };
}

async function getSololearnStats(profileUrl) {
  console.log(`Starting SoloLearn scraper for URL: ${profileUrl}`);

  if (!profileUrl || typeof profileUrl !== "string") {
    throw new Error("Profile URL is required.");
  }

  const profileId = extractSololearnProfileId(profileUrl);
  if (!profileId) {
    throw new Error("SoloLearn profile URL must include a numeric profile id.");
  }

  return fetchSololearnApi(profileId);
}

module.exports = getSololearnStats;

