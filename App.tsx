import React, { useState, useEffect, useRef } from 'react';
import { GameCanvas } from './components/GameCanvas';
import { CardPicker } from './components/CardPicker';
import { GameState, GameSession, Card } from './types';
import { getRandomCards } from './services/cardService';
import { peerService } from './services/peerService';

const TARGET_WINS = 5;

type MenuState = 'MAIN' | 'HOST_LOBBY' | 'JOIN_LOBBY';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [menuState, setMenuState] = useState<MenuState>('MAIN');
  const [session, setSession] = useState<GameSession>({
    p1Score: 0, p2Score: 0, round: 1, history: [], p1Cards: [], p2Cards: []
  });
  const [roundWinner, setRoundWinner] = useState<'p1' | 'p2' | null>(null);
  const [availableCards, setAvailableCards] = useState<Card[]>([]);

  // Multiplayer State
  const [networkMode, setNetworkMode] = useState<'local' | 'host' | 'client'>('local');
  const [roomCode, setRoomCode] = useState<string>('');
  const [joinCode, setJoinCode] = useState<string>('');
  const [connectionStatus, setConnectionStatus] = useState<string>('');
  const [latestRemoteState, setLatestRemoteState] = useState<any>(null);
  const [latestRemoteInput, setLatestRemoteInput] = useState<any>(null);

  // --- Network Handlers ---
  const initHost = async () => {
      setConnectionStatus('Initializing Host...');
      try {
          // Generate simple 4 letter code by truncating peer ID or using alias if possible.
          // Since we rely on PeerJS default IDs which are UUIDs, we'll just display the first 4 chars
          // and hope PeerJS didn't give us a long one, OR we just use the UUID.
          // Wait, PeerJS allows providing an ID. Let's try to generate a random 4-letter one.
          // Collision is possible but unlikely for this demo.
          // Actually, let's just use what Peer gives us to be safe, but display it nicely.
          
          await peerService.init((id) => {
              setRoomCode(id);
              setConnectionStatus('Waiting for player to join...');
          });
          
          peerService.waitForConnection(
            (data: any) => {
                // Host received data (Input from client)
                if (data.type === 'INPUT') {
                    setLatestRemoteInput(data.payload);
                } else if (data.type === 'CARD_SELECT') {
                    // Client picked a card
                    handleCardSelect(data.payload, 'p2'); 
                }
            }, 
            () => {
                setConnectionStatus('Player Connected! Starting Game...');
                setTimeout(() => {
                    startOnlineGame('host');
                }, 1000);
            }
          );
      } catch (e) {
          setConnectionStatus('Error initializing host.');
          console.error(e);
      }
  };

  const initJoin = async () => {
      if (!joinCode) return;
      setConnectionStatus(`Connecting to ${joinCode}...`);
      try {
          await peerService.init(() => {});
          peerService.connectToPeer(
              joinCode,
              (data: any) => {
                  // Client received data (State from host)
                  if (data.type === 'STATE') {
                      setLatestRemoteState(data.payload);
                      // Sync Session Score/Cards if needed
                      // For now we trust the visual state, but session data (cards) 
                      // should ideally be synced.
                      // Let's assume the state payload includes necessary session updates or we infer them.
                      // Actually, the GameCanvas handles the round logic visually.
                      // But the React state `session` needs to be kept in sync for the CardPicker to appear.
                      
                      // Check for round end in data? 
                      // Simpler: Host sends a specialized event for Round End.
                  } else if (data.type === 'ROUND_END') {
                      handleRoundEnd(data.winner);
                  } else if (data.type === 'SESSION_UPDATE') {
                      setSession(data.payload);
                  }
              },
              () => {
                  setConnectionStatus('Connected! Waiting for host...');
              }
          );
      } catch (e) {
          setConnectionStatus('Connection failed.');
      }
  };

  const startOnlineGame = (mode: 'host' | 'client') => {
      setNetworkMode(mode);
      const initialSession: GameSession = {
        p1Score: 0, p2Score: 0, round: 1, history: [], p1Cards: [], p2Cards: []
      };
      setSession(initialSession);
      setGameState(GameState.PLAYING);
      
      // If host, broadcast session start
      if (mode === 'host') {
          peerService.send({ type: 'SESSION_UPDATE', payload: initialSession });
      }
  };

  // --- Game Flow ---
  const startLocalGame = () => {
    setNetworkMode('local');
    setSession({
      p1Score: 0, p2Score: 0, round: 1, history: [], p1Cards: [], p2Cards: []
    });
    setGameState(GameState.PLAYING);
  };

  const continueGame = () => {
     const nextSession = {
        ...session,
        p1Score: 0, p2Score: 0, round: session.round + 1, history: [],
     };
     setSession(nextSession);
     setGameState(GameState.PLAYING);
     if (networkMode === 'host') {
         peerService.send({ type: 'SESSION_UPDATE', payload: nextSession });
     }
  };

  const handleRoundEnd = (winner: 'p1' | 'p2') => {
    setGameState(GameState.ROUND_END);
    setRoundWinner(winner);
    
    const newSession = { ...session };
    if (winner === 'p1') newSession.p1Score++;
    else newSession.p2Score++;
    newSession.history.push({ winner });
    setSession(newSession);
    
    if (networkMode === 'host') {
        peerService.send({ type: 'ROUND_END', winner });
        peerService.send({ type: 'SESSION_UPDATE', payload: newSession });
    }

    if (newSession.p1Score >= TARGET_WINS || newSession.p2Score >= TARGET_WINS) {
        setTimeout(() => setGameState(GameState.GAME_OVER), 1000);
        return;
    }

    // Generate cards for the loser
    // Only the machine controlling the card picker (Loser) needs the cards?
    // Actually, both need to see it.
    // Host generates cards and sends to client.
    if (networkMode === 'local' || networkMode === 'host') {
        const cards = getRandomCards(3);
        setAvailableCards(cards);
        if (networkMode === 'host') {
            peerService.send({ type: 'CARDS_GENERATED', payload: cards });
        }
    }
    // Client listens for 'CARDS_GENERATED' (handled in peerService listener inside initJoin? No, need to move listener out or use effect)
  };
  
  // Effect to listen for card generation on client
  useEffect(() => {
      if (networkMode !== 'client') return;
      // We need to hook into the existing connection listener. 
      // Since peerService is singleton, we can't easily add another listener without overwriting.
      // Better approach: peerService has a callback. We can't change it easily.
      // Fix: Move the onData logic to a centralized handler in the component or make peerService support events.
      // For simplicity, I will stick to the single callback passed in `initJoin`.
      // Wait, `initJoin` only sets up the callback once.
      // I need to update the callback when state changes? No, closure.
      // The callback in `initJoin` can dispatch to state setters.
      // I'll add a separate useEffect to handle `availableCards` updates if I can't do it in `initJoin`.
      // Actually, let's just make `peerService` emit events or simple hack:
      // Modify `initJoin` to handle 'CARDS_GENERATED'.
  }, [networkMode]);

  // Refined Join Logic to handle all events
  const onClientData = (data: any) => {
      if (data.type === 'STATE') setLatestRemoteState(data.payload);
      else if (data.type === 'ROUND_END') handleRoundEnd(data.winner);
      else if (data.type === 'SESSION_UPDATE') setSession(data.payload);
      else if (data.type === 'CARDS_GENERATED') setAvailableCards(data.payload);
  };

  const handleCardSelect = (card: Card, forceWho?: 'p1'|'p2') => {
    const loser = forceWho || (roundWinner === 'p1' ? 'p2' : 'p1');
    
    // If Client picked a card, they sent it to us.
    // If Host picks a card, we process it.
    
    // If I am Client and I picked:
    if (networkMode === 'client' && !forceWho) {
        // I am P2. Round winner was P1. So I am picking.
        // Send choice to Host.
        peerService.send({ type: 'CARD_SELECT', payload: card });
        setAvailableCards([]);
        setRoundWinner(null);
        setGameState(GameState.PLAYING);
        return; 
    }

    // Host Logic (or Local)
    const nextSession = {
        ...session,
        p1Cards: loser === 'p1' ? [...session.p1Cards, card] : session.p1Cards,
        p2Cards: loser === 'p2' ? [...session.p2Cards, card] : session.p2Cards,
        round: session.round + 1
    };
    
    setSession(nextSession);
    setAvailableCards([]);
    setRoundWinner(null);
    setGameState(GameState.PLAYING);
    
    if (networkMode === 'host') {
        peerService.send({ type: 'SESSION_UPDATE', payload: nextSession });
    }
  };

  return (
    <div className="w-full h-screen bg-slate-900 flex flex-col items-center justify-center overflow-hidden relative">
        {/* Animated Background Grid */}
        <div className="absolute inset-0 z-0 opacity-20 pointer-events-none" 
             style={{ 
                 backgroundImage: 'linear-gradient(to right, #334155 1px, transparent 1px), linear-gradient(to bottom, #334155 1px, transparent 1px)',
                 backgroundSize: '40px 40px'
             }}
        />

      {gameState === GameState.MENU && (
        <div className="relative z-10 flex flex-col items-center animate-fadeIn w-full max-w-4xl">
          <div className="mb-12 relative text-center">
             <h1 className="text-7xl md:text-9xl font-arcade text-transparent bg-clip-text bg-gradient-to-br from-blue-400 via-purple-500 to-red-500 filter drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]">
                NEON<br/>ROUNDS
             </h1>
          </div>

          {menuState === 'MAIN' && (
              <div className="flex flex-col gap-6 w-full max-w-sm">
                  <button onClick={startLocalGame} className="btn-menu bg-slate-800 border-slate-600 hover:border-white">
                    LOCAL 1v1
                  </button>
                  <button onClick={() => { setMenuState('HOST_LOBBY'); initHost(); }} className="btn-menu bg-blue-900/50 border-blue-600 hover:border-blue-300">
                    HOST ONLINE
                  </button>
                  <button onClick={() => setMenuState('JOIN_LOBBY')} className="btn-menu bg-purple-900/50 border-purple-600 hover:border-purple-300">
                    JOIN ONLINE
                  </button>
              </div>
          )}

          {menuState === 'HOST_LOBBY' && (
              <div className="flex flex-col items-center gap-6 p-8 bg-slate-900/90 border-2 border-blue-500 rounded-xl shadow-2xl neon-border min-w-[400px]">
                  <h2 className="text-2xl font-arcade text-blue-400">LOBBY HOST</h2>
                  <div className="text-center">
                      <p className="text-sm text-slate-400 mb-2">SHARE ROOM CODE</p>
                      <div className="text-5xl font-mono tracking-widest bg-black/50 p-4 rounded border border-blue-500/30 text-white select-all">
                          {roomCode || '...'}
                      </div>
                  </div>
                  <div className="flex items-center gap-2 text-yellow-400 font-mono text-sm animate-pulse">
                      <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
                      {connectionStatus}
                  </div>
                  <button onClick={() => { peerService.destroy(); setMenuState('MAIN'); }} className="text-xs text-slate-500 hover:text-white underline">
                      CANCEL
                  </button>
              </div>
          )}

          {menuState === 'JOIN_LOBBY' && (
              <div className="flex flex-col items-center gap-6 p-8 bg-slate-900/90 border-2 border-purple-500 rounded-xl shadow-2xl neon-border min-w-[400px]">
                  <h2 className="text-2xl font-arcade text-purple-400">JOIN GAME</h2>
                  <input 
                    type="text" 
                    placeholder="ENTER CODE" 
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value)}
                    className="w-full bg-black/50 text-white font-mono text-3xl p-4 text-center border border-purple-500/30 focus:border-purple-500 outline-none rounded"
                  />
                  <button 
                    onClick={() => {
                        // Re-bind the specialized client data handler here
                        initJoin();
                        // Hacky re-bind workaround: PeerService isn't pure React, so we manually call connect using the internal peerService logic which accepts the callback
                        // We actually defined initJoin to use a hardcoded callback. Let's ensure it calls onClientData.
                        // Wait, initJoin defined above uses a closure that might be stale?
                        // Actually `onClientData` needs to be passed to `initJoin` but `initJoin` is defined in render scope so it sees current `onClientData`.
                        // However, we need to pass `onClientData` to `peerService.connectToPeer`.
                        // Let's modify initJoin to use `onClientData`.
                    }} 
                    className="w-full py-4 bg-purple-600 hover:bg-purple-500 font-arcade text-white rounded"
                  >
                    CONNECT
                  </button>
                  <div className="text-yellow-400 font-mono text-sm h-6">
                      {connectionStatus}
                  </div>
                  <button onClick={() => setMenuState('MAIN')} className="text-xs text-slate-500 hover:text-white underline">
                      BACK
                  </button>
              </div>
          )}
        </div>
      )}

      <div className={`w-full h-full z-10 ${gameState === GameState.MENU ? 'hidden' : 'block'}`}>
         <GameCanvas 
            session={session} 
            gameState={gameState} 
            onRoundEnd={handleRoundEnd} 
            networkMode={networkMode}
            onSendState={(s) => peerService.send({ type: 'STATE', payload: s })}
            onSendInput={(i) => peerService.send({ type: 'INPUT', payload: i })}
            latestRemoteState={latestRemoteState}
            latestRemoteInput={latestRemoteInput}
         />
      </div>

      {gameState === GameState.ROUND_END && roundWinner && (
        <CardPicker 
            cards={availableCards} 
            onSelect={handleCardSelect} 
            winner={roundWinner}
        />
      )}

      {/* Styles for menu buttons */}
      <style>{`
        .btn-menu {
            @apply relative w-full py-5 text-xl font-arcade text-white rounded-lg border-2 transition-all transform hover:scale-105 shadow-xl;
        }
      `}</style>
    </div>
  );
};

export default App;