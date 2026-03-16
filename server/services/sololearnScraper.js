const { launchBrowser } = require("./puppeteerLauncher");

async function getSololearnStats(profileUrl) {
    let browser = null;
    
    try {
        console.log(`Starting SoloLearn scraper for URL: ${profileUrl}`);
        
        if (!profileUrl.startsWith('http')) {
            throw new Error('Invalid URL format');
        }
        
        browser = await launchBrowser();

        const page = await browser.newPage();
        
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await page.setDefaultNavigationTimeout(60000);

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
        
        console.log("Navigating to profile URL...");
        let response = null;
        try {
            response = await page.goto(profileUrl, {
                waitUntil: "networkidle2",
                timeout: 60000
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
            await page.waitForSelector('body', { timeout: 10000 });
        } catch (waitError) {
            const waitTimeout = waitError?.name === "TimeoutError" || /timeout/i.test(waitError?.message || "");
            if (waitTimeout) {
                console.warn("SoloLearn body selector timed out, continuing with best-effort scrape.");
            } else {
                throw waitError;
            }
        }
        await new Promise(resolve => setTimeout(resolve, 5000));

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
