// Prisma Client Setup - Database connection management
// This file implements the singleton pattern to prevent multiple Prisma Client instances
import { PrismaClient } from '@prisma/client';

// Declare a global variable 'prisma' in the NodeJS global type
// This extends the global type to include our Prisma Client instance
declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

// Create a Prisma Client instance using the singleton pattern
// In development: Store the instance on globalThis to prevent creating multiple instances during Hot Module Reloading (HMR)
// In production: Create a new instance if globalThis.prisma doesn't exist
// Determine the connection string. If a Fixie proxy database URL is provided,
// use it so that database connections originate from a static IP.
const connectionString =
  process.env.FIXIE_DATABASE_URL || process.env.DATABASE_URL;

const prisma = globalThis.prisma ||
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
    datasources: {
      db: {
        url: connectionString,
      },
    },
  });

// In development, store the Prisma instance on globalThis to persist across hot reloads
// This prevents the "Too many clients already" error in development
if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = prisma;
}

// Export the singleton Prisma Client instance
// This ensures all parts of the application use the same database connection
export default prisma;