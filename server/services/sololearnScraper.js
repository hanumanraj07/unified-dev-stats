const axios = require("axios");
const { launchBrowser } = require("./puppeteerLauncher");

const SOLOLEARN_COOKIE_ENV_KEYS = [
    "SOLOLEARN_COOKIE_STRING",
    "SOLOLEARN_COOKIES"
];

const SOLOLEARN_BEARER_ENV_KEYS = [
    "SOLOLEARN_AUTH_BEARER",
    "SOLOLEARN_BEARER",
    "SOLOLEARN_AUTH_TOKEN"
];

function parseCookieString(cookieString) {
    if (!cookieString) return [];
    return cookieString
        .split(";")
        .map(part => part.trim())
        .filter(Boolean)
        .map(part => {
            const separatorIndex = part.indexOf("=");
            if (separatorIndex <= 0) return null;
            const name = part.slice(0, separatorIndex).trim();
            const value = part.slice(separatorIndex + 1).trim();
            if (!name || !value) return null;
            const lowerName = name.toLowerCase();
            if (["path", "domain", "expires", "max-age", "samesite", "secure", "httponly", "priority"].includes(lowerName)) {
                return null;
            }
            return { name, value };
        })
        .filter(Boolean);
}

function buildSololearnCookies() {
    const cookieString = SOLOLEARN_COOKIE_ENV_KEYS
        .map(key => process.env[key])
        .find(value => value && value.trim().length > 0);
    return parseCookieString(cookieString);
}

function getSololearnBearer() {
    const bearerValue = SOLOLEARN_BEARER_ENV_KEYS
        .map(key => process.env[key])
        .find(value => value && value.trim().length > 0);
    if (!bearerValue) return null;
    return bearerValue.startsWith("Bearer ") ? bearerValue.trim() : `Bearer ${bearerValue.trim()}`;
}

function buildCookiePayloads(cookies) {
    if (!cookies.length) return [];
    return cookies.map(cookie => ({
        url: "https://www.sololearn.com",
        name: cookie.name,
        value: cookie.value
    }));
}

function isSololearnApiUrl(url) {
    if (!url) return false;
    return url.includes("api2.sololearn.com") || url.includes("api3.sololearn.com");
}

function walkObject(value, visitor, seen = new Set()) {
    if (!value || typeof value !== "object") return;
    if (seen.has(value)) return;
    seen.add(value);

    if (Array.isArray(value)) {
        value.forEach(item => walkObject(item, visitor, seen));
        return;
    }

    for (const [key, val] of Object.entries(value)) {
        visitor(key, val, value);
        walkObject(val, visitor, seen);
    }
}

function normalizeNumber(value) {
    if (value === null || value === undefined) return null;
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
        const cleaned = value.replace(/,/g, "").match(/\d+/);
        if (!cleaned) return null;
        const num = Number(cleaned[0]);
        return Number.isFinite(num) ? num : null;
    }
    return null;
}

function extractCount(value) {
    if (Array.isArray(value)) return value.length;
    if (value && typeof value === "object") {
        if (Array.isArray(value.items)) return value.items.length;
        if (Array.isArray(value.data)) return value.data.length;
    }
    return normalizeNumber(value);
}

function extractSololearnStatsFromResponses(responses) {
    if (!responses.length) return null;
    const xpKeys = new Set(["xp", "totalxp", "experience", "experiencepoints"]);
    const levelKeys = new Set(["level", "userlevel", "levelnumber"]);
    const streakKeys = new Set(["streak", "currentstreak", "streakdays", "currentstreakdays"]);
    const certKeys = new Set(["certificates", "certificatecount", "certs", "badges", "badgecount"]);
    const usernameKeys = new Set(["username", "userName", "nickname", "displayname", "name"]);

    let xp = null;
    let level = null;
    let streak = null;
    let certificates = null;
    let username = "";

    const tryAssignNumber = (key, value) => {
        const lower = key.toLowerCase();
        if (xp === null && xpKeys.has(lower)) xp = extractCount(value);
        if (level === null && levelKeys.has(lower)) level = extractCount(value);
        if (streak === null && streakKeys.has(lower)) streak = extractCount(value);
        if (certificates === null && certKeys.has(lower)) certificates = extractCount(value);
    };

    const tryAssignName = (key, value) => {
        if (username) return;
        const lower = key.toLowerCase();
        if (usernameKeys.has(lower) && typeof value === "string" && value.trim().length > 0) {
            username = value.trim();
        }
    };

    responses.forEach(({ data }) => {
        walkObject(data, (key, value) => {
            tryAssignNumber(key, value);
            tryAssignName(key, value);
        });
    });

    const hasAny = [xp, level, streak, certificates].some(val => Number.isFinite(val) && val > 0);
    if (!hasAny) return null;

    return {
        xp: Number.isFinite(xp) ? xp.toString() : "0",
        level: Number.isFinite(level) ? level.toString() : "0",
        streak: Number.isFinite(streak) ? streak.toString() : "0",
        certificates: Number.isFinite(certificates) ? certificates.toString() : "0",
        username
    };
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

async function fetchSololearnApiStats(profileUrl) {
    const profileId = extractSololearnProfileId(profileUrl);
    if (!profileId) return null;

    const bearer = getSololearnBearer();
    if (!bearer) return null;

    const headers = {
        Accept: "application/json",
        Authorization: bearer,
        Origin: "https://www.sololearn.com",
        Referer: "https://www.sololearn.com/",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    };

    const baseUrls = ["https://api2.sololearn.com", "https://api3.sololearn.com"];
    const paths = [
        `/v2/profile/${profileId}`,
        `/v2/profile/${profileId}?sections=1,3,7,8`,
        `/v2/userprofile/${profileId}`,
        `/v2/userprofile/${profileId}?sections=1,3,7,8`,
        `/v2/streak/api/streaks/${profileId}`,
        `/v2/learningexperience/${profileId}`,
        `/v2/xp/${profileId}`
    ];

    const responses = [];

    for (const base of baseUrls) {
        for (const path of paths) {
            const url = `${base}${path}`;
            try {
                const { data } = await axios.get(url, { headers, timeout: 8000 });
                responses.push({ url, data });
                const extracted = extractSololearnStatsFromResponses(responses);
                if (extracted) {
                    return extracted;
                }
            } catch (error) {
                const status = error?.response?.status;
                if (status === 401 || status === 403) {
                    return null;
                }
            }
        }
    }

    return extractSololearnStatsFromResponses(responses);
}

async function getSololearnStats(profileUrl) {
    let browser = null;
    const navigationTimeout = 20000;
    const apiWaitTimeout = 8000;
    const bodyWaitTimeout = 4000;
    
    try {
        console.log(`Starting SoloLearn scraper for URL: ${profileUrl}`);
        
        if (!profileUrl.startsWith('http')) {
            throw new Error('Invalid URL format');
        }
        
        const apiDirectStats = await fetchSololearnApiStats(profileUrl);
        if (apiDirectStats) {
            console.log("Final scraped data (api-direct):", apiDirectStats);
            return apiDirectStats;
        }

        const cookies = buildSololearnCookies();
        const bearer = getSololearnBearer();
        if (!cookies.length && !bearer) {
            console.warn("No SoloLearn auth cookies or bearer token found. Skipping scrape.");
            return { xp: "0", level: "0", streak: "0", certificates: "0", username: "" };
        }

        browser = await launchBrowser();

        const page = await browser.newPage();
        
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await page.setDefaultNavigationTimeout(navigationTimeout);
        await page.setDefaultTimeout(Math.min(10000, navigationTimeout));

        try {
            await page.setRequestInterception(true);
            page.on("request", request => {
                const resourceType = request.resourceType();
                if (["image", "media", "font", "stylesheet"].includes(resourceType)) {
                    request.abort();
                } else {
                    request.continue();
                }
            });
        } catch (interceptError) {
            console.warn("SoloLearn scraper request interception setup failed:", interceptError?.message || interceptError);
        }

        const apiResponses = [];
        let apiStats = null;
        let resolveApiStats = null;
        const apiStatsPromise = new Promise((resolve) => {
            resolveApiStats = resolve;
        });
        page.on("response", async (response) => {
            const url = response.url();
            if (!isSololearnApiUrl(url)) return;
            const contentType = response.headers()?.["content-type"] || "";
            if (!contentType.includes("application/json")) return;
            if (apiResponses.length > 20) return;
            try {
                const data = await response.json();
                apiResponses.push({ url, data });
                if (!apiStats) {
                    const extracted = extractSololearnStatsFromResponses(apiResponses);
                    if (extracted) {
                        apiStats = extracted;
                        resolveApiStats(extracted);
                    }
                }
            } catch (responseError) {
                console.warn("SoloLearn API response parse failed:", responseError?.message || responseError);
            }
        });

        if (bearer) {
            try {
                await page.setExtraHTTPHeaders({ Authorization: bearer });
            } catch (headerError) {
                console.warn("SoloLearn auth header setup failed:", headerError?.message || headerError);
            }
        }

        const cookiesForPage = cookies;
        if (cookiesForPage.length) {
            const cookiePayloads = buildCookiePayloads(cookiesForPage);
            await page.setCookie(...cookiePayloads);
            console.log(`Applied ${cookiePayloads.length} SoloLearn auth cookies.`);
        } else if (!bearer) {
            console.warn("No SoloLearn auth cookies found. Set SOLOLEARN_COOKIE_STRING for authenticated scraping.");
        }
        
        console.log("Navigating to profile URL...");
        let response = null;
        try {
            response = await page.goto(profileUrl, {
                waitUntil: "domcontentloaded",
                timeout: navigationTimeout
            });
        } catch (navError) {
            const isTimeout = navError?.name === "TimeoutError" || /timeout/i.test(navError?.message || "");
            if (!isTimeout) {
                throw navError;
            }
            console.warn("SoloLearn navigation timed out, continuing with best-effort scrape.");
        }
        
        if (response) {
            console.log(`Navigation response status: ${response.status()}`);
            
            if (response.status() !== 200) {
                throw new Error(`HTTP ${response.status()} - Failed to load page`);
            }
        }

        try {
            await Promise.race([
                apiStatsPromise,
                new Promise((resolve) => setTimeout(resolve, apiWaitTimeout))
            ]);
        } catch (waitApiError) {
            console.warn("SoloLearn API response wait error:", waitApiError?.message || waitApiError);
        }

        if (!apiStats) {
            try {
                await page.waitForSelector('body', { timeout: bodyWaitTimeout });
            } catch (waitError) {
                const waitTimeout = waitError?.name === "TimeoutError" || /timeout/i.test(waitError?.message || "");
                if (waitTimeout) {
                    console.warn("SoloLearn body selector timed out, continuing with best-effort scrape.");
                } else {
                    throw waitError;
                }
            }
        }

        const extractedApiStats = apiStats || extractSololearnStatsFromResponses(apiResponses);
        if (extractedApiStats) {
            console.log("Final scraped data (api):", extractedApiStats);
            return extractedApiStats;
        }

        const pageTitle = await page.title();
        console.log(`Page title: ${pageTitle}`);

        const currentUrl = page.url();
        console.log(`Current URL: ${currentUrl}`);

        if (currentUrl.includes('login') || currentUrl.includes('error')) {
            throw new Error('Redirected to login/error page - profile may be private or invalid');
        }

        const data = await page.evaluate(() => {
            const cleanText = (text) => {
                if (!text) return null;
                return text.trim().replace(/,/g, '').replace(/[^0-9]/g, '');
            };
            
            let xp = null;
            let level = null;
            let streak = null;
            let certificates = null;
            let username = null;

            const usernameSelectors = [
                '[class*="user"] [class*="name"]',
                '[class*="profile"] [class*="name"]',
                '[data-testid*="user"]',
                'a[href*="/profile/"]',
                '.username',
                '[class*="header"] [class*="name"]'
            ];
            
            for (const selector of usernameSelectors) {
                const el = document.querySelector(selector);
                if (el && el.textContent) {
                    const text = el.textContent.trim();
                    if (text && text.length > 0 && text.length < 50 && !text.includes('404')) {
                        username = text;
                        break;
                    }
                }
            }

            if (!username) {
                const allLinks = document.querySelectorAll('a');
                for (const a of allLinks) {
                    const href = a.getAttribute('href');
                    if (href && href.includes('/profile/') && href !== window.location.pathname) {
                        const text = a.textContent.trim();
                        if (text && text.length > 0 && text.length < 50) {
                            username = text;
                            break;
                        }
                    }
                }
            }

            const bodyText = document.body.innerText;
            
            const xpPatterns = [
                /([\d,]+)\s*XP/i,
                /XP[:\s]*([\d,]+)/i,
                /([\d,]+)\s*experience/i
            ];
            for (const pattern of xpPatterns) {
                const match = bodyText.match(pattern);
                if (match) {
                    xp = cleanText(match[1]);
                    if (xp && parseInt(xp) > 0) break;
                }
            }

            const levelPatterns = [
                /Level\s*(\d+)/i,
                /Lvl[:\s]*(\d+)/i,
                /level[:\s]*(\d+)/i
            ];
            for (const pattern of levelPatterns) {
                const match = bodyText.match(pattern);
                if (match) {
                    level = match[1];
                    break;
                }
            }

            const streakPatterns = [
                /streak[:\s]*(\d+)/i,
                /(\d+)\s*day[s]?\s*streak/i,
                /current\s*streak[:\s]*(\d+)/i
            ];
            for (const pattern of streakPatterns) {
                const match = bodyText.match(pattern);
                if (match) {
                    streak = match[1];
                    break;
                }
            }

            const certSection = bodyText.match(/Certificates\s*([\s\S]*?)\s*Learning paths/);
            if (certSection) {
                const certText = certSection[1];
                const certCourses = certText.split('\n').filter(line => line.trim().length > 0);
                certificates = certCourses.length.toString();
            }

            const result = {
                xp: xp || "0",
                level: level || "0",
                streak: streak || "0",
                certificates: certificates || "0",
                username: username || ""
            };

            console.log("Extracted data:", result);
            return result;
        });

        console.log("Final scraped data:", data);
        return data;
    } catch (error) {
        const isTimeout = error?.name === "TimeoutError" || /timeout/i.test(error?.message || "");
        console.error("Error in SoloLearn scraper:", error);
        if (isTimeout) {
            return { xp: "0", level: "0", streak: "0", certificates: "0", username: "" };
        }
        throw new Error(`Failed to scrape SoloLearn profile: ${error.message}`);
    } finally {
        if (browser) {
            try {
                await browser.close();
                console.log("Browser closed successfully");
            } catch (closeError) {
                console.error("Error closing browser:", closeError.message);
            }
        }
    }
}

module.exports = getSololearnStats;
