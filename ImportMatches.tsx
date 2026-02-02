
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useGames } from '../context/GameContext';
import { ExportData, Game, Player, Match, MatchResult, GameExtension, ScoreColumn } from '../types';
import GameForm from '../components/GameForm';
import AddPlayerModal from '../components/AddPlayerModal';

// Utility for safe UTF-8 Base64 decoding
const fromBase64 = (str: string) => {
    try {
        return decodeURIComponent(Array.prototype.map.call(atob(str), function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
    } catch (e) {
        return null;
    }
};

const ImportMatches: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { games, players, locations, addPlayer, addMatch, addGame, updateGame, addLocation } = useGames();
  
  // Ref for file input
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Steps: 
  // 1. input / select_games
  // 2. map_game (Includes Extensions now)
  // 3. map_locations
  // 4. map_players / confirm
  const [step, setStep] = useState<'input' | 'select_games' | 'map_game' | 'map_locations' | 'map_players' | 'confirm'>('input');
  
  // Data
  const [importString, setImportString] = useState('');
  const [error, setError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Queue System for Multiple Games Import
  const [importQueue, setImportQueue] = useState<ExportData[]>([]);
  const [currentQueueIndex, setCurrentQueueIndex] = useState(0);
  const [detectedGames, setDetectedGames] = useState<ExportData[]>([]); // Candidates found in file
  const [selectedDetectedIndices, setSelectedDetectedIndices] = useState<number[]>([]);

  // Current Working Data (Pointer to queue item)
  const [parsedData, setParsedData] = useState<ExportData | null>(null);

  // Mapping State (Per Game)
  const [gameMappingMode, setGameMappingMode] = useState<'none' | 'create' | 'existing'>('none');
  const [targetGameId, setTargetGameId] = useState<number | null>(null); 
  const [isCreatingGame, setIsCreatingGame] = useState(false);
  
  const [playerMapping, setPlayerMapping] = useState<Record<string, string>>({});
  const [locationMapping, setLocationMapping] = useState<Record<string, string>>({});
  const [customLocationValues, setCustomLocationValues] = useState<Record<string, string>>({});
  const [extensionMapping, setExtensionMapping] = useState<Record<string, string>>({});
  
  // New: Store customized extension configurations (keyed by import ID)
  const [customizedExtensions, setCustomizedExtensions] = useState<Record<string, GameExtension>>({});

  // Derived unique lists from import data
  const [uniqueImportLocations, setUniqueImportLocations] = useState<string[]>([]);
  
  // -- Modal States --
  const [showGameModal, setShowGameModal] = useState(false);
  const [showExtensionModal, setShowExtensionModal] = useState(false);
  const [editingExtensionImportId, setEditingExtensionImportId] = useState<string | null>(null);
  
  const [showPlayerModal, setShowPlayerModal] = useState(false);
  const [editingRemotePlayerId, setEditingRemotePlayerId] = useState<string | null>(null);

  // Auto-detect data from URL
  useEffect(() => {
      const dataParam = searchParams.get('data');
      if (dataParam) {
          tryParseData(dataParam);
          setImportString(dataParam);
      }
  }, [searchParams]);

  // Sync parsedData when queue moves
  useEffect(() => {
      if (importQueue.length > 0 && currentQueueIndex < importQueue.length) {
          const data = importQueue[currentQueueIndex];
          prepareImportData(data);
      }
  }, [importQueue, currentQueueIndex]);

  // Auto-match extensions when target game changes
  useEffect(() => {
      if (step === 'map_game' && parsedData?.extensions && targetGameId) {
          const targetGame = games.find(g => g.id === targetGameId);
          // Start with existing mapping to preserve user choices if they navigated back/forth
          const newMapping: Record<string, string> = { ...extensionMapping };
          
          parsedData.extensions.forEach(impExt => {
              // Only auto-map if not already set
              if (!newMapping[impExt.id] || newMapping[impExt.id] === '') {
                  const normalizedImp = impExt.title.toLowerCase().trim();
                  
                  // Strategy 1: Exact Match
                  let existing = targetGame?.extensions?.find(e => e.title.toLowerCase().trim() === normalizedImp);
                  
                  // Strategy 2: Fuzzy Match (Includes)
                  if (!existing && targetGame?.extensions) {
                      existing = targetGame.extensions.find(e => {
                          const normalizedLocal = e.title.toLowerCase().trim();
                          return normalizedImp.includes(normalizedLocal) || normalizedLocal.includes(normalizedImp);
                      });
                  }

                  // Strategy 3: Token Overlap (Best Match)
                  if (!existing && targetGame?.extensions) {
                      let bestMatch = null;
                      let maxOverlap = 0;

                      const impTokens = normalizedImp.replace(/[^a-z0-9 ]/g, '').split(/\s+/);

                      targetGame.extensions.forEach(e => {
                          const localTokens = e.title.toLowerCase().replace(/[^a-z0-9 ]/g, '').split(/\s+/);
                          
                          // Count how many significant words (>2 chars) match
                          const overlap = impTokens.filter(t => t.length > 2 && localTokens.includes(t)).length;
                          
                          if (overlap > maxOverlap) {
                              maxOverlap = overlap;
                              bestMatch = e;
                          }
                      });

                      if (maxOverlap > 0) {
                          existing = bestMatch || undefined;
                      }
                  }

                  if (existing) {
                      newMapping[impExt.id] = existing.id;
                  } else {
                      // If no match found, force explicit selection (empty string)
                      newMapping[impExt.id] = '';
                  }
              }
          });
          setExtensionMapping(newMapping);
      }
  }, [targetGameId, parsedData, step, games]);

  const tryParseData = async (input: string) => {
      if (!input.trim()) return;
      setIsProcessing(true);
      setError('');
      
      let cleanInput = input.trim();

      // 1. Check URL
      if (cleanInput.includes('data=')) {
          try {
              const parts = cleanInput.split('data=');
              if (parts.length > 1) {
                  cleanInput = parts[1].split('&')[0];
                  cleanInput = decodeURIComponent(cleanInput);
              }
          } catch (e) { /* ignore */ }
      }

      // 2. Check BG Stats Link
      if (cleanInput.includes('bgstatsapp.com')) {
          setError('BG Stats links kunnen niet direct worden gelezen. Exporteer als JSON.');
          setIsProcessing(false);
          return;
      }

      // 3. Parse JSON
      try {
          // Try Raw JSON
          const data = JSON.parse(cleanInput);
          if (handleParsedObject(data)) return;
      } catch (e) {
          // Not JSON, try Base64
          try {
              const json = fromBase64(cleanInput);
              if (json) {
                  const data = JSON.parse(json);
                  if (handleParsedObject(data)) return;
              }
          } catch (e2) { /* Ignore */ }
      }

      setError('Kan de data niet lezen. Controleer of de code compleet is.');
      setIsProcessing(false);
  };

  const handleParsedObject = (data: any): boolean => {
      // 1. Native Export Format (Single Game)
      if (data && data.type === 'match_export' && Array.isArray(data.matches)) {
          setDetectedGames([data]);
          setSelectedDetectedIndices([0]);
          setStep('select_games');
          setIsProcessing(false);
          return true;
      }
      
      // 2. BG Stats Export (Potentially Multiple Games)
      const bgStatsExports = convertBGStatsData(data);
      if (bgStatsExports.length > 0) {
          setDetectedGames(bgStatsExports);
          setSelectedDetectedIndices(bgStatsExports.map((_, i) => i));
          setStep('select_games');
          setIsProcessing(false);
          return true;
      }

      return false;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          const reader = new FileReader();
          reader.onload = (event) => {
              if (event.target?.result) {
                  const content = event.target.result as string;
                  setImportString(content); 
                  tryParseData(content);
              }
          };
          reader.readAsText(file);
      }
  };

  const convertBGStatsData = (data: any): ExportData[] => {
      if (!data || !Array.isArray(data.plays) || !Array.isArray(data.players) || !Array.isArray(data.games)) {
          return [];
      }

      try {
          // Group plays by Game ID
          const playsByGame: Record<number, any[]> = {};
          data.plays.forEach((play: any) => {
              if (!playsByGame[play.gameRefId]) playsByGame[play.gameRefId] = [];
              playsByGame[play.gameRefId].push(play);
          });

          const resultExports: ExportData[] = [];

          Object.keys(playsByGame).forEach((gameIdStr) => {
              const gameId = parseInt(gameIdStr);
              const relevantPlays = playsByGame[gameId];
              const bgGame = data.games.find((g: any) => g.id === gameId);
              
              if (!bgGame || relevantPlays.length === 0) return;

              const sourceGameTitle = bgGame.name || 'Onbekend Spel';

              // Map Players for this specific game batch
              const playersMap: Record<number, { id: string, name: string }> = {};
              const usedPlayerIds = new Set<string>();
              const extensionDefinitions: { id: string, title: string }[] = [];
              const usedExtensions = new Set<string>();

              // Pre-fill player map from global list
              data.players.forEach((p: any) => {
                  playersMap[p.id] = { id: `bg_${p.id}`, name: p.name || 'Onbekend' };
              });

              // Check extensions in these plays
              relevantPlays.forEach((play: any) => {
                  if (play.usesExpansions) {
                      play.usesExpansions.forEach((expId: number) => {
                          const extGame = data.games.find((g: any) => g.id === expId);
                          if (extGame) {
                              const extIdStr = `bg_ext_${expId}`;
                              if (!usedExtensions.has(extIdStr)) {
                                  usedExtensions.add(extIdStr);
                                  extensionDefinitions.push({ id: extIdStr, title: extGame.name });
                              }
                          }
                      });
                  }
              });

              const convertedMatches: Match[] = [];

              relevantPlays.forEach((play: any, index: number) => {
                  const results: MatchResult[] = [];
                  
                  if (play.playerScores) {
                      play.playerScores.forEach((ps: any) => {
                          const pInfo = playersMap[ps.playerRefId];
                          if (pInfo) {
                              usedPlayerIds.add(pInfo.id);
                              results.push({
                                  playerId: pInfo.id,
                                  score: Number(ps.score) || 0,
                                  isWinner: ps.winner === true,
                                  isStarter: ps.startPlayer === true
                              });
                          }
                      });
                  }

                  const dateStr = play.playDate;
                  const dateObj = new Date(dateStr);
                  const months = ['Jan', 'Feb', 'Mrt', 'Apr', 'Mei', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'];
                  const formattedDate = !isNaN(dateObj.getTime()) 
                      ? `${dateObj.getDate()} ${months[dateObj.getMonth()]} ${dateObj.getFullYear()}`
                      : dateStr;

                  let durationStr;
                  if (play.durationMin) {
                      const h = Math.floor(play.durationMin / 60);
                      const m = play.durationMin % 60;
                      durationStr = `${h}:${m.toString().padStart(2, '0')}:00`;
                  }

                  let matchExtensionIds: string[] | undefined = undefined;
                  if (play.usesExpansions && Array.isArray(play.usesExpansions)) {
                      matchExtensionIds = play.usesExpansions.map((id: number) => `bg_ext_${id}`);
                  }

                  convertedMatches.push({
                      id: Date.now() + index, // Temp ID
                      gameId: 0,
                      date: formattedDate,
                      duration: durationStr,
                      location: data.locations ? data.locations.find((l: any) => l.id === play.locationRefId)?.name : undefined,
                      results: results,
                      createdBy: 'import',
                      extensionIds: matchExtensionIds
                  });
              });

              const convertedPlayers = Array.from(usedPlayerIds).map(id => {
                  const bgId = parseInt(id.replace('bg_', ''));
                  return { id: id, name: playersMap[bgId]?.name || 'Speler' };
              });

              resultExports.push({
                  type: 'match_export',
                  version: 1,
                  sourceGameTitle: sourceGameTitle,
                  matches: convertedMatches,
                  players: convertedPlayers,
                  extensions: extensionDefinitions
              });
          });

          return resultExports;

      } catch (e) {
          console.error(e);
          return [];
      }
  };

  const prepareImportData = (data: ExportData) => {
      setParsedData(data);
      
      // Reset Mapping State for new item
      setTargetGameId(null);
      setIsCreatingGame(false);
      setGameMappingMode('none'); 
      setPlayerMapping({});
      setLocationMapping({});
      setCustomLocationValues({});
      setExtensionMapping({});
      setCustomizedExtensions({}); // Reset customizations

      // Pre-fill targetGameId if match found, but don't auto-select mode
      const matchByTitle = games.find(g => g.title.toLowerCase() === data.sourceGameTitle.toLowerCase());
      if (matchByTitle) {
          setTargetGameId(matchByTitle.id);
      }

      // Pre-initialize extensions to empty string (force selection)
      if (data.extensions) {
          const initExtMap: Record<string, string> = {};
          data.extensions.forEach(e => initExtMap[e.id] = '');
          setExtensionMapping(initExtMap);
      }

      // Extract unique locations
      const locs = new Set<string>();
      data.matches.forEach(m => {
          if (m.location) locs.add(m.location);
      });
      setUniqueImportLocations(Array.from(locs));
      
      setStep('map_game');
      setError('');
  };

  // --- Step Handlers ---

  const handleParse = () => {
      tryParseData(importString);
  };

  const handleSelectionConfirm = () => {
      const selectedGames = detectedGames.filter((_, i) => selectedDetectedIndices.includes(i));
      if (selectedGames.length === 0) {
          setError('Selecteer ten minste één spel.');
          return;
      }
      setImportQueue(selectedGames);
      setCurrentQueueIndex(0);
  };

  const toggleSelection = (index: number) => {
      setSelectedDetectedIndices(prev => 
          prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
      );
  };

  const handleExtensionAction = (impId: string, action: string) => {
      if (action === 'create_custom') {
          setEditingExtensionImportId(impId);
          setShowExtensionModal(true);
      } else {
          setExtensionMapping(prev => ({ ...prev, [impId]: action }));
      }
  };

  const handleExtensionConfigured = (_gameData: Partial<Game>, extData?: { parentId: number, title: string, image: string, customColumns?: ScoreColumn[] }) => {
      if (!editingExtensionImportId || !extData) return;

      const newExt: GameExtension = {
          id: `ext_${Date.now()}`, // Temp ID, will be used in handleImport
          title: extData.title,
          image: extData.image, // technically unused for extensions now but kept for type compatibility
          customColumns: extData.customColumns
      };

      setCustomizedExtensions(prev => ({ ...prev, [editingExtensionImportId]: newExt }));
      setExtensionMapping(prev => ({ ...prev, [editingExtensionImportId]: 'customized' }));
      setShowExtensionModal(false);
      setEditingExtensionImportId(null);
  };

  const handleGameMapping = () => {
      if (gameMappingMode === 'none') {
          setError('Maak een keuze: Nieuw of Bestaand spel.');
          return;
      }
      if (gameMappingMode === 'existing' && !targetGameId) {
          setError('Kies een spel uit de lijst.');
          return;
      }
      if (gameMappingMode === 'create' && !targetGameId) {
          setError('Maak het nieuwe spel eerst aan.');
          return;
      }
      
      // Check if all extensions are mapped
      if (parsedData?.extensions) {
          const allExtensionsMapped = parsedData.extensions.every(e => extensionMapping[e.id] !== '' && extensionMapping[e.id] !== undefined);
          if (!allExtensionsMapped) {
              setError('Maak een keuze voor alle uitbreidingen.');
              return;
          }
      }
      
      // Pre-fill location mapping
      const newLocMapping: Record<string, string> = {};
      const newCustomLocValues: Record<string, string> = {};
      
      uniqueImportLocations.forEach(impLoc => {
          // Normalize for comparison (Case insensitive + trimmed)
          const normalizedImp = impLoc.trim().toLowerCase();
          const exactMatch = locations.find(l => l.trim().toLowerCase() === normalizedImp);
          
          if (exactMatch) {
              newLocMapping[impLoc] = exactMatch; // Automatically select existing
          } else {
              newLocMapping[impLoc] = 'new';
          }
          newCustomLocValues[impLoc] = impLoc; 
      });
      setLocationMapping(newLocMapping);
      setCustomLocationValues(newCustomLocValues);

      // Determine next step
      if (uniqueImportLocations.length > 0) {
          setStep('map_locations');
      } else {
          initPlayerMapping();
          setStep('map_players');
      }
      setError('');
  };

  const handleGameCreated = (gameData: Partial<Game>) => {
      const newGame: Game = {
          id: Date.now(),
          title: gameData.title || parsedData?.sourceGameTitle || 'Nieuw Spel',
          lastPlayed: 'Nog nooit',
          playCount: 0,
          winner: { name: '-', score: '-' },
          image: gameData.image || '',
          type: gameData.type || 'score',
          winningCondition: gameData.winningCondition,
          scoreType: gameData.scoreType,
          customColumns: gameData.customColumns,
          extensions: []
      };
      addGame(newGame);
      setTargetGameId(newGame.id);
      setIsCreatingGame(false); 
      setGameMappingMode('create'); 
      setShowGameModal(false);
  };

  const handleLocationMapping = () => {
      initPlayerMapping();
      setStep('map_players');
  };

  const initPlayerMapping = () => {
      if (parsedData) {
          const newMapping: Record<string, string> = {};
          parsedData.players.forEach(remoteP => {
              const localMatch = players.find(p => p.name.toLowerCase() === remoteP.name.toLowerCase());
              if (localMatch) {
                  newMapping[remoteP.id] = localMatch.id;
              } else {
                  // CHANGE: Default to empty to force user selection
                  newMapping[remoteP.id] = ''; 
              }
          });
          setPlayerMapping(newMapping);
      }
  };

  const handleAdvancedPlayerSelect = (remotePlayerId: string, value: string) => {
      if (value === 'create_advanced') {
          setEditingRemotePlayerId(remotePlayerId);
          setShowPlayerModal(true);
      } else {
          setPlayerMapping(prev => ({ ...prev, [remotePlayerId]: value }));
      }
  };

  const handlePlayerCreated = (newPlayer: Player) => {
      if (editingRemotePlayerId) {
          setPlayerMapping(prev => ({ ...prev, [editingRemotePlayerId]: newPlayer.id }));
          setEditingRemotePlayerId(null);
      }
  };

  const handleImport = () => {
      if (!parsedData) return;

      let finalGameId = targetGameId;
      let finalGame = games.find(g => g.id === targetGameId);

      // (Fallback creation)
      if (isCreatingGame && !finalGame) {
          const newGameId = Date.now();
          const newGame: Game = {
              id: newGameId,
              title: parsedData.sourceGameTitle,
              lastPlayed: 'Nog nooit',
              playCount: 0,
              winner: { name: '-', score: '-' },
              image: `https://ui-avatars.com/api/?name=${encodeURIComponent(parsedData.sourceGameTitle)}&background=random&size=512`,
              type: 'score',
              extensions: [] 
          };
          addGame(newGame);
          finalGameId = newGameId;
          finalGame = newGame;
      }

      // 2. Process Extensions
      const finalExtensionMapping = { ...extensionMapping };
      const newExtensionsToAdd: GameExtension[] = [];

      if (parsedData.extensions && finalGame) {
          parsedData.extensions.forEach(impExt => {
              const mappedValue = finalExtensionMapping[impExt.id];
              
              if (mappedValue === 'customized') {
                  // Retrieve the customized config
                  const customConfig = customizedExtensions[impExt.id];
                  if (customConfig) {
                      newExtensionsToAdd.push(customConfig);
                      finalExtensionMapping[impExt.id] = customConfig.id;
                  }
              } 
              // 'ignore' and 'new' (removed) logic is handled by just not mapping it to a valid ID in the matches below
          });

          if (newExtensionsToAdd.length > 0) {
              const updatedGame = {
                  ...finalGame,
                  extensions: [...(finalGame.extensions || []), ...newExtensionsToAdd]
              };
              updateGame(updatedGame);
          }
      }

      // 3. Create New Players
      const finalPlayerMapping = { ...playerMapping };
      parsedData.players.forEach(remoteP => {
          if (finalPlayerMapping[remoteP.id] === 'new') {
              const newPlayerId = `p_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
              const newPlayer: Player = {
                  id: newPlayerId,
                  name: remoteP.name,
                  image: `https://ui-avatars.com/api/?name=${encodeURIComponent(remoteP.name)}&background=random`
              };
              addPlayer(newPlayer);
              finalPlayerMapping[remoteP.id] = newPlayerId;
          }
      });

      // 4. Process Locations
      Object.entries(locationMapping).forEach(([impName, mappedValue]) => {
          if (mappedValue === 'new') {
              addLocation(impName); 
          } else if (mappedValue === 'custom_entry') {
              const customName = customLocationValues[impName];
              if (customName && customName.trim()) {
                  addLocation(customName);
              }
          }
      });

      // 5. Import Matches
      parsedData.matches.forEach((remoteMatch, idx) => {
          let finalLocation = remoteMatch.location;
          if (remoteMatch.location) {
              const mappedLoc = locationMapping[remoteMatch.location];
              if (mappedLoc === 'new') finalLocation = remoteMatch.location;
              else if (mappedLoc === 'custom_entry') finalLocation = customLocationValues[remoteMatch.location] || remoteMatch.location;
              else if (mappedLoc) finalLocation = mappedLoc;
          }

          let finalExtensionIds: string[] | undefined = undefined;
          if (remoteMatch.extensionIds && remoteMatch.extensionIds.length > 0) {
              finalExtensionIds = remoteMatch.extensionIds
                .map(eid => finalExtensionMapping[eid])
                .filter(id => id && id !== 'ignore' && id !== 'customized'); 
          }

          const newMatch: Match = {
              ...remoteMatch,
              id: Date.now() + idx + Math.floor(Math.random()*1000), 
              gameId: finalGameId as number,
              location: finalLocation,
              extensionIds: finalExtensionIds,
              results: remoteMatch.results.map(res => ({
                  ...res,
                  playerId: finalPlayerMapping[res.playerId] || res.playerId 
              }))
          };
          addMatch(newMatch);
      });

      // CHECK QUEUE
      if (currentQueueIndex < importQueue.length - 1) {
          setCurrentQueueIndex(prev => prev + 1);
      } else {
          navigate(`/`);
      }
  };

  const getTargetGameExtensions = () => {
      if (isCreatingGame || !targetGameId) return [];
      const g = games.find(game => game.id === targetGameId);
      return g?.extensions || [];
  };

  const getActiveStepIndex = () => {
      if (step === 'input' || step === 'select_games') return 0;
      if (step === 'map_game') return 1;
      if (step === 'map_locations') return 2;
      return 3;
  };

  // Check if all players are mapped (no empty strings)
  const allPlayersMapped = parsedData?.players.every(p => playerMapping[p.id] !== undefined && playerMapping[p.id] !== '') ?? false;

  const initialPlayerName = useMemo(() => {
      if (!parsedData || !editingRemotePlayerId) return '';
      const p = parsedData.players.find(pl => pl.id === editingRemotePlayerId);
      return p ? p.name : '';
  }, [parsedData, editingRemotePlayerId]);

  // Initial extension title for modal
  const initialExtensionData = useMemo(() => {
      if (!parsedData || !editingExtensionImportId || !targetGameId) return undefined;
      const ext = parsedData.extensions.find(e => e.id === editingExtensionImportId);
      if (!ext) return undefined;
      
      // If we already customized it, use that data
      if (customizedExtensions[editingExtensionImportId]) {
          const existing = customizedExtensions[editingExtensionImportId];
          return {
              parentId: targetGameId,
              id: existing.id,
              title: existing.title,
              image: '',
              customColumns: existing.customColumns
          } as any;
      }

      // Fresh start
      return {
          parentId: targetGameId,
          id: 'temp',
          title: ext.title,
          image: '',
          customColumns: []
      } as any;
  }, [parsedData, editingExtensionImportId, targetGameId, customizedExtensions]);

  return (
    <div className="bg-background-light dark:bg-background-dark font-display antialiased min-h-screen flex flex-col max-w-md mx-auto relative shadow-2xl text-slate-900 dark:text-white">
      {/* Header */}
      <div className="sticky top-0 z-50 flex items-center bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-md p-4 pb-2 justify-between border-b border-gray-200 dark:border-gray-800">
        <button onClick={() => navigate(-1)} className="text-gray-900 dark:text-white flex size-12 shrink-0 items-center justify-center rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors">
          <span className="material-symbols-outlined text-2xl">arrow_back</span>
        </button>
        <div className="flex-1 text-center">
            <h2 className="text-gray-900 dark:text-white text-lg font-bold leading-tight tracking-[-0.015em]">
                {importQueue.length > 1 ? `Import (${currentQueueIndex + 1}/${importQueue.length})` : 'Importeer Potjes'}
            </h2>
            {importQueue.length > 1 && parsedData && (
                <span className="text-[10px] text-slate-500 font-bold uppercase">{parsedData.sourceGameTitle}</span>
            )}
        </div>
        <div className="w-12"></div>
      </div>

      <div className="flex-1 p-6 overflow-y-auto pb-32">
        
        {/* Progress Stepper (4 Steps) */}
        <div className="flex items-center justify-center gap-2 mb-8">
            <div className={`h-2 flex-1 rounded-full ${getActiveStepIndex() >= 0 ? 'bg-primary' : 'bg-gray-200 dark:bg-gray-700'}`}></div>
            <div className={`h-2 flex-1 rounded-full ${getActiveStepIndex() >= 1 ? 'bg-primary' : 'bg-gray-200 dark:bg-gray-700'}`}></div>
            <div className={`h-2 flex-1 rounded-full ${getActiveStepIndex() >= 2 ? 'bg-primary' : 'bg-gray-200 dark:bg-gray-700'}`}></div>
            <div className={`h-2 flex-1 rounded-full ${getActiveStepIndex() >= 3 ? 'bg-primary' : 'bg-gray-200 dark:bg-gray-700'}`}></div>
        </div>

        {/* STEP 1: INPUT */}
        {step === 'input' && (
            <div className="animate-slide-down">
                <div className="text-center mb-6">
                    <div className="size-16 bg-blue-50 dark:bg-blue-900/20 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="material-symbols-outlined text-3xl">content_paste</span>
                    </div>
                    <h3 className="text-xl font-bold mb-2">Data Importeren</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        Plak hier de export code van <strong>Game Master</strong> of de ruwe JSON van <strong>BG Stats</strong>.
                    </p>
                </div>
                
                <textarea 
                    value={importString}
                    onChange={(e) => setImportString(e.target.value)}
                    placeholder="Plak hier de code..."
                    className="w-full h-40 bg-white dark:bg-surface-dark border border-gray-200 dark:border-gray-700 rounded-xl p-4 font-mono text-xs focus:ring-2 focus:ring-primary/50 resize-none mb-4"
                ></textarea>
                
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileUpload} 
                    accept=".json,.txt" 
                    className="hidden" 
                />
                <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-3 mb-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl flex items-center justify-center gap-2 text-slate-500 hover:border-primary hover:text-primary transition-colors bg-gray-50 dark:bg-gray-800/50 text-sm font-bold"
                >
                    <span className="material-symbols-outlined">upload_file</span>
                    Kies bestand van schijf
                </button>

                {error && (
                    <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300 p-3 rounded-xl text-sm mb-4 font-medium flex items-center gap-2">
                        <span className="material-symbols-outlined text-lg">error</span>
                        {error}
                    </div>
                )}

                <button 
                    onClick={handleParse}
                    disabled={!importString.trim() || isProcessing}
                    className="w-full py-4 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/30 hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                >
                    {isProcessing ? (
                        <>
                            <span className="material-symbols-outlined animate-spin text-lg">refresh</span>
                            Verwerken...
                        </>
                    ) : (
                        'Volgende'
                    )}
                </button>
            </div>
        )}

        {/* STEP 1.5: SELECT GAMES (Multi-import) */}
        {step === 'select_games' && (
            <div className="animate-slide-down">
                <div className="text-center mb-6">
                    <h3 className="text-xl font-bold mb-2">Selecteer Spellen</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        Er zijn <strong>{detectedGames.length}</strong> spellen gevonden in het bestand. Welke wil je importeren?
                    </p>
                </div>

                <div className="space-y-3 mb-6">
                    {detectedGames.map((g, idx) => {
                        const isSelected = selectedDetectedIndices.includes(idx);
                        return (
                            <button 
                                key={idx}
                                onClick={() => toggleSelection(idx)}
                                className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left ${isSelected ? 'border-primary bg-primary/5' : 'border-gray-200 dark:border-gray-700 bg-surface-light dark:bg-surface-dark'}`}
                            >
                                <div className={`size-6 rounded-full border-2 flex items-center justify-center shrink-0 ${isSelected ? 'border-primary bg-primary text-white' : 'border-slate-300 dark:border-slate-600'}`}>
                                    {isSelected && <span className="material-symbols-outlined text-sm font-bold">check</span>}
                                </div>
                                <div>
                                    <span className="block font-bold text-slate-900 dark:text-white">{g.sourceGameTitle}</span>
                                    <span className="text-xs text-slate-500 dark:text-slate-400">{g.matches.length} potjes</span>
                                </div>
                            </button>
                        );
                    })}
                </div>

                {error && <div className="text-red-500 text-sm font-bold text-center mb-4">{error}</div>}

                <button 
                    onClick={handleSelectionConfirm}
                    className="w-full py-4 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/30 hover:bg-primary/90 transition-all"
                >
                    Start Import ({selectedDetectedIndices.length})
                </button>
            </div>
        )}

        {/* STEP 2: MAP GAME (And Extensions) */}
        {step === 'map_game' && parsedData && (
            <div className="animate-slide-down">
                <div className="text-center mb-6">
                    <h3 className="text-xl font-bold mb-2">Spel Koppelen</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        Match <strong>{parsedData.matches.length} potjes</strong> van <strong>{parsedData.sourceGameTitle}</strong>.
                        <br/>Waar moeten we deze aan toevoegen?
                    </p>
                </div>

                <div className="space-y-3 mb-6">
                    {/* Create New Block */}
                    <div 
                        onClick={() => { setGameMappingMode('create'); setIsCreatingGame(true); }}
                        className={`w-full p-4 rounded-xl border-2 text-left cursor-pointer transition-all ${gameMappingMode === 'create' ? 'border-primary bg-primary/5' : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                    >
                        <div className="flex items-center gap-3 mb-2">
                            <div className={`size-6 rounded-full border-2 flex items-center justify-center ${gameMappingMode === 'create' ? 'border-primary' : 'border-slate-300'}`}>
                                {gameMappingMode === 'create' && <div className="size-3 bg-primary rounded-full"></div>}
                            </div>
                            <span className="block font-bold">Nieuw spel aanmaken</span>
                        </div>
                        
                        {gameMappingMode === 'create' && (
                            <div className="ml-9 animate-slide-down">
                                {targetGameId ? (
                                    <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 flex items-center gap-3">
                                        <span className="material-symbols-outlined text-green-500">check_circle</span>
                                        <div className="flex-1">
                                            <span className="text-xs text-slate-500 block uppercase font-bold">Aangemaakt</span>
                                            <span className="font-bold text-sm block">{games.find(g => g.id === targetGameId)?.title || 'Nieuw Spel'}</span>
                                        </div>
                                    </div>
                                ) : (
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); setShowGameModal(true); }}
                                        className="w-full py-2 bg-primary text-white text-sm font-bold rounded-lg hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                                    >
                                        <span className="material-symbols-outlined text-lg">add</span>
                                        Spel Configureren
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Select Existing Block */}
                    <div 
                        onClick={() => { setGameMappingMode('existing'); setIsCreatingGame(false); }}
                        className={`w-full p-4 rounded-xl border-2 text-left cursor-pointer transition-all ${gameMappingMode === 'existing' ? 'border-primary bg-primary/5' : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                    >
                        <div className="flex items-center gap-3 mb-2">
                            <div className={`size-6 rounded-full border-2 flex items-center justify-center ${gameMappingMode === 'existing' ? 'border-primary' : 'border-slate-300'}`}>
                                {gameMappingMode === 'existing' && <div className="size-3 bg-primary rounded-full"></div>}
                            </div>
                            <span className="block font-bold">Kies bestaand spel</span>
                        </div>

                        {gameMappingMode === 'existing' && (
                            <div className="ml-9 animate-slide-down">
                                <div className="relative">
                                    <select 
                                        className="w-full rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-sm py-2 pl-3 pr-8 focus:ring-primary focus:border-primary disabled:opacity-50"
                                        value={targetGameId || ''}
                                        onChange={(e) => setTargetGameId(Number(e.target.value))}
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <option value="" disabled>Selecteer een spel...</option>
                                        {games.map(g => (
                                            <option key={g.id} value={g.id}>{g.title}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* EXTENSION MAPPING UI (Integrated here) */}
                {parsedData.extensions && parsedData.extensions.length > 0 && (
                    <div className="mt-6 mb-6 animate-slide-down border-t border-gray-200 dark:border-gray-700 pt-6">
                        <div className="text-center mb-4">
                            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide">Gevonden Uitbreidingen</h3>
                        </div>
                        <div className="space-y-4">
                            {parsedData.extensions.map(ext => {
                                const currentValue = extensionMapping[ext.id];
                                const isMatched = currentValue && currentValue !== 'create_custom' && currentValue !== 'ignore' && currentValue !== 'customized' && currentValue !== '';
                                const isIgnored = currentValue === 'ignore';
                                const isCustomized = currentValue === 'customized';
                                const isUnselected = !currentValue;

                                return (
                                <div key={ext.id} className={`bg-surface-light dark:bg-surface-dark p-3 rounded-xl border-2 transition-colors flex flex-col gap-2 ${isMatched ? 'border-emerald-500/30 bg-emerald-50/10' : isUnselected ? 'border-orange-300/50 bg-orange-50/10' : (isCustomized) ? 'border-blue-500/30 bg-blue-50/10' : 'border-gray-200 dark:border-gray-700'}`}>
                                    <div className="flex items-center gap-2">
                                        <span className="material-symbols-outlined text-slate-400 text-sm">extension</span>
                                        <span className="font-bold text-slate-900 dark:text-white text-sm">{customizedExtensions[ext.id]?.title || ext.title}</span>
                                        
                                        {isMatched && <span className="ml-auto text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded">MATCH</span>}
                                        {isCustomized && <span className="ml-auto text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded">NIEUW</span>}
                                        {isIgnored && <span className="ml-auto text-[10px] font-bold bg-gray-100 text-gray-500 px-2 py-0.5 rounded">NEGEER</span>}
                                        {isUnselected && <span className="ml-auto text-[10px] font-bold bg-orange-100 text-orange-600 px-2 py-0.5 rounded">KIES ACTIE</span>}
                                    </div>
                                    
                                    <div className="flex items-center gap-2">
                                        <span className={`material-symbols-outlined ${isUnselected ? 'text-orange-400' : 'text-slate-300'}`}>arrow_downward</span>
                                        <select 
                                            className={`flex-1 rounded-lg bg-gray-50 dark:bg-gray-800 border text-sm py-2 pl-3 pr-8 focus:ring-primary focus:border-primary ${isUnselected ? 'border-orange-300 text-slate-500 italic' : 'border-gray-200 dark:border-gray-600 text-slate-900 dark:text-white'}`}
                                            value={currentValue || ''}
                                            onChange={(e) => handleExtensionAction(ext.id, e.target.value)}
                                        >
                                            <option value="" disabled>Selecteer actie...</option>
                                            <option value="create_custom">✨ Nieuw aanmaken</option>
                                            <option value="ignore">🚫 Niet toevoegen</option>
                                            {!isCreatingGame && (
                                                <optgroup label="Bestaande Uitbreidingen">
                                                    {getTargetGameExtensions().map(existing => (
                                                        <option key={existing.id} value={existing.id}>{existing.title}</option>
                                                    ))}
                                                </optgroup>
                                            )}
                                        </select>
                                    </div>
                                </div>
                            )})}
                        </div>
                    </div>
                )}

                {error && (
                    <div className="text-red-500 text-sm font-bold text-center mb-4">{error}</div>
                )}

                <button 
                    onClick={handleGameMapping}
                    disabled={gameMappingMode === 'none' || (gameMappingMode === 'existing' && !targetGameId)}
                    className="w-full py-4 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/30 hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Volgende
                </button>
            </div>
        )}

        {/* STEP 3: DETAILS (Location) */}
        {step === 'map_locations' && (
            <div className="animate-slide-down">
                <div className="text-center mb-6">
                    <h3 className="text-xl font-bold mb-2">Locaties Koppelen</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        Koppel de locaties uit de import aan jouw bestaande lijst of maak nieuwe aan.
                    </p>
                </div>

                <div className="space-y-6 mb-8">
                    {uniqueImportLocations.map(loc => {
                        const currentMapping = locationMapping[loc];
                        const isMatched = currentMapping && currentMapping !== 'new' && currentMapping !== 'custom_entry';

                        return (
                            <div key={loc} className={`bg-surface-light dark:bg-surface-dark p-3 rounded-xl border-2 transition-colors flex flex-col gap-3 ${isMatched ? 'border-emerald-500/30 bg-emerald-50/10' : 'border-gray-200 dark:border-gray-700'}`}>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-slate-400 uppercase">Import</span>
                                    <span className="font-bold text-slate-900 dark:text-white">{loc}</span>
                                    {isMatched && <span className="ml-auto text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded">MATCH</span>}
                                </div>
                                
                                <div className="flex items-center gap-2">
                                    <span className="material-symbols-outlined text-slate-300">arrow_downward</span>
                                    <select 
                                        className="flex-1 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-sm py-2 pl-3 pr-8 focus:ring-primary focus:border-primary"
                                        value={currentMapping || 'new'}
                                        onChange={(e) => setLocationMapping(prev => ({ ...prev, [loc]: e.target.value }))}
                                    >
                                        <option value="new">✨ Nieuw: "{loc}"</option>
                                        <option value="custom_entry">✍️ Zelf typen...</option>
                                        <optgroup label="Bestaande Locaties">
                                            {locations.map(existing => (
                                                <option key={existing} value={existing}>{existing}</option>
                                            ))}
                                        </optgroup>
                                    </select>
                                </div>

                                {currentMapping === 'custom_entry' && (
                                    <div className="ml-8 animate-slide-down">
                                        <input 
                                            type="text" 
                                            placeholder="Typ locatienaam..."
                                            value={customLocationValues[loc] || ''}
                                            onChange={(e) => setCustomLocationValues(prev => ({ ...prev, [loc]: e.target.value }))}
                                            className="w-full rounded-lg bg-white dark:bg-surface-dark border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20"
                                        />
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                <button 
                    onClick={handleLocationMapping}
                    className="w-full py-4 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/30 hover:bg-primary/90 transition-all"
                >
                    Volgende
                </button>
            </div>
        )}

        {/* STEP 4: PLAYERS & CONFIRM */}
        {step === 'map_players' && parsedData && (
            <div className="animate-slide-down">
                <div className="text-center mb-6">
                    <h3 className="text-xl font-bold mb-2">Spelers Koppelen</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        Koppel de spelers uit de import aan jouw eigen spelerslijst.
                    </p>
                </div>

                <div className="space-y-4 mb-8">
                    {parsedData.players.map(remoteP => {
                        const currentVal = playerMapping[remoteP.id];
                        const isUnselected = currentVal === '';
                        return (
                            <div key={remoteP.id} className={`bg-surface-light dark:bg-surface-dark p-3 rounded-xl border-2 flex flex-col gap-2 transition-colors ${isUnselected ? 'border-orange-300/50 bg-orange-50/10' : 'border-gray-200 dark:border-gray-700'}`}>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-slate-400 uppercase">Import</span>
                                    <span className="font-bold text-slate-900 dark:text-white">{remoteP.name}</span>
                                    {isUnselected && <span className="ml-auto text-[10px] font-bold bg-orange-100 text-orange-600 px-2 py-0.5 rounded">KIES ACTIE</span>}
                                </div>
                                
                                <div className="flex items-center gap-2">
                                    <span className={`material-symbols-outlined ${isUnselected ? 'text-orange-400' : 'text-slate-300'}`}>arrow_downward</span>
                                    <select 
                                        className={`flex-1 rounded-lg bg-gray-50 dark:bg-gray-800 border text-sm py-2 pl-3 pr-8 focus:ring-primary focus:border-primary ${isUnselected ? 'border-orange-300 text-slate-500 italic' : 'border-gray-200 dark:border-gray-600 text-slate-900 dark:text-white'}`}
                                        value={playerMapping[remoteP.id] || ''}
                                        onChange={(e) => handleAdvancedPlayerSelect(remoteP.id, e.target.value)}
                                    >
                                        <option value="" disabled>Selecteer actie...</option>
                                        <option value="create_advanced">✨ Nieuw aanmaken</option>
                                        <optgroup label="Bestaande Spelers">
                                            {players.map(localP => (
                                                <option key={localP.id} value={localP.id}>{localP.name}</option>
                                            ))}
                                        </optgroup>
                                    </select>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <button 
                    onClick={handleImport}
                    disabled={!allPlayersMapped}
                    className="w-full py-4 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/30 hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {!allPlayersMapped ? 'Koppel alle spelers...' : (importQueue.length > currentQueueIndex + 1 ? 'Opslaan & Volgende Spel' : 'Importeren & Afronden')}
                </button>
            </div>
        )}

      </div>

      {/* FULL SCREEN GAME FORM MODAL */}
      {showGameModal && (
          <div className="fixed inset-0 z-[100] bg-background-light dark:bg-background-dark animate-fade-in overflow-y-auto">
              <GameForm 
                  pageTitle="Nieuw Spel (Import)"
                  buttonLabel="Aanmaken & Selecteren"
                  onSubmit={handleGameCreated}
                  onCancel={() => setShowGameModal(false)}
                  // Pre-fill with import name
                  initialData={{
                      id: 0, 
                      title: parsedData?.sourceGameTitle || '',
                      lastPlayed: '', playCount: 0, winner: {name:'',score:''}, image: '', type: 'score'
                  }}
              />
          </div>
      )}

      {/* EXTENSION CONFIG MODAL */}
      {showExtensionModal && initialExtensionData && (
          <div className="fixed inset-0 z-[100] bg-background-light dark:bg-background-dark animate-fade-in overflow-y-auto">
              <GameForm 
                  pageTitle="Uitbreiding Configureren"
                  buttonLabel="Opslaan & Selecteren"
                  initialExtensionData={initialExtensionData}
                  availableGames={games}
                  onSubmit={handleExtensionConfigured}
                  onCancel={() => { setShowExtensionModal(false); setEditingExtensionImportId(null); }}
              />
          </div>
      )}

      {/* PLAYER MODAL */}
      {showPlayerModal && (
          <AddPlayerModal 
              isOpen={showPlayerModal}
              onClose={() => setShowPlayerModal(false)}
              onPlayerAdded={handlePlayerCreated}
              initialName={initialPlayerName}
          />
      )}

    </div>
  );
};

export default ImportMatches;
