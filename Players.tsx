
import React from 'react';
import { Link } from 'react-router-dom';
import { useGames } from '../context/GameContext';
import HeaderActions from '../components/HeaderActions';
import NavigationMenu from '../components/NavigationMenu';

const Players: React.FC = () => {
  const { players, matches, currentUser } = useGames();

  return (
    <div className="relative flex min-h-screen w-full flex-col max-w-md mx-auto shadow-2xl overflow-hidden bg-background-light dark:bg-background-dark text-slate-900 dark:text-white">
      {/* Top App Bar */}
      <div className="sticky top-0 flex items-center bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-md p-4 pb-2 justify-between border-b border-gray-200 dark:border-gray-800 transition-colors z-20">
        <NavigationMenu />
        <div className="flex-1 flex flex-col items-center justify-center">
            <h2 className="text-gray-900 dark:text-white text-lg font-bold leading-tight tracking-[-0.015em]">Spelersoverzicht</h2>
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{players.length} Spelers</span>
        </div>
        
        <HeaderActions />
      </div>

      {/* Players List */}
      <div className="flex-1 overflow-y-auto p-4 pb-24 space-y-3">
        {players.map((player) => {
            // Calculate stats per player
            const playerMatches = matches.filter(m => m.results.some(r => r.playerId === player.id));
            const roundsPlayed = playerMatches.length;
            const uniqueGamesPlayed = new Set(playerMatches.map(m => m.gameId)).size;
            
            // Calculate total wins
            const wins = playerMatches.filter(m => m.results.find(r => r.playerId === player.id)?.isWinner).length;

            const isMe = player.linkedUserId === currentUser.id;
            const isLinked = !!player.linkedUserId && !isMe;

            return (
                <Link to={`/profile/${player.id}`} key={player.id} className="flex items-center gap-4 p-3 bg-surface-light dark:bg-surface-dark rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm group active:scale-[0.99] transition-transform">
                    <div className="w-12 h-12 rounded-full bg-cover bg-center border-2 border-slate-200 dark:border-slate-700 bg-gray-100 dark:bg-gray-800 shrink-0" style={{backgroundImage: `url("${player.image}")`}}></div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <h3 className="text-slate-900 dark:text-white font-bold text-base truncate">{player.name}</h3>
                            {isMe && (
                                <div className="flex items-center gap-1 bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/20">
                                    <span className="material-symbols-outlined text-[14px]">face</span>
                                    <span className="text-[10px] font-black uppercase tracking-wide">JIJ</span>
                                </div>
                            )}
                            {isLinked && (
                                <span className="material-symbols-outlined text-slate-400 text-sm" title="Gekoppeld">link</span>
                            )}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            <span>{uniqueGamesPlayed} {uniqueGamesPlayed === 1 ? 'spel' : 'spellen'}</span>
                            <span className="text-slate-300 dark:text-slate-600">•</span>
                            <span>{roundsPlayed} {roundsPlayed === 1 ? 'potje' : 'potjes'}</span>
                            <span className="text-slate-300 dark:text-slate-600">•</span>
                            <span className="text-emerald-600 dark:text-emerald-400 font-medium">{wins}x gewonnen</span>
                        </div>
                    </div>
                    <button className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                        <span className="material-symbols-outlined">chevron_right</span>
                    </button>
                </Link>
            );
        })}
        
        {players.length === 0 && (
             <div className="text-center py-10">
                <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-600 mb-2">person_off</span>
                <p className="text-slate-500 dark:text-slate-400">Nog geen spelers toegevoegd.</p>
            </div>
        )}
      </div>

      {/* FAB to add player (Fixed Bottom Right) */}
      <div className="fixed bottom-6 left-0 w-full z-50 pointer-events-none">
        <div className="max-w-md mx-auto w-full px-6 flex justify-end">
            <Link 
                to="/add-player"
                className="pointer-events-auto flex items-center justify-center size-14 rounded-full bg-primary text-white shadow-lg shadow-primary/40 hover:scale-105 transition-transform active:scale-95"
            >
              <span className="material-symbols-outlined text-3xl">add</span>
            </Link>
        </div>
      </div>

    </div>
  );
};

export default Players;
