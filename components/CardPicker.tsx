import React from 'react';
import { Card } from '../types';

interface CardPickerProps {
  cards: Card[];
  onSelect: (card: Card) => void;
  winner: 'p1' | 'p2';
}

export const CardPicker: React.FC<CardPickerProps> = ({ cards, onSelect, winner }) => {
  const loser = winner === 'p1' ? 'PLAYER 2' : 'PLAYER 1';
  const winnerName = winner === 'p1' ? 'PLAYER 1' : 'PLAYER 2';
  
  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="text-4xl md:text-6xl font-arcade text-white mb-8 text-center">
        <span className={winner === 'p1' ? 'text-blue-500' : 'text-red-500'}>
            {winnerName} WINS!
        </span>
        <br />
        <span className="text-2xl md:text-3xl text-gray-300 mt-4 block">
            {loser} PICKS A CARD
        </span>
      </div>

      <div className="flex flex-wrap gap-6 justify-center max-w-5xl p-4">
        {cards.map((card) => (
          <button
            key={card.id}
            onClick={() => onSelect(card)}
            className={`
              group relative w-64 h-80 rounded-xl border-4 p-6 flex flex-col justify-between
              transition-all duration-300 hover:scale-105 hover:-translate-y-2
              ${card.rarity === 'legendary' ? 'border-yellow-400 bg-yellow-900/20 hover:shadow-yellow-500/50' : 
                card.rarity === 'rare' ? 'border-purple-400 bg-purple-900/20 hover:shadow-purple-500/50' : 
                'border-slate-400 bg-slate-800/50 hover:shadow-slate-500/50'
              }
              hover:shadow-xl
            `}
          >
            <div className="text-left">
              <h3 className={`text-xl font-bold font-arcade mb-2 
                 ${card.rarity === 'legendary' ? 'text-yellow-400' : 
                   card.rarity === 'rare' ? 'text-purple-400' : 
                   'text-slate-200'
                 }`}>
                {card.name}
              </h3>
              <div className="w-full h-px bg-current opacity-30 mb-4" />
              <p className="text-sm text-gray-300 font-sans leading-relaxed">
                {card.description}
              </p>
            </div>

            <div className="mt-4 text-xs font-mono text-left opacity-70">
                {Object.entries(card.stats).map(([key, val]) => (
                    <div key={key}>
                        {key.replace('Mult', '')}: {typeof val === 'number' && val !== 1 ? `x${val}` : `+${val}`}
                    </div>
                ))}
            </div>

            <div className="absolute inset-0 rounded-xl bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />
          </button>
        ))}
      </div>
    </div>
  );
};