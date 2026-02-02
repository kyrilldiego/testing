
import React, { useState, useRef, useEffect } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { useGames } from '../context/GameContext';
import { Game } from '../types';
import HeaderActions from '../components/HeaderActions';
import NavigationMenu from '../components/NavigationMenu';

const { Link, useNavigate } = ReactRouterDOM as any;

const GamesOverview: React.FC = () => {
  const { games, matches, toggleFavorite, allGroups } = useGames();
  
  // Filters state
  const [filter, setFilter] = useState<'recent' | 'most_played' | 'alphabet' | 'rating'>('recent');
  const [ownershipFilter, setOwnershipFilter] = useState<'all' | 'owned' | 'wishlist'>('all');
  
  // Split filters again: Favorites boolean + Group selection string
  const [showFavorites, setShowFavorites] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [isGroupDropdownOpen, setIsGroupDropdownOpen] = useState(false);

  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Extensions state: 
  // expandedGames: controls which games have their extensions drawer open
  const [expandedGames, setExpandedGames] = useState<number[]>([]);
  // showAllExtensionsMap: controls whether the drawer shows ALL extensions or just Top 3 for a specific game
  const [showAllExtensionsMap, setShowAllExtensionsMap] = useState<Record<number, boolean>>({});

  const navigate = useNavigate();
  const groupDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
          if (groupDropdownRef.current && !groupDropdownRef.current.contains(event.target as Node)) {
              setIsGroupDropdownOpen(false);
          }
      };
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Helper to parse Dutch date strings like "12 Okt 2023" to a timestamp for sorting
  const parseDutchDate = (dateStr: string): number => {
    if (!dateStr) return 0;
    
    const months: { [key: string]: number } = {
      'jan': 0, 'feb': 1, 'mrt': 2, 'maa': 2, 'apr': 3, 'mei': 4, 'jun': 5,
      'jul': 6, 'aug': 7, 'sep': 8, 'okt': 9, 'nov': 10, 'dec': 11
    };

    try {
      const parts = dateStr.toLowerCase().split(' ');
      if (parts.length < 3) return 0;
      
      const day = parseInt(parts[0]);
      // Remove punctuation like dots if present in abbreviations
      const monthStr = parts[1].replace('.', '').substring(0, 3);
      const month = months[monthStr] !== undefined ? months[monthStr] : 0;
      const year = parseInt(parts[2]);
      
      return new Date(year, month, day).getTime();
    } catch (e) {
      return 0;
    }
  };

  const toggleExtension = (e: React.MouseEvent, gameId: number) => {
      e.preventDefault();
      e.stopPropagation();
      setExpandedGames(prev => 
          prev.includes(gameId) ? prev.filter(id => id !== gameId) : [...prev, gameId]
      );
  };

  const toggleShowAllExtensions = (e: React.MouseEvent, gameId: number) => {
      e.preventDefault();
      e.stopPropagation();
      setShowAllExtensionsMap(prev => ({
          ...prev,
          [gameId]: !prev[gameId]
      }));
  };

  // Combine games with dynamic match counts and highest score logic
  const gamesWithStats = games.map(game => {
    const gameMatches = matches.filter(m => m.gameId === game.id);
    
    // Calculate highest score
    let highestScoreDisplay = '-';
    let lastMatchTimestamp = 0;

    if (gameMatches.length > 0) {
      let maxVal = -Infinity;
      
      // Determine highest score
      gameMatches.forEach(m => {
        // Update lastMatchTimestamp if this match is more recent
        const matchTs = parseDutchDate(m.date);
        if (matchTs > lastMatchTimestamp) {
          lastMatchTimestamp = matchTs;
        }

        m.results.forEach(r => {
          // Parse score to number if it's a string (remove currency symbols etc)
          const val = typeof r.score === 'number' 
            ? r.score 
            : parseFloat(r.score.toString().replace(/[^0-9.-]+/g,""));
            
          if (!isNaN(val) && val > maxVal) {
            maxVal = val;
            highestScoreDisplay = r.score.toString();
          }
        });
      });
    }

    return {
      ...game,
      playCount: gameMatches.length,
      highestScore: highestScoreDisplay,
      lastMatchTimestamp: lastMatchTimestamp
    };
  });

  // Filter and sort logic
  const getSortedGames = () => {
    let sorted = [...gamesWithStats];
    
    // 0. Apply Search Filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      sorted = sorted.filter(g => g.title.toLowerCase().includes(query));
    }

    // 1. Apply Favorites Filter (Independent)
    if (showFavorites) {
      sorted = sorted.filter(g => g.isFavorite);
    }

    // 2. Apply Group Filter (Independent)
    if (selectedGroup) {
      sorted = sorted.filter(g => g.groups && g.groups.includes(selectedGroup));
    }

    // 3. Apply Ownership Filter
    if (ownershipFilter === 'owned') {
      sorted = sorted.filter(g => g.ownershipStatus === 'owned');
    } else if (ownershipFilter === 'wishlist') {
      sorted = sorted.filter(g => g.ownershipStatus === 'wishlist');
    }

    // 4. Apply Sorting
    if (filter === 'most_played') {
      sorted.sort((a, b) => b.playCount - a.playCount);
    } else if (filter === 'alphabet') {
      sorted.sort((a, b) => a.title.localeCompare(b.title));
    } else if (filter === 'recent') {
      sorted.sort((a, b) => {
        // Primary sort: Most recent date first
        if (b.lastMatchTimestamp !== a.lastMatchTimestamp) {
          return b.lastMatchTimestamp - a.lastMatchTimestamp;
        }
        // Secondary sort: Alphabetical for items with same date (or no date)
        return a.title.localeCompare(b.title);
      });
    } else if (filter === 'rating') {
        sorted.sort((a, b) => {
            const ratingA = a.rating !== undefined ? a.rating : -1;
            const ratingB = b.rating !== undefined ? b.rating : -1;
            
            // If both rated, higher rating first
            if (ratingA !== -1 && ratingB !== -1) {
                if (ratingA !== ratingB) return ratingB - ratingA;
                return a.title.localeCompare(b.title); // Tie-break
            }
            
            // Rated always before Unrated
            if (ratingA !== -1) return -1;
            if (ratingB !== -1) return 1;
            
            // Both unrated: Alphabetical
            return a.title.localeCompare(b.title);
        });
    }
    
    return sorted;
  };

  const displayGames = getSortedGames();

  return (
    <div className="relative flex h-full min-h-screen w-full flex-col overflow-hidden max-w-md mx-auto shadow-2xl bg-background-light dark:bg-background-dark">
      {/* Header */}
      <header className="flex flex-col gap-2 p-4 pb-2 sticky top-0 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-sm transition-colors z-40">
        <div className="flex items-center h-12 justify-between">
          <NavigationMenu />
          <HeaderActions />
        </div>
        <div className="flex items-center gap-3">
            <h1 className="text-slate-900 dark:text-white tracking-tight text-[32px] font-bold leading-tight">Spellenoverzicht</h1>
            <span className="px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-sm font-bold border border-slate-200 dark:border-slate-700">
                {displayGames.length}
            </span>
        </div>
      </header>
      
      {/* Search */}
      <div className="px-4 py-2 z-10">
        <div className="relative flex w-full items-center rounded-xl bg-input-light dark:bg-input-dark h-12 transition-colors focus-within:ring-2 focus-within:ring-primary/50">
          <div className="absolute left-4 text-slate-400 flex items-center justify-center">
            <span className="material-symbols-outlined text-2xl">search</span>
          </div>
          <input 
            className="w-full h-full bg-transparent border-none focus:ring-0 pl-12 pr-4 text-slate-900 dark:text-white placeholder:text-slate-400 text-base font-normal leading-normal focus:outline-none" 
            placeholder="Zoek spellen..." 
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Ownership Filter Segmented Control */}
      <div className="px-4 py-1">
        <div className="flex bg-surface-light dark:bg-surface-dark p-1 rounded-xl border border-gray-200 dark:border-gray-700">
            <button 
                onClick={() => setOwnershipFilter('all')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${ownershipFilter === 'all' ? 'bg-white dark:bg-gray-600 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
            >
                Alles
            </button>
            <button 
                onClick={() => setOwnershipFilter('owned')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 ${ownershipFilter === 'owned' ? 'bg-white dark:bg-gray-600 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
            >
                <span className={`material-symbols-outlined text-[14px] ${ownershipFilter === 'owned' ? 'text-emerald-500 dark:text-emerald-400' : ''}`}>check_circle</span>
                In bezit
            </button>
            <button 
                onClick={() => setOwnershipFilter('wishlist')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 ${ownershipFilter === 'wishlist' ? 'bg-white dark:bg-gray-600 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
            >
                <span className={`material-symbols-outlined text-[14px] ${ownershipFilter === 'wishlist' ? 'text-purple-500 dark:text-purple-400' : ''}`}>card_giftcard</span>
                Verlanglijst
            </button>
        </div>
      </div>

      {/* Group Dropdown Filter (Single Button) */}
      <div className="px-4 py-1 z-30 relative">
          <div className="relative" ref={groupDropdownRef}>
              <button 
                  onClick={() => setIsGroupDropdownOpen(!isGroupDropdownOpen)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${isGroupDropdownOpen || selectedGroup ? 'bg-surface-light dark:bg-surface-dark border-primary ring-1 ring-primary/20' : 'bg-surface-light dark:bg-surface-dark border-gray-200 dark:border-gray-700 text-slate-500 dark:text-slate-400'}`}
              >
                  <span className={`text-sm font-bold ${selectedGroup ? 'text-primary' : ''}`}>
                      {selectedGroup ? selectedGroup : "Filter op groep..."}
                  </span>
                  <span className={`material-symbols-outlined text-slate-400 transition-transform ${isGroupDropdownOpen ? 'rotate-180' : ''}`}>expand_more</span>
              </button>

              {isGroupDropdownOpen && (
                  <div className="absolute top-full left-0 w-full mt-2 bg-surface-light dark:bg-surface-dark rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 z-50 max-h-56 overflow-y-auto custom-scrollbar animate-slide-down">
                      <button 
                          onClick={() => { setSelectedGroup(null); setIsGroupDropdownOpen(false); }}
                          className={`w-full text-left px-4 py-3 text-sm font-bold border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${selectedGroup === null ? 'text-primary bg-primary/5' : 'text-slate-900 dark:text-white'}`}
                      >
                          Alle Groepen
                      </button>
                      {allGroups.map(group => (
                          <button 
                              key={group}
                              onClick={() => { setSelectedGroup(group); setIsGroupDropdownOpen(false); }}
                              className={`w-full text-left px-4 py-3 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${selectedGroup === group ? 'text-primary bg-primary/5' : 'text-slate-600 dark:text-slate-300'}`}
                          >
                              {group}
                          </button>
                      ))}
                      {allGroups.length === 0 && (
                          <div className="px-4 py-3 text-xs text-slate-400 italic">Geen groepen aangemaakt</div>
                      )}
                  </div>
              )}
          </div>
      </div>
      
      {/* Sort Filter Chips */}
      <div className="px-4 py-1 relative z-10">
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          <button 
            onClick={() => setFilter('recent')}
            className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-all active:scale-95 ${filter === 'recent' ? 'bg-primary text-white shadow-sm' : 'bg-input-light dark:bg-surface-dark border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
          >
            Recent gespeeld
          </button>
          <button 
            onClick={() => setFilter('most_played')}
            className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-all active:scale-95 ${filter === 'most_played' ? 'bg-primary text-white shadow-sm' : 'bg-input-light dark:bg-surface-dark border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
          >
            Meest gespeeld
          </button>
          <button 
            onClick={() => setFilter('rating')}
            className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-all active:scale-95 flex items-center gap-1 ${filter === 'rating' ? 'bg-primary text-white shadow-sm' : 'bg-input-light dark:bg-surface-dark border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
          >
            <span className="material-symbols-outlined text-[16px] fill-current">star</span>
            Waardering
          </button>
          <button 
            onClick={() => setFilter('alphabet')}
            className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-all active:scale-95 ${filter === 'alphabet' ? 'bg-primary text-white shadow-sm' : 'bg-input-light dark:bg-surface-dark border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
          >
            Op alfabet
          </button>
        </div>
      </div>
      
      {/* Games List */}
      <div className="flex-1 overflow-y-auto px-4 pb-24 pt-2 space-y-4">
        <div className="flex items-center justify-between pt-2">
          <button 
            onClick={() => setViewMode(prev => prev === 'list' ? 'grid' : 'list')}
            className="flex items-center gap-1 group hover:opacity-80 transition-opacity"
          >
            <h2 className="text-slate-900 dark:text-white text-lg font-bold">{viewMode === 'list' ? 'Lijst' : 'Rooster'}</h2>
            <span className="material-symbols-outlined text-slate-900 dark:text-white text-xl">
              {viewMode === 'list' ? 'view_list' : 'grid_view'}
            </span>
          </button>

          {/* Favorites Toggle - Restored to Checkbox Style */}
          <button 
            onClick={() => setShowFavorites(!showFavorites)}
            className="flex items-center gap-2 text-sm font-semibold hover:opacity-80 transition-opacity"
          >
            <span className={showFavorites ? "text-primary" : "text-slate-500 dark:text-slate-400"}>Favorieten</span>
            <div className={`size-5 rounded border flex items-center justify-center transition-colors ${showFavorites ? 'bg-primary border-primary' : 'bg-transparent border-slate-300 dark:border-slate-600'}`}>
                {showFavorites && <span className="material-symbols-outlined text-white text-[16px]">check</span>}
            </div>
          </button>
        </div>
        
        {viewMode === 'list' ? (
          // LIST VIEW
          <div className="flex flex-col gap-4">
            {displayGames.map(game => {
              const hasExtensions = game.extensions && game.extensions.length > 0;
              const isExpanded = expandedGames.includes(game.id);
              const showAllExtensions = showAllExtensionsMap[game.id] || false;
              
              // Calculate which extensions to show
              const extensionsToShow = (hasExtensions && isExpanded) 
                  ? (showAllExtensions ? game.extensions : game.extensions?.slice(0, 3)) 
                  : [];

              return (
              <div key={game.id} className="flex flex-col">
                <Link to={`/game-details/${game.id}`} className="group relative flex flex-col gap-0 rounded-xl bg-surface-light dark:bg-surface-dark shadow-sm hover:shadow-md transition-all active:scale-[0.98] cursor-pointer overflow-hidden border border-slate-100 dark:border-transparent z-10">
                  <div className="flex items-stretch p-4 gap-4">
                    <div className="flex flex-col justify-between gap-2 flex-[2_2_0px]">
                      <div>
                        <div className="flex justify-between items-start">
                          <p className="text-slate-900 dark:text-white text-lg font-bold leading-tight line-clamp-1">{game.title}</p>
                          <span className="material-symbols-outlined text-slate-300 dark:text-slate-600 text-sm group-hover:text-primary transition-colors ml-2">arrow_forward_ios</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {game.rating !== undefined && (
                              <div className="flex items-center gap-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded text-[10px] font-bold border border-amber-200 dark:border-amber-800">
                                  <span className="material-symbols-outlined text-[12px] fill-current">star</span>
                                  <span>{game.rating.toFixed(1)}</span>
                              </div>
                          )}
                          <p className="text-slate-500 dark:text-slate-400 text-xs font-medium uppercase tracking-wide truncate">
                            {game.playCount > 0 && (
                              <>Beste score: {game.highestScore} • </>
                            )}
                            <span className={`${filter === 'most_played' ? 'text-primary font-bold' : ''}`}>
                              {game.playCount}x gespeeld
                            </span>
                          </p>
                        </div>
                        
                        {/* Tags Preview in List */}
                        {game.groups && game.groups.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                                {game.groups.slice(0, 3).map(g => (
                                    <span key={g} className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold border border-slate-200 dark:border-slate-700">
                                        {g}
                                    </span>
                                ))}
                                {game.groups.length > 3 && <span className="text-[9px] text-slate-400">+{game.groups.length - 3}</span>}
                            </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        {game.type === 'score' && (
                          <div className="flex -space-x-2">
                            <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-[10px] text-white font-bold border-2 border-surface-light dark:border-surface-dark z-10">{game.winner.name.charAt(0)}</div>
                            <div className="w-6 h-6 rounded-full bg-slate-300 dark:bg-slate-700 border-2 border-surface-light dark:border-surface-dark"></div>
                            <div className="w-6 h-6 rounded-full bg-slate-300 dark:bg-slate-700 border-2 border-surface-light dark:border-surface-dark"></div>
                          </div>
                        )}
                        {game.type === 'team' && (
                          <span className="material-symbols-outlined text-primary text-base">diversity_3</span>
                        )}
                        {game.type === 'money' && (
                          <div className="flex -space-x-2">
                            <div className="w-6 h-6 rounded-full bg-green-600 flex items-center justify-center text-[10px] text-white font-bold border-2 border-surface-light dark:border-surface-dark z-10">{game.winner.name.charAt(0)}</div>
                            <div className="w-6 h-6 rounded-full bg-slate-300 dark:bg-slate-700 border-2 border-surface-light dark:border-surface-dark"></div>
                            <div className="w-6 h-6 rounded-full bg-slate-300 dark:bg-slate-700 border-2 border-surface-light dark:border-surface-dark"></div>
                          </div>
                        )}
                        
                        <p className="text-slate-600 dark:text-slate-300 text-sm truncate">
                          <span className="text-primary font-bold">{game.winner.name}</span> won {game.winner.score}
                        </p>
                      </div>
                    </div>
                    <div className="relative w-24 h-24 sm:w-28 sm:h-auto bg-center bg-no-repeat bg-cover rounded-lg flex-shrink-0" style={{backgroundImage: `url("${game.image}")`}}>
                        {/* Extension Toggle */}
                        {hasExtensions && (
                            <button 
                                onClick={(e) => toggleExtension(e, game.id)}
                                className={`absolute bottom-1 right-1 p-1.5 rounded-full backdrop-blur-sm transition-colors ${isExpanded ? 'bg-primary text-white' : 'bg-black/40 hover:bg-black/60 text-white'}`}
                            >
                                <span className={`material-symbols-outlined text-[18px] transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>expand_more</span>
                            </button>
                        )}

                        <button 
                          onClick={(e) => {
                            e.preventDefault();
                            toggleFavorite(game.id);
                          }}
                          className="absolute top-1 right-1 p-1.5 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-sm text-white transition-colors"
                        >
                          <span className={`material-symbols-outlined text-[18px] ${game.isFavorite ? 'fill-current text-red-500' : 'text-white'}`}>
                            favorite
                          </span>
                        </button>
                    </div>
                  </div>
                </Link>
                
                {/* Extensions List */}
                {hasExtensions && isExpanded && (
                    <div className="pl-6 pr-2 py-2 -mt-2 animate-slide-down">
                        <div className="border-l-2 border-dashed border-gray-300 dark:border-gray-700 pl-4 space-y-2 pt-2 pb-1">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Uitbreidingen</p>
                            {extensionsToShow?.map(ext => (
                                <div key={ext.id} className="flex items-center gap-3 p-2 bg-surface-light dark:bg-surface-dark rounded-lg border border-slate-100 dark:border-gray-800 shadow-sm">
                                    {ext.image ? (
                                        <div className="w-8 h-8 rounded bg-cover bg-center bg-gray-200 dark:bg-gray-700" style={{backgroundImage: `url("${ext.image}")`}}></div>
                                    ) : (
                                        <div className="w-8 h-8 rounded bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-slate-400">
                                            <span className="material-symbols-outlined text-sm">extension</span>
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{ext.title}</span>
                                            {ext.rating !== undefined && (
                                                <div className="flex items-center gap-0.5 text-[10px] font-bold text-amber-500 bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded ml-2">
                                                    <span className="material-symbols-outlined text-[10px] fill-current">star</span>
                                                    {ext.rating.toFixed(1)}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                            
                            {/* Toggle Show All within Drawer */}
                            {game.extensions && game.extensions.length > 3 && (
                                <div className="text-center pt-1">
                                    <button 
                                        onClick={(e) => toggleShowAllExtensions(e, game.id)}
                                        className="text-xs font-bold text-primary hover:underline flex items-center justify-center gap-1 w-full"
                                    >
                                        {showAllExtensions 
                                            ? 'Toon minder' 
                                            : `...en nog ${game.extensions.length - 3} andere`
                                        }
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}
              </div>
            )})}
          </div>
        ) : (
          // GRID VIEW (3 Columns)
          <div className="grid grid-cols-3 gap-3">
             {displayGames.map(game => (
               <Link key={game.id} to={`/game-details/${game.id}`} className="relative aspect-square rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-surface-light dark:bg-surface-dark active:scale-95 transition-transform group">
                 <div className="absolute inset-0 bg-cover bg-center transition-transform group-hover:scale-110" style={{backgroundImage: `url("${game.image}")`}}></div>
                 <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent"></div>
                 
                 {/* Favorite Button for Grid */}
                 <button 
                    onClick={(e) => {
                      e.preventDefault();
                      toggleFavorite(game.id);
                    }}
                    className="absolute top-1 right-1 p-1.5 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-sm text-white transition-colors z-10"
                  >
                    <span className={`material-symbols-outlined text-[16px] ${game.isFavorite ? 'fill-current text-red-500' : 'text-white'}`}>
                      favorite
                    </span>
                  </button>

                 {/* Rating Badge Grid */}
                 {game.rating !== undefined && (
                     <div className="absolute top-1 left-1 bg-black/50 backdrop-blur-md px-1.5 py-0.5 rounded text-[10px] font-bold text-amber-400 flex items-center gap-0.5 z-10">
                         <span className="material-symbols-outlined text-[10px] fill-current">star</span>
                         {game.rating.toFixed(1)}
                     </div>
                 )}

                 <div className="absolute bottom-0 left-0 w-full p-2 text-center">
                   <p className="text-white text-xs font-bold truncate leading-tight">{game.title}</p>
                 </div>
               </Link>
             ))}
          </div>
        )}
        
        {displayGames.length === 0 && (
           <div className="text-center py-10">
             <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-600 mb-2">sentiment_dissatisfied</span>
             <p className="text-slate-500 dark:text-slate-400">Geen spellen gevonden.</p>
           </div>
        )}

        <div className="h-16"></div>
      </div>
      
      {/* Floating Action Button (Fixed Bottom Right) */}
      <div className="fixed bottom-6 left-0 w-full z-50 pointer-events-none">
        <div className="max-w-md mx-auto w-full px-6 flex justify-end">
            <Link 
                to="/add-game" 
                className="pointer-events-auto flex items-center justify-center size-14 rounded-full bg-primary text-white shadow-lg shadow-primary/40 hover:scale-105 transition-transform active:scale-95"
            >
                <span className="material-symbols-outlined text-3xl">add</span>
            </Link>
        </div>
      </div>
      
      <div className="absolute bottom-0 left-0 w-full h-12 bg-gradient-to-t from-background-light dark:from-background-dark to-transparent pointer-events-none"></div>
    </div>
  );
};

export default GamesOverview;
