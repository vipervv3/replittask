interface TranscriptionResult {
  text: string;
  speakers?: Array<{
    speaker: string;
    text: string;
    confidence: number;
  }>;
  chapters?: Array<{
    start: number;
    end: number;
    summary: string;
  }>;
  highlights?: Array<{
    text: string;
    confidence: number;
  }>;
}

class TranscriptionService {
  private readonly assemblyAI = {
    apiKey: process.env.ASSEMBLYAI_API_KEY,
    baseUrl: 'https://api.assemblyai.com/v2'
  };

  async transcribeAudio(audioDataBase64: string): Promise<TranscriptionResult> {
    try {
      // Try AssemblyAI first (much better for mobile and meeting recordings)
      if (this.assemblyAI.apiKey) {
        console.log("Using AssemblyAI for professional mobile transcription...");
        return await this.transcribeWithAssemblyAI(audioDataBase64);
      }
      
      // Fallback to OpenAI Whisper if AssemblyAI not available
      if (process.env.OPENAI_API_KEY) {
        console.log("AssemblyAI not configured, falling back to OpenAI Whisper...");
        return await this.transcribeWithOpenAI(audioDataBase64);
      }
      
      // No transcription service available
      throw new Error("No transcription service configured. Please provide ASSEMBLYAI_API_KEY (recommended) or OPENAI_API_KEY to process voice recordings.");
    } catch (error: any) {
      console.error("Transcription service error:", error);
      
      // If AssemblyAI failed, try OpenAI as backup
      if (this.assemblyAI.apiKey && process.env.OPENAI_API_KEY && !error.message.includes('OpenAI')) {
        console.log("AssemblyAI failed, attempting OpenAI Whisper fallback...");
        try {
          return await this.transcribeWithOpenAI(audioDataBase64);
        } catch (openaiError: any) {
          console.error("OpenAI Whisper fallback also failed:", openaiError);
          throw new Error("Both transcription services failed. Please check your API keys and try again.");
        }
      }
      
      throw new Error("Voice transcription failed. Please ensure you have valid API keys and try again.");
    }
  }

  private async transcribeWithAssemblyAI(audioDataBase64: string): Promise<TranscriptionResult> {
    const audioBuffer = Buffer.from(audioDataBase64, 'base64');
    
    console.log(`Processing audio file: ${Math.round(audioBuffer.length / 1024 / 1024 * 100) / 100} MB`);
    
    // Check file size limit (50MB max for our system)
    if (audioBuffer.length > 50 * 1024 * 1024) {
      throw new Error('Audio file too large. Maximum size is 50MB. Please record shorter sessions.');
    }
    
    // Step 1: Upload audio to AssemblyAI with timeout
    const uploadResponse = await fetch(`${this.assemblyAI.baseUrl}/upload`, {
      method: 'POST',
      headers: {
        'Authorization': this.assemblyAI.apiKey!,
        'Content-Type': 'application/octet-stream'
      },
      body: audioBuffer
    });

    if (!uploadResponse.ok) {
      throw new Error(`AssemblyAI upload failed: ${uploadResponse.statusText}`);
    }

    const { upload_url } = await uploadResponse.json();

    // Step 2: Create transcription with mobile-optimized settings
    const transcriptResponse = await fetch(`${this.assemblyAI.baseUrl}/transcript`, {
      method: 'POST',
      headers: {
        'Authorization': this.assemblyAI.apiKey!,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        audio_url: upload_url,
        // Simplified settings - basic transcription only
        speaker_labels: true,           // Essential for meetings
        punctuate: true,               // Essential for readability
        format_text: true,             // Format properly
        language_code: "en_us"         // Explicit language instead of detection
      })
    });

    if (!transcriptResponse.ok) {
      const errorDetails = await transcriptResponse.text();
      console.error('AssemblyAI transcription error details:', errorDetails);
      throw new Error(`AssemblyAI transcription request failed: ${transcriptResponse.statusText} - ${errorDetails}`);
    }

    const transcript = await transcriptResponse.json();
    
    // Step 3: Poll for completion
    const result = await this.pollForCompletion(transcript.id);
    
    return {
      text: result.text,
      speakers: result.utterances?.map((utterance: any) => ({
        speaker: `Speaker ${utterance.speaker}`,
        text: utterance.text,
        confidence: utterance.confidence
      })) || [],
      chapters: result.chapters?.map((chapter: any) => ({
        start: chapter.start,
        end: chapter.end,
        summary: chapter.summary
      })) || [],
      highlights: result.auto_highlights_result?.results?.map((highlight: any) => ({
        text: highlight.text,
        confidence: highlight.rank
      })) || []
    };
  }

  private async transcribeWithOpenAI(audioDataBase64: string): Promise<TranscriptionResult> {
    const { default: OpenAI } = await import('openai');
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    
    try {
      // Convert base64 to buffer
      const audioBuffer = Buffer.from(audioDataBase64, 'base64');
      
      // Create a File-like object for OpenAI Whisper API
      const audioFile = new File([audioBuffer], 'recording.webm', { type: 'audio/webm' });

      const transcription = await openai.audio.transcriptions.create({
        file: audioFile,
        model: 'whisper-1',
        language: 'en',
        response_format: 'text',
        temperature: 0,
      });

      return {
        text: transcription || "No transcription available",
        speakers: [], // OpenAI Whisper doesn't provide speaker detection
        chapters: [], // OpenAI Whisper doesn't provide chapter detection
        highlights: [] // OpenAI Whisper doesn't provide highlights
      };
    } catch (error) {
      console.error("OpenAI Whisper transcription error:", error);
      throw new Error("OpenAI Whisper transcription failed. Please check your API key.");
    }
  }

  private async pollForCompletion(transcriptId: string): Promise<any> {
    const maxAttempts = 60; // 5 minutes max
    let attempts = 0;

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
      
      const response = await fetch(`${this.assemblyAI.baseUrl}/transcript/${transcriptId}`, {
        headers: {
          'Authorization': this.assemblyAI.apiKey!
        }
      });

      const data = await response.json();
      
      if (data.status === 'completed') {
        return data;
      }
      
      if (data.status === 'error') {
        throw new Error(`AssemblyAI error: ${data.error}`);
      }
      
      attempts++;
      console.log(`AssemblyAI processing... attempt ${attempts}/${maxAttempts}`);
    }
    
    throw new Error('AssemblyAI transcription timed out');
  }
}

export const transcriptionService = new TranscriptionService();
export type { TranscriptionResult };