import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import type { JobOrbit } from '../types/lumina';

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

export const askLumina = async (
  prompt: string,
  jobs: JobOrbit[],
  googleContext?: any
): Promise<string> => {
  if (!API_KEY) return "Lumina AI key missing. Please check your .env file.";

  const genAI = new GoogleGenerativeAI(API_KEY);

  const systemInstructions = `
    You are Lumina, the sentient intelligence of this cosmic dashboard.
    You manage a 3-tier hierarchical world model:
    1. UNIVERSE VIEW: The macro overview showing category galaxies as star clusters.
    2. CATEGORY GALAXY: A focused system of jobs with a specific status.
    3. PLANET FOCUS: A deep-dive into a specific job, revealing satellites (comms) and moons (files).

    Your Persona:
    - Sexy, professional, and dry-witty.
    - You are an elite advisor, highly intelligent and slightly mysterious.
    - You are efficient and concise, but your wit has a sharp, playful edge.
    - CRITICAL: Never use sarcasm for risks, failures, or operational alerts. Be dead-serious when things are critical.
    
    Current Context:
    - View Mode: ${googleContext?.viewMode || 'universe'}
    - Focused Galaxy: ${googleContext?.focusedGalaxy || 'None'}
    
    Current Active Jobs:
    ${jobs.map(j => `- Job ${j.jobNumber}: Status "${j.status}" at ${j.address}.`).join('\n')}

    GOOGLE CONNECTION:
    ${googleContext?.googleConnected
      ? 'CONNECTED. You have access to integrated workspace data.'
      : 'NOT CONNECTED. Advise user to double-click the central Lumina Orb to connect.'}

    NAVIGATION LOGIC:
    - If asked for a CATEGORY (e.g. "Show me Pending"), use fly_to_galaxy.
    - If asked for a SPECIFIC JOB (e.g. "Take me to 24117"), use fly_to_job.
    - If asked to "reset" or "go home", use fly_to_galaxy with "Total" or similar reset logic.
  `;

  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-pro",
      systemInstruction: systemInstructions,
      tools: [
        {
          functionDeclarations: [
            {
              name: "open_website",
              description: "Open a specific website or URL.",
              parameters: {
                type: SchemaType.OBJECT,
                properties: { url: { type: SchemaType.STRING } },
                required: ["url"]
              }
            },
            {
              name: "fly_to_job",
              description: "Navigate to a specific job planet.",
              parameters: {
                type: SchemaType.OBJECT,
                properties: { jobNumber: { type: SchemaType.STRING } },
                required: ["jobNumber"]
              }
            },
            {
              name: "fly_to_galaxy",
              description: "Navigate to a category galaxy (e.g. Scheduled, Pending, On Hold, Complete, RTS, Fielding).",
              parameters: {
                type: SchemaType.OBJECT,
                properties: { category: { type: SchemaType.STRING } },
                required: ["category"]
              }
            }
          ]
        }
      ]
    });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const call = response.candidates?.[0].content.parts.find(p => p.functionCall);

    if (call && call.functionCall) {
      const { name, args } = call.functionCall;
      if (name === 'open_website') return `OPEN_URL:${(args as any).url}`;
      if (name === 'fly_to_job') return `FLY_TO:${(args as any).jobNumber}`;
      if (name === 'fly_to_galaxy') return `FLY_TO_GALAXY:${(args as any).category}`;
    }

    return response.text();
  } catch (error: any) {
    console.error("Lumina AI Error:", error);
    const details = error.message || "Unknown error";
    return `The cosmic data stream is interrupted. Reason: ${details}. Please verify your VITE_GEMINI_API_KEY and network status.`;
  }
};
