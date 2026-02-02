
import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGames } from '../context/GameContext';
import { ScoreColumn, MatchResult, GameExtension } from '../types';
import LocationSelector from '../components/LocationSelector';

const EditMatch: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { matches, games, players, updateMatch, deleteMatch, addLocation, updateGame } = useGames();

  // State
  const [selectedGameId, setSelectedGameId] = useState<number | null>(null);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [scores, setScores] = useState<Record<string, Record<string, number>>>({});
  const [startingPlayerId, setStartingPlayerId] = useState<string | null>(null);
  
  // Duration State (Split into parts)
  const [hours, setHours] = useState('00');
  const [minutes, setMinutes] = useState('00');
  const [seconds, setSeconds] = useState('00');

  const [location, setLocation] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  
  // Extensions State
  const [selectedExtensionIds, setSelectedExtensionIds] = useState<string[]>([]);
  const [isAddingExtension, setIsAddingExtension] = useState(false);
  const [newExtensionName, setNewExtensionName] = useState('');

  // Team Assignments
  const [playerTeams, setPlayerTeams] = useState<Record<string, string>>({});
  const [activeTeams, setActiveTeams] = useState<string[]>(['1', '2']);

  // Standard Game Multi-row State
  const [standardRowCount, setStandardRowCount] = useState(1);
  
  // Helper to pad numbers with leading zero
  const pad = (val: string | number) => {
      const num = parseInt(val.toString());
      if (isNaN(num)) return '00';
      return num.toString().padStart(2, '0');
  };

  // Load initial data
  useEffect(() => {
    const matchId = Number(id);
    const match = matches.find(m => m.id === matchId);
    
    if (!match) {
        navigate('/');
        return;
    }

    setSelectedGameId(match.gameId);
    setLocation(match.location || '');
    setSelectedExtensionIds(match.extensionIds || []);
    
    // Parse Duration
    if (match.duration) {
        // Try to parse "H:MM:SS" or "MM:SS" or "Xm"
        const clean = match.duration.replace(/[^0-9:]/g, ''); // Remove 'm', 'u', spaces
        const parts = clean.split(':').map(p => parseInt(p));
        
        if (parts.length === 3) {
            setHours(pad(parts[0]));
            setMinutes(pad(parts[1]));
            setSeconds(pad(parts[2]));
        } else if (parts.length === 2) {
            setHours('00');
            setMinutes(pad(parts[0]));
            setSeconds(pad(parts[1]));
        } else if (parts.length === 1 && !isNaN(parts[0])) {
            // Assume minutes if just a number (legacy "45m")
            // But if it was > 60 in legacy, we might want to convert, but simple is ok for now
            setMinutes(pad(parts[0]));
            setSeconds('00');
        }
    } else {
        setHours('00');
        setMinutes('00');
        setSeconds('00');
    }
    
    // Check if we need to determine standard row count
    const game = games.find(g => g.id === match.gameId);
    const isTeamGame = game?.type === 'team';

    // Force at least 3 rows for standard numeric games
    let maxRows = (game?.scoreType === 'standard' && game.inputMethod === 'numeric') ? 3 : 1;

    // Extract players and starter
    const pIds: string[] = [];
    const loadedScores: Record<string, Record<string, number>> = {};
    const teams: Record<string, string> = {};
    
    match.results.forEach(res => {
        pIds.push(res.playerId);
        if (res.isStarter) setStartingPlayerId(res.playerId);
        
        // Recover Team ID or infer
        if (isTeamGame) {
            teams[res.playerId] = res.teamId || '1'; // Default to team 1 if legacy data missing
        }

        // Map scores
        // If team game, map score to Team ID, else Player ID
        const scoreEntityId = isTeamGame ? (res.teamId || '1') : res.playerId;
        
        // Don't overwrite if team score already loaded
        if (!loadedScores[scoreEntityId]) {
            loadedScores[scoreEntityId] = {};
            
            if (game?.scoreType === 'custom' && res.scoreBreakdown) {
                loadedScores[scoreEntityId] = { ...res.scoreBreakdown };
            } else {
                 // Standard Numeric - might have multiple rows in scoreBreakdown
                 if (res.scoreBreakdown && Object.keys(res.scoreBreakdown).length > 0) {
                     loadedScores[scoreEntityId] = { ...res.scoreBreakdown };
                     
                     // Find highest row index to expand if needed
                     Object.keys(res.scoreBreakdown).forEach(key => {
                         if (key.startsWith('row_')) {
                             const idx = parseInt(key.replace('row_', ''));
                             if (!isNaN(idx) && idx + 1 > maxRows) maxRows = idx + 1;
                         }
                     });
                 } else {
                     // Fallback for old standard matches
                     const val = typeof res.score === 'number' ? res.score : parseFloat(res.score.toString().replace(/[^0-9.-]+/g,"")) || 0;
                     loadedScores[scoreEntityId] = { 'row_0': val }; // Put in row 0
                 }
            }
        }
    });
    
    setStandardRowCount(maxRows);
    setSelectedPlayerIds(pIds);
    setScores(loadedScores);
    setPlayerTeams(teams);

  }, [id, matches, games, navigate]);

  const selectedGame = useMemo(() => 
    games.find(g => g.id === selectedGameId), 
  [selectedGameId, games]);

  const handlePlayerClick = (playerId: string) => {
    // In edit mode, clicking toggles selection. 
    setSelectedPlayerIds(prev => {
      if (prev.includes(playerId)) {
        if (startingPlayerId === playerId) setStartingPlayerId(null);
        return prev.filter(id => id !== playerId);
      } else {
        // If re-adding a player in team mode, assign default team
        if (selectedGame?.type === 'team') {
            setPlayerTeams(curr => ({...curr, [playerId]: '1'}));
        }
        return [...prev, playerId];
      }
    });
  };

  const togglePlayerTeam = (playerId: string) => {
      setPlayerTeams(prev => {
          const currentTeam = prev[playerId] || '1';
          const nextTeam = currentTeam === '1' ? '2' : '1';
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

  const handleAddNewExtension = () => {
      if (!newExtensionName.trim() || !selectedGame) return;
      
      const newExt: GameExtension = {
          id: `ext_${Date.now()}`,
          title: newExtensionName.trim()
      };

      // 1. Update Game
      const updatedGame = {
          ...selectedGame,
          extensions: [...(selectedGame.extensions || []), newExt]
      };
      updateGame(updatedGame);

      // 2. Auto-select the new extension
      setSelectedExtensionIds(prev => [...prev, newExt.id]);

      // 3. Reset UI
      setNewExtensionName('');
      setIsAddingExtension(false);
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

  const handleTimeChange = (type: 'h'|'m'|'s', val: string) => {
      // Only allow numbers
      const nums = val.replace(/[^0-9]/g, '').slice(0, 2); // Max 2 digits
      
      if (type === 'h') setHours(nums);
      if (type === 'm') {
          // Clamp minutes visually if typed > 59 (optional, but good UX is to let them type then blur fix)
          setMinutes(nums);
      }
      if (type === 's') setSeconds(nums);
  };

  const handleTimeBlur = (type: 'h'|'m'|'s') => {
      if (type === 'h') setHours(pad(hours));
      if (type === 'm') {
          let val = parseInt(minutes || '0');
          if (val > 59) val = 59;
          setMinutes(pad(val));
      }
      if (type === 's') {
          let val = parseInt(seconds || '0');
          if (val > 59) val = 59;
          setSeconds(pad(val));
      }
  };

  // Build the list of columns to display
  // For Custom games: use game.customColumns + Extension customColumns
  // For Standard Numeric: generate dynamic rows
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

  const calculateTotalScore = (entityId: string) => {
      return activeColumns.reduce((sum, col) => {
          if (col.type === 'input') {
              const val = calculateColumnValue(entityId, col);
              return sum + (col.modifier === 'subtract' ? -val : val);
          }
          return sum;
      }, 0);
  };

  const handleSave = () => {
      if (!selectedGame || selectedPlayerIds.length === 0) return;
      
      const matchId = Number(id);
      const existingMatch = matches.find(m => m.id === matchId);
      if (!existingMatch) return;

      const isTeamGame = selectedGame.type === 'team';

      // 1. Calculate scores
      const results: MatchResult[] = selectedPlayerIds.map(playerId => {
        const teamId = isTeamGame ? playerTeams[playerId] : undefined;
        const scoreEntityId = isTeamGame ? teamId || '1' : playerId;

        let finalScore = 0;
        let breakdown: Record<string, number> = {};

        if (selectedGame.scoreType === 'custom') {
            activeColumns.forEach(col => {
                const val = calculateColumnValue(scoreEntityId, col);
                breakdown[col.id] = val;
            });
            finalScore = calculateTotalScore(scoreEntityId);
        } else {
            // Standard Numeric
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

      // 3. Save Location to global list
      if (location.trim()) {
          addLocation(location.trim());
      }

      // 4. Construct duration string
      const durationStr = `${hours}:${minutes}:${seconds}`;

      // 5. Update Match
      updateMatch({
          ...existingMatch,
          duration: durationStr,
          location: location.trim() || undefined,
          extensionIds: selectedExtensionIds.length > 0 ? selectedExtensionIds : undefined,
          results: results
      });

      // Navigate back
      if (window.history.state && window.history.state.idx > 0) {
          navigate(-1);
      } else {
          navigate(`/match-details/${matchId}`, { replace: true });
      }
  };
  
  const confirmDelete = () => {
      deleteMatch(Number(id));
      navigate('/', { replace: true });
  };

  const handleClose = () => {
      // Robust back navigation that avoids stuck states
      if (window.history.state && window.history.state.idx > 0) {
          navigate(-1);
      } else {
          navigate('/');
      }
  };

  // Always table input now
  const sortedAllPlayers = [...players].sort((a,b) => a.name.localeCompare(b.name));
  
  const isTeamGame = selectedGame?.type === 'team';
  const entitiesToScore = isTeamGame ? activeTeams : selectedPlayerIds;

  return (
    <div className="bg-background-light dark:bg-background-dark font-display antialiased min-h-screen flex flex-col max-w-md mx-auto relative shadow-2xl">
      {/* Top App Bar */}
      <div className="sticky top-0 z-50 flex items-center bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-md p-4 pb-2 justify-between border-b border-gray-200 dark:border-gray-800">
        <button onClick={handleClose} className="text-gray-900 dark:text-white flex size-12 shrink-0 items-center justify-center rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors">
          <span className="material-symbols-outlined text-2xl">close</span>
        </button>
        <h2 className="text-gray-900 dark:text-white text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center">Potje Bewerken</h2>
        <button onClick={() => setShowDeleteModal(true)} className="text-gray-900 dark:text-white flex size-12 shrink-0 items-center justify-center rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors">
          <span className="material-symbols-outlined text-2xl text-red-500">delete</span>
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto pb-32 pt-4">
        
        {/* Game Info (Read Only) */}
        <div className="px-4 mb-4">
            <div className="flex items-center gap-3 p-3 bg-surface-light dark:bg-surface-dark rounded-xl border border-gray-200 dark:border-gray-700">
                 <div className="w-10 h-10 rounded-lg bg-cover bg-center bg-gray-200 dark:bg-gray-700 shrink-0" style={{backgroundImage: `url("${selectedGame?.image}")`}}></div>
                 <div className="flex-1">
                     <h3 className="font-bold text-slate-900 dark:text-white">{selectedGame?.title}</h3>
                     <p className="text-xs text-slate-500">Spel kan niet gewijzigd worden</p>
                 </div>
            </div>
        </div>

        {/* Extensions Selection */}
        {selectedGame && (
            <div className="px-4 mb-4 animate-slide-down">
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

                    {/* Add New Extension */}
                    {isAddingExtension ? (
                        <div className="flex items-center bg-surface-light dark:bg-surface-dark border border-primary rounded-lg overflow-hidden h-8 animate-fade-in">
                            <input 
                                type="text"
                                value={newExtensionName}
                                onChange={(e) => setNewExtensionName(e.target.value)}
                                placeholder="Naam..."
                                autoFocus
                                className="bg-transparent border-none text-xs px-2 py-1 focus:ring-0 w-24 text-slate-900 dark:text-white placeholder:text-slate-400"
                                onKeyDown={(e) => e.key === 'Enter' && handleAddNewExtension()}
                            />
                            <button 
                                onClick={handleAddNewExtension}
                                className="bg-primary text-white px-2 h-full flex items-center justify-center hover:bg-primary/90"
                            >
                                <span className="material-symbols-outlined text-sm">check</span>
                            </button>
                            <button 
                                onClick={() => setIsAddingExtension(false)}
                                className="bg-gray-100 dark:bg-gray-700 text-slate-500 h-full px-2 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-600"
                            >
                                <span className="material-symbols-outlined text-sm">close</span>
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => setIsAddingExtension(true)}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold border border-dashed border-gray-300 dark:border-gray-600 text-slate-500 dark:text-slate-400 hover:border-primary hover:text-primary transition-all flex items-center gap-1"
                        >
                            <span className="material-symbols-outlined text-sm">add</span>
                            Nieuw
                        </button>
                    )}
                </div>
            </div>
        )}

        {/* Duration Input (Numeric Segmented) */}
        <div className="px-4 mb-4">
            <label className="block text-sm font-bold text-gray-900 dark:text-white mb-2">Speeltijd</label>
            <div className="flex items-center justify-center gap-1 bg-surface-light dark:bg-surface-dark rounded-xl border border-gray-200 dark:border-gray-700 p-2">
                 {/* Hours */}
                 <div className="flex flex-col items-center w-20">
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Uur</span>
                    <input 
                        type="number"
                        inputMode="numeric"
                        min="0"
                        max="23"
                        value={hours}
                        onChange={(e) => handleTimeChange('h', e.target.value)}
                        onBlur={() => handleTimeBlur('h')}
                        className="w-full text-center bg-transparent border-2 border-transparent focus:border-primary rounded-lg text-3xl font-mono font-black text-slate-900 dark:text-white p-0 focus:ring-0"
                    />
                 </div>
                 <span className="text-2xl font-bold text-gray-300 dark:text-gray-600 pb-2">:</span>
                 {/* Minutes */}
                 <div className="flex flex-col items-center w-20">
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Min</span>
                    <input 
                        type="number"
                        inputMode="numeric"
                        min="0"
                        max="59"
                        value={minutes}
                        onChange={(e) => handleTimeChange('m', e.target.value)}
                        onBlur={() => handleTimeBlur('m')}
                        className="w-full text-center bg-transparent border-2 border-transparent focus:border-primary rounded-lg text-3xl font-mono font-black text-slate-900 dark:text-white p-0 focus:ring-0"
                    />
                 </div>
                 <span className="text-2xl font-bold text-gray-300 dark:text-gray-600 pb-2">:</span>
                 {/* Seconds */}
                 <div className="flex flex-col items-center w-20">
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Sec</span>
                    <input 
                        type="number"
                        inputMode="numeric"
                        min="0"
                        max="59"
                        value={seconds}
                        onChange={(e) => handleTimeChange('s', e.target.value)}
                        onBlur={() => handleTimeBlur('s')}
                        className="w-full text-center bg-transparent border-2 border-transparent focus:border-primary rounded-lg text-3xl font-mono font-black text-slate-900 dark:text-white p-0 focus:ring-0"
                    />
                 </div>
            </div>
        </div>

        {/* Location Input (With Selector) */}
        <div className="px-4 mb-6">
            <label className="block text-sm font-bold text-gray-900 dark:text-white mb-2">Locatie</label>
            <LocationSelector 
                value={location}
                onChange={setLocation}
            />
        </div>

        <div className="h-px bg-gray-200 dark:bg-gray-800 mx-4 mb-4"></div>

        {/* Start Player */}
        <div className="px-4 mb-6">
            <label className="text-gray-900 dark:text-white text-base font-medium leading-normal pb-2 block">Startspeler</label>
            <p className="text-xs text-slate-500 mb-3">Klik op een geselecteerde speler hieronder om als startspeler in te stellen.</p>
        </div>

        {/* Players Selection */}
        <div className="pb-2">
          <h3 className="text-gray-900 dark:text-white tracking-tight text-xl font-bold leading-tight px-4 text-left pb-4">Spelers & Startspeler</h3>
          <div className="grid grid-cols-5 gap-y-4 gap-x-2 px-4 pb-4 max-h-[220px] overflow-y-auto custom-scrollbar">
            {sortedAllPlayers.map(player => {
                const isSelected = selectedPlayerIds.includes(player.id);
                const isStarter = startingPlayerId === player.id;
                
                return (
                    <div 
                        key={player.id} 
                        onClick={() => {
                            handlePlayerClick(player.id);
                        }} 
                        className={`flex flex-col items-center gap-1 group cursor-pointer transition-opacity relative`}
                    >
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
                        
                        {/* Inline Starter Setter for Selected Players */}
                        {isSelected && !isStarter && (
                             <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setStartingPlayerId(player.id);
                                }}
                                className="absolute top-0 left-0 w-full h-full flex items-center justify-center bg-black/30 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                             >
                                 <span className="material-symbols-outlined text-white text-lg drop-shadow-md">play_circle</span>
                             </button>
                        )}
                    </div>
                );
            })}
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
          <h3 className="text-gray-900 dark:text-white tracking-tight text-xl font-bold leading-tight px-4 text-left pb-4">Scores Aanpassen</h3>
          {selectedPlayerIds.length === 0 ? (
            <div className="text-center py-6 text-gray-400 px-4">Selecteer spelers om scores in te voeren.</div>
          ) : (
            <>
                <div className="overflow-x-auto pb-4">
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
                    {selectedGame?.scoreType === 'standard' && selectedGame.inputMethod === 'numeric' && (
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
            </>
          )}
        </div>
        
        {/* Delete Button */}
        <div className="mt-8 px-4">
             <button 
                onClick={() => setShowDeleteModal(true)}
                className="w-full py-4 flex items-center justify-center gap-2 text-red-500 font-bold bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-100 dark:border-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors"
            >
                <span className="material-symbols-outlined">delete</span>
                Potje Verwijderen
            </button>
        </div>
      </div>
      
      <div className="fixed bottom-0 left-0 w-full z-40 bg-gradient-to-t from-background-light via-background-light to-transparent dark:from-background-dark dark:via-background-dark dark:to-transparent pb-6 pt-12 px-4 pointer-events-none max-w-md mx-auto right-0">
        <button 
            onClick={handleSave}
            disabled={!selectedGameId || selectedPlayerIds.length === 0}
            className="pointer-events-auto w-full h-14 bg-primary hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl shadow-lg shadow-primary/25 flex items-center justify-center gap-2 font-bold text-lg transition-all active:scale-[0.98]"
        >
          <span className="material-symbols-outlined">save</span>
          Wijzigingen Opslaan
        </button>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-surface-light dark:bg-surface-dark w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-gray-100 dark:border-gray-700 animate-slide-down">
                <div className="flex flex-col items-center mb-4 text-center">
                    <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4">
                        <span className="material-symbols-outlined text-3xl text-red-500">delete</span>
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Potje Verwijderen?</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        Weet je zeker dat je dit potje definitief wilt verwijderen? Dit kan niet ongedaan worden gemaakt.
                    </p>
                </div>
                <div className="flex gap-3">
                    <button 
                        onClick={() => setShowDeleteModal(false)}
                        className="flex-1 py-3 font-bold text-slate-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors bg-gray-50 dark:bg-gray-800/50"
                    >
                        Annuleren
                    </button>
                    <button 
                        onClick={confirmDelete}
                        className="flex-1 py-3 font-bold bg-red-500 text-white rounded-xl shadow-lg shadow-red-500/30 hover:bg-red-600 transition-all active:scale-[0.98]"
                    >
                        Verwijderen
                    </button>
                </div>
            </div>
        </div>
      )}

    </div>
  );
};

export default EditMatch;
