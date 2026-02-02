
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useGames } from '../context/GameContext';
import { Player, ExportData } from '../types';
import HeaderActions from '../components/HeaderActions';
import NavigationMenu from '../components/NavigationMenu';

// Utility for safe UTF-8 Base64 encoding
const toBase64 = (str: string) => {
    return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g,
        function toSolidBytes(match, p1) {
            return String.fromCharCode(parseInt(p1, 16));
    }));
};

// Robust Copy Helper
const copyToClipboard = async (text: string): Promise<boolean> => {
    try {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        textArea.style.top = "0";
        textArea.setAttribute('readonly', '');
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        textArea.setSelectionRange(0, 99999);
        const success = document.execCommand('copy');
        document.body.removeChild(textArea);
        if (success) return true;
    } catch (e) {
        console.warn("Sync copy failed", e);
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (err) {
            console.error("Async copy failed", err);
        }
    }
    return false;
};

const Matches: React.FC = () => {
  const { matches, games, players } = useGames();
  const navigate = useNavigate();
  const location = useLocation();

  // Filter State
  const [gameQuery, setGameQuery] = useState('');
  const [selectedGameId, setSelectedGameId] = useState<number | null>(null);
  const [showGameDropdown, setShowGameDropdown] = useState(false);

  const [playerQuery, setPlayerQuery] = useState('');
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [showPlayerDropdown, setShowPlayerDropdown] = useState(false);

  // Selection & Export State
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedMatchIds, setSelectedMatchIds] = useState<number[]>([]);
  
  // Share Modal State
  const [shareData, setShareData] = useState<{ url: string; text: string; title: string; jsonData: string } | null>(null);
  const [showCopyToast, setShowCopyToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Refs for click outside
  const gameFilterRef = useRef<HTMLDivElement>(null);
  const playerFilterRef = useRef<HTMLDivElement>(null);

  // Initialize from Navigation State (e.g. from GameDetails)
  useEffect(() => {
      const state = location.state as { filterGameId?: number, autoSelectionMode?: boolean } | null;
      
      if (state?.filterGameId) {
          const gId = state.filterGameId;
          const g = games.find(x => x.id === gId);
          if (g) {
              setSelectedGameId(g.id);
              setGameQuery(g.title);
          }
      }
      
      if (state?.autoSelectionMode) {
          setIsSelectionMode(true);
      }
      
      // Clear state to prevent re-applying on refresh if desired, 
      // but keeping it simple for now. 
  }, [location.state, games]);

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (gameFilterRef.current && !gameFilterRef.current.contains(event.target as Node)) {
        setShowGameDropdown(false);
        if (!selectedGameId) setGameQuery('');
        else {
            const g = games.find(game => game.id === selectedGameId);
            setGameQuery(g ? g.title : '');
        }
      }
      if (playerFilterRef.current && !playerFilterRef.current.contains(event.target as Node)) {
        setShowPlayerDropdown(false);
        if (!selectedPlayerId) setPlayerQuery('');
        else {
            const p = players.find(player => player.id === selectedPlayerId);
            setPlayerQuery(p ? p.name : '');
        }
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [selectedGameId, games, selectedPlayerId, players]);


  // Logic for Dropdown lists
  const filteredGamesList = useMemo(() => {
    if (selectedGameId) {
        const selectedGame = games.find(g => g.id === selectedGameId);
        if (selectedGame && selectedGame.title === gameQuery) {
            return games;
        }
    }
    if (!gameQuery) return games;
    return games.filter(g => g.title.toLowerCase().includes(gameQuery.toLowerCase()));
  }, [games, gameQuery, selectedGameId]);

  const filteredPlayersList = useMemo(() => {
    if (selectedPlayerId) {
        const selectedPlayer = players.find(p => p.id === selectedPlayerId);
        if (selectedPlayer && selectedPlayer.name === playerQuery) {
            return players;
        }
    }
    if (!playerQuery) return players;
    return players.filter(p => p.name.toLowerCase().includes(playerQuery.toLowerCase()));
  }, [players, playerQuery, selectedPlayerId]);


  // Logic for filtering the Matches
  const visibleMatches = useMemo(() => {
    return matches.filter(match => {
        if (selectedGameId && match.gameId !== selectedGameId) return false;
        if (selectedPlayerId) {
            const participated = match.results.some(r => r.playerId === selectedPlayerId);
            if (!participated) return false;
        }
        return true;
    });
  }, [matches, selectedGameId, selectedPlayerId]);


  // Handlers
  const selectGame = (id: number, title: string) => {
      setSelectedGameId(id);
      setGameQuery(title);
      setShowGameDropdown(false);
  };

  const clearGame = (e: React.MouseEvent) => {
      e.stopPropagation();
      setSelectedGameId(null);
      setGameQuery('');
  };

  const selectPlayer = (id: string, name: string) => {
      setSelectedPlayerId(id);
      setPlayerQuery(name);
      setShowPlayerDropdown(false);
  };

  const clearPlayer = (e: React.MouseEvent) => {
      e.stopPropagation();
      setSelectedPlayerId(null);
      setPlayerQuery('');
  };

  // Selection Handlers
  const toggleMatchSelection = (matchId: number) => {
      setSelectedMatchIds(prev => 
          prev.includes(matchId) 
            ? prev.filter(id => id !== matchId) 
            : [...prev, matchId]
      );
  };

  const toggleSelectAll = () => {
      // Check if all VISIBLE matches are selected
      const allVisibleSelected = visibleMatches.length > 0 && visibleMatches.every(m => selectedMatchIds.includes(m.id));
      
      if (allVisibleSelected) {
          // Deselect only the visible ones (keep others selected? usually clear all is expected behavior in this context)
          // Let's clear all visible ones from selection
          const visibleIds = visibleMatches.map(m => m.id);
          setSelectedMatchIds(prev => prev.filter(id => !visibleIds.includes(id)));
      } else {
          // Select all visible ones
          const visibleIds = visibleMatches.map(m => m.id);
          // Merge unique
          const newSelection = new Set([...selectedMatchIds, ...visibleIds]);
          setSelectedMatchIds(Array.from(newSelection));
      }
  };

  // Prepare Data for Sharing
  const prepareExport = () => {
      const matchesToExport = matches.filter(m => selectedMatchIds.includes(m.id));
      if (matchesToExport.length === 0) return;

      const playerIds = new Set<string>();
      matchesToExport.forEach(m => {
          m.results.forEach(r => playerIds.add(r.playerId));
      });
      const playersForExport = players
        .filter(p => playerIds.has(p.id))
        .map(p => ({ id: p.id, name: p.name }));

      const extensionIds = new Set<string>();
      matchesToExport.forEach(m => m.extensionIds?.forEach(id => extensionIds.add(id)));
      
      const extensionsForExport: { id: string, title: string }[] = [];
      games.forEach(g => {
          g.extensions?.forEach(ext => {
              if (extensionIds.has(ext.id)) {
                  if (!extensionsForExport.some(e => e.id === ext.id)) {
                      extensionsForExport.push({ id: ext.id, title: ext.title });
                  }
              }
          });
      });

      const uniqueGameIds = new Set(matchesToExport.map(m => m.gameId));
      let sourceTitle = "Gemengde Export";
      if (uniqueGameIds.size === 1) {
          const g = games.find(g => g.id === [...uniqueGameIds][0]);
          if (g) sourceTitle = g.title;
      }

      const exportData: ExportData = {
          type: 'match_export',
          version: 1,
          sourceGameTitle: sourceTitle,
          matches: matchesToExport,
          players: playersForExport,
          extensions: extensionsForExport
      };

      const jsonString = JSON.stringify(exportData);
      
      let shareUrl = '';
      try {
          const base64Data = toBase64(jsonString);
          const baseUrl = window.location.href.split('#')[0];
          shareUrl = `${baseUrl}#/import?data=${encodeURIComponent(base64Data)}`;
          
          if (shareUrl.length > 8000) {
              shareUrl = ''; // Too long for URL
          }
      } catch (e) {
          // Ignore
      }

      setShareData({
          url: shareUrl || jsonString, // Fallback to raw JSON if URL too long or error
          text: `Hier zijn ${matchesToExport.length} potjes van ${sourceTitle}.`,
          title: `Game Master Export: ${sourceTitle}`,
          jsonData: jsonString
      });
  };

  const handleCopyLink = async () => {
      if (!shareData) return;
      const success = await copyToClipboard(shareData.url);
      setToastMessage(success ? 'Link gekopieerd!' : 'Kopiëren mislukt');
      setShowCopyToast(true);
      setTimeout(() => setShowCopyToast(false), 3000);
      setShareData(null);
      setIsSelectionMode(false);
      setSelectedMatchIds([]);
  };

  const handleDownloadFile = () => {
      if (!shareData?.jsonData) return;
      
      const blob = new Blob([shareData.jsonData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      // Sanitize title for filename
      const safeTitle = shareData.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const date = new Date().toISOString().slice(0, 10);
      a.download = `${safeTitle}_${date}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      setShareData(null);
      setIsSelectionMode(false);
      setSelectedMatchIds([]);
  };

  const handleWhatsApp = () => {
      if (!shareData) return;
      const text = encodeURIComponent(`${shareData.text}\n\n${shareData.url}`);
      window.open(`https://wa.me/?text=${text}`, '_blank');
      setShareData(null);
      setIsSelectionMode(false);
      setSelectedMatchIds([]);
  };

  const handleSystemShare = async () => {
      if (!shareData) return;
      if (navigator.share) {
          try {
              await navigator.share({
                  title: shareData.title,
                  text: shareData.text,
                  url: shareData.url.startsWith('http') ? shareData.url : undefined
              });
              setShareData(null);
              setIsSelectionMode(false);
              setSelectedMatchIds([]);
          } catch (err) {
              // Cancelled
          }
      } else {
          // Fallback if generic button clicked but no support (rare on mobile)
          handleCopyLink();
      }
  };

  // Helper to parse scores
  const parseScore = (score: string | number): number => {
      if (typeof score === 'number') return score;
      const parsed = parseFloat(score.toString().replace(/[^0-9.-]+/g,""));
      return isNaN(parsed) ? 0 : parsed;
  };

  const isAllSelected = visibleMatches.length > 0 && visibleMatches.every(m => selectedMatchIds.includes(m.id));

  return (
    <div className="relative flex min-h-screen w-full flex-col max-w-md mx-auto shadow-2xl overflow-hidden bg-background-light dark:bg-background-dark text-slate-900 dark:text-white">
      {/* Top App Bar */}
      <div className="sticky top-0 flex items-center bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-md p-4 pb-2 justify-between border-b border-gray-200 dark:border-gray-800 transition-colors z-20">
        {!isSelectionMode ? (
            <>
                <NavigationMenu />
                <div className="flex-1 flex flex-col items-center justify-center">
                    <h2 className="text-gray-900 dark:text-white text-lg font-bold leading-tight tracking-[-0.015em]">Alle Potjes</h2>
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{visibleMatches.length} Resultaten</span>
                </div>
                <div className="flex items-center gap-1">
                    <button 
                        onClick={() => navigate('/import')}
                        className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-slate-600 dark:text-white"
                        title="Importeren"
                    >
                        <span className="material-symbols-outlined text-[20px]">download</span>
                    </button>
                    <button 
                        onClick={() => setIsSelectionMode(true)}
                        className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-slate-600 dark:text-white"
                        title="Selecteren & Exporteren"
                    >
                        <span className="material-symbols-outlined text-[20px]">ios_share</span>
                    </button>
                    <HeaderActions />
                </div>
            </>
        ) : (
            <>
                <button onClick={() => { setIsSelectionMode(false); setSelectedMatchIds([]); }} className="text-slate-900 dark:text-white flex size-12 shrink-0 items-center justify-center rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors">
                    <span className="material-symbols-outlined">close</span>
                </button>
                <h2 className="text-gray-900 dark:text-white text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center">
                    {selectedMatchIds.length} Geselecteerd
                </h2>
                <button 
                    onClick={toggleSelectAll} 
                    className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ${isAllSelected ? 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300' : 'bg-primary text-white shadow-sm'}`}
                >
                    {isAllSelected ? 'Niets' : 'Alles'}
                </button>
            </>
        )}
      </div>

      {/* Share Modal (Bottom Sheet) */}
      {shareData && (
          <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 animate-fade-in">
              <div className="bg-surface-light dark:bg-surface-dark w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-gray-100 dark:border-gray-700 animate-slide-down">
                  <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white">Delen</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{shareData.text}</p>
                      </div>
                      <button onClick={() => setShareData(null)} className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-slate-400"><span className="material-symbols-outlined">close</span></button>
                  </div>

                  {/* Readonly Link Field */}
                  <div className="mb-6 relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <span className="material-symbols-outlined text-slate-400 text-lg">link</span>
                      </div>
                      <input 
                          type="text" 
                          readOnly 
                          value={shareData.url.length > 50 ? shareData.url.substring(0, 50) + '...' : shareData.url} 
                          className="w-full pl-10 pr-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-slate-600 dark:text-slate-300 text-sm font-mono truncate focus:outline-none select-all"
                      />
                  </div>

                  {/* Share Actions Grid (2 Rows of 2) */}
                  <div className="grid grid-cols-2 gap-3">
                      {/* Copy Link */}
                      <button onClick={handleCopyLink} className="flex flex-col items-center gap-2 group p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                          <div className="size-12 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-slate-700 dark:text-slate-200 group-hover:bg-gray-200 dark:group-hover:bg-gray-700 transition-colors">
                              <span className="material-symbols-outlined text-xl">content_copy</span>
                          </div>
                          <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Kopieer</span>
                      </button>

                      {/* WhatsApp */}
                      <button onClick={handleWhatsApp} className="flex flex-col items-center gap-2 group p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                          <div className="size-12 rounded-2xl bg-[#25D366] flex items-center justify-center text-white group-hover:opacity-90 transition-opacity shadow-lg shadow-green-500/30">
                              <span className="material-symbols-outlined text-xl">chat</span>
                          </div>
                          <span className="text-xs font-bold text-slate-600 dark:text-slate-300">WhatsApp</span>
                      </button>

                      {/* Download File (NEW) */}
                      <button onClick={handleDownloadFile} className="flex flex-col items-center gap-2 group p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                          <div className="size-12 rounded-2xl bg-orange-500 flex items-center justify-center text-white group-hover:opacity-90 transition-opacity shadow-lg shadow-orange-500/30">
                              <span className="material-symbols-outlined text-xl">save</span>
                          </div>
                          <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Opslaan</span>
                      </button>

                      {/* System Share */}
                      <button onClick={handleSystemShare} className="flex flex-col items-center gap-2 group p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                          <div className="size-12 rounded-2xl bg-blue-500 flex items-center justify-center text-white group-hover:opacity-90 transition-opacity shadow-lg shadow-blue-500/30">
                              <span className="material-symbols-outlined text-xl">ios_share</span>
                          </div>
                          <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Meer...</span>
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Toast Notification */}
      {showCopyToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] animate-slide-down w-[90%] max-w-[320px]">
            <div className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 border border-slate-700 dark:border-slate-200">
                <div className={`size-10 rounded-full flex items-center justify-center shrink-0 ${toastMessage.includes('mislukt') ? 'bg-red-500' : 'bg-green-500'}`}>
                    <span className="material-symbols-outlined text-white text-2xl">{toastMessage.includes('mislukt') ? 'error' : 'check'}</span>
                </div>
                <div className="flex-1">
                    <p className="font-bold text-sm">{toastMessage}</p>
                    <p className="text-xs opacity-80">{toastMessage.includes('mislukt') ? 'Probeer het opnieuw.' : 'Deel het met je vrienden!'}</p>
                </div>
            </div>
        </div>
      )}

      {/* Filter Bar - Hide in Selection Mode to keep UI clean */}
      {!isSelectionMode && (
        <div className="px-4 py-2 grid grid-cols-2 gap-3 z-10">
            {/* Game Filter */}
            <div className="relative" ref={gameFilterRef}>
                <div className={`flex items-center w-full rounded-xl bg-input-light dark:bg-input-dark border transition-all ${showGameDropdown ? 'ring-2 ring-primary/20 border-primary' : 'border-transparent'}`}>
                    <div className="pl-3 text-slate-400">
                        <span className="material-symbols-outlined text-lg">casino</span>
                    </div>
                    <input 
                        type="text"
                        value={gameQuery}
                        onChange={(e) => {
                            setGameQuery(e.target.value);
                            setShowGameDropdown(true);
                            if (!e.target.value) setSelectedGameId(null);
                        }}
                        onFocus={() => setShowGameDropdown(true)}
                        placeholder="Spel..."
                        className="w-full bg-transparent border-none focus:ring-0 text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 h-10 pl-2 pr-8"
                    />
                    {selectedGameId ? (
                        <button onClick={clearGame} className="absolute right-2 text-slate-400 hover:text-slate-600 dark:hover:text-white p-0.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10">
                            <span className="material-symbols-outlined text-sm block">close</span>
                        </button>
                    ) : (
                        <span className="absolute right-2 text-slate-400 material-symbols-outlined text-sm pointer-events-none">expand_more</span>
                    )}
                </div>
                
                {showGameDropdown && (
                    <div className="absolute top-full left-0 w-full mt-1 bg-surface-light dark:bg-surface-dark rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 z-50 max-h-60 overflow-y-auto custom-scrollbar animate-slide-down">
                        {filteredGamesList.length === 0 ? (
                            <div className="p-3 text-center text-xs text-slate-400">Geen spellen</div>
                        ) : (
                            filteredGamesList.map(g => (
                                <button 
                                    key={g.id} 
                                    onClick={() => selectGame(g.id, g.title)}
                                    className="w-full flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
                                >
                                    <div className="w-6 h-6 rounded bg-cover bg-center bg-gray-200 dark:bg-gray-700 shrink-0" style={{backgroundImage: `url("${g.image}")`}}></div>
                                    <span className="text-sm font-medium text-slate-900 dark:text-white truncate">{g.title}</span>
                                </button>
                            ))
                        )}
                    </div>
                )}
            </div>

            {/* Player Filter */}
            <div className="relative" ref={playerFilterRef}>
                <div className={`flex items-center w-full rounded-xl bg-input-light dark:bg-input-dark border transition-all ${showPlayerDropdown ? 'ring-2 ring-primary/20 border-primary' : 'border-transparent'}`}>
                    <div className="pl-3 text-slate-400">
                        <span className="material-symbols-outlined text-lg">person</span>
                    </div>
                    <input 
                        type="text"
                        value={playerQuery}
                        onChange={(e) => {
                            setPlayerQuery(e.target.value);
                            setShowPlayerDropdown(true);
                            if (!e.target.value) setSelectedPlayerId(null);
                        }}
                        onFocus={() => setShowPlayerDropdown(true)}
                        placeholder="Speler..."
                        className="w-full bg-transparent border-none focus:ring-0 text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 h-10 pl-2 pr-8"
                    />
                    {selectedPlayerId ? (
                        <button onClick={clearPlayer} className="absolute right-2 text-slate-400 hover:text-slate-600 dark:hover:text-white p-0.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10">
                            <span className="material-symbols-outlined text-sm block">close</span>
                        </button>
                    ) : (
                        <span className="absolute right-2 text-slate-400 material-symbols-outlined text-sm pointer-events-none">expand_more</span>
                    )}
                </div>

                {showPlayerDropdown && (
                    <div className="absolute top-full left-0 w-full mt-1 bg-surface-light dark:bg-surface-dark rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 z-50 max-h-60 overflow-y-auto custom-scrollbar animate-slide-down">
                        {filteredPlayersList.length === 0 ? (
                            <div className="p-3 text-center text-xs text-slate-400">Geen spelers</div>
                        ) : (
                            filteredPlayersList.map(p => (
                                <button 
                                    key={p.id} 
                                    onClick={() => selectPlayer(p.id, p.name)}
                                    className="w-full flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
                                >
                                    <div className="w-6 h-6 rounded-full bg-cover bg-center bg-gray-200 dark:bg-gray-700 shrink-0" style={{backgroundImage: `url("${p.image}")`}}></div>
                                    <span className="text-sm font-medium text-slate-900 dark:text-white truncate">{p.name}</span>
                                </button>
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
      )}

      {/* Match List */}
      <div className="flex-1 overflow-y-auto p-4 pb-24 space-y-4 pt-2">
        {visibleMatches.length === 0 ? (
          <div className="text-center py-10">
            <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-600 mb-2">filter_list_off</span>
            <p className="text-slate-500 dark:text-slate-400">Geen potjes gevonden met deze filters.</p>
            {(selectedGameId || selectedPlayerId) && !isSelectionMode && (
                <button 
                    onClick={() => {
                        setSelectedGameId(null);
                        setGameQuery('');
                        setSelectedPlayerId(null);
                        setPlayerQuery('');
                    }}
                    className="text-primary font-bold mt-2 inline-block text-sm"
                >
                    Filters wissen
                </button>
            )}
          </div>
        ) : (
          visibleMatches.map((match) => {
            const game = games.find(g => g.id === match.gameId);
            if (!game) return null;

            const sortedResults = [...match.results].sort((a, b) => {
                if (a.isWinner && !b.isWinner) return -1;
                if (!a.isWinner && b.isWinner) return 1;
                const valA = parseScore(a.score);
                const valB = parseScore(b.score);
                return valB - valA;
            });

            const usedExtensions = game.extensions?.filter(ext => match.extensionIds?.includes(ext.id)) || [];
            const isSelected = selectedMatchIds.includes(match.id);

            return (
                <div 
                    key={match.id} 
                    onClick={() => {
                        if (isSelectionMode) toggleMatchSelection(match.id);
                        else navigate(`/match-details/${match.id}`);
                    }}
                    className={`bg-surface-light dark:bg-surface-dark rounded-xl p-4 shadow-sm border transition-transform block relative ${isSelectionMode ? 'pl-12 cursor-pointer' : 'cursor-pointer group/card active:scale-[0.99]'} ${isSelected ? 'border-primary ring-1 ring-primary/20' : 'border-gray-100 dark:border-gray-800'}`}
                >
                    {isSelectionMode && (
                        <div className={`absolute left-0 top-0 bottom-0 w-12 flex items-center justify-center z-10 ${isSelected ? 'opacity-100' : 'opacity-50'}`}>
                            <div className={`size-6 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected ? 'bg-primary border-primary' : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-surface-dark'}`}>
                                {isSelected && <span className="material-symbols-outlined text-white text-sm font-bold">check</span>}
                            </div>
                        </div>
                    )}

                    <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100 dark:border-gray-800">
                        <div className="flex items-center gap-3">
                             <div className="w-10 h-10 rounded-md bg-cover bg-center bg-gray-200 dark:bg-gray-700 shrink-0" style={{backgroundImage: `url("${game.image}")`}}></div>
                             <div className="flex flex-col">
                                 <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-bold text-sm text-slate-900 dark:text-white">{game.title}</span>
                                    {usedExtensions.map(ext => (
                                        <span key={ext.id} className="text-[10px] bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-300 px-1.5 py-0.5 rounded border border-indigo-100 dark:border-indigo-800 font-medium">
                                            + {ext.title}
                                        </span>
                                    ))}
                                 </div>
                                 <div className="flex items-center gap-2 mt-1">
                                    <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">{match.date}</span>
                                    {match.duration && (
                                        <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-[10px] font-bold text-slate-600 dark:text-slate-300">
                                            <span className="material-symbols-outlined text-[10px]">timer</span>
                                            {match.duration}
                                        </div>
                                    )}
                                 </div>
                             </div>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-4 gap-y-4 gap-x-2 text-center">
                    {sortedResults.map(res => {
                        const player = players.find(p => p.id === res.playerId);
                        if (!player) return null;
                        
                        let scoreClass = "text-slate-900 dark:text-white";
                        let scorePrefix = "";
                        if (res.change) {
                            if (res.change > 0) {
                                scoreClass = "text-green-500";
                                scorePrefix = "+";
                            } else if (res.change < 0) {
                                scoreClass = "text-red-500";
                            }
                        } else if (res.isWinner) {
                            scoreClass = "text-green-500";
                        }

                        return (
                            <div 
                                key={res.playerId} 
                                className="flex flex-col gap-1 items-center"
                            >
                                <div className="relative">
                                    <div 
                                      className="w-8 h-8 rounded-full bg-cover bg-center bg-gray-100 dark:bg-gray-800 mb-1 border border-transparent dark:border-gray-700" 
                                      style={{backgroundImage: `url("${player.image}")`}}
                                    ></div>
                                    {res.isStarter && (
                                        <div className="absolute -bottom-1 -right-1 bg-yellow-400 text-black rounded-full p-[2px] border border-surface-light dark:border-surface-dark shadow-sm z-10" title="Startspeler">
                                            <span className="material-symbols-outlined text-[8px] font-bold block">play_arrow</span>
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-center gap-1 max-w-full">
                                    <span className="text-[10px] uppercase text-slate-400 font-semibold truncate transition-colors">{player.name}</span>
                                </div>
                                <span className={`${scoreClass} font-bold font-mono text-sm leading-none`}>
                                    {scorePrefix}{res.score}
                                </span>
                            </div>
                        );
                    })}
                    </div>
                </div>
            );
          })
        )}
      </div>

      {/* FAB (Fixed Bottom Right) */}
      <div className="fixed bottom-6 left-0 w-full z-50 pointer-events-none">
        <div className="max-w-md mx-auto w-full px-6 flex justify-end">
            {isSelectionMode && selectedMatchIds.length > 0 ? (
                <button 
                    onClick={prepareExport}
                    className="pointer-events-auto flex items-center gap-2 bg-primary text-white shadow-lg shadow-primary/40 hover:scale-105 transition-transform active:scale-95 px-6 py-3 rounded-full font-bold"
                >
                    <span className="material-symbols-outlined">ios_share</span>
                    Exporteer {selectedMatchIds.length}
                </button>
            ) : (
                <Link 
                    to="/new-round"
                    className="pointer-events-auto flex items-center justify-center size-14 rounded-full bg-primary text-white shadow-lg shadow-primary/40 hover:scale-105 transition-transform active:scale-95"
                >
                  <span className="material-symbols-outlined text-3xl">add</span>
                </Link>
            )}
        </div>
      </div>

    </div>
  );
};

export default Matches;
