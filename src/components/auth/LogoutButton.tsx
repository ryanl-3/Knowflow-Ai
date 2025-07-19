// src/components/auth/LogoutButton.tsx
// Logout Button Component
// This component provides a simple way for users to sign out of the application
// It demonstrates NextAuth client-side logout functionality

"use client"; // Client component needed for user interaction

import { signOut } from 'next-auth/react'; // NextAuth client-side logout function
import { Button } from '@/components/ui/button';

export default function LogoutButton() {
  return (
    <Button
      variant="outline" // Use outline variant for a secondary button style
      onClick={() => signOut({ callbackUrl: '/' })} // Sign out and redirect to homepage
    >
      Sign Out
    </Button>
  );
}