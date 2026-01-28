import { Card } from '../types';
import { CARD_POOL } from '../constants';

export const getRandomCards = (count: number): Card[] => {
  // Shuffle the pool
  const shuffled = [...CARD_POOL].sort(() => 0.5 - Math.random());
  
  // Pick unique cards and assign a unique ID for this instance
  return shuffled.slice(0, count).map(c => ({
    ...c, 
    id: `${c.id}_${Math.random().toString(36).substr(2,9)}`
  }));
};