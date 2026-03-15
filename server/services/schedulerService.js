const cron = require("node-cron");
const { refreshAllProfiles } = require("./statsCacheService");

let isRunning = false;
let lastRunResult = null;

async function runScheduledRefresh() {
  if (isRunning) {
    console.log("[Scheduler] Previous refresh still running, skipping this cycle.");
    return;
  }

  isRunning = true;
  console.log("[Scheduler] Starting scheduled stats refresh...");

  try {
    const result = await refreshAllProfiles();
    lastRunResult = {
      success: true,
      timestamp: new Date(),
      ...result
    };
  } catch (error) {
    lastRunResult = {
      success: false,
      timestamp: new Date(),
      error: error.message
    };
    console.error("[Scheduler] Refresh failed:", error.message);
  } finally {
    isRunning = false;
  }
}

function startScheduler() {
  const cronExpression = "0 */6 * * *";
  
  console.log(`[Scheduler] Starting stats refresh scheduler (${cronExpression} - every 6 hours)`);
  
  cron.schedule(cronExpression, runScheduledRefresh, {
    scheduled: true,
    timezone: "UTC"
  });
}

function stopScheduler() {
  cron.validate("* * * * *");
}

function getSchedulerStatus() {
  return {
    isRunning,
    lastRun: lastRunResult,
    nextRun: cron.validate("0 */6 * * *") ? "Every 6 hours" : "Invalid"
  };
}

module.exports = {
  startScheduler,
  stopScheduler,
  getSchedulerStatus,
  runScheduledRefresh
};
