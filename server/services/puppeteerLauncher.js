const fs = require("fs");
const os = require("os");
const path = require("path");
const puppeteer = require("puppeteer");
const {
  Browser,
  BrowserTag,
  computeExecutablePath,
  detectBrowserPlatform,
  install,
  resolveBuildId
} = require("@puppeteer/browsers");

const cacheDir = process.env.PUPPETEER_CACHE_DIR || path.join(os.homedir(), ".cache", "puppeteer");
let installPromise = null;

async function resolveExecutablePath() {
  const envPath = process.env.PUPPETEER_EXECUTABLE_PATH;
  if (envPath && fs.existsSync(envPath)) return envPath;

  const puppeteerPath = typeof puppeteer.executablePath === "function" ? puppeteer.executablePath() : "";
  if (puppeteerPath && fs.existsSync(puppeteerPath)) return puppeteerPath;

  const platform = detectBrowserPlatform();
  if (!platform) {
    throw new Error("Unsupported platform: cannot detect a valid browser platform.");
  }

  const buildId = await resolveBuildId(Browser.CHROME, platform, BrowserTag.STABLE);
  const computedPath = computeExecutablePath({
    cacheDir,
    browser: Browser.CHROME,
    platform,
    buildId
  });

  if (fs.existsSync(computedPath)) {
    return computedPath;
  }

  if (!installPromise) {
    installPromise = install({
      browser: Browser.CHROME,
      buildId,
      cacheDir,
      platform,
      downloadProgressCallback: "default"
    });
  }

  const installed = await installPromise;
  return installed.executablePath || computedPath;
}

async function launchBrowser() {
  const executablePath = await resolveExecutablePath();
  return puppeteer.launch({
    headless: true,
    executablePath,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
  });
}

module.exports = { launchBrowser, resolveExecutablePath };
