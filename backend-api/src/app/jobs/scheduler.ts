import cron from 'node-cron';
import { spawn } from 'child_process';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Schedules the process-user-profiles-job to run automatically
 *
 * Schedule: Every day at 3:00 AM (configurable via environment variables)
 * Default cron expression: '0 3 * * *' (minute=0, hour=3, every day)
 *
 * Environment variables:
 * - JOB_SCHEDULE_CRON: Cron expression (default: '0 3 * * *')
 * - JOB_SCHEDULE_TIMEZONE: Timezone (default: 'Europe/Madrid')
 * - JOB_SCHEDULE_ENABLED: Enable/disable scheduler (default: 'true')
 */
export function startJobScheduler() {
  // Check if scheduler is enabled
  const schedulerEnabled = process.env.JOB_SCHEDULE_ENABLED !== 'false';

  if (!schedulerEnabled) {
    console.log(
      '[SCHEDULER] Job scheduler is disabled (JOB_SCHEDULE_ENABLED=false)'
    );
    return;
  }

  // Get configuration from environment variables
  const cronExpression = process.env.JOB_SCHEDULE_CRON || '0 3 * * *';
  const timezone = process.env.JOB_SCHEDULE_TIMEZONE || 'Europe/Madrid';

  console.log('[SCHEDULER] Setting up job scheduler...');
  console.log(`[SCHEDULER] Schedule: Every day at 3:00 AM (${timezone})`);
  console.log(`[SCHEDULER] Cron expression: ${cronExpression}`);

  try {
    cron.schedule(
      cronExpression,
      () => {
        const executionTime = new Date().toISOString();
        console.log(
          `[SCHEDULER] [${executionTime}] Starting scheduled job: process-user-profiles-job`
        );

        // Get the path to the job script
        // From src/app/jobs/scheduler.ts to scripts/jobs/process-user-profiles-job.ts
        const jobScriptPath = path.join(
          __dirname,
          '../../../scripts/jobs/process-user-profiles-job.ts'
        );

        // Execute the job script using tsx (works in both dev and production)
        const jobProcess = spawn('npx', ['tsx', jobScriptPath], {
          stdio: 'inherit', // Inherit stdout/stderr so logs appear in console
          shell: true,
          cwd: path.join(__dirname, '../../..'), // Set working directory to backend-api root
        });

        jobProcess.on('error', (error) => {
          console.error(
            `[SCHEDULER] [${new Date().toISOString()}] Failed to start job: ${error.message}`
          );
          if (error.stack) {
            console.error(`[SCHEDULER] Stack trace: ${error.stack}`);
          }
        });

        jobProcess.on('exit', (code) => {
          const exitTime = new Date().toISOString();
          if (code === 0) {
            console.log(`[SCHEDULER] [${exitTime}] Job completed successfully`);
          } else {
            console.error(
              `[SCHEDULER] [${exitTime}] Job exited with code ${code}`
            );
          }
        });
      },
      {
        timezone: timezone,
      }
    );

    console.log('[SCHEDULER] Job scheduler started successfully');
  } catch (error) {
    console.error('[SCHEDULER] Failed to start job scheduler:', error);
    if (error instanceof Error) {
      console.error(`[SCHEDULER] Error message: ${error.message}`);
      if (error.stack) {
        console.error(`[SCHEDULER] Stack trace: ${error.stack}`);
      }
    }
  }
}
