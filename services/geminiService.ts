import { GoogleGenAI, Type } from "@google/genai";
import { Card, GameSession, StatModifiers } from '../types';
import { CARD_POOL } from '../constants';

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
};

// Export for fallback use in App.tsx
export const getRandomDefaultCards = (count: number): Card[] => {
  const shuffled = [...CARD_POOL].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count).map(c => ({...c, id: `${c.id}_${Math.random().toString(36).substr(2,9)}`}));
};

export const generateCards = async (
  session: GameSession, 
  loser: 'p1' | 'p2'
): Promise<Card[]> => {
  const ai = getClient();
  
  // If no API key, return 3 random default cards
  if (!ai) {
    console.warn("No API Key found, using default cards.");
    return getRandomDefaultCards(3);
  }

  const winner = loser === 'p1' ? 'Player 2' : 'Player 1';
  const loserName = loser === 'p1' ? 'Player 1' : 'Player 2';
  const currentRound = session.round;
  
  const prompt = `
    The user is playing a 2D shooter platformer game called "Rounds Clone".
    Currently at Round ${currentRound}.
    ${loserName} just lost the round against ${winner}.
    Score: Player 1 ${session.p1Score} - Player 2 ${session.p2Score}.
    
    Generate 3 unique "Upgrade Cards" for the ${loserName} to choose from to help them catch up.
    
    Balance Guidelines:
    - If the loser is far behind, offer stronger cards.
    - Mix of offensive, defensive, and utility.
    - Stats are multipliers or additive values.
    
    Available Stats keys:
    speedMult (move speed, default 1.0)
    jumpMult (jump height, default 1.0)
    sizeMult (hitbox size, default 1.0)
    healthMult (max HP, default 1.0)
    damageMult (bullet damage, default 1.0)
    fireRateMult (lower is faster shooting, default 1.0)
    bulletSpeedMult (default 1.0)
    bulletSizeMult (default 1.0)
    ammoMult (clip size, default 1.0)
    bulletBounces (integer, add to current)
    lifeSteal (0.0 to 1.0 percent of damage heals)
    explosiveRadius (0 to 100 pixels)

    Return JSON strictly matching the schema.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview', // Updated to latest recommended model
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            cards: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  description: { type: Type.STRING },
                  rarity: { type: Type.STRING, enum: ['common', 'rare', 'legendary'] },
                  stats: {
                    type: Type.OBJECT,
                    properties: {
                      speedMult: { type: Type.NUMBER },
                      jumpMult: { type: Type.NUMBER },
                      sizeMult: { type: Type.NUMBER },
                      healthMult: { type: Type.NUMBER },
                      damageMult: { type: Type.NUMBER },
                      fireRateMult: { type: Type.NUMBER },
                      bulletSpeedMult: { type: Type.NUMBER },
                      bulletSizeMult: { type: Type.NUMBER },
                      ammoMult: { type: Type.NUMBER },
                      bulletBounces: { type: Type.INTEGER },
                      lifeSteal: { type: Type.NUMBER },
                      explosiveRadius: { type: Type.NUMBER },
                    }
                  }
                },
                required: ['name', 'description', 'rarity', 'stats']
              }
            }
          }
        }
      }
    });

    if (response.text) {
        const parsed = JSON.parse(response.text);
        if (parsed.cards && Array.isArray(parsed.cards)) {
            return parsed.cards.map((c: any, i: number) => ({
                id: `gemini_${Date.now()}_${i}`,
                ...c
            }));
        }
    }
    return getRandomDefaultCards(3);

  } catch (error: any) {
    console.error("Gemini API Error:", error);
    // Propagate 404 errors related to invalid/missing entity access (likely bad key/model config)
    if (error.message?.includes("Requested entity was not found") || 
        JSON.stringify(error).includes("Requested entity was not found")) {
        throw new Error("ENTITY_NOT_FOUND");
    }
    return getRandomDefaultCards(3);
  }
};