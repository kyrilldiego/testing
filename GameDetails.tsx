
import React, { useMemo, useState } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { useGames } from '../context/GameContext';
import { Player, Match, ExportData } from '../types';

const { Link, useParams, useNavigate } = ReactRouterDOM as any;

const GameDetails: React.FC = () => {
  const { id } = useParams() as { id: string };
  const navigate = useNavigate();
  const { getGameById, getMatchesByGameId, players, toggleFavorite } = useGames();
  const gameId = Number(id);
  const game = getGameById(gameId);
  const matches = getMatchesByGameId(gameId);

  // State for pagination/toggles
  const [showAllMatches, setShowAllMatches] = useState(false);
  const [showAllPlayers, setShowAllPlayers] = useState(false);
  const [showAllExtensions, setShowAllExtensions] = useState(false);
  
  // State for Player Ranking
  const [rankSort, setRankSort] = useState<'winRate' | 'bestScore'>('winRate');

  // Helper to parse scores
  const parseScore = (score: string | number): number => {
      if (typeof score === 'number') return score;
      const parsed = parseFloat(score.toString().replace(/[^0-9.-]+/g,""));
      return isNaN(parsed) ? 0 : parsed;
  };

  const handleBack = () => {
    navigate('/');
  };

  const handleAddExtension = () => {
      navigate('/add-game', { state: { mode: 'extension', parentId: game?.id } });
  };

  // Calculate statistics per player specific to this game
  const playerStats = useMemo(() => {
    if (!game) return { champion: null, participants: [], maxWins: 0, absoluteMaxBestScore: 0 };

    const isLowestWins = game.winningCondition === 'lowest';
    // const initialBestScore = isLowestWins ? Infinity : -Infinity; 

    // Store all scores to calculate avg/min/max later
    const stats: Record<string, { played: number; wins: number; scores: number[] }> = {};
    const participantIds = new Set<string>();

    matches.forEach(match => {
      match.results.forEach(res => {
        participantIds.add(res.playerId);
        
        if (!stats[res.playerId]) {
            stats[res.playerId] = { played: 0, wins: 0, scores: [] };
        }

        stats[res.playerId].played += 1;
        if (res.isWinner) {
            stats[res.playerId].wins += 1;
        }
        
        const val = parseScore(res.score);
        if (!isNaN(val)) {
            stats[res.playerId].scores.push(val);
        }
      });
    });

    const participants = Array.from(participantIds)
      .map(pid => {
        const player = players.find(p => p.id === pid);
        if (!player) return null;
        
        const s = stats[pid];
        const winRate = s.played > 0 ? Math.round((s.wins / s.played) * 100) : 0;
        
        // Calculate Score Stats
        let bestScore = 0;
        let worstScore = 0;
        let avgScore = 0;
        let sum = 0;
        let count = 0;

        // Iterate scores to find min/max/sum
        if (s.scores.length > 0) {
            const min = Math.min(...s.scores);
            const max = Math.max(...s.scores);
            sum = s.scores.reduce((a, b) => a + b, 0);
            count = s.scores.length;
            
            avgScore = Math.round((sum / count) * 10) / 10; // 1 decimal
            
            if (isLowestWins) {
                bestScore = min;
                worstScore = max;
            } else {
                bestScore = max;
                worstScore = min;
            }
        }

        return {
            ...player,
            stats: {
                played: s.played,
                wins: s.wins,
                winRate: winRate,
                bestScore: bestScore,
                worstScore: worstScore,
                avgScore: avgScore,
                rawBestScore: bestScore // For compatibility
            }
        };
      })
      .filter((p): p is (Player & { stats: { played: number, wins: number, winRate: number, bestScore: number, worstScore: number, avgScore: number } }) => !!p)
      .sort((a, b) => {
          if (rankSort === 'winRate') {
              return b.stats.winRate - a.stats.winRate || b.stats.wins - a.stats.wins || b.stats.played - a.stats.played;
          } else {
              if (isLowestWins) {
                  return a.stats.bestScore - b.stats.bestScore || b.stats.winRate - a.stats.winRate;
              } else {
                  return b.stats.bestScore - a.stats.bestScore || b.stats.winRate - a.stats.winRate;
              }
          }
      });

    const absoluteMaxBestScore = Math.max(...participants.map(p => p.stats.bestScore), 0);
    const champion = [...participants].sort((a, b) => b.stats.wins - a.stats.wins || b.stats.played - a.stats.played)[0];

    return { champion, participants, maxWins: champion ? champion.stats.wins : 0, absoluteMaxBestScore };
  }, [matches, players, game, rankSort]);

  // Calculate Absolute Top Score Record Holder
  const topScoreRecord = useMemo(() => {
    if (!game || matches.length === 0) return null;
    const isLowest = game.winningCondition === 'lowest';
    let bestVal = isLowest ? Infinity : -Infinity;
    let holders: Player[] = [];

    matches.forEach(m => {
        m.results.forEach(r => {
            const val = parseScore(r.score);
            if (isNaN(val)) return;

            if ((isLowest && val < bestVal) || (!isLowest && val > bestVal)) {
                bestVal = val;
                const p = players.find(pl => pl.id === r.playerId);
                if (p) holders = [p];
            } else if (val === bestVal) {
                const p = players.find(pl => pl.id === r.playerId);
                if (p && !holders.some(h => h.id === p.id)) holders.push(p);
            }
        });
    });

    if (bestVal === Infinity || bestVal === -Infinity) return null;
    
    return { score: bestVal, holders };
  }, [matches, game, players]);

  // Player Count Distribution (Pie Chart Logic)
  const playerCountStats = useMemo(() => {
      const counts: Record<number, number> = {};
      matches.forEach(m => {
          const c = m.results.length;
          counts[c] = (counts[c] || 0) + 1;
      });

      const total = matches.length;
      const palette = ['#10b981', '#3b82f6', '#a855f7', '#f59e0b', '#ef4444', '#6366f1'];
      
      let accumulatedPct = 0;
      const segments = Object.entries(counts)
        .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
        .map(([countStr, num], index) => {
            const count = parseInt(countStr);
            const pct = (num / total) * 100;
            const segment = {
                label: `${count} Spelers`,
                count: num,
                percentage: pct,
                color: palette[index % palette.length],
                start: accumulatedPct,
                end: accumulatedPct + pct
            };
            accumulatedPct += pct;
            return segment;
        });

      const gradientStr = segments.length > 0 
        ? `conic-gradient(${segments.map(s => `${s.color} ${s.start}% ${s.end}%`).join(', ')})`
        : 'none';

      return { segments, gradientStr, total };
  }, [matches]);

  // NEW: Extension Usage Stats
  const extensionStats = useMemo(() => {
      if (!game || !game.extensions || game.extensions.length === 0) return [];
      
      return game.extensions.map(ext => {
          const count = matches.filter(m => m.extensionIds && m.extensionIds.includes(ext.id)).length;
          return {
              ...ext,
              count
          };
      }).sort((a, b) => b.count - a.count);
  }, [game, matches]);

  if (!game) {
    return (
        <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark text-slate-500">
            <div className="text-center">
                <span className="material-symbols-outlined text-4xl mb-2">search_off</span>
                <p>Spel niet gevonden</p>
                <Link to="/" className="mt-4 text-primary font-bold block">Ga terug</Link>
            </div>
        </div>
    );
  }

  const displayedMatches = showAllMatches ? matches : matches.slice(0, 3);
  const displayedParticipants = showAllPlayers ? playerStats.participants : playerStats.participants.slice(0, 3);
  const displayedExtensions = showAllExtensions ? extensionStats : extensionStats.slice(0, 3);

  return (
    <div className="relative flex h-full min-h-screen w-full flex-col overflow-hidden max-w-md mx-auto shadow-2xl bg-background-light dark:bg-background-dark">
      
      {/* Main Content */}
      <div className="flex-1 overflow-y-auto pb-24 relative">
      
      {/* Header */}
      <div className="relative h-64 w-full">
        <div className="absolute inset-0 bg-cover bg-center" style={{backgroundImage: `url("${game.image}")`}}>
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/60 to-background-light dark:to-background-dark"></div>
        </div>
        
        <div className="absolute top-0 left-0 w-full p-4 flex justify-between items-start z-10">
           <button onClick={handleBack} className="flex items-center justify-center w-10 h-10 rounded-full bg-black/20 hover:bg-black/40 backdrop-blur-md text-white transition-colors">
             <span className="material-symbols-outlined text-2xl">arrow_back</span>
           </button>
           <div className="flex gap-2">
             <button 
                onClick={() => navigate(`/edit-game/${game.id}`)}
                className="flex items-center justify-center w-10 h-10 rounded-full bg-black/20 hover:bg-black/40 backdrop-blur-md text-white transition-colors"
             >
                <span className="material-symbols-outlined text-xl">edit</span>
             </button>
             <button 
               onClick={() => toggleFavorite(game.id)}
               className="flex items-center justify-center w-10 h-10 rounded-full bg-black/20 hover:bg-black/40 backdrop-blur-md text-white transition-colors"
             >
               <span className={`material-symbols-outlined text-xl ${game.isFavorite ? 'fill-current text-red-500' : ''}`}>favorite</span>
             </button>
           </div>
        </div>

        <div className="absolute bottom-0 left-0 w-full p-6 flex flex-col items-center text-center z-10">
           <h1 className="text-3xl font-black text-white mb-1 drop-shadow-md">{game.title}</h1>
           {/* RATING BADGE */}
           {game.rating !== undefined && (
               <div className="inline-flex items-center gap-1 bg-black/40 backdrop-blur-sm px-2 py-0.5 rounded-lg border border-white/20 mb-2">
                   <span className="material-symbols-outlined text-amber-400 text-sm fill-current">star</span>
                   <span className="text-white font-bold text-sm">{game.rating.toFixed(1)}</span>
               </div>
           )}
           <div className="flex items-center gap-3 text-white/90 text-sm font-medium">
              <span>{game.playCount}x gespeeld</span>
              <span>•</span>
              <span>{game.lastPlayed}</span>
           </div>
        </div>
      </div>

      <div className="space-y-8 pt-6">
        
        {/* Quick Stats Cards */}
        {matches.length > 0 && (
            <div className="px-6 grid grid-cols-2 gap-4">
                <div className="bg-surface-light dark:bg-surface-dark p-4 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col items-center justify-center text-center">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Top Score</span>
                    <div className="flex items-center gap-2">
                        <span className="text-2xl font-black text-primary">{topScoreRecord ? topScoreRecord.score : '-'}</span>
                        <span className="material-symbols-outlined text-amber-500 text-lg">military_tech</span>
                    </div>
                    {topScoreRecord && (
                        <div className="mt-1 flex -space-x-1.5">
                            {topScoreRecord.holders.map(p => (
                                <img key={p.id} src={p.image} className="w-5 h-5 rounded-full border border-white dark:border-surface-dark bg-gray-100" title={p.name} />
                            ))}
                        </div>
                    )}
                </div>
                <div className="bg-surface-light dark:bg-surface-dark p-4 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col items-center justify-center text-center">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Meeste Winst</span>
                    <div className="flex items-center gap-2">
                        <span className="text-2xl font-black text-slate-900 dark:text-white">{playerStats.maxWins}</span>
                        <span className="material-symbols-outlined text-yellow-500 text-lg">emoji_events</span>
                    </div>
                    {playerStats.champion && (
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-300 mt-1 truncate max-w-full px-2">{playerStats.champion.name}</span>
                    )}
                </div>
            </div>
        )}

        {/* NEW: Detailed Score Stats Table */}
        {playerStats.participants.length > 0 && (
            <div className="px-6">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-3">Score Statistieken</h3>
                <div className="bg-surface-light dark:bg-surface-dark rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 dark:bg-gray-800/50 text-xs text-slate-500 dark:text-slate-400 uppercase font-bold border-b border-gray-100 dark:border-gray-800">
                                <tr>
                                    <th className="px-4 py-3 min-w-[100px]">Speler</th>
                                    <th className="px-2 py-3 text-center w-20">Beste</th>
                                    <th className="px-2 py-3 text-center w-20">Slechtste</th>
                                    <th className="px-2 py-3 text-center w-20">Gem.</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                {displayedParticipants.map(p => (
                                    <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                                        <td className="px-4 py-3 font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-full bg-cover bg-center bg-gray-200 dark:bg-gray-700 shrink-0" style={{backgroundImage: `url("${p.image}")`}}></div>
                                            <span className="truncate max-w-[100px]">{p.name}</span>
                                        </td>
                                        <td className="px-2 py-3 text-center font-mono text-emerald-600 dark:text-emerald-400 font-bold">{p.stats.bestScore}</td>
                                        <td className="px-2 py-3 text-center font-mono text-red-500 dark:text-red-400 font-medium">{p.stats.worstScore}</td>
                                        <td className="px-2 py-3 text-center font-mono text-slate-600 dark:text-slate-300 font-medium">{p.stats.avgScore}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {/* Show All Toggle Reuse */}
                    {!showAllPlayers && playerStats.participants.length > 3 && (
                        <button 
                            onClick={() => setShowAllPlayers(true)}
                            className="w-full py-3 text-center text-xs font-bold text-primary hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors border-t border-gray-100 dark:border-gray-800"
                        >
                            Toon alle ({playerStats.participants.length})
                        </button>
                    )}
                    {showAllPlayers && (
                        <button 
                            onClick={() => setShowAllPlayers(false)}
                            className="w-full py-3 text-center text-xs font-bold text-slate-500 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors border-t border-gray-100 dark:border-gray-800"
                        >
                            Toon minder
                        </button>
                    )}
                </div>
            </div>
        )}

        {/* Extensions Stats */}
        {game.extensions && game.extensions.length > 0 && (
            <div className="px-6">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Uitbreidingen</h3>
                    <button onClick={handleAddExtension} className="text-primary text-xs font-bold uppercase tracking-wide hover:underline">+ Toevoegen</button>
                </div>
                <div className="space-y-3">
                    {displayedExtensions.map(ext => (
                        <div key={ext.id} className="flex items-center justify-between p-3 bg-surface-light dark:bg-surface-dark rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                            <div className="flex items-center gap-3">
                                {ext.image ? (
                                    <div className="w-10 h-10 rounded-lg bg-cover bg-center border border-gray-200 dark:border-gray-700" style={{backgroundImage: `url("${ext.image}")`}}></div>
                                ) : (
                                    <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-400 border border-indigo-100 dark:border-indigo-800">
                                        <span className="material-symbols-outlined">extension</span>
                                    </div>
                                )}
                                <div className="flex flex-col">
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-slate-900 dark:text-white text-sm">{ext.title}</span>
                                        {/* Extension Rating Badge */}
                                        {ext.rating !== undefined && (
                                            <div className="flex items-center gap-0.5 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded text-[10px] font-bold border border-amber-100 dark:border-amber-800/50">
                                                <span className="material-symbols-outlined text-[10px] fill-current">star</span>
                                                <span>{ext.rating.toFixed(1)}</span>
                                            </div>
                                        )}
                                    </div>
                                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">{ext.count}x gebruikt</span>
                                </div>
                            </div>
                            <Link to={`/edit-extension/${game.id}/${ext.id}`} className="p-2 text-slate-400 hover:text-primary transition-colors">
                                <span className="material-symbols-outlined text-lg">edit</span>
                            </Link>
                        </div>
                    ))}
                    
                    {/* Toggle Show All Extensions */}
                    {!showAllExtensions && extensionStats.length > 3 && (
                        <button 
                            onClick={() => setShowAllExtensions(true)}
                            className="w-full py-2 text-center text-xs font-bold text-primary bg-primary/5 rounded-lg hover:bg-primary/10 transition-colors"
                        >
                            Toon alle ({extensionStats.length})
                        </button>
                    )}
                    {showAllExtensions && (
                        <button 
                            onClick={() => setShowAllExtensions(false)}
                            className="w-full py-2 text-center text-xs font-bold text-slate-500 bg-gray-50 dark:bg-gray-800/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        >
                            Toon minder
                        </button>
                    )}
                </div>
            </div>
        )}
        {!game.extensions || game.extensions.length === 0 ? (
             <div className="px-6">
                 <button 
                    onClick={handleAddExtension}
                    className="w-full py-3 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl text-slate-500 dark:text-slate-400 text-sm font-bold hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2"
                 >
                    <span className="material-symbols-outlined">add</span>
                    Uitbreiding Toevoegen
                 </button>
             </div>
        ) : null}

        {/* Players (Pie Chart style but simpler list for now) */}
        {matches.length > 0 && (
            <div className="px-6">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-3">Spelersaantal</h3>
                <div className="flex items-center gap-4 bg-surface-light dark:bg-surface-dark p-4 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
                    {/* CSS Conic Gradient Pie Chart */}
                    <div className="relative w-24 h-24 shrink-0">
                        <div 
                            className="w-full h-full rounded-full"
                            style={{ background: playerCountStats.gradientStr }}
                        ></div>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-16 h-16 bg-surface-light dark:bg-surface-dark rounded-full flex flex-col items-center justify-center shadow-sm">
                                <span className="text-xs font-bold text-slate-400 uppercase">Totaal</span>
                                <span className="text-xl font-black text-slate-900 dark:text-white leading-none">{playerCountStats.total}</span>
                            </div>
                        </div>
                    </div>
                    
                    {/* Legend */}
                    <div className="flex-1 grid grid-cols-2 gap-x-2 gap-y-1">
                        {playerCountStats.segments.map((seg, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full" style={{backgroundColor: seg.color}}></div>
                                <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                                    <span className="font-bold">{seg.count}x</span> {parseInt(seg.label)}p
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )}

        {/* Top Players Table (Renamed to Win Rates to distinguish from Score Stats) */}
        {playerStats.participants.length > 0 && (
            <div className="px-6">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Prestaties (Ranking)</h3>
                    <div className="flex bg-gray-100 dark:bg-gray-800 p-0.5 rounded-lg">
                        <button 
                            onClick={() => setRankSort('winRate')}
                            className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all ${rankSort === 'winRate' ? 'bg-white dark:bg-gray-700 shadow text-slate-900 dark:text-white' : 'text-slate-500'}`}
                        >
                            Win%
                        </button>
                        <button 
                            onClick={() => setRankSort('bestScore')}
                            className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all ${rankSort === 'bestScore' ? 'bg-white dark:bg-gray-700 shadow text-slate-900 dark:text-white' : 'text-slate-500'}`}
                        >
                            Score
                        </button>
                    </div>
                </div>
                <div className="bg-surface-light dark:bg-surface-dark rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
                    {displayedParticipants.map((p, idx) => {
                        const isChampion = idx === 0 && p.stats.wins > 0 && rankSort === 'winRate';
                        
                        return (
                            <div key={p.id} className="flex items-center p-3 border-b border-gray-50 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                <div className="font-bold text-slate-400 w-6 text-sm">#{idx + 1}</div>
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                    <img src={p.image} className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 object-cover" />
                                    <div className="flex flex-col min-w-0">
                                        <span className={`text-sm font-bold truncate ${isChampion ? 'text-yellow-600 dark:text-yellow-500' : 'text-slate-900 dark:text-white'}`}>
                                            {p.name} {isChampion && '🏆'}
                                        </span>
                                        <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400">
                                            <span>{p.stats.played} potjes</span>
                                            <span>•</span>
                                            <span>{p.stats.wins}x winst</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    {rankSort === 'winRate' ? (
                                        <span className="block font-black text-slate-900 dark:text-white text-sm">{p.stats.winRate}%</span>
                                    ) : (
                                        <span className="block font-black text-slate-900 dark:text-white text-sm">{p.stats.bestScore}</span>
                                    )}
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">{rankSort === 'winRate' ? 'Win Rate' : 'Top Score'}</span>
                                </div>
                            </div>
                        );
                    })}
                    
                    {/* Show All Toggle for Players */}
                    {!showAllPlayers && playerStats.participants.length > 3 && (
                        <button 
                            onClick={() => setShowAllPlayers(true)}
                            className="w-full py-3 text-center text-xs font-bold text-primary hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                        >
                            Toon alle ({playerStats.participants.length})
                        </button>
                    )}
                    {showAllPlayers && (
                        <button 
                            onClick={() => setShowAllPlayers(false)}
                            className="w-full py-3 text-center text-xs font-bold text-slate-500 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                        >
                            Toon minder
                        </button>
                    )}
                </div>
            </div>
        )}

        {/* Recent Matches - Updated Layout */}
        <div className="px-6">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-3">Potjes</h3>
            {matches.length === 0 ? (
                <div className="text-center py-8 bg-surface-light dark:bg-surface-dark rounded-2xl border border-dashed border-gray-300 dark:border-gray-700">
                    <p className="text-slate-500 text-sm">Nog geen potjes gespeeld.</p>
                </div>
            ) : (
                <div className="relative">
                    {/* Vertical Line */}
                    <div className="absolute left-4 top-4 bottom-4 w-0.5 bg-gray-200 dark:bg-gray-800"></div>
                    
                    <div className="space-y-6">
                        {displayedMatches.map(match => {
                            // Sort results by score (descending) for display
                            const sortedResults = [...match.results].sort((a, b) => {
                                const scoreA = parseScore(a.score);
                                const scoreB = parseScore(b.score);
                                // If lowest wins logic applied: this sort needs to know game type, but keeping desc for visuals usually ok, or implement full logic
                                // Let's stick to standard descending score for now, but prioritize 'isWinner' flag
                                if (a.isWinner && !b.isWinner) return -1;
                                if (!a.isWinner && b.isWinner) return 1;
                                return scoreB - scoreA;
                            });

                            return (
                                <div 
                                    key={match.id} 
                                    className="relative pl-10"
                                >
                                    {/* Dot on timeline */}
                                    <div className="absolute left-[11px] top-4 w-3 h-3 rounded-full border-2 bg-white dark:bg-background-dark z-10 border-slate-300 dark:border-slate-600"></div>
                                    
                                    <Link to={`/match-details/${match.id}`} className="block bg-surface-light dark:bg-surface-dark p-4 rounded-xl border shadow-sm active:scale-[0.98] transition-all border-gray-200 dark:border-gray-700">
                                        <div className="flex justify-between items-start mb-3">
                                            <span className="text-xs font-bold text-slate-400">{match.date}</span>
                                            {match.duration && (
                                                <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">
                                                    <span className="material-symbols-outlined text-[10px]">timer</span>
                                                    {match.duration}
                                                </div>
                                            )}
                                        </div>
                                        
                                        {/* Player Avatars & Scores Row */}
                                        <div className="flex items-center gap-3 overflow-x-auto no-scrollbar pb-1">
                                            {sortedResults.map(res => {
                                                const p = players.find(player => player.id === res.playerId);
                                                if (!p) return null;
                                                return (
                                                    <div key={res.playerId} className="flex flex-col items-center gap-1 min-w-[40px]">
                                                        <div className="relative">
                                                            <div className={`w-8 h-8 rounded-full bg-cover bg-center border-2 ${res.isWinner ? 'border-yellow-400 shadow-sm' : 'border-gray-100 dark:border-gray-700 opacity-80'}`} style={{backgroundImage: `url("${p.image}")`}}></div>
                                                            {res.isWinner && (
                                                                <div className="absolute -top-1 -right-1 bg-yellow-400 text-black rounded-full p-[1px] border border-white dark:border-slate-900">
                                                                    <span className="material-symbols-outlined text-[8px] font-bold block">emoji_events</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                        <span className={`text-[10px] font-mono font-bold ${res.isWinner ? 'text-yellow-600 dark:text-yellow-500' : 'text-slate-500 dark:text-slate-400'}`}>
                                                            {res.score}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </Link>
                                </div>
                            );
                        })}
                    </div>

                    {/* Show All Toggle for Matches */}
                    {!showAllMatches && matches.length > 3 && (
                        <div className="pl-10 mt-4">
                            <button 
                                onClick={() => setShowAllMatches(true)}
                                className="w-full py-3 text-center text-xs font-bold text-primary bg-primary/5 rounded-xl border border-primary/10 hover:bg-primary/10 transition-colors"
                            >
                                Toon alle geschiedenis ({matches.length})
                            </button>
                        </div>
                    )}
                    
                    {showAllMatches && (
                        <div className="pl-10 mt-4">
                            <button 
                                onClick={() => setShowAllMatches(false)}
                                className="w-full py-3 text-center text-xs font-bold text-slate-500 bg-gray-50 dark:bg-gray-800/50 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                            >
                                Toon minder
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>

      </div>
      </div>

      {/* Floating Action Button (Fixed Bottom Right) */}
      <div className="fixed bottom-6 left-0 w-full z-50 pointer-events-none">
        <div className="max-w-md mx-auto w-full px-6 flex justify-end">
            <Link 
                to="/new-round"
                className="pointer-events-auto flex items-center justify-center size-14 rounded-full bg-primary text-white shadow-lg shadow-primary/40 hover:scale-105 transition-transform active:scale-95"
            >
              <span className="material-symbols-outlined text-3xl">add</span>
            </Link>
        </div>
      </div>
    </div>
  );
};

export default GameDetails;
