// NextAuth.js Authentication Configuration
// This file sets up authentication providers and options for the application
// Learn more: https://next-auth.js.org/configuration/options

import { PrismaAdapter } from '@next-auth/prisma-adapter';
import prisma from '@/lib/prisma';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import { LoginSchema } from '@/schemas';
import { getUserByEmail } from '@/data/user';
import bcrypt from 'bcryptjs';
import NextAuth from 'next-auth';

// Helper function to safely link OAuth accounts to existing users
async function linkAccountToExistingUser(
  existingUserId: string, 
  account: { 
    type: string; 
    provider: string; 
    providerAccountId: string; 
    access_token?: string; 
    expires_at?: number; 
    token_type?: string; 
    scope?: string; 
    id_token?: string; 
  }, 
  userProfile: { 
    image?: string; 
    name?: string; 
  }
) {
  try {
    // Create the account link
    await prisma.account.create({
      data: {
        userId: existingUserId,
        type: account.type,
        provider: account.provider,
        providerAccountId: account.providerAccountId,
        access_token: account.access_token,
        expires_at: account.expires_at,
        token_type: account.token_type,
        scope: account.scope,
        id_token: account.id_token,
      },
    });

    // Update user profile with OAuth data if missing
    const existingUser = await prisma.user.findUnique({
      where: { id: existingUserId },
    });

    if (existingUser && !existingUser.image && userProfile.image) {
      await prisma.user.update({
        where: { id: existingUserId },
        data: {
          image: userProfile.image,
          name: existingUser.name || userProfile.name,
        },
      });
    }

    console.log(`✅ Successfully linked ${account.provider} account to existing user ${existingUserId}`);
    return true;
  } catch (error) {
    console.error('❌ Error linking account:', error);
    return false;
  }
}

// Authentication configuration object
// This defines how authentication works in our application
export const authConfig = {
  // Database adapter - connects NextAuth to our Prisma database
  // This allows storing user sessions and account data in the database
  adapter: PrismaAdapter(prisma),
  
  // Session strategy - how we store user sessions
  // "jwt" = store session data in encrypted JWT tokens (faster, stateless)
  // "database" = store session data in database (more secure, allows session invalidation)
  session: {
    strategy: 'jwt' as const,
  },
  
  // Custom pages configuration
  // Override default NextAuth pages with our custom designs
  pages: {
    signIn: '/login', // Custom login page instead of default NextAuth page
  },
  
  // Authentication providers - different ways users can sign in
  providers: [
    // Google OAuth Provider
    // Allows users to sign in with their Google account
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,     // Google OAuth client ID from environment
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!, // Google OAuth secret from environment
      // Allow account linking - users can link Google to existing accounts
      allowDangerousEmailAccountLinking: true,
    }),
    
    // Credentials Provider
    // Allows users to sign in with email and password
    Credentials({
      // Define the login form fields
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      
      // Authorization function - validates user credentials
      // This runs when a user tries to sign in with email/password
      async authorize(credentials) {
        // Validate the input data using Zod schema
        const validatedFields = LoginSchema.safeParse(credentials);

        if (validatedFields.success) {
          const { email, password } = validatedFields.data;
          
          // Look up user by email in the database
          const user = await getUserByEmail(email);
          
          // If user doesn't exist or has no password (OAuth user), deny access
          if (!user || !user.password) return null;

          // Compare the provided password with the stored hash
          const passwordsMatch = await bcrypt.compare(
            password,
            user.password,
          );

          // If password matches, return user object (successful authentication)
          // If not, return null (authentication failed)
          if (passwordsMatch) return user;
        }

        // Authentication failed - invalid credentials
        return null;
      }
    })
  ],

  // Callbacks - customize NextAuth behavior
  // These functions run at specific points in the authentication flow
  callbacks: {
    // SignIn callback - runs when a user attempts to sign in
    // This is where we implement account linking logic
    async signIn({ user, account }: { 
      user: { id: string; email?: string | null; name?: string | null; image?: string | null }; 
      account: { type: string; provider: string; providerAccountId: string; access_token?: string; expires_at?: number; token_type?: string; scope?: string; id_token?: string } | null; 
    }) {
      try {
        // Only handle OAuth providers (not credentials)
        if (account && account.provider !== 'credentials' && user.email) {
          // Check if user with this email already exists
          const existingUser = await getUserByEmail(user.email);
          
          if (existingUser && existingUser.id !== user.id) {
            // User exists with different ID - need to link accounts
            console.log(`🔗 Attempting to link ${account.provider} account for email: ${user.email}`);
            
            // Check if they already have this provider linked
            const existingAccount = await prisma.account.findFirst({
              where: {
                userId: existingUser.id,
                provider: account.provider,
              },
            });

            if (!existingAccount) {
              // Link the new OAuth account to existing user
              const linkSuccess = await linkAccountToExistingUser(
                existingUser.id,
                account,
                {
                  image: user.image || undefined,
                  name: user.name || undefined,
                }
              );

              if (linkSuccess) {
                // Try to delete the duplicate user record created by OAuth
                try {
                  await prisma.user.delete({
                    where: { id: user.id },
                  });
                  console.log(`🗑️ Cleaned up duplicate user record: ${user.id}`);
                } catch (deleteError) {
                  console.log(`⚠️ Could not delete duplicate user record: ${deleteError}`);
                  // Don't fail the sign-in if cleanup fails
                }
              }
            } else {
              console.log(`ℹ️ ${account.provider} account already linked for user: ${existingUser.email}`);
            }
          }
        }
        
        // Allow sign in to proceed
        return true;
      } catch (error) {
        console.error('❌ SignIn callback error:', error);
        // Don't block sign-in on linking errors
        return true;
      }
    },

    // JWT callback - runs whenever a JWT is created, updated, or accessed
    // This ensures user data is properly included in the token
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async jwt({ token, user }: { token: any; user?: any }) {
      // When user signs in, add their database ID to the token
      if (user) {
        token.sub = user.id;
      }
      
      return token;
    },

    // Session callback - runs when session is checked
    // This shapes the session object that's returned to the client
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async session({ session, token }: { session: any; token: any }) {
      // Add user ID to session
      if (token.sub) {
        session.user.id = token.sub;
      }
      
      return session;
    },
  },
  
  // Secret key for signing JWT tokens and encrypting sessions
  // This should be a random string stored in environment variables
  secret: process.env.NEXTAUTH_SECRET,
};

// Create NextAuth handler with our configuration
// This creates the authentication API endpoints and functions
const handler = NextAuth(authConfig);

// Export HTTP handlers for the NextAuth API routes
// These handle GET and POST requests to /api/auth/*
export { handler as GET, handler as POST }; 