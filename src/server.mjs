import { loadConfig } from './config.mjs';
import { createLogger } from './logger.mjs';
import { EvidenceLedger } from './evidence-ledger.mjs';
import { GitHubApi } from './github-api.mjs';
import { WebhookProcessor } from './processor.mjs';
import { createApp } from './app.mjs';

const config = await loadConfig();
const logger = createLogger({ level: config.logLevel });
const ledger = new EvidenceLedger(config.evidenceLedgerPath);
await ledger.initialize();

const github = new GitHubApi(config);
const processor = new WebhookProcessor({ config, github, ledger, logger });
const server = createApp({ config, processor, ledger, logger });

server.requestTimeout = 20_000;
server.headersTimeout = 25_000;
server.keepAliveTimeout = 5_000;

server.listen(config.port, config.host, () => {
  logger.info('AltmanAI CI server started', {
    host: config.host,
    port: config.port,
    environment: config.nodeEnv,
    policyVersion: config.policy.policyVersion
  });
});

async function shutdown(signal) {
  logger.info('Shutdown requested', { signal });
  server.close((error) => {
    if (error) {
      logger.error('Shutdown failed', { error: error.message });
      process.exitCode = 1;
    }
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error: error.stack || error.message });
  process.exit(1);
});
process.on('unhandledRejection', (error) => {
  logger.error('Unhandled rejection', { error: error?.stack || String(error) });
  process.exit(1);
});
