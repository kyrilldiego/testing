
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { useGames } from '../context/GameContext';
import { Player, Game } from '../types';
import HeaderActions from '../components/HeaderActions';
import NavigationMenu from '../components/NavigationMenu';

const { Link, useNavigate } = ReactRouterDOM as any;

const Statistics: React.FC = () => {
  const { matches, games, players } = useGames();
  const [timeFilter, setTimeFilter] = useState<'all' | 'year' | 'month'>('year');
  const [viewDate, setViewDate] = useState(new Date()); // State for the currently viewed period
  const [showLibraryBreakdown, setShowLibraryBreakdown] = useState(false);
  
  // Show All States
  const [showAllWinners, setShowAllWinners] = useState(false);
  const [showAllGames, setShowAllGames] = useState(false);

  const navigate = useNavigate();
  
  // Scroll Refs & State
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollTrackRef = useRef<HTMLDivElement>(null);
  const [scrollThumb, setScrollThumb] = useState({ left: 0, width: 0 });
  const [isDragging, setIsDragging] = useState(false);

  // Navigate Time Logic
  const shiftTime = (direction: 'prev' | 'next') => {
      const newDate = new Date(viewDate);
      const modifier = direction === 'next' ? 1 : -1;

      if (timeFilter === 'year') {
          newDate.setFullYear(newDate.getFullYear() + modifier);
      } else if (timeFilter === 'month') {
          newDate.setMonth(newDate.getMonth() + modifier);
      }
      // For 'all', we don't navigate
      setViewDate(newDate);
  };

  // Helper: Parse Dutch Date "12 Okt 2023"
  const parseDutchDate = (dateStr: string): Date => {
    const months: { [key: string]: number } = {
      'jan': 0, 'feb': 1, 'mrt': 2, 'maa': 2, 'apr': 3, 'mei': 4, 'jun': 5,
      'jul': 6, 'aug': 7, 'sep': 8, 'okt': 9, 'nov': 10, 'dec': 11
    };
    try {
      const parts = dateStr.toLowerCase().split(' ');
      if (parts.length < 3) return new Date();
      
      const day = parseInt(parts[0]);
      const monthStr = parts[1].replace('.', '').substring(0, 3);
      const month = months[monthStr] !== undefined ? months[monthStr] : 0;
      const year = parseInt(parts[2]);
      
      return new Date(year, month, day);
    } catch (e) {
      return new Date();
    }
  };

  // Helper to parse scores safely
  const parseScore = (score: string | number): number => {
      if (typeof score === 'number') return score;
      const parsed = parseFloat(score.toString().replace(/[^0-9.-]+/g,""));
      return isNaN(parsed) ? 0 : parsed;
  };

  // Main Calculation Logic
  const stats = useMemo(() => {
    const activeYear = viewDate.getFullYear();
    const activeMonth = viewDate.getMonth();
    
    // Check if the viewed period is the actual current period (for highlighting "today")
    const now = new Date();
    const isCurrentPeriod = timeFilter === 'year' 
        ? activeYear === now.getFullYear()
        : timeFilter === 'month' 
            ? activeYear === now.getFullYear() && activeMonth === now.getMonth()
            : true;

    // 1. Filter Matches based on Time Selection AND View Date
    const filteredMatches = matches.filter(m => {
        const date = parseDutchDate(m.date);
        if (timeFilter === 'year') {
            return date.getFullYear() === activeYear;
        }
        if (timeFilter === 'month') {
            return date.getFullYear() === activeYear && date.getMonth() === activeMonth;
        }
        return true;
    });

    // 2. Global Metrics
    const totalMatches = filteredMatches.length;
    
    // Playtime Calculation
    let totalSeconds = 0;
    filteredMatches.forEach(m => {
        if (m.duration) {
            const parts = m.duration.split(':').map(Number);
            if (parts.length === 3) {
                totalSeconds += (parts[0] * 3600) + (parts[1] * 60) + parts[2];
            }
        }
    });

    const hours = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const playTimeStr = `${hours}u${mins > 0 ? ` ${mins}m` : ''}`;

    // NEW: Unique Games Played
    const uniqueGameIdsPlayed = new Set(filteredMatches.map(m => m.gameId));
    const uniqueGamesPlayedCount = uniqueGameIdsPlayed.size;
    const totalLibraryCount = games.length;
    const libraryUtilization = totalLibraryCount > 0 ? Math.round((uniqueGamesPlayedCount / totalLibraryCount) * 100) : 0;

    // NEW: Unique Extensions Played
    const uniqueExtensionIdsPlayed = new Set<string>();
    filteredMatches.forEach(m => {
        if (m.extensionIds && m.extensionIds.length > 0) {
            m.extensionIds.forEach(id => uniqueExtensionIdsPlayed.add(id));
        }
    });
    const uniqueExtensionsPlayedCount = uniqueExtensionIdsPlayed.size;
    const totalExtensionsCount = games.reduce((acc, g) => acc + (g.extensions?.length || 0), 0);
    const extensionUtilization = totalExtensionsCount > 0 ? Math.round((uniqueExtensionsPlayedCount / totalExtensionsCount) * 100) : 0;

    // NEW: Ownership Stats
    const ownershipStats = { owned: 0, wishlist: 0, none: 0 };
    games.forEach(g => {
        if (g.ownershipStatus === 'owned') ownershipStats.owned++;
        else if (g.ownershipStatus === 'wishlist') ownershipStats.wishlist++;
        else ownershipStats.none++;
    });

    // 3. Top Winners
    const playerWins: {[key: string]: number} = {};
    filteredMatches.forEach(m => {
      m.results.forEach(r => {
        if (r.isWinner) {
          playerWins[r.playerId] = (playerWins[r.playerId] || 0) + 1;
        }
      });
    });

    const sortedWinners = Object.entries(playerWins).sort(([, a], [, b]) => b - a);
    const topWinners = [];
    let currentRank = 1;
    
    // Process all winners (limit in render)
    for (let i = 0; i < sortedWinners.length; i++) {
        const [pid, wins] = sortedWinners[i];
        if (i > 0 && wins < sortedWinners[i-1][1]) {
            currentRank = i + 1;
        }
        const player = players.find(p => p.id === pid);
        topWinners.push({ player, wins, rank: currentRank });
    }

    // 4. Game Breakdown (Updated with Top Score Logic)
    const gameStatsMap: Record<number, { 
        count: number, 
        winsPerPlayer: Record<string, number>, 
        playedPerPlayer: Record<string, number>,
        bestScore: number | null,
        bestScorePlayerIds: Set<string>
    }> = {};

    filteredMatches.forEach(m => {
        const game = games.find(g => g.id === m.gameId);
        if (!game) return;

        if (!gameStatsMap[m.gameId]) {
            gameStatsMap[m.gameId] = { 
                count: 0, 
                winsPerPlayer: {}, 
                playedPerPlayer: {},
                bestScore: null,
                bestScorePlayerIds: new Set()
            };
        }
        
        const stat = gameStatsMap[m.gameId];
        stat.count++;
        
        const isLowestWins = game.winningCondition === 'lowest';

        m.results.forEach(r => {
            stat.playedPerPlayer[r.playerId] = (stat.playedPerPlayer[r.playerId] || 0) + 1;
            if (r.isWinner) {
                stat.winsPerPlayer[r.playerId] = (stat.winsPerPlayer[r.playerId] || 0) + 1;
            }

            // Top Score Logic
            const val = parseScore(r.score);
            if (!isNaN(val)) {
                if (stat.bestScore === null) {
                    stat.bestScore = val;
                    stat.bestScorePlayerIds.add(r.playerId);
                } else {
                    if ((isLowestWins && val < stat.bestScore) || (!isLowestWins && val > stat.bestScore)) {
                        // New record
                        stat.bestScore = val;
                        stat.bestScorePlayerIds.clear();
                        stat.bestScorePlayerIds.add(r.playerId);
                    } else if (val === stat.bestScore) {
                        // Tie record
                        stat.bestScorePlayerIds.add(r.playerId);
                    }
                }
            }
        });
    });

    const gameBreakdown = Object.entries(gameStatsMap).map(([gameIdStr, data]) => {
        const gameId = parseInt(gameIdStr);
        const game = games.find(g => g.id === gameId);
        
        // Calculate Champion (Most Wins)
        let maxWins = 0;
        Object.values(data.winsPerPlayer).forEach(w => {
            if (w > maxWins) maxWins = w;
        });

        let potentialChampions = Object.keys(data.winsPerPlayer).filter(pid => data.winsPerPlayer[pid] === maxWins);
        if (potentialChampions.length > 1) {
            let maxWinRate = 0;
            const rates = potentialChampions.map(pid => {
                const wins = data.winsPerPlayer[pid];
                const played = data.playedPerPlayer[pid] || 0;
                const rate = played > 0 ? wins / played : 0;
                if (rate > maxWinRate) maxWinRate = rate;
                return { pid, rate };
            });
            potentialChampions = rates
                .filter(item => Math.abs(item.rate - maxWinRate) < 0.0001)
                .map(item => item.pid);
        }

        const champions = potentialChampions
            .map(pid => players.find(p => p.id === pid))
            .filter((p): p is Player => !!p)
            .sort((a, b) => a.name.localeCompare(b.name));
        
        // Calculate Top Score Holders
        const topScoreHolders = Array.from(data.bestScorePlayerIds)
            .map(pid => players.find(p => p.id === pid))
            .filter((p): p is Player => !!p)
            .sort((a, b) => a.name.localeCompare(b.name));

        return { 
            game, 
            count: data.count, 
            champions,
            maxWins,
            topScore: data.bestScore,
            topScoreHolders
        };
    }).sort((a, b) => b.count - a.count);


    // 5. Activity Graph Data (Updated for View Date & Labels)
    let activityData: { label: string, periodName: string, count: number, highlight?: boolean }[] = [];
    let maxActivity = 0;
    let monthGrowthStr = '';

    if (timeFilter === 'all') {
        const counts: Record<number, number> = {};
        matches.forEach(m => {
            const y = parseDutchDate(m.date).getFullYear();
            counts[y] = (counts[y] || 0) + 1;
        });
        
        const years = Object.keys(counts).map(Number).sort();
        const startYear = years.length > 0 ? Math.min(...years) : now.getFullYear() - 2;
        const endYear = now.getFullYear();
        const displayStartYear = Math.min(startYear, endYear - 2);

        for (let y = displayStartYear; y <= endYear; y++) {
            activityData.push({ 
                label: y.toString(), 
                periodName: `Jaar ${y}`,
                count: counts[y] || 0, 
                highlight: y === now.getFullYear() 
            });
        }
        maxActivity = Math.max(...activityData.map(d => d.count)) || 1;

    } else if (timeFilter === 'year') {
        // Year View: Months 1-12 of the ACTIVE view year
        const countsThisYear = new Array(12).fill(0);
        const monthNamesShort = ['Jan', 'Feb', 'Mrt', 'Apr', 'Mei', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'];
        const monthNamesLong = ['Januari', 'Februari', 'Maart', 'April', 'Mei', 'Juni', 'Juli', 'Augustus', 'September', 'Oktober', 'November', 'December'];

        matches.forEach(m => {
            const date = parseDutchDate(m.date);
            const mYear = date.getFullYear();
            const mMonth = date.getMonth();

            if (mYear === activeYear) {
                countsThisYear[mMonth]++;
            }
        });

        for(let i=0; i<12; i++) {
            activityData.push({
                label: monthNamesShort[i],
                periodName: monthNamesLong[i],
                count: countsThisYear[i],
                highlight: isCurrentPeriod && i === now.getMonth()
            });
        }

        maxActivity = Math.max(...countsThisYear) || 1;

    } else if (timeFilter === 'month') {
        // Month View: Days of the ACTIVE view month
        const counts: Record<number, number> = {};
        filteredMatches.forEach(m => {
            const d = parseDutchDate(m.date).getDate();
            counts[d] = (counts[d] || 0) + 1;
        });
        
        const daysInMonth = new Date(activeYear, activeMonth + 1, 0).getDate();
        
        for (let i = 1; i <= daysInMonth; i++) {
            activityData.push({ 
                label: i.toString(),
                periodName: `Dag ${i}`,
                count: counts[i] || 0,
                highlight: isCurrentPeriod && i === now.getDate()
            });
        }
        maxActivity = Math.max(...activityData.map(d => d.count)) || 1;

        // Growth vs Previous Month
        const countThisMonth = filteredMatches.length;
        let pMonth = activeMonth - 1;
        let pYear = activeYear;
        if (pMonth < 0) {
            pMonth = 11;
            pYear = activeYear - 1;
        }

        const countPrevMonth = matches.filter(m => {
             const d = parseDutchDate(m.date);
             return d.getMonth() === pMonth && d.getFullYear() === pYear;
        }).length;

        if (countPrevMonth === 0) {
            monthGrowthStr = countThisMonth > 0 ? `+${countThisMonth} t.o.v. vorige maand` : 'Stabiel t.o.v. vorige maand';
        } else {
            const diff = countThisMonth - countPrevMonth;
            const pct = Math.round((diff / countPrevMonth) * 100);
            const sign = diff >= 0 ? '+' : '';
            monthGrowthStr = `${sign}${pct}% t.o.v. vorige maand`;
        }
    }

    // 6. Location Statistics
    const locationCounts: Record<string, number> = {};
    filteredMatches.forEach(m => {
        if (m.location && m.location.trim() !== '') {
            locationCounts[m.location] = (locationCounts[m.location] || 0) + 1;
        }
    });

    const totalLocations = Object.values(locationCounts).reduce((a, b) => a + b, 0);
    const locationSegments = Object.entries(locationCounts)
        .sort((a, b) => b[1] - a[1]) // Sort by count desc
        .map(([loc, count], index) => {
            const pct = (count / totalLocations) * 100;
            const palette = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#64748b'];
            return {
                label: loc,
                count,
                pct,
                color: palette[index % palette.length]
            };
        });

    let currentPct = 0;
    const gradientParts = locationSegments.map(seg => {
        const start = currentPct;
        const end = currentPct + seg.pct;
        currentPct += seg.pct;
        return `${seg.color} ${start}% ${end}%`;
    });
    const locationGradient = gradientParts.length > 0 ? `conic-gradient(${gradientParts.join(', ')})` : 'none';


    return {
        filteredMatches, 
        totalMatches,
        playTimeStr,
        topWinners,
        gameBreakdown,
        activityData,
        maxActivity,
        monthGrowthStr,
        uniqueGamesPlayedCount,
        totalLibraryCount,
        libraryUtilization,
        uniqueExtensionsPlayedCount,
        totalExtensionsCount,
        extensionUtilization,
        ownershipStats,
        locationSegments,
        locationGradient,
        totalLocations,
        activeYear,
        activeMonth
    };
  }, [matches, games, players, timeFilter, viewDate]);

  // Dynamic Title for Activity
  const activityTitle = useMemo(() => {
      if (timeFilter === 'month') return 'Activiteit per dag';
      if (timeFilter === 'year') return 'Activiteit per maand';
      return 'Activiteit per jaar';
  }, [timeFilter]);

  // Scrollbar Logic
  const updateScrollState = useCallback(() => {
    // Only update visual thumb if not dragging (handled by drag event)
    // or if we want to sync with regular scroll
    if (isDragging) return;

    if (scrollContainerRef.current) {
        const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
        const widthPercentage = (clientWidth / scrollWidth) * 100;
        const leftPercentage = (scrollLeft / scrollWidth) * 100;
        setScrollThumb({ left: leftPercentage, width: widthPercentage });
    }
  }, [isDragging]);

  useEffect(() => {
      updateScrollState();
      window.addEventListener('resize', updateScrollState);
      return () => window.removeEventListener('resize', updateScrollState);
  }, [updateScrollState, stats.activityData]);

  const handleThumbMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault(); 
    e.stopPropagation();
    
    // Capture initial state
    const startX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const startScrollLeft = scrollContainerRef.current?.scrollLeft || 0;
    
    if (scrollContainerRef.current) {
        // Disable smooth scroll for direct 1:1 control
        scrollContainerRef.current.style.scrollBehavior = 'auto';
    }
    
    setIsDragging(true);

    const handleMove = (moveEvent: MouseEvent | TouchEvent) => {
        if (!scrollContainerRef.current || !scrollTrackRef.current) return;
        
        moveEvent.preventDefault(); // Prevent text selection/drag scrolling
        
        const currentX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX;
        const deltaX = currentX - startX;
        
        const { scrollWidth, clientWidth } = scrollContainerRef.current;
        const trackWidth = scrollTrackRef.current.clientWidth;
        
        // Calculate dimensions
        const thumbWidthPx = (clientWidth / scrollWidth) * trackWidth;
        const availableTrack = trackWidth - thumbWidthPx;
        const maxScroll = scrollWidth - clientWidth;
        
        if (availableTrack <= 0) return;
        
        // Calculate new scroll position
        // Ratio: 1px of thumb movement = X pixels of scroll movement
        // X = maxScroll / availableTrack
        const scrollDelta = (deltaX / availableTrack) * maxScroll;
        
        // Apply scroll immediately
        const newScroll = Math.max(0, Math.min(startScrollLeft + scrollDelta, maxScroll));
        scrollContainerRef.current.scrollLeft = newScroll;
        
        // Manually update thumb visual for instant feedback
        const newLeftPct = (newScroll / scrollWidth) * 100;
        setScrollThumb(prev => ({ ...prev, left: newLeftPct }));
    };

    const handleUp = () => {
        setIsDragging(false);
        if (scrollContainerRef.current) {
            scrollContainerRef.current.style.scrollBehavior = 'smooth';
        }
        window.removeEventListener('mousemove', handleMove);
        window.removeEventListener('touchmove', handleMove);
        window.removeEventListener('mouseup', handleUp);
        window.removeEventListener('touchend', handleUp);
    };

    // Attach to window to handle drag outside the bar
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('touchmove', handleMove, { passive: false });
    window.addEventListener('mouseup', handleUp);
    window.addEventListener('touchend', handleUp);
  };

  const handleTrackClick = (e: React.MouseEvent) => {
      if (scrollContainerRef.current && scrollTrackRef.current) {
          const trackRect = scrollTrackRef.current.getBoundingClientRect();
          const clickX = e.clientX - trackRect.left;
          const clickRatio = clickX / trackRect.width;
          const { scrollWidth, clientWidth } = scrollContainerRef.current;
          const targetScrollLeft = (clickRatio * scrollWidth) - (clientWidth / 2);
          scrollContainerRef.current.scrollTo({ left: targetScrollLeft, behavior: 'smooth' });
      }
  };

  const formatViewLabel = () => {
      if (timeFilter === 'year') {
          return stats.activeYear.toString();
      }
      if (timeFilter === 'month') {
          const d = new Date(stats.activeYear, stats.activeMonth, 1);
          return d.toLocaleString('nl-NL', { month: 'long', year: 'numeric' });
      }
      return 'Alles';
  };

  useEffect(() => {
    // Only auto-scroll on mount or filter change, not every navigation click
    if (scrollContainerRef.current) {
        requestAnimationFrame(() => updateScrollState());
    }
  }, [timeFilter, stats.activityData, updateScrollState]);

  const getPieChartStyle = () => {
      const { owned, wishlist, none } = stats.ownershipStats;
      const total = owned + wishlist + none;
      if (total === 0) return { background: '#e2e8f0' };
      const ownedPct = (owned / total) * 100;
      const wishlistPct = (wishlist / total) * 100;
      return {
          background: `conic-gradient(#10b981 0% ${ownedPct}%, #a855f7 ${ownedPct}% ${ownedPct + wishlistPct}%, #cbd5e1 ${ownedPct + wishlistPct}% 100%)`
      };
  };

  const isYearView = timeFilter === 'year';

  const displayedWinners = showAllWinners ? stats.topWinners : stats.topWinners.slice(0, 3);
  const displayedGames = showAllGames ? stats.gameBreakdown : stats.gameBreakdown.slice(0, 3);

  return (
    <div className="relative flex min-h-screen w-full flex-col max-w-md mx-auto shadow-2xl overflow-hidden bg-background-light dark:bg-background-dark text-slate-900 dark:text-white">
      <div className="sticky top-0 flex items-center bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-md p-4 pb-2 justify-between border-b border-gray-200 dark:border-gray-800 transition-colors z-20">
        <NavigationMenu />
        <h2 className="text-gray-900 dark:text-white text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center">Statistieken</h2>
        <HeaderActions />
      </div>

      <div className="flex-1 overflow-y-auto pb-24 space-y-6 pt-4">
        {/* Time Filter */}
        <div className="px-4 space-y-3">
            <div className="flex bg-surface-light dark:bg-surface-dark p-1 rounded-xl border border-gray-200 dark:border-gray-700">
                <button onClick={() => setTimeFilter('month')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${timeFilter === 'month' ? 'bg-primary text-white shadow-sm' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}>Maand</button>
                <button onClick={() => setTimeFilter('year')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${timeFilter === 'year' ? 'bg-primary text-white shadow-sm' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}>Jaar</button>
                <button onClick={() => setTimeFilter('all')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${timeFilter === 'all' ? 'bg-primary text-white shadow-sm' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}>Alles</button>
            </div>

            {/* Date Navigator (Only for Year/Month) */}
            {timeFilter !== 'all' && (
                <div className="flex items-center justify-between bg-surface-light dark:bg-surface-dark p-2 rounded-xl border border-gray-200 dark:border-gray-700">
                    <button onClick={() => shiftTime('prev')} className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-slate-500 dark:text-slate-400 transition-colors">
                        <span className="material-symbols-outlined">chevron_left</span>
                    </button>
                    <span className="font-bold text-slate-900 dark:text-white text-sm capitalize">{formatViewLabel()}</span>
                    <button onClick={() => shiftTime('next')} className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-slate-500 dark:text-slate-400 transition-colors">
                        <span className="material-symbols-outlined">chevron_right</span>
                    </button>
                </div>
            )}
        </div>

        {/* LIBRARY STATS */}
        <div className="px-4 grid grid-cols-2 gap-4">
            {/* 1. Games & Extensions Played */}
            <div onClick={() => setShowLibraryBreakdown(true)} className="col-span-2 bg-surface-light dark:bg-surface-dark p-4 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm cursor-pointer hover:border-primary/50 transition-colors group relative">
                <div className="flex justify-between items-start mb-3">
                    <span className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wide">Activiteiten</span>
                    <span className="text-[10px] bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full text-slate-500 dark:text-slate-300 font-bold group-hover:bg-primary group-hover:text-white transition-colors">
                        {timeFilter === 'year' ? stats.activeYear : timeFilter === 'month' ? new Date(stats.activeYear, stats.activeMonth).toLocaleString('nl-NL', {month:'short'}) : 'Totaal'}
                    </span>
                </div>
                
                {/* Games Metric */}
                <div className="mb-4">
                    <div className="flex items-end gap-2 mb-1">
                        <span className="text-3xl font-black text-slate-900 dark:text-white group-hover:text-primary transition-colors leading-none">{stats.uniqueGamesPlayedCount}</span>
                        <span className="text-sm font-bold text-slate-600 dark:text-slate-300 mb-0.5">Spellen</span>
                        <span className="text-xs font-medium text-slate-400 mb-0.5 ml-auto">{stats.libraryUtilization}% van totaal</span>
                    </div>
                    <div className="h-1.5 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full transition-all duration-500 ease-out" style={{ width: `${stats.libraryUtilization}%` }}></div>
                    </div>
                </div>

                {/* Extensions Metric */}
                <div className="pt-3 border-t border-dashed border-gray-100 dark:border-gray-700">
                    <div className="flex items-end gap-2 mb-1">
                        <span className="text-2xl font-black text-slate-700 dark:text-slate-200 leading-none">{stats.uniqueExtensionsPlayedCount}</span>
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-0.5">Uitbreidingen</span>
                        <span className="text-[10px] font-medium text-slate-400 mb-0.5 ml-auto">{stats.extensionUtilization}% van totaal</span>
                    </div>
                    <div className="h-1.5 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-400 rounded-full transition-all duration-500 ease-out" style={{ width: `${stats.extensionUtilization}%` }}></div>
                    </div>
                </div>
            </div>

            {/* 2. Collection Ownership */}
            <div className="col-span-2 bg-surface-light dark:bg-surface-dark p-4 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex items-center gap-6">
                <div className="relative size-24 shrink-0">
                    <div className="size-full rounded-full" style={getPieChartStyle()}></div>
                    <div className="absolute inset-4 bg-surface-light dark:bg-surface-dark rounded-full flex items-center justify-center shadow-inner">
                        <span className="text-xs font-bold text-slate-400 uppercase">Status</span>
                    </div>
                </div>
                <div className="flex-1 flex flex-col gap-2">
                    <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5"><div className="size-2 rounded-full bg-emerald-500"></div><span className="text-slate-600 dark:text-slate-300">In bezit</span></div>
                        <span className="font-bold text-slate-900 dark:text-white">{stats.ownershipStats.owned}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5"><div className="size-2 rounded-full bg-purple-500"></div><span className="text-slate-600 dark:text-slate-300">Verlanglijst</span></div>
                        <span className="font-bold text-slate-900 dark:text-white">{stats.ownershipStats.wishlist}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5"><div className="size-2 rounded-full bg-slate-300 dark:bg-slate-500"></div><span className="text-slate-600 dark:text-slate-300">Geen status</span></div>
                        <span className="font-bold text-slate-900 dark:text-white">{stats.ownershipStats.none}</span>
                    </div>
                </div>
            </div>
        </div>

        {/* Big Counters */}
        <div className="px-4 grid grid-cols-2 gap-4">
            <div className="bg-surface-light dark:bg-surface-dark p-4 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
                <span className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wide block mb-1">Totaal Potjes</span>
                <span className="text-3xl font-black text-slate-900 dark:text-white">{stats.totalMatches}</span>
                {timeFilter === 'month' && stats.monthGrowthStr && (
                    <span className={`block text-[10px] font-bold mt-1 ${stats.monthGrowthStr.includes('+') ? 'text-green-500' : stats.monthGrowthStr.includes('-') ? 'text-red-500' : 'text-slate-400'}`}>
                        {stats.monthGrowthStr}
                    </span>
                )}
            </div>
            <div className="bg-surface-light dark:bg-surface-dark p-4 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
                <span className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wide block mb-1">Speeltijd</span>
                <span className="text-3xl font-black text-slate-900 dark:text-white">{stats.playTimeStr}</span>
            </div>
        </div>

        {/* Location Breakdown */}
        {stats.locationSegments.length > 0 && (
            <div className="px-4">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-3">Locaties</h3>
                <div className="bg-surface-light dark:bg-surface-dark p-4 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex items-center gap-6">
                    <div className="relative size-28 shrink-0">
                        <div 
                            className="size-full rounded-full" 
                            style={{ background: stats.locationGradient }}
                        ></div>
                        <div className="absolute inset-5 bg-surface-light dark:bg-surface-dark rounded-full flex flex-col items-center justify-center shadow-inner">
                            <span className="text-xl font-black text-slate-900 dark:text-white leading-none">{stats.totalLocations}</span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Locaties</span>
                        </div>
                    </div>
                    <div className="flex-1 flex flex-col gap-2">
                        {stats.locationSegments.map((seg, i) => (
                            <div key={i} className="flex items-center justify-between text-xs">
                                <div className="flex items-center gap-2">
                                    <div className="size-2.5 rounded-full" style={{ backgroundColor: seg.color }}></div>
                                    <span className="text-slate-600 dark:text-slate-300 font-bold truncate max-w-[100px]">{seg.label}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-slate-900 dark:text-white font-bold">{seg.count}x</span>
                                    <span className="text-slate-400 w-8 text-right">{Math.round(seg.pct)}%</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )}

        {/* Activity Chart */}
        <div className="px-4">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-3">{activityTitle}</h3>
            <div className="bg-surface-light dark:bg-surface-dark p-4 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
                <div className="h-44 relative flex gap-2">
                    {/* Y-Axis */}
                    <div className="flex flex-col justify-between text-[10px] text-slate-400 font-bold py-4 text-right min-w-[20px]">
                        <span>{stats.maxActivity}</span>
                        <span>{Math.round(stats.maxActivity / 2)}</span>
                        <span>0</span>
                    </div>

                    {/* Chart Area */}
                    <div className="relative flex-1 min-w-0">
                        {/* Grid Lines */}
                        <div className="absolute inset-0 flex flex-col justify-between py-4 pointer-events-none z-0 px-1">
                            <div className="border-t border-dashed border-slate-200 dark:border-slate-700 w-full opacity-50"></div>
                            <div className="border-t border-dashed border-slate-200 dark:border-slate-700 w-full opacity-50"></div>
                            <div className="border-t border-slate-200 dark:border-slate-700 w-full opacity-50"></div>
                        </div>

                        <div 
                            ref={scrollContainerRef}
                            className={`flex h-full w-full overflow-x-auto no-scrollbar pb-4 pt-6 relative z-10 ${isYearView ? 'gap-1 px-1' : 'gap-3'}`}
                            onScroll={updateScrollState}
                        >
                            {stats.activityData.map((item, idx) => {
                                const heightPct = stats.maxActivity > 0 ? (item.count / stats.maxActivity) * 100 : 0;
                                const isFirst = idx === 0;
                                const isLast = idx === stats.activityData.length - 1;
                                
                                return (
                                    <div key={idx} className={`flex flex-col items-center gap-2 h-full justify-end ${isYearView ? 'flex-1 min-w-0' : 'min-w-[24px] flex-shrink-0'}`}>
                                        <div className="relative w-full flex-1 flex items-end justify-center group">
                                            {/* Main Bar */}
                                            <div 
                                                className={`rounded-t-md transition-all relative ${item.highlight ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-600 group-hover:bg-primary/70'} ${isYearView ? 'w-full mx-0.5' : 'w-4'}`}
                                                style={{ height: `${Math.max(4, heightPct)}%` }}
                                            >
                                                {/* Tooltip */}
                                                <div className={`absolute bottom-full mb-1 px-2 py-1.5 bg-slate-900 text-white text-[10px] font-bold rounded-md opacity-0 group-hover:opacity-100 whitespace-nowrap z-20 pointer-events-none transition-opacity shadow-xl ${isFirst ? 'left-0' : isLast ? 'right-0' : 'left-1/2 -translate-x-1/2'}`}>
                                                    <span className="block text-slate-300 mb-0.5 text-[9px] uppercase">{item.periodName}</span>
                                                    {item.count} {item.count === 1 ? 'potje' : 'potjes'}
                                                </div>
                                            </div>
                                        </div>
                                        <span className={`text-[9px] font-bold truncate ${item.highlight ? 'text-primary' : 'text-slate-400'}`}>{item.label}</span>
                                    </div>
                                );
                            })}
                            <div className="w-4 shrink-0"></div>
                        </div>
                    </div>
                </div>
                
                {/* Scrollbar Track (Custom) */}
                <div 
                    ref={scrollTrackRef}
                    className="mt-2 h-1 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden cursor-pointer relative touch-none"
                    onMouseDown={handleThumbMouseDown}
                    onTouchStart={handleThumbMouseDown}
                    onClick={handleTrackClick}
                >
                    <div 
                        className={`absolute top-0 bottom-0 bg-gray-300 dark:bg-gray-600 rounded-full transition-all duration-75 ${isDragging ? 'bg-primary' : 'hover:bg-primary/50'}`}
                        style={{ 
                            left: `${scrollThumb.left}%`, 
                            width: `${scrollThumb.width}%` 
                        }}
                    ></div>
                </div>
            </div>
        </div>

        {/* Top Winners */}
        {stats.topWinners.length > 0 && (
            <div className="px-4">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Meeste Winst</h3>
                </div>
                <div className="bg-surface-light dark:bg-surface-dark rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
                    {displayedWinners.map((w, idx) => (
                        <div key={w.player?.id || idx} className="flex items-center p-3 border-b border-gray-50 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                            <div className="font-bold text-slate-400 w-6 text-sm">#{idx + 1}</div>
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                <img src={w.player?.image} className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 object-cover" />
                                <span className="text-sm font-bold text-slate-900 dark:text-white truncate">{w.player?.name}</span>
                            </div>
                            <div className="text-right">
                                <span className="block font-black text-slate-900 dark:text-white text-sm">{w.wins}</span>
                                <span className="text-[10px] font-bold text-slate-400 uppercase">Gewonnen</span>
                            </div>
                        </div>
                    ))}
                    {!showAllWinners && stats.topWinners.length > 3 && (
                        <button onClick={() => setShowAllWinners(true)} className="w-full py-3 text-center text-xs font-bold text-primary hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">Toon alle ({stats.topWinners.length})</button>
                    )}
                    {showAllWinners && (
                        <button onClick={() => setShowAllWinners(false)} className="w-full py-3 text-center text-xs font-bold text-slate-500 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">Toon minder</button>
                    )}
                </div>
            </div>
        )}

        {/* Game Breakdown */}
        {stats.gameBreakdown.length > 0 && (
            <div className="px-4">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Meest Gespeeld</h3>
                </div>
                <div className="bg-surface-light dark:bg-surface-dark rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
                    {displayedGames.map((stat) => (
                        <Link to={`/game-details/${stat.game?.id}`} key={stat.game?.id} className="flex items-center gap-4 p-3 border-b border-gray-50 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                            <div className="w-12 h-12 rounded-lg bg-cover bg-center shrink-0 border border-slate-200 dark:border-slate-700" style={{backgroundImage: `url("${stat.game?.image}")`}}></div>
                            <div className="flex-1 min-w-0">
                                <h4 className="font-bold text-slate-900 dark:text-white truncate">{stat.game?.title}</h4>
                                <div className="flex items-center gap-2 text-xs mt-0.5 text-slate-500 dark:text-slate-400">
                                    <span>{stat.count} keer gespeeld</span>
                                </div>
                            </div>
                            <span className="material-symbols-outlined text-slate-300 dark:text-slate-600">chevron_right</span>
                        </Link>
                    ))}
                    {!showAllGames && stats.gameBreakdown.length > 3 && (
                        <button onClick={() => setShowAllGames(true)} className="w-full py-3 text-center text-xs font-bold text-primary hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">Toon alle ({stats.gameBreakdown.length})</button>
                    )}
                    {showAllGames && (
                        <button onClick={() => setShowAllGames(false)} className="w-full py-3 text-center text-xs font-bold text-slate-500 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">Toon minder</button>
                    )}
                </div>
            </div>
        )}

      </div>
    </div>
  );
};

export default Statistics;
