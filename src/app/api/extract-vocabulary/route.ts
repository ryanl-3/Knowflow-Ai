import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authConfig } from '@/auth';
import prisma from '@/lib/prisma';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface VocabularyEntry {
  term: string;
  definition: string;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authConfig);
    console.log("👤 Session:", session);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { text, projectId, messageId } = await request.json();
    console.log("📨 Request body:", { text, projectId, messageId });  // 🔍 Debug input
    if (!text || !projectId) {
      return NextResponse.json({ error: 'Missing text or projectId' }, { status: 400 });
    }

    // Verify user owns the project
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId: session.user.id },
    });
    console.log("📁 Project found:", project);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Extract vocabulary using OpenAI
    const prompt = `
      From the following text, extract important technical terms, concepts, and definitions.
      Return the result as a JSON object with a "vocabulary" array, where each object has a "term" and a "definition" field.
      Focus on meaningful terms that would be useful in a vocabulary list.
      If no terms are found, return an empty array.

      Text:
      """
      ${text}
      """

      Return only the JSON object in this format:
      {
        "vocabulary": [
          {"term": "example term", "definition": "clear definition"}
        ]
      }
    `;

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      response_format: { type: "json_object" },
    });

    let extractedVocabulary: VocabularyEntry[] = [];
    const content = completion.choices[0]?.message?.content;

    if (content) {
      try {
        const parsedJson = JSON.parse(content);
        if (parsedJson.vocabulary && Array.isArray(parsedJson.vocabulary)) {
          extractedVocabulary = parsedJson.vocabulary.filter(
            (item: unknown): item is VocabularyEntry =>
              typeof item === 'object' &&
              item !== null &&
              'term' in item &&
              'definition' in item &&
              typeof (item as Record<string, unknown>).term === 'string' && 
              typeof (item as Record<string, unknown>).definition === 'string' &&
              ((item as Record<string, unknown>).term as string).trim() !== '' &&
              ((item as Record<string, unknown>).definition as string).trim() !== ''
          );
        }
      } catch (e) {
        console.error("Failed to parse LLM JSON output:", e);
      }
    }

    // Store in database (using upsert to handle duplicates)
    const savedVocabulary = [];
    for (const entry of extractedVocabulary) {
      try {
        const saved = await prisma.vocabularyWord.upsert({
          where: {
            projectId_term: {
              projectId: projectId,
              term: entry.term
            }
          },
          update: {
            definition: entry.definition,
            updatedAt: new Date()
          },
          create: {
            term: entry.term,
            definition: entry.definition,
            projectId: projectId,
            messageId: messageId || null
          }
        });
        savedVocabulary.push(saved);
      } catch (error) {
        console.error(`Error saving vocabulary term "${entry.term}":`, error);
      }
    }

    return NextResponse.json({ 
      vocabulary: savedVocabulary,
      count: savedVocabulary.length 
    });

  } catch (error) {
    console.error('Error extracting vocabulary:', error);
    return NextResponse.json({ error: 'Failed to extract vocabulary' }, { status: 500 });
  }
} 