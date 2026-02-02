
import React from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useGames } from '../context/GameContext';
import { ScoreColumn } from '../types';

const MatchDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { matches, games, players } = useGames();
  
  const matchId = Number(id);
  const match = matches.find(m => m.id === matchId);
  const game = match ? games.find(g => g.id === match.gameId) : null;

  const handleBack = () => {
    // Navigate explicitly to the parent (Game Details) or Home to avoid history loops
    if (match && match.gameId) {
        navigate(`/game-details/${match.gameId}`);
    } else {
        navigate('/');
    }
  };

  if (!match || !game) {
    return (
        <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark text-slate-500">
            <div className="text-center">
                <span className="material-symbols-outlined text-4xl mb-2">search_off</span>
                <p>Wedstrijd niet gevonden</p>
                <button onClick={handleBack} className="mt-4 text-primary font-bold">Ga terug</button>
            </div>
        </div>
    );
  }

  // Determine which columns to show based on HISTORY of this match.
  // We explicitly check if the match results contain data for the columns configured in the game/extensions.
  let showColumns = false;
  let dynamicColumns: ScoreColumn[] = [];

  if (game.scoreType === 'custom') {
      // 1. Gather all POTENTIAL columns from Game + Used Extensions
      let potentialColumns = [...(game.customColumns || [])];
      
      const usedExtensionIds = match.extensionIds || [];
      usedExtensionIds.forEach(extId => {
          const ext = game.extensions?.find(e => e.id === extId);
          if (ext && ext.customColumns) {
              potentialColumns = [...potentialColumns, ...ext.customColumns];
          }
      });

      // 2. FILTER: Only keep columns that have data in this match's results.
      dynamicColumns = potentialColumns.filter(col => {
          return match.results.some(r => 
              r.scoreBreakdown && Object.prototype.hasOwnProperty.call(r.scoreBreakdown, col.id)
          );
      });

      if (dynamicColumns.length > 0) {
          showColumns = true;
      }

  } else if (game.scoreType === 'standard' && game.inputMethod === 'numeric') {
      // Standard Numeric Logic: Check for row_x keys
      const hasRows = match.results.some(r => r.scoreBreakdown && Object.keys(r.scoreBreakdown).some(k => k.startsWith('row_')));
      if (hasRows) {
          showColumns = true;
          // Determine max rows to rebuild column headers based on data
          let maxRows = 0;
          match.results.forEach(r => {
              if (r.scoreBreakdown) {
                  Object.keys(r.scoreBreakdown).forEach(k => {
                      if (k.startsWith('row_')) {
                          const idx = parseInt(k.replace('row_', ''));
                          if (!isNaN(idx) && idx + 1 > maxRows) maxRows = idx + 1;
                      }
                  });
              }
          });
          
          for (let i = 0; i < maxRows; i++) {
              dynamicColumns.push({
                  id: `row_${i}`,
                  name: maxRows > 1 ? `Rij ${i + 1}` : 'Score',
                  type: 'input'
              });
          }
      }
  }
  
  // Sort results by score (descending) usually, but for a transposed table 
  // sometimes it's nice to keep winner on left OR keep original order. 
  // Let's stick to Winner First (Left).
  const sortedResults = [...match.results].sort((a, b) => {
      const scoreA = typeof a.score === 'number' ? a.score : 0;
      const scoreB = typeof b.score === 'number' ? b.score : 0;
      // Winner first logic usually implies highest score, but check isWinner
      if (a.isWinner && !b.isWinner) return -1;
      if (!a.isWinner && b.isWinner) return 1;
      return scoreB - scoreA;
  });

  // Used extensions objects for display
  const usedExtensions = game.extensions?.filter(ext => match.extensionIds?.includes(ext.id)) || [];

  return (
    <div className="bg-background-light dark:bg-background-dark font-display antialiased min-h-screen flex flex-col max-w-md mx-auto relative shadow-2xl text-slate-900 dark:text-white">
      {/* Top App Bar */}
      <div className="sticky top-0 z-50 flex items-center bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-md p-4 pb-2 justify-between border-b border-gray-200 dark:border-gray-800">
        <button onClick={handleBack} className="text-gray-900 dark:text-white flex size-12 shrink-0 items-center justify-center rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors">
          <span className="material-symbols-outlined text-2xl">arrow_back</span>
        </button>
        <h2 className="text-gray-900 dark:text-white text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center">Resultaten</h2>
        
        <Link 
            to={`/edit-match/${match.id}`} 
            className="text-gray-900 dark:text-white flex size-12 shrink-0 items-center justify-center rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
        >
          <span className="material-symbols-outlined text-[20px]">edit</span>
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto pb-6">
        {/* Match Header Info */}
        <div className="p-6 text-center">
            <Link to={`/game-details/${game.id}`} className="inline-block p-4 rounded-2xl bg-surface-light dark:bg-surface-dark shadow-sm border border-gray-100 dark:border-gray-800 mb-4 hover:border-primary/50 transition-colors group">
                <div className="w-20 h-20 mx-auto rounded-xl bg-cover bg-center mb-3 shadow-inner group-hover:scale-105 transition-transform" style={{backgroundImage: `url("${game.image}")`}}></div>
                <h1 className="text-2xl font-black leading-tight group-hover:text-primary transition-colors">{game.title}</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 font-medium flex items-center justify-center gap-1">
                    {match.date}
                    {match.location && (
                        <>
                            <span>•</span>
                            <span className="flex items-center gap-0.5"><span className="material-symbols-outlined text-[14px]">place</span>{match.location}</span>
                        </>
                    )}
                </p>
                {/* Extensions Badges */}
                {usedExtensions.length > 0 && (
                    <div className="flex flex-wrap justify-center gap-1.5 mt-2 max-w-[200px] mx-auto">
                        {usedExtensions.map(ext => (
                            <span key={ext.id} className="text-[10px] font-bold px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-slate-600 dark:text-slate-300 rounded border border-gray-200 dark:border-gray-700">
                                + {ext.title}
                            </span>
                        ))}
                    </div>
                )}
            </Link>
            
            <div className="flex justify-center gap-4 text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {match.duration && (
                    <div className="flex items-center gap-1 bg-primary/10 text-primary px-3 py-1.5 rounded-full border border-primary/20">
                        <span className="material-symbols-outlined text-sm">timer</span>
                        {match.duration}
                    </div>
                )}
                <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded-full">
                    <span className="material-symbols-outlined text-sm">group</span>
                    {match.results.length} Spelers
                </div>
            </div>
        </div>

        {/* Score Table - TRANSPOSED: Players in Header, Categories in Left Column */}
        <div className="px-4">
            <div className="bg-surface-light dark:bg-surface-dark rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full border-separate border-spacing-0">
                        <thead>
                            <tr className="bg-gray-50 dark:bg-gray-800/50">
                                {/* Top Left Cell: "Onderdeel" */}
                                <th className="sticky left-0 z-20 bg-gray-50 dark:bg-gray-800/50 py-3 pr-4 pl-4 text-left align-bottom border-b-2 border-gray-200 dark:border-gray-700 min-w-[140px] border-r border-gray-200 dark:border-gray-800 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Onderdeel</span>
                                </th>
                                
                                {/* Player Headers */}
                                {sortedResults.map(result => {
                                    const player = players.find(p => p.id === result.playerId);
                                    if (!player) return null;
                                    
                                    return (
                                        <th key={result.playerId} className="p-2 min-w-[100px] text-center align-bottom border-b-2 border-gray-200 dark:border-gray-700 cursor-pointer group" onClick={() => navigate(`/profile/${player.id}`)}>
                                            <div className="flex flex-col items-center gap-1.5 pb-1 relative">
                                                <div className="relative">
                                                    <div 
                                                        className="w-10 h-10 rounded-full bg-cover bg-center bg-gray-200 dark:bg-gray-700 border-2 border-surface-light dark:border-surface-dark shadow-sm" 
                                                        style={{backgroundImage: `url("${player.image}")`}}
                                                    ></div>
                                                    {result.isWinner && (
                                                        <div className="absolute -top-1 -right-1 bg-green-500 text-white rounded-full p-0.5 border border-white dark:border-surface-dark z-10 shadow-sm">
                                                            <span className="material-symbols-outlined text-[8px] font-bold block">emoji_events</span>
                                                        </div>
                                                    )}
                                                    {result.isStarter && (
                                                        <div className="absolute -bottom-1 -left-1 bg-yellow-400 text-black rounded-full p-0.5 border border-white dark:border-surface-dark shadow-sm z-20" title="Startspeler">
                                                            <span className="material-symbols-outlined text-[8px] font-bold block">play_arrow</span>
                                                        </div>
                                                    )}
                                                </div>
                                                <span className={`text-xs font-bold truncate max-w-[90px] group-hover:text-primary transition-colors ${result.isWinner ? 'text-green-600 dark:text-green-400' : 'text-slate-900 dark:text-white'}`}>
                                                    {player.name}
                                                </span>
                                            </div>
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>
                        <tbody>
                            {/* Dynamic Score Columns (Now Rows) */}
                            {showColumns && dynamicColumns.map(col => (
                                <tr key={col.id} className="group hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                                    <td className="sticky left-0 z-10 bg-surface-light dark:bg-surface-dark group-hover:bg-gray-50 dark:group-hover:bg-[#151c2a] transition-colors py-3 pr-4 pl-4 text-left border-b border-gray-100 dark:border-gray-800 border-r border-gray-200 dark:border-gray-800 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-bold text-gray-900 dark:text-white truncate">{col.name}</span>
                                        </div>
                                    </td>
                                    
                                    {sortedResults.map(result => (
                                        <td key={`${result.playerId}-${col.id}`} className="p-3 border-b border-gray-100 dark:border-gray-800 text-center font-mono text-slate-600 dark:text-slate-400 font-medium">
                                            {result.scoreBreakdown ? (result.scoreBreakdown[col.id] ?? '-') : '-'}
                                        </td>
                                    ))}
                                </tr>
                            ))}

                            {/* Total Row */}
                            <tr className="bg-gray-100 dark:bg-gray-800/50 font-bold">
                                <td className="sticky left-0 z-10 bg-gray-100 dark:bg-[#151c2a] py-3 pr-4 pl-4 text-left border-t-2 border-gray-300 dark:border-gray-600 border-r border-gray-300 dark:border-gray-600 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                    <span className="text-gray-900 dark:text-white uppercase tracking-wider text-sm">Totaal</span>
                                </td>
                                {sortedResults.map(result => (
                                    <td key={`total-${result.playerId}`} className="px-4 py-3 text-center border-t-2 border-gray-300 dark:border-gray-600 font-mono text-lg">
                                        <span className={result.isWinner ? 'text-green-600 dark:text-green-400' : 'text-slate-900 dark:text-white'}>
                                            {result.score}
                                        </span>
                                    </td>
                                ))}
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

      </div>
    </div>
  );
};

export default MatchDetails;
