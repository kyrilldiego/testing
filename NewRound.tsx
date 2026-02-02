
import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { useGames } from '../context/GameContext';
import { ScoreColumn, Match, MatchResult, GameExtension, Game } from '../types';
import LocationSelector from '../components/LocationSelector';
import GameForm from '../components/GameForm';

const { Link, useSearchParams, useNavigate } = ReactRouterDOM as any;

const NewRound: React.FC = () => {
  const { games, players, matches, addMatch, updateGame, currentUser, autoStartTimer, addLocation, defaultPlayerIds } = useGames();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  // State
  const [selectedGameId, setSelectedGameId] = useState<number | null>(null);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  // Scores: Record<PlayerId, Record<ColumnId, Value>>
  const [scores, setScores] = useState<Record<string, Record<string, number>>>({});
  
  // Team Assignments: Record<PlayerId, TeamId>
  const [playerTeams, setPlayerTeams] = useState<Record<string, string>>({});
  const [activeTeams, setActiveTeams] = useState<string[]>(['1', '2']);

  // Extensions State
  const [selectedExtensionIds, setSelectedExtensionIds] = useState<string[]>([]);
  // New State for Full Modal Extension Creation
  const [showExtensionModal, setShowExtensionModal] = useState(false);

  // Standard Game Multi-row State
  const [standardRowCount, setStandardRowCount] = useState(1);

  // Timer State
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [showTimerToast, setShowTimerToast] = useState(false);

  // Location State
  const [location, setLocation] = useState('');

  // Starting Player State
  const [startingPlayerId, setStartingPlayerId] = useState<string | null>(null);
  const [isManualSelectionMode, setIsManualSelectionMode] = useState(false);

  // Wheel Animation State
  const [isSpinning, setIsSpinning] = useState(false);
  const [spinningPlayerId, setSpinningPlayerId] = useState<string | null>(null);
  const [spinWinnerId, setSpinWinnerId] = useState<string | null>(null);

  // Dropdown / Search State
  const [isGameDropdownOpen, setIsGameDropdownOpen] = useState(false);
  const [gameSearchQuery, setGameSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const hasInitializedSelection = useRef(false);

  // Modal State
  const [showDiscardModal, setShowDiscardModal] = useState(false);

  // Initialize from URL or defaults
  useEffect(() => {
    const paramId = searchParams.get('gameId');
    let targetGameId: number | null = null;

    if (paramId) {
      const id = parseInt(paramId);
      if (games.some(g => g.id === id)) {
        targetGameId = id;
      }
    } else if (games.length > 0 && !selectedGameId) {
      targetGameId = games[0].id;
    }

    if (targetGameId) {
        setSelectedGameId(targetGameId);
        // Initialize rows based on game type logic
        const g = games.find(g => g.id === targetGameId);
        if (g?.scoreType === 'standard') {
            setStandardRowCount(3); // Default to 3 rows for Standard/Excel style
        } else {
            setStandardRowCount(1);
        }
    }
  }, [searchParams, games]); // Don't include selectedGameId to avoid loops

  // Sync search query with selected game title
  useEffect(() => {
    if (selectedGameId) {
        const game = games.find(g => g.id === selectedGameId);
        if (game) {
            setGameSearchQuery(game.title);
        }
        // Reset extensions when game changes
        setSelectedExtensionIds([]);
    }
  }, [selectedGameId, games]);

  // Timer Interval Logic
  useEffect(() => {
    let interval: any;
    if (isTimerRunning) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning]);

  // Auto-Start Timer when Starter is picked
  useEffect(() => {
    // Only auto-start if:
    // 1. A starter is selected
    // 2. The timer is currently NOT running
    // 3. The timer is at 0 (meaning it's the start of the game, not a resume)
    // 4. The user setting is enabled
    if (startingPlayerId && !isTimerRunning && timerSeconds === 0 && autoStartTimer) {
        setIsTimerRunning(true);
        setShowTimerToast(true);
    }
  }, [startingPlayerId, isTimerRunning, timerSeconds, autoStartTimer]);

  // Separate effect for Toast timeout to avoid cleanup issues when timerSeconds updates
  useEffect(() => {
    if (showTimerToast) {
        const timer = setTimeout(() => {
            setShowTimerToast(false);
        }, 3000); // 3 seconds visibility
        return () => clearTimeout(timer);
    }
  }, [showTimerToast]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsGameDropdownOpen(false);
        if (selectedGameId) {
            const game = games.find(g => g.id === selectedGameId);
            if (game) setGameSearchQuery(game.title);
        }
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [selectedGameId, games]);

  const filteredGames = useMemo(() => {
    if (!gameSearchQuery) return games;
    const selectedGame = games.find(g => g.id === selectedGameId);
    if (selectedGame && selectedGame.title === gameSearchQuery) return games;
    return games.filter(g => g.title.toLowerCase().includes(gameSearchQuery.toLowerCase()));
  }, [games, gameSearchQuery, selectedGameId]);

  const sortedPlayers = useMemo(() => {
    const playCounts: Record<string, number> = {};
    matches.forEach(match => {
        match.results.forEach(result => {
            playCounts[result.playerId] = (playCounts[result.playerId] || 0) + 1;
        });
    });
    return [...players].sort((a, b) => {
        const countA = playCounts[a.id] || 0;
        const countB = playCounts[b.id] || 0;
        return countB - countA;
    });
  }, [players, matches]);

  // Initialize selected players (Defaults + Me > Frequent)
  useEffect(() => {
    if (hasInitializedSelection.current) return;
    if (players.length === 0) return;

    const myPlayer = players.find(p => p.linkedUserId === currentUser.id);
    let initialSelection: string[] = [];

    // 1. Check for Configured Defaults
    if (defaultPlayerIds.length > 0) {
        // Filter out any IDs that might have been deleted
        const validDefaults = defaultPlayerIds.filter(id => players.some(p => p.id === id));
        initialSelection = [...validDefaults];
        
        // ENFORCE: Always add "Me" if not already in the defaults list
        if (myPlayer && !initialSelection.includes(myPlayer.id)) {
            initialSelection.push(myPlayer.id);
        }
    } 
    // 2. Fallback to "Me + Frequent" logic if no defaults set
    else {
        // Always select 'Me' if found
        if (myPlayer) {
            initialSelection.push(myPlayer.id);
            
            // Add one more most frequent player who isn't me to make a pair
            const opponent = sortedPlayers.find(p => p.id !== myPlayer.id);
            if (opponent) {
                initialSelection.push(opponent.id);
            }
        } else {
            // Fallback if 'Me' not found (unlikely but possible with local-only setup)
            // Select top 2 frequent players
            if (sortedPlayers.length >= 1) initialSelection.push(sortedPlayers[0].id);
            if (sortedPlayers.length >= 2) initialSelection.push(sortedPlayers[1].id);
        }
    }
    
    if (initialSelection.length > 0) {
        setSelectedPlayerIds(initialSelection);
        hasInitializedSelection.current = true;
    }
  }, [sortedPlayers, players, currentUser.id, defaultPlayerIds]);

  const selectedGame = useMemo(() => 
    games.find(g => g.id === selectedGameId), 
  [selectedGameId, games]);

  // Initialize teams when players or game changes
  useEffect(() => {
      if (selectedGame?.type === 'team') {
          const newTeams: Record<string, string> = {};
          selectedPlayerIds.forEach((pid, idx) => {
              // Alternate teams 1 and 2 by default
              newTeams[pid] = (idx % 2 === 0) ? '1' : '2';
          });
          setPlayerTeams(newTeams);
      }
  }, [selectedPlayerIds, selectedGame]);

  const handlePlayerClick = (playerId: string) => {
    if (isManualSelectionMode) {
        // In manual selection mode, clicking a player sets them as starter
        // ONLY if they are already selected for the game
        if (selectedPlayerIds.includes(playerId)) {
            setStartingPlayerId(playerId);
            setIsManualSelectionMode(false); // Turn off mode after selection
        }
    } else {
        // Normal mode: toggle selection
        togglePlayer(playerId);
    }
  };

  const togglePlayer = (playerId: string) => {
    setSelectedPlayerIds(prev => {
      if (prev.includes(playerId)) {
        // If removing the currently selected starter, unset starter
        if (startingPlayerId === playerId) setStartingPlayerId(null);
        return prev.filter(id => id !== playerId);
      } else {
        return [...prev, playerId];
      }
    });
  };

  // Toggle Team Assignment
  const togglePlayerTeam = (playerId: string) => {
      setPlayerTeams(prev => {
          const currentTeam = prev[playerId] || '1';
          const nextTeam = currentTeam === '1' ? '2' : '1'; // Simple toggle for now
          return { ...prev, [playerId]: nextTeam };
      });
  };

  // Extension Logic
  const toggleExtension = (extId: string) => {
      setSelectedExtensionIds(prev => 
          prev.includes(extId) 
              ? prev.filter(id => id !== extId)
              : [...prev, extId]
      );
  };

  const handleExtensionSubmit = (_gameData: Partial<Game>, extensionData?: { parentId: number, title: string, image: string, customColumns?: ScoreColumn[] }) => {
      if (!selectedGame || !extensionData) return;

      const newExt: GameExtension = {
          id: `ext_${Date.now()}`,
          title: extensionData.title,
          // Image is ignored for extensions based on previous rules, but can be kept if we revert
          image: extensionData.image, 
          customColumns: extensionData.customColumns
      };

      // 1. Update Game in Global Context
      const updatedGame = {
          ...selectedGame,
          extensions: [...(selectedGame.extensions || []), newExt]
      };
      updateGame(updatedGame);

      // 2. Auto-select the new extension locally
      setSelectedExtensionIds(prev => [...prev, newExt.id]);

      // 3. Close Modal
      setShowExtensionModal(false);
  };

  const pickRandomStarter = () => {
    if (selectedPlayerIds.length < 2) return;
    
    // Reset manual mode if active
    setIsManualSelectionMode(false);

    // 1. Setup Animation
    setIsSpinning(true);
    setSpinWinnerId(null);
    
    // 2. Pick winner
    const winnerIndex = Math.floor(Math.random() * selectedPlayerIds.length);
    const winnerId = selectedPlayerIds[winnerIndex];

    // 3. Animation Logic variables
    let currentIndex = 0;
    let speed = 50; // Initial speed in ms
    let rounds = 0;
    const minRounds = 2; // Reduced from 4 to shorten animation duration
    
    const animate = () => {
        // Update displayed player
        const idToShow = selectedPlayerIds[currentIndex];
        setSpinningPlayerId(idToShow);

        // Check if we should stop
        // We stop if we have done minRounds AND we are currently on the winner
        if (rounds >= minRounds && idToShow === winnerId) {
            setSpinWinnerId(winnerId);
            setStartingPlayerId(winnerId);
            
            // Close modal after showing winner
            setTimeout(() => {
                setIsSpinning(false);
                setSpinningPlayerId(null);
                setSpinWinnerId(null);
            }, 2000);
            return;
        }

        // Logic for next step
        currentIndex++;
        if (currentIndex >= selectedPlayerIds.length) {
            currentIndex = 0;
            rounds++;
        }

        // Slow down logic (exponential decay)
        if (rounds >= minRounds - 1) {
             speed *= 1.15; 
        } else if (rounds >= minRounds - 2) {
             speed *= 1.05;
        }

        setTimeout(animate, speed);
    };

    animate();
  };

  const updateScore = (entityId: string, columnId: string, value: number) => {
    setScores(prev => ({
      ...prev,
      [entityId]: {
        ...(prev[entityId] || {}),
        [columnId]: value
      }
    }));
  };

  // Build the list of columns to display
  // Logic: Base Game Columns + Extension Columns
  const activeColumns = useMemo<ScoreColumn[]>(() => {
    if (!selectedGame) return [];
    
    let cols: ScoreColumn[] = [];

    if (selectedGame.scoreType === 'custom') {
        cols = [...(selectedGame.customColumns || [])];
        
        // Merge extension columns
        if (selectedGame.extensions && selectedExtensionIds.length > 0) {
            selectedExtensionIds.forEach(extId => {
                const ext = selectedGame.extensions?.find(e => e.id === extId);
                if (ext && ext.customColumns) {
                    cols = [...cols, ...ext.customColumns];
                }
            });
        }
        return cols;
    }
    
    // Standard Numeric Game (Always defaults to this if not custom)
    for (let i = 0; i < standardRowCount; i++) {
        cols.push({
            id: `row_${i}`,
            name: standardRowCount > 1 ? `Rij ${i + 1}` : 'Score',
            type: 'input',
            modifier: 'add'
        });
    }
    return cols;
    
  }, [selectedGame, standardRowCount, selectedExtensionIds]);

  const calculateColumnValue = (entityId: string, col: ScoreColumn): number => {
    if (col.type === 'input') {
      return scores[entityId]?.[col.id] ?? 0;
    }
    if (col.type === 'calculated' && col.formula) {
        let expression = col.formula;
        expression = expression.replace(/{([^}]+)}/g, (match, colId) => {
            // Need to look in all active columns to find the referenced column
            const refCol = activeColumns.find(c => c.id === colId);
            if (refCol) {
                let val = calculateColumnValue(entityId, refCol);
                // If referenced column is an input with 'subtract' modifier, use negative value
                if (refCol.type === 'input' && refCol.modifier === 'subtract') {
                    val = val * -1;
                }
                return val.toString();
            }
            return "0";
        });
        try {
            if (!/^[0-9+\-*/().\s]*$/.test(expression)) return 0;
            // eslint-disable-next-line no-new-func
            const result = new Function('return ' + expression)();
            return isFinite(result) ? Math.round(result * 100) / 100 : 0;
        } catch (e) {
            return 0;
        }
    }
    return 0;
  };

  // Calculates the TOTAL sum for a player/team across all active columns
  const calculateTotalScore = (entityId: string) => {
      // First check if there is a specific 'calculated' column named 'Total' or similar defined in base game
      // This is risky if extensions add columns that aren't included in the base formula.
      // Strategy: Sum all INPUT columns (including extensions) considering their modifiers.
      
      return activeColumns.reduce((sum, col) => {
          if (col.type === 'input') {
              const val = calculateColumnValue(entityId, col);
              return sum + (col.modifier === 'subtract' ? -val : val);
          }
          return sum;
      }, 0);
  };

  // Helper to format duration for display
  const formatTimeDisplay = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    const pad = (n: number) => n.toString().padStart(2, '0');
    
    if (hours > 0) {
        return `${hours}:${pad(minutes)}:${pad(seconds)}`;
    }
    return `${pad(minutes)}:${pad(seconds)}`;
  };

  const handleSave = () => {
      if (!selectedGame || selectedPlayerIds.length === 0) return;

      const isTeamGame = selectedGame.type === 'team';

      // 1. Calculate scores
      const results: MatchResult[] = selectedPlayerIds.map(playerId => {
        // Determine ID to fetch score from (Player ID or Team ID)
        const teamId = isTeamGame ? playerTeams[playerId] : undefined;
        const scoreEntityId = isTeamGame ? teamId || '1' : playerId; // Fallback to team 1 if undef

        let finalScore = 0;
        let breakdown: Record<string, number> = {};

        // Use activeColumns which includes extensions
        if (selectedGame.scoreType === 'custom') {
            activeColumns.forEach(col => {
                const val = calculateColumnValue(scoreEntityId, col);
                breakdown[col.id] = val;
            });

            // Calculate total dynamically based on all input columns in activeColumns
            finalScore = calculateTotalScore(scoreEntityId);
            
            // Note: If the base game had a complex formula for total (e.g. A * B), adding an extension column C 
            // won't update that formula automatically. The simpler "Sum of inputs" approach is used here for stability with extensions.
            // If specific formula behavior is needed, we'd need a more complex formula builder that appends new columns.
        } else {
            // Standard Numeric (Multi-row support)
            activeColumns.forEach(col => {
                const val = scores[scoreEntityId]?.[col.id] || 0;
                breakdown[col.id] = val;
            });
            finalScore = calculateTotalScore(scoreEntityId);
        }
        
        return { 
          playerId, 
          score: finalScore, 
          isWinner: false,
          isStarter: playerId === startingPlayerId,
          scoreBreakdown: breakdown,
          teamId: teamId
        };
      });

      // 2. Determine Winner
      const condition = selectedGame.winningCondition || 'highest';
      const firstScore = results[0].score;
      if (typeof firstScore === 'number') {
          let bestScore = firstScore;
          results.forEach(r => {
              const s = r.score as number;
              if (condition === 'highest') {
                  if (s > bestScore) bestScore = s;
              } else {
                  if (s < bestScore) bestScore = s;
              }
          });
          results.forEach(r => {
              if (r.score === bestScore) r.isWinner = true;
          });
      }

      // 3. Format Duration string (HH:MM:SS) if timer was used
      let durationStr: string | undefined = undefined;
      if (timerSeconds > 0) {
          const h = Math.floor(timerSeconds / 3600);
          const m = Math.floor((timerSeconds % 3600) / 60);
          const s = timerSeconds % 60;
          durationStr = `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
      }

      // 4. Save Location to global list
      if (location.trim()) {
          addLocation(location.trim());
      }

      const dateObj = new Date();
      const months = ['Jan', 'Feb', 'Mrt', 'Apr', 'Mei', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'];
      const dateStr = `${dateObj.getDate()} ${months[dateObj.getMonth()]} ${dateObj.getFullYear()}`;

      const newMatch: Match = {
          id: Date.now(),
          gameId: selectedGame.id,
          date: dateStr,
          duration: durationStr,
          location: location.trim() || undefined,
          results: results,
          createdBy: currentUser.id,
          extensionIds: selectedExtensionIds.length > 0 ? selectedExtensionIds : undefined
      };

      addMatch(newMatch);
      navigate(`/game-details/${selectedGame.id}`);
  };

  const performBackNavigation = () => {
    if (window.history.state && window.history.state.idx > 0) {
        navigate(-1);
    } else {
        navigate('/');
    }
  };

  const handleBack = () => {
    if (selectedGameId || selectedPlayerIds.length > 0) {
        setShowDiscardModal(true);
    } else {
        performBackNavigation();
    }
  };

  const handleGameSelect = (id: number) => {
    setSelectedGameId(id);
    const game = games.find(g => g.id === id);
    if (game) {
        setGameSearchQuery(game.title);
        // Reset state
        setScores({});
        
        // Initialize rows based on game type
        if (game.scoreType === 'standard') {
            setStandardRowCount(3); // Default to 3 rows
        } else {
            setStandardRowCount(1);
        }
    }
    setIsGameDropdownOpen(false);
  };

  const isTeamGame = selectedGame?.type === 'team';
  const entitiesToScore = isTeamGame ? activeTeams : selectedPlayerIds;

  return (
    <div className="bg-background-light dark:bg-background-dark font-display antialiased min-h-screen flex flex-col max-w-md mx-auto relative shadow-2xl">
      {/* Top App Bar */}
      <div className="sticky top-0 z-50 flex items-center bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-md p-4 pb-2 justify-between border-b border-gray-200 dark:border-gray-800">
        <div className="w-12 shrink-0"></div>
        <h2 className="text-gray-900 dark:text-white text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center">Nieuw Potje</h2>
        <button onClick={handleBack} className="text-gray-900 dark:text-white flex size-12 shrink-0 items-center justify-center rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors">
          <span className="material-symbols-outlined text-2xl">close</span>
        </button>
      </div>
      
      {/* Toast Notification */}
      {showTimerToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] animate-slide-down w-[90%] max-w-[320px]">
            <div className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 border border-slate-700 dark:border-slate-200">
                <div className="size-10 rounded-full bg-green-500 flex items-center justify-center shrink-0 animate-pulse">
                    <span className="material-symbols-outlined text-white text-2xl">play_arrow</span>
                </div>
                <div className="flex-1">
                    <p className="font-bold text-sm">Startspeler bepaald!</p>
                    <p className="text-xs opacity-80">Timer is aangezet</p>
                </div>
            </div>
        </div>
      )}
      
      <div className="flex-1 overflow-y-auto pb-32">
        {/* Game Selector */}
        <div className="px-4 py-4 pb-4">
          <div className="flex flex-col w-full relative" ref={dropdownRef}>
            <label htmlFor="game-search-input" className="text-gray-900 dark:text-white text-base font-medium leading-normal pb-2">Kies Spel</label>
            <div className="relative">
              <div 
                className={`flex items-center w-full rounded-xl bg-surface-light dark:bg-surface-dark border ${isGameDropdownOpen ? 'border-primary ring-2 ring-primary/20' : 'border-gray-300 dark:border-gray-700'} h-14 transition-all`}
              >
                  <div className="pl-4 text-gray-400">
                    <span className="material-symbols-outlined">search</span>
                  </div>
                  <input 
                    id="game-search-input"
                    type="text"
                    value={gameSearchQuery}
                    onChange={(e) => {
                        setGameSearchQuery(e.target.value);
                        if (!isGameDropdownOpen) setIsGameDropdownOpen(true);
                    }}
                    onFocus={() => setIsGameDropdownOpen(true)}
                    onClick={() => setIsGameDropdownOpen(true)}
                    placeholder="Zoek een spel..."
                    className="flex-1 bg-transparent border-none focus:ring-0 text-gray-900 dark:text-white text-base font-normal leading-normal placeholder:text-gray-400 dark:placeholder:text-gray-500 px-3"
                  />
                  <button 
                    onClick={() => setIsGameDropdownOpen(!isGameDropdownOpen)}
                    className="px-4 h-full flex items-center justify-center text-gray-500 hover:text-primary transition-colors"
                  >
                    <span className={`material-symbols-outlined transition-transform duration-200 ${isGameDropdownOpen ? 'rotate-180' : ''}`}>expand_more</span>
                  </button>
              </div>

              {isGameDropdownOpen && (
                <div className="absolute top-full left-0 w-full mt-2 bg-surface-light dark:bg-surface-dark rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 z-30 max-h-60 overflow-y-auto custom-scrollbar animate-slide-down">
                    {filteredGames.length === 0 ? (
                        <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">Geen spellen gevonden.</div>
                    ) : (
                        <div className="py-1">
                            {filteredGames.map(g => (
                                <button
                                    key={g.id}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleGameSelect(g.id);
                                    }}
                                    className={`w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${selectedGameId === g.id ? 'bg-primary/5 text-primary' : 'text-gray-900 dark:text-white'}`}
                                >
                                    <div className="w-8 h-8 rounded-md bg-cover bg-center bg-gray-200 dark:bg-gray-700 shrink-0" style={{backgroundImage: `url("${g.image}")`}}></div>
                                    <span className="font-medium truncate">{g.title}</span>
                                    {selectedGameId === g.id && <span className="material-symbols-outlined ml-auto text-primary">check</span>}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Extensions Selection */}
        {selectedGame && (
            <div className="px-4 pb-6 animate-slide-down">
                <label className="text-gray-900 dark:text-white text-base font-medium leading-normal pb-2 block">Uitbreidingen</label>
                <div className="flex flex-wrap gap-2">
                    {/* Existing Extensions */}
                    {selectedGame.extensions?.map(ext => {
                        const isSelected = selectedExtensionIds.includes(ext.id);
                        return (
                            <button
                                key={ext.id}
                                onClick={() => toggleExtension(ext.id)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${isSelected ? 'bg-primary text-white border-primary' : 'bg-surface-light dark:bg-surface-dark text-slate-600 dark:text-slate-300 border-gray-200 dark:border-gray-700 hover:border-primary/50'}`}
                            >
                                {ext.title}
                            </button>
                        );
                    })}

                    {/* Add New Extension Button - Opens Modal */}
                    <button
                        onClick={() => setShowExtensionModal(true)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold border border-dashed border-gray-300 dark:border-gray-600 text-slate-500 dark:text-slate-400 hover:border-primary hover:text-primary transition-all flex items-center gap-1"
                    >
                        <span className="material-symbols-outlined text-sm">add</span>
                        Nieuw
                    </button>
                </div>
            </div>
        )}

        {/* Timer Widget */}
        <div className="px-4 pb-2">
            <div className={`rounded-2xl p-4 flex items-center justify-between border shadow-sm transition-all ${isTimerRunning ? 'bg-primary text-white border-primary shadow-primary/30' : 'bg-surface-light dark:bg-surface-dark border-gray-200 dark:border-gray-700'}`}>
                <div className="flex flex-col">
                    <span className={`text-xs font-bold uppercase tracking-wider ${isTimerRunning ? 'text-white/80' : 'text-gray-500 dark:text-gray-400'}`}>
                        Speeltijd
                    </span>
                    <div className={`font-mono text-3xl font-black tabular-nums ${isTimerRunning ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
                        {formatTimeDisplay(timerSeconds)}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {timerSeconds > 0 && !isTimerRunning && (
                        <button 
                            onClick={() => setTimerSeconds(0)}
                            className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-red-500 transition-colors"
                        >
                            <span className="material-symbols-outlined">refresh</span>
                        </button>
                    )}
                    <button 
                        onClick={() => setIsTimerRunning(!isTimerRunning)}
                        className={`w-12 h-12 flex items-center justify-center rounded-full transition-all shadow-md ${isTimerRunning ? 'bg-white text-primary' : 'bg-primary text-white hover:scale-105 active:scale-95'}`}
                    >
                        <span className="material-symbols-outlined text-3xl font-bold fill-current">
                            {isTimerRunning ? 'pause' : 'play_arrow'}
                        </span>
                    </button>
                </div>
            </div>
        </div>

        {/* Start Player Randomizer */}
        <div className="px-4 pb-6">
            <label className="text-gray-900 dark:text-white text-base font-medium leading-normal pb-2 block">Startspeler bepalen</label>
            <div className="flex gap-3">
                <button 
                    onClick={pickRandomStarter}
                    disabled={selectedPlayerIds.length < 2 || isManualSelectionMode}
                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 font-bold rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
                >
                    <span className="material-symbols-outlined">casino</span>
                    Random
                </button>
                <button 
                    onClick={() => {
                        setIsManualSelectionMode(!isManualSelectionMode);
                        // Clear starter if we cancel
                        if (isManualSelectionMode) setIsManualSelectionMode(false);
                    }}
                    disabled={selectedPlayerIds.length === 0}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 font-bold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] ${isManualSelectionMode ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
                >
                    <span className="material-symbols-outlined">{isManualSelectionMode ? 'close' : 'touch_app'}</span>
                    {isManualSelectionMode ? 'Annuleren' : 'Handmatig'}
                </button>
            </div>
            {isManualSelectionMode && (
                <div className="mt-2 text-center animate-fade-in">
                    <span className="text-primary font-bold text-sm animate-pulse">Tik op een speler om te starten...</span>
                </div>
            )}
        </div>
        
        <div className="h-px bg-gray-200 dark:bg-gray-800 mx-4"></div>

        {/* Location Selector (Replaces simple input) */}
        <div className="px-4 py-4">
            <label className="text-gray-900 dark:text-white text-base font-medium leading-normal pb-2 block">Locatie</label>
            <LocationSelector 
                value={location}
                onChange={setLocation}
            />
        </div>

        <div className="h-px bg-gray-200 dark:bg-gray-800 mx-4"></div>
        
        {/* Players Selection */}
        <div className="pt-6 pb-2">
          <h3 className="text-gray-900 dark:text-white tracking-tight text-xl font-bold leading-tight px-4 text-left pb-4">Wie doet er mee?</h3>
          <div className="grid grid-cols-5 gap-y-4 gap-x-2 px-4 pb-4 max-h-[220px] overflow-y-auto custom-scrollbar">
            {sortedPlayers.map(player => {
                const isSelected = selectedPlayerIds.includes(player.id);
                const isStarter = startingPlayerId === player.id;
                
                return (
                    <div key={player.id} onClick={() => handlePlayerClick(player.id)} className={`flex flex-col items-center gap-1 group cursor-pointer transition-opacity ${isManualSelectionMode && !isSelected ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>
                        <div className="relative">
                            <div className={`w-12 h-12 rounded-full bg-cover bg-center border-2 transition-transform transform group-hover:scale-105 bg-gray-100 dark:bg-gray-800 ${isSelected ? 'border-primary shadow-lg shadow-primary/20' : 'border-transparent grayscale opacity-60'}`} style={{backgroundImage: `url("${player.image}")`}}></div>
                            {isSelected && (
                                <div className="absolute -top-1 -right-1 bg-primary text-white rounded-full p-0.5 border-2 border-background-light dark:border-background-dark z-10">
                                    <span className="material-symbols-outlined text-[10px] font-bold block">check</span>
                                </div>
                            )}
                            {isStarter && (
                                <div className="absolute -bottom-1 -left-1 bg-yellow-400 text-black rounded-full p-0.5 border-2 border-background-light dark:border-background-dark z-20 shadow-sm" title="Startspeler">
                                    <span className="material-symbols-outlined text-[10px] font-bold block">play_arrow</span>
                                </div>
                            )}
                        </div>
                        <span className={`text-[10px] text-center font-semibold truncate w-full ${isSelected ? 'text-primary' : 'text-gray-500 dark:text-gray-400'}`}>{player.name}</span>
                    </div>
                );
            })}
            <Link to="/add-player" className="flex flex-col items-center gap-1 group cursor-pointer">
              <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                <span className="material-symbols-outlined text-gray-400 dark:text-gray-500 text-xl">add</span>
              </div>
              <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500">Nieuw</span>
            </Link>
          </div>
        </div>
        
        {/* Team Assignment (Only if Team Game) */}
        {isTeamGame && selectedPlayerIds.length > 0 && (
            <>
                <div className="h-px bg-gray-200 dark:bg-gray-800 mx-4 my-2"></div>
                <div className="px-4 pt-4">
                    <h3 className="text-gray-900 dark:text-white tracking-tight text-xl font-bold leading-tight text-left pb-2">Team Indeling</h3>
                    <p className="text-xs text-slate-500 mb-4">Klik op een speler om van team te wisselen.</p>
                    
                    <div className="grid grid-cols-2 gap-4">
                        {/* Team 1 Container */}
                        <div className="bg-blue-50 dark:bg-blue-900/10 rounded-xl p-3 border border-blue-100 dark:border-blue-800">
                            <h4 className="text-sm font-bold text-blue-600 dark:text-blue-400 mb-2 text-center uppercase tracking-wide">Team 1</h4>
                            <div className="flex flex-wrap gap-2 justify-center">
                                {selectedPlayerIds.filter(pid => (playerTeams[pid] || '1') === '1').map(pid => {
                                    const p = players.find(pl => pl.id === pid);
                                    if (!p) return null;
                                    return (
                                        <button key={pid} onClick={() => togglePlayerTeam(pid)} className="relative group">
                                            <img src={p.image} className="w-10 h-10 rounded-full border-2 border-blue-500 shadow-sm" alt={p.name} />
                                            <span className="absolute -bottom-1 -right-1 bg-white dark:bg-slate-800 rounded-full p-0.5 border border-gray-200 dark:border-gray-700 shadow-sm">
                                                <span className="material-symbols-outlined text-[10px] block">sync_alt</span>
                                            </span>
                                        </button>
                                    );
                                })}
                                {selectedPlayerIds.filter(pid => (playerTeams[pid] || '1') === '1').length === 0 && (
                                    <span className="text-xs text-blue-300 italic py-2">Leeg</span>
                                )}
                            </div>
                        </div>

                        {/* Team 2 Container */}
                        <div className="bg-orange-50 dark:bg-orange-900/10 rounded-xl p-3 border border-orange-100 dark:border-orange-800">
                            <h4 className="text-sm font-bold text-orange-600 dark:text-orange-400 mb-2 text-center uppercase tracking-wide">Team 2</h4>
                            <div className="flex flex-wrap gap-2 justify-center">
                                {selectedPlayerIds.filter(pid => playerTeams[pid] === '2').map(pid => {
                                    const p = players.find(pl => pl.id === pid);
                                    if (!p) return null;
                                    return (
                                        <button key={pid} onClick={() => togglePlayerTeam(pid)} className="relative group">
                                            <img src={p.image} className="w-10 h-10 rounded-full border-2 border-orange-500 shadow-sm" alt={p.name} />
                                            <span className="absolute -bottom-1 -right-1 bg-white dark:bg-slate-800 rounded-full p-0.5 border border-gray-200 dark:border-gray-700 shadow-sm">
                                                <span className="material-symbols-outlined text-[10px] block">sync_alt</span>
                                            </span>
                                        </button>
                                    );
                                })}
                                {selectedPlayerIds.filter(pid => playerTeams[pid] === '2').length === 0 && (
                                    <span className="text-xs text-orange-300 italic py-2">Leeg</span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </>
        )}

        <div className="h-2 bg-gray-100 dark:bg-[#0c1018] mt-4"></div>
        
        {/* Scores Section */}
        <div className="pt-6">
          <h3 className="text-gray-900 dark:text-white tracking-tight text-xl font-bold leading-tight px-4 text-left pb-4">Scores Invoeren</h3>
          {selectedPlayerIds.length === 0 ? (
            <div className="text-center py-6 text-gray-400 px-4">Selecteer spelers om scores in te voeren.</div>
          ) : (
            <>
                <div className="overflow-x-auto pb-4">
                    {selectedGame?.scoreType === 'custom' && activeColumns.length === 0 ? (
                        <div className="px-4 py-8 text-center text-gray-500 bg-gray-50 dark:bg-gray-800/50 mx-4 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
                            <p>Dit spel is ingesteld als 'Zelf maken', maar heeft geen kolommen.</p>
                            <Link to={`/edit-game/${selectedGameId}`} className="text-primary font-bold hover:underline mt-2 inline-block">Bewerk Spel</Link>
                        </div>
                    ) : (
                        <div className="min-w-full">
                            <table className="min-w-full border-separate border-spacing-0">
                                <thead>
                                    <tr>
                                        <th className="sticky left-0 z-20 bg-background-light dark:bg-background-dark py-3 pr-4 pl-4 text-left align-bottom border-b-2 border-gray-200 dark:border-gray-700 min-w-[140px] border-r border-gray-200 dark:border-gray-800 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Onderdeel</span>
                                        </th>
                                        {entitiesToScore.map(entityId => {
                                            if (isTeamGame) {
                                                // Entity is Team ID
                                                return (
                                                    <th key={entityId} className="p-2 min-w-[100px] text-center align-bottom border-b-2 border-gray-200 dark:border-gray-700">
                                                        <div className={`flex flex-col items-center gap-1.5 pb-1 relative`}>
                                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg shadow-sm border-2 ${entityId === '1' ? 'bg-blue-100 border-blue-500 text-blue-600' : 'bg-orange-100 border-orange-500 text-orange-600'}`}>
                                                                {entityId}
                                                            </div>
                                                            <span className="text-xs font-bold text-gray-900 dark:text-white truncate max-w-[90px]">Team {entityId}</span>
                                                        </div>
                                                    </th>
                                                );
                                            } else {
                                                // Entity is Player ID
                                                const player = players.find(p => p.id === entityId);
                                                const isStarter = startingPlayerId === entityId;
                                                return (
                                                    <th key={entityId} className="p-2 min-w-[100px] text-center align-bottom border-b-2 border-gray-200 dark:border-gray-700">
                                                        <div className="flex flex-col items-center gap-1.5 pb-1 relative">
                                                            <div className="relative">
                                                                <img src={player?.image} alt={player?.name} className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 object-cover border-2 border-surface-light dark:border-surface-dark shadow-sm"/>
                                                                {isStarter && (
                                                                    <div className="absolute -bottom-1 -left-1 bg-yellow-400 text-black rounded-full p-0.5 border border-surface-light dark:border-surface-dark shadow-sm">
                                                                        <span className="material-symbols-outlined text-[8px] font-bold block">play_arrow</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <span className="text-xs font-bold text-gray-900 dark:text-white truncate max-w-[90px]">{player?.name}</span>
                                                        </div>
                                                    </th>
                                                );
                                            }
                                        })}
                                    </tr>
                                </thead>
                                <tbody>
                                    {activeColumns.map((col) => (
                                        <tr key={col.id} className="group hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                                            <td className="sticky left-0 z-10 bg-background-light dark:bg-background-dark group-hover:bg-gray-50 dark:group-hover:bg-[#151c2a] transition-colors py-3 pr-4 pl-4 text-left border-b border-gray-100 dark:border-gray-800 border-r border-gray-200 dark:border-gray-800 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-bold text-gray-900 dark:text-white truncate">{col.name}</span>
                                                    <div className="flex gap-2 mt-0.5">
                                                        {col.type === 'calculated' && <span className="text-[10px] text-primary font-bold bg-primary/10 px-1.5 py-0.5 rounded">Auto</span>}
                                                        {col.modifier === 'subtract' && <span className="text-[10px] text-red-500 font-bold bg-red-500/10 px-1.5 py-0.5 rounded">- Min</span>}
                                                        {col.modifier === 'add' && col.type === 'input' && selectedGame?.scoreType === 'custom' && <span className="text-[10px] text-emerald-500 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded">+ Plus</span>}
                                                    </div>
                                                </div>
                                            </td>
                                            {entitiesToScore.map(entityId => (
                                                <td key={`${entityId}-${col.id}`} className="p-3 border-b border-gray-100 dark:border-gray-800 text-center">
                                                    {col.type === 'input' ? (
                                                        <input 
                                                            type="number" 
                                                            className={`w-full rounded-xl border p-2 text-center font-bold text-lg shadow-sm focus:ring-2 focus:ring-primary/50 transition-all ${col.modifier === 'subtract' ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-900/30 text-red-700 dark:text-red-400 placeholder-red-300' : 'bg-white dark:bg-surface-dark border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white'}`}
                                                            value={scores[entityId]?.[col.id] || ''}
                                                            placeholder="0"
                                                            onChange={(e) => updateScore(entityId, col.id, parseInt(e.target.value) || 0)}
                                                        />
                                                    ) : (
                                                        <div className="flex items-center justify-center h-full">
                                                            <div className="min-w-[48px] py-2 px-3 rounded-lg bg-gray-100 dark:bg-gray-800 font-mono font-bold text-gray-700 dark:text-gray-300 text-lg">
                                                                {calculateColumnValue(entityId, col)}
                                                            </div>
                                                        </div>
                                                    )}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                    
                                    {/* Total Row */}
                                    <tr className="bg-gray-100 dark:bg-gray-800/50 font-bold">
                                            <td className="sticky left-0 z-10 bg-gray-100 dark:bg-[#151c2a] py-3 pr-4 pl-4 text-left border-t-2 border-gray-300 dark:border-gray-600 border-r border-gray-300 dark:border-gray-600 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                            <span className="text-gray-900 dark:text-white uppercase tracking-wider text-sm">Totaal</span>
                                            </td>
                                            {entitiesToScore.map(entityId => (
                                                <td key={`total-${entityId}`} className="p-3 text-center border-t-2 border-gray-300 dark:border-gray-600">
                                                    <div className="text-xl font-black text-primary">{calculateTotalScore(entityId)}</div>
                                                </td>
                                            ))}
                                    </tr>
                                </tbody>
                            </table>
                            
                            {/* Add Row Button for Standard Numeric Games */}
                            {selectedGame?.scoreType === 'standard' && (
                                <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700">
                                    <button 
                                        onClick={() => setStandardRowCount(prev => prev + 1)}
                                        className="flex items-center gap-2 text-sm font-bold text-primary hover:text-primary/80 transition-colors"
                                    >
                                        <span className="material-symbols-outlined text-lg">add</span>
                                        Rij toevoegen
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </>
          )}
        </div>
      </div>
      
      <div className="fixed bottom-0 left-0 w-full z-40 bg-gradient-to-t from-background-light via-background-light to-transparent dark:from-background-dark dark:via-background-dark dark:to-transparent pb-6 pt-12 px-4 pointer-events-none max-w-md mx-auto right-0">
        <button 
            onClick={handleSave}
            disabled={!selectedGameId || selectedPlayerIds.length === 0}
            className="pointer-events-auto w-full h-14 bg-primary hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl shadow-lg shadow-primary/25 flex items-center justify-center gap-2 font-bold text-lg transition-all active:scale-[0.98]"
        >
          <span className="material-symbols-outlined">save</span>
          Potje Opslaan
        </button>
      </div>

        {/* Wheel/Roulette Modal */}
        {isSpinning && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md animate-fade-in px-6">
                <div className="flex flex-col items-center justify-center w-full max-w-sm text-center">
                    <h3 className="text-white text-2xl font-bold mb-8 animate-pulse">Startspeler kiezen...</h3>
                    
                    <div className="relative w-48 h-48 mb-8">
                        {/* Background Rings */}
                        <div className="absolute inset-0 rounded-full border-4 border-primary/30 animate-[spin_3s_linear_infinite]"></div>
                        <div className="absolute inset-4 rounded-full border-4 border-white/10 animate-[spin_2s_linear_infinite_reverse]"></div>
                        
                        {/* Current Player Display */}
                        {spinningPlayerId && (
                            <div className={`absolute inset-0 flex items-center justify-center transition-all duration-100 ${spinWinnerId ? 'scale-110' : 'scale-110'}`}>
                                <div className={`w-40 h-40 rounded-full bg-white dark:bg-gray-800 overflow-hidden border-4 shadow-2xl flex items-center justify-center ${spinWinnerId ? 'border-yellow-400 ring-4 ring-yellow-400/50' : 'border-white'}`}>
                                    <img 
                                        src={players.find(p => p.id === spinningPlayerId)?.image} 
                                        alt="Spinning"
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                            </div>
                        )}
                        
                        {/* Winner indicator arrow */}
                         <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-yellow-400">
                             <span className="material-symbols-outlined text-4xl drop-shadow-lg">arrow_drop_down</span>
                         </div>
                    </div>

                    <div className="h-16 flex items-center justify-center">
                        {spinWinnerId ? (
                            <div className="animate-slide-down">
                                <span className="text-yellow-400 text-xs font-bold uppercase tracking-widest block mb-1">De startspeler is</span>
                                <span className="text-white text-3xl font-black">{players.find(p => p.id === spinWinnerId)?.name}</span>
                            </div>
                        ) : (
                            <span className="text-white/50 text-xl font-medium">
                                {players.find(p => p.id === spinningPlayerId)?.name}
                            </span>
                        )}
                    </div>
                </div>
            </div>
        )}

        {/* Discard Confirmation Modal */}
        {showDiscardModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                <div className="bg-surface-light dark:bg-surface-dark w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-gray-100 dark:border-gray-700 animate-slide-down">
                    <div className="flex flex-col items-center mb-4 text-center">
                        <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4">
                            <span className="material-symbols-outlined text-3xl text-red-500">warning</span>
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Potje niet opslaan?</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Weet je zeker dat je wilt stoppen? De gegevens van dit potje gaan verloren. Nieuwe spelers blijven wel bewaard.
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <button 
                            onClick={() => setShowDiscardModal(false)}
                            className="flex-1 py-3 font-bold text-slate-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors bg-gray-50 dark:bg-gray-800/50"
                        >
                            Nee, verder
                        </button>
                        <button 
                            onClick={() => {
                                if (window.history.state && window.history.state.idx > 0) {
                                    navigate(-1);
                                } else {
                                    navigate('/');
                                }
                            }}
                            className="flex-1 py-3 font-bold bg-red-500 text-white rounded-xl shadow-lg shadow-red-500/30 hover:bg-red-600 transition-all active:scale-[0.98]"
                        >
                            Ja, stop
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* Full Screen Modal for Adding Extension with Columns */}
        {showExtensionModal && selectedGameId && (
            <div className="fixed inset-0 z-[100] bg-background-light dark:bg-background-dark animate-fade-in">
                <GameForm 
                    pageTitle="Nieuwe Uitbreiding" 
                    buttonLabel="Toevoegen & Selecteren"
                    initialEntryType="extension"
                    preSelectedParentId={selectedGameId}
                    availableGames={games} // Though locked to parent
                    onSubmit={handleExtensionSubmit} 
                    onCancel={() => setShowExtensionModal(false)}
                />
            </div>
        )}
    </div>
  );
};

export default NewRound;
