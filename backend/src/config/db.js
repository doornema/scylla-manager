import { Client } from '@scylladb/driver';
import dotenv from 'dotenv';

dotenv.config();

const SCYLLA_HOSTS = (process.env.SCYLLA_HOSTS || 'scylla')
  .split(',')
  .map((h) => h.trim())
  .filter(Boolean);

const SCYLLA_PORT = parseInt(process.env.SCYLLA_PORT || '9042', 10);
const SCYLLA_DC = process.env.SCYLLA_DC || 'datacenter1';
const SCYLLA_USER = process.env.SCYLLA_USER || 'cassandra';
const SCYLLA_PASS = process.env.SCYLLA_PASS || 'cassandra';

let client = null;
let connecting = null;

/**
 * اتصال با retry خودکار — چون در زمان استارت کانتینر، ممکن است
 * ScyllaDB هنوز آماده نباشد.
 */
export async function getClient(retries = 30, delayMs = 3000) {
  if (client) return client;
  if (connecting) return connecting;

  connecting = (async () => {
    for (let i = 1; i <= retries; i++) {
      try {
        const c = new Client({
          // فقط hostname — بدون port
          contactPoints: SCYLLA_HOSTS,
          localDataCenter: SCYLLA_DC,
          // port به‌صورت جداگانه
          protocolOptions: { port: SCYLLA_PORT },
          credentials: {
            username: SCYLLA_USER,
            password: SCYLLA_PASS,
          },
          socketOptions: {
            connectTimeout: 10000,
          },
          pooling: {
            coreConnectionsPerHost: {
              local: 2,
              remote: 1,
            },
          },
        });

        await c.connect();
        client = c;
        console.log('✅ Connected to ScyllaDB');
        return client;
      } catch (err) {
        console.warn(
          `⏳ ScyllaDB not ready (attempt ${i}/${retries}): ${err.message}`
        );
        if (i === retries) {
          connecting = null;
          throw err;
        }
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
  })();

  return connecting;
}

export async function executeQuery(cql, params = [], options = {}) {
  const c = await getClient();
  return c.execute(cql, params, { prepare: true, ...options });
}

export async function closeClient() {
  if (client) {
    await client.close();
    client = null;
    connecting = null;
  }
}