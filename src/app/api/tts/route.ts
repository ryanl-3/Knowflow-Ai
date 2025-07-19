import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authConfig } from '@/auth';
import * as SpeechSDK from 'microsoft-cognitiveservices-speech-sdk';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authConfig);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { text, voiceName, rate, pitch, volume } = await request.json();

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Invalid text' }, { status: 400 });
    }

    const azureKey = process.env.AZURE_TTS_KEY;
    const azureRegion = process.env.AZURE_TTS_REGION;

    if (!azureKey || !azureRegion) {
      return NextResponse.json({ error: 'Azure TTS not configured' }, { status: 500 });
    }

    const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(azureKey, azureRegion);
    speechConfig.speechSynthesisOutputFormat = SpeechSDK.SpeechSynthesisOutputFormat.Audio16Khz32KBitRateMonoMp3;
    speechConfig.speechSynthesisVoiceName = voiceName || "en-US-AvaMultilingualNeural";

    // Use SSML for better control
    const ssmlText = `
      <speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">
        <voice name="${speechConfig.speechSynthesisVoiceName}">
          <prosody rate="${rate || 'medium'}" pitch="${pitch || 'medium'}" volume="${volume || 'medium'}">
            ${text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}
          </prosody>
        </voice>
      </speak>
    `;

    return new Promise<NextResponse>((resolve) => {
      const synthesizer = new SpeechSDK.SpeechSynthesizer(speechConfig, undefined);

      synthesizer.speakSsmlAsync(
        ssmlText,
        (result) => {
          synthesizer.close();
          if (result.reason === SpeechSDK.ResultReason.SynthesizingAudioCompleted) {
            const audioData = Buffer.from(result.audioData);
            
            const response = new NextResponse(audioData, {
              status: 200,
              headers: {
                'Content-Type': 'audio/mpeg',
                'Content-Length': audioData.length.toString(),
                'Cache-Control': 'no-cache',
              }
            });
            
            resolve(response);
          } else {
            console.error("Speech synthesis canceled or failed: " + result.errorDetails);
            resolve(NextResponse.json({ 
              error: 'Speech synthesis failed', 
              details: result.errorDetails 
            }, { status: 500 }));
          }
        },
        (err) => {
          synthesizer.close();
          console.error("Error during speech synthesis: " + err);
          resolve(NextResponse.json({ 
            error: 'Speech synthesis error', 
            details: err 
          }, { status: 500 }));
        }
      );
    });

  } catch (error) {
    console.error('TTS API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 