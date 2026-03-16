const { launchBrowser } = require("./puppeteerLauncher");

const TWITTER_SYNDICATION_URL = "https://cdn.syndication.twimg.com/widgets/followbutton/info.json?screen_names=";

const TWITTER_COOKIE_ENV_KEYS = [
    "TWITTER_COOKIE_STRING",
    "TWITTER_COOKIES"
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

function getCookieValue(cookies, name) {
    return cookies.find(cookie => cookie.name === name)?.value || "";
}

function buildTwitterCookies() {
    const cookieString = TWITTER_COOKIE_ENV_KEYS
        .map(key => process.env[key])
        .find(value => value && value.trim().length > 0);

    let cookies = parseCookieString(cookieString);

    if (!cookies.length) {
        const authToken = process.env.TWITTER_AUTH_TOKEN || "";
        const csrfToken = process.env.TWITTER_CT0 || process.env.TWITTER_CSRF_TOKEN || "";

        if (authToken) {
            cookies.push({ name: "auth_token", value: authToken });
        }
        if (csrfToken) {
            cookies.push({ name: "ct0", value: csrfToken });
        }
    }

    const csrfToken = getCookieValue(cookies, "ct0");

    return { cookies, csrfToken };
}

function buildCookiePayloads(cookies) {
    if (!cookies.length) return [];

    const targets = ["https://x.com", "https://twitter.com"];
    const payloads = [];

    for (const target of targets) {
        for (const cookie of cookies) {
            payloads.push({
                url: target,
                name: cookie.name,
                value: cookie.value
            });
        }
    }

    return payloads;
}

function extractTwitterHandle(profileUrl) {
    if (!profileUrl || typeof profileUrl !== "string") return "";
    const trimmed = profileUrl.trim();
    const match = trimmed.match(/https?:\/\/(?:www\.)?(?:x|twitter)\.com\/([A-Za-z0-9_]+)/i);
    if (match) return match[1];
    if (/^[A-Za-z0-9_]{1,15}$/.test(trimmed)) return trimmed;
    return "";
}

function extractCountsFromHtml(html) {
    if (!html) return null;
    const pickNumber = (pattern) => {
        const match = html.match(pattern);
        if (!match) return null;
        const value = parseInt(match[1], 10);
        return Number.isFinite(value) ? value.toString() : null;
    };

    const pickText = (pattern) => {
        const match = html.match(pattern);
        return match ? match[1] : "";
    };

    const posts = pickNumber(/(?:statuses_count|statusesCount)"?:\s*(\d+)/);
    const followers = pickNumber(/(?:followers_count|followersCount)"?:\s*(\d+)/);
    const following = pickNumber(/(?:friends_count|friendsCount)"?:\s*(\d+)/);
    const username = pickText(/(?:screen_name|screenName)"?:\s*"?([A-Za-z0-9_]{1,15})"?/);

    if (!posts && !followers && !following) return null;

    return {
        posts: posts || "0",
        followers: followers || "0",
        following: following || "0",
        username
    };
}

async function fetchSyndicationStats(handle) {
    if (!handle) return null;
    const endpoint = `${TWITTER_SYNDICATION_URL}${encodeURIComponent(handle)}`;
    try {
        const response = await fetch(endpoint, {
            headers: {
                "accept": "application/json,text/plain,*/*",
                "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
        });

        if (!response.ok) {
            console.warn(`Twitter syndication fetch failed with status ${response.status()}`);
            return null;
        }

        const raw = await response.text();
        if (!raw) {
            console.warn("Twitter syndication empty response.");
            return null;
        }
        if (raw.trim().startsWith("<")) {
            console.warn("Twitter syndication returned HTML instead of JSON.");
            return null;
        }

        let data = null;
        try {
            data = JSON.parse(raw);
        } catch (parseError) {
            console.warn("Twitter syndication JSON parse failed, raw length:", raw.length);
            return null;
        }
        if (!Array.isArray(data) || !data.length) return null;
        const record = data[0];
        if (!record) return null;

        return {
            posts: record.statuses_count?.toString?.() || "0",
            followers: record.followers_count?.toString?.() || "0",
            following: record.friends_count?.toString?.() || "0",
            username: record.screen_name || handle
        };
    } catch (error) {
        console.warn("Twitter syndication fetch error:", error?.message || error);
        return null;
    }
}

async function getTwitterStats(profileUrl) {
    let browser = null;
    
    try {
        console.log(`Starting Twitter scraper for URL: ${profileUrl}`);
        
        if (!profileUrl.startsWith('http')) {
            throw new Error('Invalid URL format');
        }
        
        browser = await launchBrowser();

        const page = await browser.newPage();

        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await page.setDefaultNavigationTimeout(45000);

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
            console.warn("Twitter scraper request interception setup failed:", interceptError?.message || interceptError);
        }

        const handle = extractTwitterHandle(profileUrl);
        const { cookies, csrfToken } = buildTwitterCookies();
        if (cookies.length) {
            const cookiePayloads = buildCookiePayloads(cookies);
            await page.setCookie(...cookiePayloads);
            console.log(`Applied ${cookiePayloads.length} Twitter auth cookies.`);
        } else {
            console.warn("No Twitter auth cookies found. Set TWITTER_COOKIE_STRING for authenticated scraping.");
        }

        if (csrfToken) {
            await page.setExtraHTTPHeaders({ "x-csrf-token": csrfToken });
        }
        
        console.log("Navigating to Twitter profile URL...");
        let response = null;
        try {
            response = await page.goto(profileUrl, {
                waitUntil: "domcontentloaded",
                timeout: 45000
            });
        } catch (navError) {
            const isTimeout = navError?.name === "TimeoutError" || /Navigation timeout/i.test(navError?.message || "");
            if (!isTimeout) {
                throw navError;
            }
            console.warn("Twitter navigation timed out, attempting to scrape anyway.");
        }
        
        if (response) {
            console.log(`Navigation response status: ${response.status()}`);
            if (response.status() !== 200) {
                throw new Error(`HTTP ${response.status()} - Failed to load page`);
            }
        }

        try {
            await page.waitForSelector('body', { timeout: 8000 });
        } catch (waitError) {
            const waitTimeout = waitError?.name === "TimeoutError" || /timeout/i.test(waitError?.message || "");
            if (waitTimeout) {
                console.warn("Twitter body selector timed out, continuing with best-effort scrape.");
            } else {
                throw waitError;
            }
        }
        await new Promise(resolve => setTimeout(resolve, 5000));

        const pageTitle = await page.title();
        console.log(`Page title: ${pageTitle}`);

        const currentUrl = page.url();
        console.log(`Current URL: ${currentUrl}`);

        if (currentUrl.includes('login') || currentUrl.includes('error') || currentUrl.includes('suspended')) {
            console.warn("Twitter profile requires login or is unavailable.");
            const fallback = await fetchSyndicationStats(handle);
            return fallback || { posts: "0", followers: "0", following: "0", username: "" };
        }

        const data = await page.evaluate(() => {
            const extractNumber = (str) => {
                if (!str) return null;
                let cleaned = str.trim().replace(/,/g, '');
                
                const suffixes = { 'K': 1000, 'k': 1000, 'M': 1000000, 'm': 1000000, 'B': 1000000000, 'b': 1000000000 };
                const suffix = cleaned.slice(-1);
                if (suffixes[suffix]) {
                    cleaned = cleaned.slice(0, -1);
                    cleaned = (parseFloat(cleaned) * suffixes[suffix]).toString();
                }
                
                return parseInt(cleaned) || null;
            };

            let posts = null;
            let followers = null;
            let following = null;
            let username = null;

            const urlMatch = window.location.href.match(/twitter\.com\/([a-zA-Z0-9_]+)/);
            if (urlMatch) {
                username = urlMatch[1];
            }

            const bodyText = document.body.innerText;

            const postsPatterns = [
                /(\d+[\d,.]*[KMB]?)\s*Posts?\s/i,
                /Posts?\s*(\d+[\d,.]*[KMB]?)/i,
                /^\s*(\d+[\d,.]*[KMB]?)\s*$/m
            ];
            for (const pattern of postsPatterns) {
                const match = bodyText.match(pattern);
                if (match) {
                    const val = extractNumber(match[1]);
                    if (val && val > 0) {
                        posts = val;
                        break;
                    }
                }
            }

            const followerPatterns = [
                /(\d+[\d,.]*[KMB]?)\s*Followers?\s/i,
                /Followers?\s*(\d+[\d,.]*[KMB]?)/i
            ];
            for (const pattern of followerPatterns) {
                const match = bodyText.match(pattern);
                if (match) {
                    const val = extractNumber(match[1]);
                    if (val && val > 0) {
                        followers = val;
                        break;
                    }
                }
            }

            const followingPatterns = [
                /(\d+[\d,.]*[KMB]?)\s*Following\s/i,
                /Following\s*(\d+[\d,.]*[KMB]?)/i
            ];
            for (const pattern of followingPatterns) {
                const match = bodyText.match(pattern);
                if (match) {
                    const val = extractNumber(match[1]);
                    if (val && val > 0) {
                        following = val;
                        break;
                    }
                }
            }

            const result = {
                posts: posts || "0",
                followers: followers || "0",
                following: following || "0",
                username: username || ""
            };

            console.log("Extracted Twitter data:", result);
            return result;
        });

        const hasAnyStats = ["posts", "followers", "following"].some(key => {
            const value = parseInt(data[key], 10);
            return Number.isFinite(value) && value > 0;
        });

        if (!hasAnyStats) {
            const html = await page.content();
            const htmlStats = extractCountsFromHtml(html);
            if (htmlStats) {
                console.log("Using Twitter HTML fallback data.");
                return {
                    posts: htmlStats.posts,
                    followers: htmlStats.followers,
                    following: htmlStats.following,
                    username: htmlStats.username || data.username || handle
                };
            }

            const fallback = await fetchSyndicationStats(handle || data.username);
            if (fallback) {
                console.log("Using Twitter syndication fallback data.");
                return fallback;
            }
        }

        console.log("Final scraped Twitter data:", data);
        return data;
    } catch (error) {
        const isTimeout = error?.name === "TimeoutError" || /timeout/i.test(error?.message || "");
        console.error("Error in Twitter scraper:", error);
        if (isTimeout) {
            const handle = extractTwitterHandle(profileUrl);
            const fallback = await fetchSyndicationStats(handle);
            return fallback || { posts: "0", followers: "0", following: "0", username: "" };
        }
        throw new Error(`Failed to scrape Twitter profile: ${error.message}`);
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

module.exports = getTwitterStats;
