import { AsyncLocalStorage } from "node:async_hooks";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

// Node server: one long-lived client with a pool.
//
// Cloudflare Workers: a socket cannot outlive the request that opened it, but building a
// PrismaClient per request re-instantiates the query compiler (WASM) every time and the Worker
// is killed for exceeding its resource limits (error 1102 after a few requests). So the Worker
// keeps ONE PrismaClient per isolate whose pool is a facade: every query is forwarded to the
// real Pool of the request being served (withRequestPool, called from cloudflare/worker.ts).
const requestPool = new AsyncLocalStorage<Pool>();

class RequestPoolFacade extends Pool {
  private current(): Pool {
    const pool = requestPool.getStore();
    if (!pool) throw new Error("Database used outside of a request");
    return pool;
  }
  // @ts-expect-error overloads of pg.Pool#query are forwarded as-is
  query(...args: unknown[]) {
    return (this.current().query as (...a: unknown[]) => unknown)(...args);
  }
  // @ts-expect-error overloads of pg.Pool#connect are forwarded as-is
  connect(...args: unknown[]) {
    return (this.current().connect as (...a: unknown[]) => unknown)(...args);
  }
  on() {
    return this;
  }
  removeListener() {
    return this;
  }
  end() {
    return Promise.resolve();
  }
}

export async function withRequestPool<T>(connectionString: string, fn: () => Promise<T>): Promise<{ result: T; close: () => Promise<void> }> {
  const pool = new Pool({ connectionString, max: 1 });
  pool.on("error", (err) => console.error("Unexpected PostgreSQL pool error:", err));
  const result = await requestPool.run(pool, fn);
  return { result, close: () => pool.end() };
}

let nodeClient: PrismaClient | undefined;
let workerClient: PrismaClient | undefined;

function createNodeClient(): PrismaClient {
  // Configure PostgreSQL connection pool to prevent connection exhaustion
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,

    // Connection pool settings
    min: 2,                      // Minimum number of connections in pool
    max: 10,                     // Maximum number of connections in pool

    // Timeout settings
    idleTimeoutMillis: 30000,    // Close idle connections after 30 seconds
    connectionTimeoutMillis: 10000, // Fail after 10 seconds if no connection available

    // Connection lifecycle
    allowExitOnIdle: false,      // Keep pool alive even when idle
  });

  // Handle pool errors
  pool.on("error", (err) => {
    console.error("Unexpected PostgreSQL pool error:", err);
  });

  // Log pool stats in development
  if (process.env.NODE_ENV !== "production") {
    setInterval(() => {
      console.log(` - Pool: total=${pool.totalCount}, idle=${pool.idleCount}, waiting=${pool.waitingCount}`);
    }, 60000); // Log every minute
  }

  return new PrismaClient({ adapter: new PrismaPg(pool) });
}

const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = requestPool.getStore()
      ? (workerClient ??= new PrismaClient({ adapter: new PrismaPg(new RequestPoolFacade({}) as unknown as Pool) }))
      : (nodeClient ??= createNodeClient());
    const value = Reflect.get(client, prop, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

export default prisma;
