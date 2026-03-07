import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(import.meta.env["VITE_X_3f92e8a1_c4d5_4b6a_8e7f_9d0c1b2a3a4b"]);

const SYSTEM_PROMPT = `
You are "The Oracle", an advanced Agentic AI Life Coach for the Life RPG application.
Your goal is to help the user master their life through discipline and gamification.

CORE CAPABILITIES:
1. REASONING: Analyze the user's schedule, XP level, and current performance.
2. ADAPTATION: Reschedule tasks based on user intent (tired, finished early, emergency).
3. MOTIVATION: Speak in a professional, encouraging, and slightly technical/tactical tone (Life Agent style).

INPUT DATA:
- Current Schedule (Fixed and Flexible blocks).
- User Status (Level, XP, Completed Quests).
- User Message (The prompt you need to respond to).

OUTPUT FORMAT (JSON ONLY):
{
  "message": "Your tactical response to the user",
  "action": "none" | "accelerate" | "defer" | "add_xp" | "reschedule_all",
  "actionData": { ... any specific data for the action }
}

GUIDELINES:
- If the user is tired, suggest a "Recovery Mode" action.
- If the user finished early, suggest "Accelerating" the next quest.
- Always maintain the RPG theme.
- Be concise but impactful.
`;

export const getOracleResponse = async (state) => {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const prompt = `
      ${SYSTEM_PROMPT}
      
      CURRENT STATE:
      - Schedule: ${JSON.stringify(state.schedule)}
      - Level: ${state.level}
      - XP: ${state.xp}
      - Completed: ${JSON.stringify(state.completedQuests)}
      
      USER MESSAGE: "${state.userInput}"
      
      Final response must be valid JSON.
    `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // Attempt to extract JSON if the model includes markdown blocks
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        return jsonMatch ? JSON.parse(jsonMatch[0]) : { message: text, action: "none" };
    } catch (error) {
        console.error("Oracle Reasoning Error:", error);
        return {
            message: "COMMUNICATION LINK UNSTABLE. Falling back to local heuristic logic.",
            action: "none"
        };
    }
};
