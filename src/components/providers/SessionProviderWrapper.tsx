// SessionProvider Wrapper Component
// This component wraps the NextAuth SessionProvider to make session data available throughout the app
"use client"; // Must be declared at the top - this is a client-side component!

import { SessionProvider } from "next-auth/react";
import React from "react"; // Import React for TypeScript

// Define Props type interface to accept children components
interface Props {
  children: React.ReactNode;
  // Optional: If you fetch session data in layout.tsx, you can pass it here to SessionProvider
  // This helps avoid loading states and improves user experience
  // session?: any;
}

// Export the SessionProvider wrapper component
// The SessionProvider automatically handles session state management
// It provides session data to all child components via React Context
export default function SessionProviderWrapper({ children }: Props) {
  // SessionProvider automatically handles session state - no need to manually pass session prop
  // It will fetch and manage session data internally
  return <SessionProvider>{children}</SessionProvider>;
}