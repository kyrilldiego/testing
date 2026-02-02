
export interface User {
  id: string;
  name: string;
  username: string; // Unique user code/handle
  email: string; // Kept for legacy/auth purposes but not used for linking anymore
  image: string;
}

export interface Notification {
  id: string;
  toUserId: string;
  fromUserId: string;
  type: 'link_request';
  payload: {
    playerId: string; // The ID of the player object in the sender's list
    playerName: string;
    senderName: string; // The name of the user sending the request
  };
  read: boolean;
  status: 'pending' | 'accepted' | 'rejected';
}

export interface Winner {
  name: string;
  score: string;
}

export interface ScoreColumn {
  id: string;
  name: string;
  type: 'input' | 'calculated';
  // For input columns: do points count up or down?
  modifier?: 'add' | 'subtract'; 
  // For calculated columns
  formula?: string; // Stores expressions like "{col_1} * 2 + {col_2}"
  // Deprecated but kept for type compatibility temporarily if needed, though we move to formula
  operation?: 'sum' | 'subtract' | 'multiply' | 'divide';
  sourceColumnIds?: string[];
}

export interface GameExtension {
  id: string;
  title: string;
  image?: string;
  rating?: number; // 0.0 - 10.0
  customColumns?: ScoreColumn[]; // Columns added by this extension
}

export interface Game {
  id: number;
  title: string;
  lastPlayed: string;
  playCount: number;
  winner: Winner;
  image: string;
  type: 'score' | 'team' | 'money';
  isFavorite?: boolean;
  rating?: number; // 0.0 - 10.0
  groups?: string[]; // Tags/Categories defined by user
  // Extended settings
  description?: string;
  winningCondition?: 'highest' | 'lowest';
  ownershipStatus?: 'owned' | 'wishlist' | null;
  extensions?: GameExtension[];
  
  // Score sheet configuration
  scoreType?: 'standard' | 'custom';
  inputMethod?: 'numeric' | 'counter'; // Used when scoreType is 'standard'
  customColumns?: ScoreColumn[]; // Used when scoreType is 'custom'
}

export interface Player {
  id: string;
  name: string;
  image: string;
  isWinner?: boolean;
  linkedUserId?: string; // If set, this player maps to a real app user
}

export interface MatchResult {
  playerId: string;
  score: number | string;
  isWinner: boolean;
  isStarter?: boolean; // Indicates if this player started the round
  teamId?: string; // ID of the team (e.g. "1", "2") if game is team-based
  change?: number; // For money games or score diffs
  scoreBreakdown?: Record<string, number>; // Stores individual column values { col_id: value }
}

export interface Match {
  id: number;
  gameId: number;
  date: string;
  duration?: string;
  location?: string; // Where was the match played?
  results: MatchResult[];
  createdBy: string; // User ID who created the match
  extensionIds?: string[]; // IDs of extensions used in this match
}

export interface ExportData {
  type: 'match_export';
  version: number;
  sourceGameTitle: string;
  matches: Match[];
  // Minimal player info needed for mapping
  players: { id: string; name: string }[];
  // Extension titles to try and map them
  extensions: { id: string; title: string }[];
}
