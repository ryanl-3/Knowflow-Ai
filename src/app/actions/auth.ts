// Authentication Server Actions
// Server Actions are functions that run on the server and can be called from client components
// Learn more: https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations

"use server"; // Mark this file as containing Server Actions

import prisma from '@/lib/prisma';
import bcrypt from 'bcrypt';
import { z } from 'zod'; // Zod is used for runtime type validation

// Define validation schema for user registration
// This ensures all input data meets our requirements before processing
const registerSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }).optional().or(z.literal('')),
  email: z.string().email({ message: "Invalid email address." }),
  password: z.string().min(6, { message: "Password must be at least 6 characters." }),
});

// Server Action: Register a new user
// This function handles user registration with validation and security measures
export async function registerUser(formData: FormData) {
  // Step 1: Extract and validate input data using Zod schema
  // This ensures type safety and validates business rules
  const validatedFields = registerSchema.safeParse({
    name: formData.get('name') as string | undefined,
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  });

  // If validation fails, return detailed error information
  if (!validatedFields.success) {
    return {
      error: true,
      message: "Validation failed.",
      issues: validatedFields.error.flatten().fieldErrors,
    };
  }

  // Extract validated data
  const { name, email, password } = validatedFields.data;

  try {
    // Step 2: Check if user already exists
    // Prevent duplicate email addresses in the system
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return { error: true, message: "Email already in use." };
    }

    // Step 3: Hash the password for security
    // Never store plain text passwords in the database
    // The number 10 is the "salt rounds" - higher numbers are more secure but slower
    const hashedPassword = await bcrypt.hash(password, 10);

    // Step 4: Create the new user in the database
    await prisma.user.create({
      data: {
        email,
        password: hashedPassword, // Store the hashed password, not the original
        name: name, // Name is optional, can be null
      },
    });

    // Return success response
    return { success: true, message: "Registration successful!" };

  } catch (error) {
    // Log the error for debugging (in production, use proper logging)
    console.error("Registration error:", error);
    
    // Return generic error message to avoid leaking sensitive information
    return { error: true, message: "An error occurred during registration." };
  }
}