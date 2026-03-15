const fs = require('fs');
const path = require('path');
const https = require('https');
const { spawn } = require('child_process');

const isRender = process.env.RENDER === 'true' || process.env.RENDER_SERVICE_NAME;

if (!isRender) {
  console.log('Skipping Chromium installation (not on Render)');
  process.exit(0);
}

const chromeVersion = '127.0.0.0';
const chromePath = path.join(__dirname, '.cache', 'puppeteer', 'chrome', `linux-${chromeVersion}`, 'chrome-linux', 'chrome');

if (fs.existsSync(chromePath)) {
  console.log('Chromium already installed');
  process.exit(0);
}

console.log('Installing Chromium for Render...');

const puppeteer = require('puppeteer');
const browserFetcher = puppeteer.createBrowserFetcher();

browserFetcher.download(chromeVersion)
  .then(() => {
    console.log('Chromium downloaded successfully');
    process.exit(0);
  })
  .catch(err => {
    console.error('Failed to download Chromium:', err);
    process.exit(1);
  });
