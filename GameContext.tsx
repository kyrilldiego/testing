
import React, { createContext, useState, useContext, ReactNode, useMemo, useEffect } from 'react';
import { Game, Match, Player, User, Notification } from '../types';

interface GameContextType {
  // Auth
  isAuthenticated: boolean;
  login: (username: string, remember: boolean) => boolean;
  logout: () => void;
  
  currentUser: User;
  switchUser: (userId: string) => void;
  registerUser: (name: string, image?: string) => boolean; 
  updateUserImage: (userId: string, imageUrl: string) => void;
  updateUserName: (userId: string, name: string) => void;
  users: User[];

  // App Settings
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  autoStartTimer: boolean;
  toggleAutoStartTimer: () => void;
  defaultPlayerImageMode: 'avatar' | 'builder' | 'initials' | 'custom';
  setDefaultPlayerImageMode: (mode: 'avatar' | 'builder' | 'initials' | 'custom') => void;
  
  // Default Players Setting
  defaultPlayerIds: string[];
  setDefaultPlayerIds: (ids: string[]) => void;

  // Data
  games: Game[];
  allGroups: string[]; // List of all unique groups used across games
  addGame: (game: Game) => void;
  updateGame: (game: Game) => void;
  toggleFavorite: (id: number) => void;
  getGameById: (id: number) => Game | undefined;
  
  // Filtered Data (based on current user + linked accounts)
  matches: Match[];
  getMatchesByGameId: (gameId: number) => Match[];
  addMatch: (match: Match) => void;
  updateMatch: (match: Match) => void;
  deleteMatch: (matchId: number) => void;
  
  players: Player[];
  addPlayer: (player: Player) => void;
  updatePlayer: (player: Player) => void;

  // Locations
  locations: string[];
  addLocation: (location: string) => void;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export const GameProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // --- 1. Load Data from LocalStorage (Persistence) ---
  
  const [users, setUsers] = useState<User[]>(() => {
      try {
          const saved = localStorage.getItem('gm_users');
          return saved ? JSON.parse(saved) : [];
      } catch (e) { return []; }
  });

  const [allGames, setAllGames] = useState<Game[]>(() => {
      try {
          const saved = localStorage.getItem('gm_games');
          return saved ? JSON.parse(saved) : [];
      } catch (e) { return []; }
  });

  const [allMatches, setAllMatches] = useState<Match[]>(() => {
      try {
          const saved = localStorage.getItem('gm_matches');
          return saved ? JSON.parse(saved) : [];
      } catch (e) { return []; }
  });

  const [allPlayers, setAllPlayers] = useState<Player[]>(() => {
      try {
          const saved = localStorage.getItem('gm_players');
          return saved ? JSON.parse(saved) : [];
      } catch (e) { return []; }
  });

  const [locations, setLocations] = useState<string[]>(() => {
      try {
          const saved = localStorage.getItem('gm_locations');
          if (saved) return JSON.parse(saved);
          
          // Default locations if none exist
          return [];
      } catch (e) { return []; }
  });

  // --- 2. Auth State ---
  
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  // Default placeholder to avoid null checks everywhere before auth
  const [currentUser, setCurrentUser] = useState<User>({
      id: 'guest',
      name: 'Gast',
      username: 'guest',
      email: '',
      image: ''
  });

  // Check for stored session on mount
  useEffect(() => {
      const storedUserId = localStorage.getItem('game_master_session');
      if (storedUserId && users.length > 0) {
          const user = users.find(u => u.id === storedUserId);
          if (user) {
              setCurrentUser(user);
              setIsAuthenticated(true);
          }
      }
  }, [users]);

  // --- 3. Persistence Effects (Save on Change) ---

  useEffect(() => localStorage.setItem('gm_users', JSON.stringify(users)), [users]);
  useEffect(() => localStorage.setItem('gm_games', JSON.stringify(allGames)), [allGames]);
  useEffect(() => localStorage.setItem('gm_matches', JSON.stringify(allMatches)), [allMatches]);
  useEffect(() => localStorage.setItem('gm_players', JSON.stringify(allPlayers)), [allPlayers]);
  useEffect(() => localStorage.setItem('gm_locations', JSON.stringify(locations)), [locations]);

  // --- 4. Settings State ---

  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('theme');
    return (saved === 'light' || saved === 'dark') ? saved : 'dark';
  });

  const [autoStartTimer, setAutoStartTimer] = useState<boolean>(() => {
    const saved = localStorage.getItem('autoStartTimer');
    return saved !== null ? JSON.parse(saved) : true;
  });

  const [defaultPlayerImageMode, setDefaultPlayerImageModeState] = useState<'avatar' | 'builder' | 'initials' | 'custom'>(() => {
    const saved = localStorage.getItem('defaultPlayerImageMode');
    return (saved === 'avatar' || saved === 'builder' || saved === 'initials' || saved === 'custom') ? saved : 'avatar';
  });

  const [defaultPlayerIds, setDefaultPlayerIdsState] = useState<string[]>(() => {
    const saved = localStorage.getItem('defaultPlayerIds');
    return saved !== null ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  // --- Actions ---

  const login = (username: string, remember: boolean) => {
      const user = users.find(u => u.username.toLowerCase() === username.toLowerCase().trim());
      if (user) {
          setCurrentUser(user);
          setIsAuthenticated(true);
          if (remember) {
              localStorage.setItem('game_master_session', user.id);
          }
          return true;
      }
      return false;
  };

  const logout = () => {
      setIsAuthenticated(false);
      localStorage.removeItem('game_master_session');
  };

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const toggleAutoStartTimer = () => {
    setAutoStartTimer(prev => {
        const newValue = !prev;
        localStorage.setItem('autoStartTimer', JSON.stringify(newValue));
        return newValue;
    });
  };

  const setDefaultPlayerImageMode = (mode: 'avatar' | 'builder' | 'initials' | 'custom') => {
      setDefaultPlayerImageModeState(mode);
      localStorage.setItem('defaultPlayerImageMode', mode);
  };

  const setDefaultPlayerIds = (ids: string[]) => {
      setDefaultPlayerIdsState(ids);
      localStorage.setItem('defaultPlayerIds', JSON.stringify(ids));
  };

  // --- derived Data ---

  const matches = useMemo(() => {
    return allMatches.filter(match => {
      if (match.createdBy === currentUser.id) return true;
      const isParticipant = match.results.some(r => {
        const player = allPlayers.find(p => p.id === r.playerId);
        return player?.linkedUserId === currentUser.id;
      });
      return isParticipant;
    });
  }, [allMatches, currentUser, allPlayers]);

  const games = useMemo(() => {
    return allGames.map(game => {
       const visibleMatches = matches.filter(m => m.gameId === game.id);
       let lastPlayedStr = game.lastPlayed;
       if (visibleMatches.length > 0) {
          const last = visibleMatches.sort((a,b) => b.id - a.id)[0];
           lastPlayedStr = last.date.split(' • ')[0]; 
       }

       return {
         ...game,
         playCount: visibleMatches.length,
         lastPlayed: visibleMatches.length > 0 ? lastPlayedStr : 'Nog nooit'
       };
    });
  }, [allGames, matches]);

  const allGroups = useMemo(() => {
      const groups = new Set<string>();
      allGames.forEach(g => {
          if (g.groups) {
              g.groups.forEach(group => groups.add(group));
          }
      });
      return Array.from(groups).sort();
  }, [allGames]);

  const players = allPlayers;

  // --- CRUD Actions ---

  const switchUser = (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (user) {
        setCurrentUser(user);
        if (localStorage.getItem('game_master_session')) {
            localStorage.setItem('game_master_session', user.id);
        }
    }
  };

  const registerUser = (name: string, image?: string): boolean => {
    const timestamp = Date.now();
    const internalUsername = `user_${timestamp}`;
    const newUserId = `user_${timestamp}`;
    
    const avatarUrl = image || `https://api.dicebear.com/9.x/adventurer/svg?seed=${encodeURIComponent(name)}&backgroundColor=b6e3f4`;

    const newUser: User = {
        id: newUserId,
        name: name,
        username: internalUsername,
        email: `${internalUsername}@local.app`,
        image: avatarUrl
    };

    const newPlayer: Player = {
        id: `p_${timestamp}`,
        name: name,
        image: avatarUrl,
        linkedUserId: newUserId
    };

    setUsers(prev => [...prev, newUser]);
    setAllPlayers(prev => [...prev, newPlayer]);
    
    setCurrentUser(newUser);
    setIsAuthenticated(true);
    localStorage.setItem('game_master_session', newUserId);
    
    return true;
  };

  const updateUserImage = (userId: string, imageUrl: string) => {
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, image: imageUrl } : u));
    if (currentUser.id === userId) {
        setCurrentUser(prev => ({ ...prev, image: imageUrl }));
    }
  };

  const updateUserName = (userId: string, name: string) => {
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, name: name } : u));
    if (currentUser.id === userId) {
        setCurrentUser(prev => ({ ...prev, name: name }));
    }
    setAllPlayers(prev => prev.map(p => p.linkedUserId === userId ? { ...p, name: name } : p));
  };

  const addGame = (game: Game) => {
    setAllGames((prev) => [game, ...prev]);
  };

  const updateGame = (updatedGame: Game) => {
    setAllGames((prev) => prev.map((g) => (g.id === updatedGame.id ? updatedGame : g)));
  };

  const toggleFavorite = (id: number) => {
    setAllGames((prev) => prev.map((g) => g.id === id ? { ...g, isFavorite: !g.isFavorite } : g));
  };

  const getGameById = (id: number) => {
    return games.find((g) => g.id === id);
  };

  const getMatchesByGameId = (gameId: number) => {
    return matches.filter((m) => m.gameId === gameId).sort((a, b) => b.id - a.id);
  };

  const addMatch = (match: Match) => {
    const matchWithUser = { ...match, createdBy: currentUser.id };
    setAllMatches((prev) => [matchWithUser, ...prev]);
  };

  const updateMatch = (updatedMatch: Match) => {
    setAllMatches((prev) => prev.map(m => m.id === updatedMatch.id ? updatedMatch : m));
  };

  const deleteMatch = (matchId: number) => {
    setAllMatches((prev) => prev.filter(m => m.id !== matchId));
  };

  const addPlayer = (player: Player) => {
    setAllPlayers((prev) => [...prev, player]);
  };

  const updatePlayer = (updatedPlayer: Player) => {
    setAllPlayers((prev) => prev.map(p => p.id === updatedPlayer.id ? updatedPlayer : p));
  };

  const addLocation = (location: string) => {
      const trimmed = location.trim();
      if (!trimmed) return;
      
      setLocations(prev => {
          const exists = prev.some(l => l.toLowerCase() === trimmed.toLowerCase());
          if (exists) return prev;
          return [...prev, trimmed].sort();
      });
  };

  const value = {
    isAuthenticated,
    login,
    logout,
    currentUser,
    switchUser,
    registerUser,
    updateUserImage,
    updateUserName,
    users,
    theme,
    toggleTheme,
    autoStartTimer,
    toggleAutoStartTimer,
    defaultPlayerImageMode,
    setDefaultPlayerImageMode,
    defaultPlayerIds,
    setDefaultPlayerIds,
    games,
    allGroups,
    addGame,
    updateGame,
    toggleFavorite,
    getGameById,
    matches,
    getMatchesByGameId,
    addMatch,
    updateMatch,
    deleteMatch,
    players,
    addPlayer,
    updatePlayer,
    locations,
    addLocation
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
};

export const useGames = () => {
  const context = useContext(GameContext);
  if (context === undefined) {
    throw new Error('useGames must be used within a GameProvider');
  }
  return context;
};
