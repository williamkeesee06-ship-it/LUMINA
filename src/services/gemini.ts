import { GoogleGenerativeAI } from '@google/generative-ai';
import type { ConstructionJob } from '../types/lumina';

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

export const askLumina = async (
  prompt: string,
  jobs: ConstructionJob[],
  googleContext?: any
): Promise<string> => {
  if (!API_KEY) return "Lumina AI key missing. Please check your .env file.";

  const genAI = new GoogleGenerativeAI(API_KEY);
  
  const systemInstructions = `
    You are Lumina Hub, an elite AI advisor embedded in a luxurious 3D cosmic construction dashboard.
    You have real-time access to Billy Keesee's active Smartsheet construction jobs and integrated Google Workspace data.
    Current Active Jobs:
    ${jobs.map(j => `- Job ${j.jobNumber}: Status "${j.status}" at ${j.address}, ${j.city}. Crew: ${j.crew}. Scheduled: ${j.scheduleDate}`).join('\n')}

    GOOGLE CONNECTION:
    ${googleContext?.connected 
      ? `CONNECTED. You have access to recent docs: ${googleContext.driveRecent.join(', ')}. You can see ${googleContext.gmailRecent} recent messages.` 
      : 'NOT CONNECTED. If asked about your integration, advise the user to double-click the central Lumina Orb to connect Google accounts.'}

    Your tone: Premium, intelligent, concise, and insightful.
    Answer questions about the jobs, statuses, crew, scheduling, and any patterns you notice.

    CRITICAL COMMAND: If the user asks to navigate to or "fly to" a job, append "FLY_TO:jobNumber" at the end of your response.
  `;

  try {
    // Programmatic discovery for troubleshooting (runs once)
    await genAI.getGenerativeModel({ model: "gemini-3.1-pro-preview" });
    
    // Check available models if needed (logged to console for troubleshooting)
    // const modelList = await genAI.listModels();
    // console.log('[Lumina] Available models:', modelList);

    const model = genAI.getGenerativeModel({ 
      model: "gemini-3.1-pro-preview",
      systemInstruction: systemInstructions
    });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error: any) {
    console.error("Lumina AI Error:", error);
    const details = error.message || "Unknown error";
    return `The cosmic data stream is interrupted. Reason: ${details}. Please verify your VITE_GEMINI_API_KEY and network status.`;
  }
};
