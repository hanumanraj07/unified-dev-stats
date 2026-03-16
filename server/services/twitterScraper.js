const { launchBrowser } = require("./puppeteerLauncher");

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
        await page.setDefaultNavigationTimeout(60000);
        
        console.log("Navigating to Twitter profile URL...");
        const response = await page.goto(profileUrl, {
            waitUntil: "networkidle2",
            timeout: 60000
        });
        
        console.log(`Navigation response status: ${response.status()}`);
        
        if (response.status() !== 200) {
            throw new Error(`HTTP ${response.status()} - Failed to load page`);
        }

        await page.waitForSelector('body', { timeout: 10000 });
        await new Promise(resolve => setTimeout(resolve, 5000));

        const pageTitle = await page.title();
        console.log(`Page title: ${pageTitle}`);

        const currentUrl = page.url();
        console.log(`Current URL: ${currentUrl}`);

        if (currentUrl.includes('login') || currentUrl.includes('error') || currentUrl.includes('suspended')) {
            throw new Error('Redirected to login/error/suspended page - profile may be private or invalid');
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

        console.log("Final scraped Twitter data:", data);
        return data;
    } catch (error) {
        console.error("Error in Twitter scraper:", error);
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
