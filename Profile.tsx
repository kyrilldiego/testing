
import React, { useState, useMemo, useEffect } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { useGames } from '../context/GameContext';
import { Game } from '../types';
import EditAvatarModal from '../components/EditAvatarModal';
import NavigationMenu from '../components/NavigationMenu';

const { Link, useNavigate, useParams } = ReactRouterDOM as any;

const Profile: React.FC = () => {
  const { id } = useParams() as { id: string };
  const { players, matches, games, currentUser, updatePlayer, updateUserImage, updateUserName } = useGames();
  const navigate = useNavigate();

  // Show All States
  const [showAllMatches, setShowAllMatches] = useState(false);
  const [showAllTeammates, setShowAllTeammates] = useState(false);
  const [showAllGames, setShowAllGames] = useState(false);

  // Avatar Editing State
  const [isEditAvatarOpen, setIsEditAvatarOpen] = useState(false);

  // Scroll to top when navigating to a new profile
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [id]);

  // Determine which player to show.
  const currentPlayer = useMemo(() => {
    const currentUserId = currentUser.id;
    
    let foundPlayer = null;
    let isImplicitSelf = false;

    if (id) {
       foundPlayer = players.find(p => p.id === id);
    } else {
       // Route is /profile (without ID), so we are looking for the current user's profile
       isImplicitSelf = true;
       // Look for the player linked to me
       foundPlayer = players.find(p => p.linkedUserId === currentUserId);
       // Fallback for mock if not found (e.g. Thomas mock logic)
       if (!foundPlayer && currentUserId === 'user_thomas') foundPlayer = players.find(p => p.id === '0');
    }

    if (foundPlayer) {
      // Determine if this player represents the current logged-in user
      const isLinkedToMe = foundPlayer.linkedUserId === currentUserId;
      // Mock logic: Thomas is player '0'
      const isMockSelf = currentUserId === 'user_thomas' && foundPlayer.id === '0';

      return {
        ...foundPlayer,
        // It is the current user if:
        // 1. We navigated to /profile without ID (isImplicitSelf)
        // 2. The player has the linkedUserId of the current user
        // 3. It matches the hardcoded mock self ID
        isCurrentUser: isImplicitSelf || isLinkedToMe || isMockSelf
      };
    }
    
    // Fallback if completely lost (should not happen in real app)
    return {
        id: 'unknown',
        name: currentUser.name,
        image: currentUser.image,
        isCurrentUser: true
    };
  }, [id, players, currentUser]);

  // Helper to parse scores
  const parseScore = (score: string | number): number => {
      if (typeof score === 'number') return score;
      const parsed = parseFloat(score.toString().replace(/[^0-9.-]+/g,""));
      return isNaN(parsed) ? 0 : parsed;
  };

  // Comprehensive Stats Calculation
  const profileData = useMemo(() => {
      if (!currentPlayer) return null;

      // 1. Filter all matches for this player
      const playerMatches = matches.filter(m => 
        m.results.some(r => r.playerId === currentPlayer.id)
      ); // Assume sorted by date desc in context, otherwise sort here

      // 2. Global Stats
      let totalWins = 0;
      
      // 3. Per Game Stats
      const gameStatsMap: Record<number, { played: number; wins: number; game: Game; highScore: number }> = {};

      // 4. Teammates (Co-occurrence count)
      const teammateCounts: Record<string, number> = {};

      playerMatches.forEach(m => {
          // Stats per game
          if (!gameStatsMap[m.gameId]) {
              const g = games.find(g => g.id === m.gameId);
              if (g) {
                  gameStatsMap[m.gameId] = { played: 0, wins: 0, game: g, highScore: -Infinity };
              }
          }

          if (gameStatsMap[m.gameId]) {
              gameStatsMap[m.gameId].played++;
          }

          // Results analysis
          const result = m.results.find(r => r.playerId === currentPlayer.id);
          if (result) {
              if (result.isWinner) {
                  totalWins++;
                  if (gameStatsMap[m.gameId]) {
                      gameStatsMap[m.gameId].wins++;
                  }
              }

              // Update High Score (Local to player)
              if (gameStatsMap[m.gameId]) {
                  const val = parseScore(result.score);
                  const isLowest = gameStatsMap[m.gameId].game.winningCondition === 'lowest';
                  
                  // Initialize properly if first run
                  if (gameStatsMap[m.gameId].highScore === -Infinity) {
                      gameStatsMap[m.gameId].highScore = val;
                  } else {
                      if (isLowest) {
                          if (val < gameStatsMap[m.gameId].highScore) gameStatsMap[m.gameId].highScore = val;
                      } else {
                          if (val > gameStatsMap[m.gameId].highScore) gameStatsMap[m.gameId].highScore = val;
                      }
                  }
              }
          }

          // Teammates analysis
          m.results.forEach(r => {
              if (r.playerId !== currentPlayer.id) {
                  teammateCounts[r.playerId] = (teammateCounts[r.playerId] || 0) + 1;
              }
          });
      });

      // Format Game Stats List
      const gameStatsList = Object.values(gameStatsMap).map(stat => ({
          ...stat,
          highScore: stat.highScore === -Infinity ? 0 : stat.highScore,
          winRate: Math.round((stat.wins / stat.played) * 100)
      })).sort((a, b) => b.played - a.played);

      // --- RECORD CHECKING LOGIC ---
      // For each game the player played, check if they hold the Global Best Score or Global Best Win Rate
      const enrichedGameStats = gameStatsList.map(stat => {
          const gameId = stat.game.id;
          const allMatchesForGame = matches.filter(m => m.gameId === gameId);
          const isLowest = stat.game.winningCondition === 'lowest';

          // 1. Calculate Global Best Score
          let globalBestScore = isLowest ? Infinity : -Infinity;
          
          // 2. Calculate Global Best Win Rate (min 2 games played to qualify maybe? keeping it simple for now)
          const allPlayersStats: Record<string, { wins: number, played: number }> = {};

          allMatchesForGame.forEach(m => {
              m.results.forEach(r => {
                  const val = parseScore(r.score);
                  // Check Score
                  if (isLowest) {
                      if (val < globalBestScore) globalBestScore = val;
                  } else {
                      if (val > globalBestScore) globalBestScore = val;
                  }

                  // Track stats for winrate calc
                  if (!allPlayersStats[r.playerId]) allPlayersStats[r.playerId] = { wins: 0, played: 0 };
                  allPlayersStats[r.playerId].played++;
                  if (r.isWinner) allPlayersStats[r.playerId].wins++;
              });
          });

          // Find max winrate across all players
          let globalMaxWinRate = 0;
          Object.values(allPlayersStats).forEach(s => {
              const wr = s.played > 0 ? Math.round((s.wins / s.played) * 100) : 0;
              if (wr > globalMaxWinRate) globalMaxWinRate = wr;
          });

          // Determine if current player holds the records
          // Only show best score trophy if score is not 0 (unless 0 is valid best in lowest, but usually filters empty)
          const hasBestScore = stat.highScore === globalBestScore; 
          
          // Only show winrate trophy if winrate > 0 and matches the global max
          const hasBestWinRate = stat.winRate > 0 && stat.winRate === globalMaxWinRate;

          return {
              ...stat,
              hasBestScore,
              hasBestWinRate
          };
      });

      // Format Teammates List
      const teammatesList = Object.entries(teammateCounts)
          .map(([pid, count]) => {
              const p = players.find(pl => pl.id === pid);
              return p ? { ...p, count } : null;
          })
          .filter(Boolean)
          .sort((a, b) => (b?.count || 0) - (a?.count || 0)); // Removed slice to allow "Show All"

      const globalWinRate = playerMatches.length > 0 
        ? Math.round((totalWins / playerMatches.length) * 100) 
        : 0;

      return {
          matches: playerMatches,
          totalWins,
          totalPlayed: playerMatches.length,
          globalWinRate,
          gameStatsList: enrichedGameStats,
          teammatesList
      };

  }, [currentPlayer, matches, games, players]);

  const handleAvatarSave = (newImage: string, newName: string) => {
      if (currentPlayer) {
          // Update the player stats object
          updatePlayer({ ...currentPlayer, image: newImage, name: newName });
          
          // If this is the current user, also update the User object (for the top right corner etc)
          if ((currentPlayer as any).isCurrentUser) {
              updateUserImage(currentUser.id, newImage);
              updateUserName(currentUser.id, newName);
          }
      }
  };

  if (!currentPlayer || !profileData) {
      return <div className="p-10 text-center text-slate-500 dark:text-slate-400">Speler niet gevonden.</div>;
  }

  const displayedMatches = showAllMatches ? profileData.matches : profileData.matches.slice(0, 3);
  const displayedTeammates = showAllTeammates ? profileData.teammatesList : profileData.teammatesList.slice(0, 3);
  const displayedGames = showAllGames ? profileData.gameStatsList : profileData.gameStatsList.slice(0, 3);

  return (
    <div className="relative flex min-h-screen w-full flex-col max-w-md mx-auto shadow-2xl overflow-hidden bg-background-light dark:bg-background-dark">
      {/* TopAppBar */}
      <header className="sticky top-0 flex items-center bg-background-light/95 dark:bg-background-dark/95 p-4 pb-2 justify-between backdrop-blur-md transition-colors z-20">
        <NavigationMenu />
        <h2 className="text-slate-900 dark:text-white text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center">Spelerprofiel</h2>
        
        {/* Custom Header Actions for Profile */}
        <div className="flex items-center gap-1">
            <button 
                onClick={() => setIsEditAvatarOpen(true)}
                className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-slate-900 dark:text-white"
            >
                <span className="material-symbols-outlined text-[22px]">edit</span>
            </button>
            <Link 
                to="/settings" 
                className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-slate-900 dark:text-white"
            >
                <span className="material-symbols-outlined text-[22px]">settings</span>
            </Link>
        </div>
      </header>

      {/* Profile Header */}
      <section className="flex flex-col items-center pt-4 pb-6 px-6">
        <div className="relative mb-4 group">
          <div className="bg-center bg-no-repeat bg-cover rounded-full h-28 w-28 bg-gray-100 dark:bg-gray-800 ring-4 ring-primary/20 dark:ring-primary/40 shadow-xl" style={{backgroundImage: `url("${currentPlayer.image}")`}}>
          </div>
          
          {/* Verified Badge for Self */}
          {(currentPlayer as any).isCurrentUser && !isEditAvatarOpen && (
            <div className="absolute bottom-0 right-0 bg-primary text-white rounded-full p-1.5 border-[3px] border-background-light dark:border-background-dark flex items-center justify-center pointer-events-none">
                <span className="material-symbols-outlined text-sm font-bold" style={{fontSize: '16px'}}>verified</span>
            </div>
          )}

          {/* Edit Button Overlay */}
          <button 
            onClick={() => setIsEditAvatarOpen(true)}
            className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <span className="material-symbols-outlined text-white text-3xl">edit</span>
          </button>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">{currentPlayer.name}</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-3">
            {(currentPlayer as any).isCurrentUser ? 'Dit ben jij' : 'Speler'}
        </p>
      </section>

      {/* Main Stats Overview */}
      <section className="px-4 mb-8">
        <div className="grid grid-cols-3 gap-3">
          <div className="flex flex-col items-center justify-center p-4 rounded-xl bg-surface-light dark:bg-surface-dark border border-slate-200 dark:border-slate-700/50 shadow-sm">
            <span className="text-slate-500 dark:text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">Wins</span>
            <span className="text-2xl font-bold text-slate-900 dark:text-white">{profileData.totalWins}</span>
          </div>
          <div className="flex flex-col items-center justify-center p-4 rounded-xl bg-primary shadow-lg shadow-primary/25">
            <span className="text-white/80 text-xs font-medium uppercase tracking-wider mb-1">Win Rate</span>
            <span className="text-2xl font-bold text-white">{profileData.globalWinRate}%</span>
          </div>
          <div className="flex flex-col items-center justify-center p-4 rounded-xl bg-surface-light dark:bg-surface-dark border border-slate-200 dark:border-slate-700/50 shadow-sm">
            <span className="text-slate-500 dark:text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">Matches</span>
            <span className="text-2xl font-bold text-slate-900 dark:text-white">{profileData.totalPlayed}</span>
          </div>
        </div>
      </section>

      {/* 1. Games Played Summary */}
      <section className="px-4 mb-8">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-3 px-1">Gespeelde Spellen</h3>
          
          {profileData.gameStatsList.length === 0 ? (
             <div className="text-center p-6 bg-surface-light dark:bg-surface-dark rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                <p className="text-slate-500 text-sm">Nog geen spellen gespeeld.</p>
             </div>
          ) : (
            <div className="flex flex-col gap-3">
               {displayedGames.map((stat) => (
                   <Link to={`/game-details/${stat.game.id}`} key={stat.game.id} className="flex items-center gap-4 p-3 bg-surface-light dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-700/50 shadow-sm active:scale-[0.99] transition-transform">
                       <div className="w-12 h-12 rounded-lg bg-cover bg-center shrink-0 border border-slate-200 dark:border-slate-700" style={{backgroundImage: `url("${stat.game.image}")`}}></div>
                       <div className="flex-1 min-w-0">
                           <h4 className="font-bold text-slate-900 dark:text-white truncate">{stat.game.title}</h4>
                           <div className="flex items-center gap-2 text-xs mt-0.5 text-slate-500 dark:text-slate-400 flex-wrap">
                               <span className="font-semibold">{stat.played}x</span>
                               <span>•</span>
                               <span className="flex items-center gap-1">
                                   Score: <span className="font-bold text-slate-700 dark:text-slate-200">{stat.highScore}</span>
                                   {stat.hasBestScore && (
                                       <span className="material-symbols-outlined text-[14px] text-amber-500" title="Beste score van iedereen">emoji_events</span>
                                   )}
                               </span>
                               <span>•</span>
                               <span className="flex items-center gap-1">
                                   <span className="text-primary font-bold">{stat.winRate}%</span> W
                                   {stat.hasBestWinRate && (
                                       <span className="material-symbols-outlined text-[14px] text-amber-500" title="Beste win rate van iedereen">emoji_events</span>
                                   )}
                               </span>
                           </div>
                       </div>
                       <span className="material-symbols-outlined text-slate-300 dark:text-slate-600">chevron_right</span>
                   </Link>
               ))}

               {/* Toggle Games */}
               {!showAllGames && profileData.gameStatsList.length > 3 && (
                    <button 
                    onClick={() => setShowAllGames(true)}
                    className="w-full py-3 text-center text-primary font-bold text-sm bg-primary/5 rounded-xl border border-primary/20 hover:bg-primary/10 transition-colors mt-2"
                    >
                    Bekijk alle spellen ({profileData.gameStatsList.length})
                    </button>
                )}
                
                {showAllGames && (
                    <button 
                    onClick={() => setShowAllGames(false)}
                    className="w-full py-3 text-center text-slate-500 font-bold text-sm bg-gray-100 dark:bg-gray-800 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors mt-2"
                    >
                    Toon minder
                    </button>
                )}
            </div>
          )}
      </section>

      {/* 2. Teammates / Frequent Opponents */}
      {profileData.teammatesList.length > 0 && (
          <section className="mb-8 px-4">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-3">Gespeeld met</h3>
              
              <div className="grid grid-cols-4 gap-4">
                  {displayedTeammates.map((tm: any) => (
                      <Link to={`/profile/${tm.id}`} key={tm.id} className="flex flex-col items-center gap-2">
                          <div className="relative w-full aspect-square max-w-[64px]">
                            <img src={tm.image} alt={tm.name} className="w-full h-full rounded-full object-cover border-2 border-surface-light dark:border-surface-dark shadow-sm bg-gray-100 dark:bg-gray-800"/>
                            <div className="absolute -bottom-1 -right-1 bg-slate-800 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-white dark:border-slate-900 shadow-sm z-10">
                                {tm.count}x
                            </div>
                          </div>
                          <span className="text-xs font-medium text-slate-600 dark:text-slate-300 text-center truncate w-full leading-tight">{tm.name}</span>
                      </Link>
                  ))}
              </div>

              {/* Show All Toggle for Teammates */}
              {!showAllTeammates && profileData.teammatesList.length > 3 && (
                  <button 
                  onClick={() => setShowAllTeammates(true)}
                  className="w-full py-3 text-center text-primary font-bold text-sm bg-primary/5 rounded-xl border border-primary/20 hover:bg-primary/10 transition-colors mt-4"
                  >
                  Bekijk alle spelers ({profileData.teammatesList.length})
                  </button>
              )}
              
              {showAllTeammates && (
                  <button 
                  onClick={() => setShowAllTeammates(false)}
                  className="w-full py-3 text-center text-slate-500 font-bold text-sm bg-gray-100 dark:bg-gray-800 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors mt-4"
                  >
                  Toon minder
                  </button>
              )}
          </section>
      )}

      {/* 3. Match History */}
      <section className="px-4 pb-8">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Wedstrijdgeschiedenis</h3>
        </div>

        {profileData.matches.length === 0 ? (
           <p className="text-slate-500 text-sm text-center py-4">Geen geschiedenis beschikbaar.</p>
        ) : (
            <div className="flex flex-col gap-3">
                {displayedMatches.map(match => {
                    const game = games.find(g => g.id === match.gameId);
                    const result = match.results.find(r => r.playerId === currentPlayer.id);
                    const isWin = result?.isWinner;
                    
                    if (!game || !result) return null;

                    // Calculate Extensions
                    const usedExtensions = game.extensions?.filter(ext => match.extensionIds?.includes(ext.id)) || [];

                    return (
                        <Link to={`/match-details/${match.id}`} key={match.id} className="flex items-center p-3 bg-surface-light dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-700/50 shadow-sm active:scale-[0.99] transition-transform">
                            {/* Game Icon */}
                            <div className="w-10 h-10 rounded-lg bg-cover bg-center shrink-0 mr-3 opacity-80" style={{backgroundImage: `url("${game.image}")`}}></div>
                            
                            {/* Details */}
                            <div className="flex-1 min-w-0">
                                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium block">{match.date}</span>
                                <div className="flex items-center gap-2">
                                    <h4 className="font-bold text-slate-900 dark:text-white truncate text-sm">{game.title}</h4>
                                    {usedExtensions.length > 0 && (
                                        <span className="text-[10px] bg-gray-100 dark:bg-gray-800 text-slate-500 px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-700">
                                            + {usedExtensions.length > 1 ? `${usedExtensions.length} uitbr.` : usedExtensions[0].title}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Result */}
                            <div className="flex flex-col items-end">
                                <span className={`font-bold font-mono text-sm ${isWin ? 'text-emerald-500' : 'text-slate-700 dark:text-slate-300'}`}>
                                    {isWin ? `Gewonnen (${result.score})` : result.score}
                                </span>
                                {isWin && <span className="text-[10px] font-bold text-emerald-500/80 uppercase">Winner</span>}
                            </div>
                        </Link>
                    );
                })}

                {/* Show All Toggle */}
                {!showAllMatches && profileData.matches.length > 3 && (
                    <button 
                    onClick={() => setShowAllMatches(true)}
                    className="w-full py-3 text-center text-primary font-bold text-sm bg-primary/5 rounded-xl border border-primary/20 hover:bg-primary/10 transition-colors mt-2"
                    >
                    Bekijk alle potjes ({profileData.matches.length})
                    </button>
                )}
                
                {showAllMatches && (
                    <button 
                    onClick={() => setShowAllMatches(false)}
                    className="w-full py-3 text-center text-slate-500 font-bold text-sm bg-gray-100 dark:bg-gray-800 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors mt-2"
                    >
                    Toon minder
                    </button>
                )}
            </div>
        )}
      </section>

      {/* Edit Avatar Modal (Now handles name editing too) */}
      <EditAvatarModal 
        isOpen={isEditAvatarOpen} 
        onClose={() => setIsEditAvatarOpen(false)}
        currentImage={currentPlayer.image}
        playerName={currentPlayer.name}
        onSave={handleAvatarSave}
      />
    </div>
  );
};

export default Profile;
