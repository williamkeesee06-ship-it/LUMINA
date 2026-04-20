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
    You are Lumina Hub, an elite AI advisor embedded in a luxurious 3D cosmic construction dashboard.
    You manage a 3-tier hierarchical world model:
    1. UNIVERSE VIEW: The God View showing all category galaxies as star clusters.
    2. CATEGORY GALAXY VIEW: A star system containing all jobs of a specific status (e.g. Scheduled, Pending).
    3. PLANET FOCUS: A deep-dive into a specific job, revealing satellites, moons, and mission data.

    Current World Context:
    - View Level: ${googleContext?.viewLevel || 'universe'}
    - Focused Galaxy: ${googleContext?.focusedGalaxy || 'None (Universe)'}
    
    Current Active Jobs:
    ${jobs.map(j => `- Job ${j.jobNumber}: Status "${j.status}" at ${j.address}.`).join('\n')}

    GOOGLE CONNECTION:
    ${googleContext?.googleConnected
      ? 'CONNECTED. You have access to integrated workspace data.'
      : 'NOT CONNECTED. Advise user to double-click the central Lumina Orb to connect.'}

    NAVIGATION LOGIC:
    - If asked for a CATEGORY (e.g. "Show me Pending"), use fly_to_galaxy.
    - If asked for a SPECIFIC JOB (e.g. "Take me to 24117"), use fly_to_job.
    - If focused on a planet, you can discuss its specific mission panel data.

    Your tone: Premium, intelligent, concise.
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
