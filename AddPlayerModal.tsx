
import React, { useState, useRef, useEffect } from 'react';
import { Player } from '../types';
import { useGames } from '../context/GameContext';

interface AddPlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPlayerAdded?: (player: Player) => void; // Optional callback for parents (like ImportMatches)
  initialName?: string;
}

// Configuration for each row:
// - seeds: generate different face/color combinations
// - params: enforces a specific hair style for that row
const AVATAR_CONFIG = [
  // Row 1: Short Hair - Style A (Neat)
  { 
    seeds: ['Adam', 'Brian', 'Charlie', 'David', 'Ethan'], 
    params: '&hair=short16&eyebrows=variant02' 
  },
  // Row 2: Short Hair - Style A (Variant) -> Same style, different faces/colors
  { 
    seeds: ['Frank', 'Greg', 'Henry', 'Ian', 'James'], 
    params: '&hair=short16&eyebrows=variant09' 
  },
  // Row 3: Short Hair - Style B (Tousled)
  { 
    seeds: ['Kevin', 'Liam', 'Mike', 'Noah', 'Oscar'], 
    params: '&hair=short04&eyebrows=variant05' 
  },
  // Row 4: Long Hair - Style A (Straight)
  { 
    seeds: ['Alice', 'Bella', 'Clara', 'Diana', 'Eva'], 
    params: '&hair=long01' 
  },
  // Row 5: Long Hair - Style A (Variant) -> Same style, different faces/colors
  { 
    seeds: ['Fiona', 'Grace', 'Hannah', 'Iris', 'Julia'], 
    params: '&hair=long01&glasses=variant02' 
  },
  // Row 6: Long Hair - Style B (Wavy/Curley)
  { 
    seeds: ['Karen', 'Luna', 'Mia', 'Nora', 'Olivia'], 
    params: '&hair=long04' 
  }
];

// Extended Palette with "Crazy" Colors
const SKIN_COLORS = [
    'ecad80', // Natural Light
    '6d4c41', // Natural Dark
    'ffcc80', // Natural Tan
    '80deea', // Crazy Cyan
    'ce93d8', // Crazy Purple
    'a5d6a7', // Alien Green
    'ef9a9a', // Reddish
];

const HAIR_COLORS = [
    '263238', // Black
    'fdd835', // Blonde
    'ff5252', // Red/Pink
    '76ff03', // Neon Green
    '2979ff', // Bright Blue
    'ffffff', // White/Grey
    'ff9800'  // Orange
];

const ACCESSORIES = [
  '', 
  'variant01', 'variant02', 'variant03', 
  'variant04', 'variant05'
];

const AddPlayerModal: React.FC<AddPlayerModalProps> = ({ isOpen, onClose, onPlayerAdded, initialName }) => {
  const { addPlayer, players, defaultPlayerImageMode } = useGames();
  
  // Form State
  const [newPlayerName, setNewPlayerName] = useState('');
  const [error, setError] = useState('');
  const [imageMode, setImageMode] = useState<'avatar' | 'initials' | 'custom'>('avatar');
  // Default to first seed of first row
  const [selectedAvatarSeed, setSelectedAvatarSeed] = useState(AVATAR_CONFIG[0].seeds[0]);
  const [customImage, setCustomImage] = useState<string>('');
  const [customUrl, setCustomUrl] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setNewPlayerName(initialName || '');
      setError('');
      // Use setting from context, but filter out 'builder' as this modal is simple
      if (defaultPlayerImageMode === 'builder') {
          setImageMode('avatar');
      } else {
          setImageMode(defaultPlayerImageMode as 'avatar' | 'initials' | 'custom');
      }
      setSelectedAvatarSeed(AVATAR_CONFIG[0].seeds[0]);
      setCustomImage('');
      setCustomUrl('');
    }
  }, [isOpen, defaultPlayerImageMode, initialName]);

  // Helper to get URL with correct params based on the seed
  const getAvatarUrl = (seed: string) => {
    const baseUrl = `https://api.dicebear.com/9.x/adventurer/svg?seed=${encodeURIComponent(seed)}`;
    
    // Find which config row this seed belongs to
    const rowIdx = AVATAR_CONFIG.findIndex(row => row.seeds.includes(seed));
    const config = AVATAR_CONFIG[rowIdx];
    
    // Append specific params if found, otherwise default
    if (config) {
        // Calculate index to cycle through diverse colors
        const seedIdx = config.seeds.indexOf(seed);
        
        const skinIndex = (seedIdx + rowIdx) % SKIN_COLORS.length;
        const hairIndex = (seedIdx + (rowIdx * 2)) % HAIR_COLORS.length; 

        const skin = SKIN_COLORS[skinIndex];
        const hair = HAIR_COLORS[hairIndex];
        
        return `${baseUrl}${config.params}&skinColor=${skin}&hairColor=${hair}`;
    }
    return baseUrl;
  };

  const getPreviewImage = () => {
    // If name is empty, provide a fallback for initials
    const nameSeed = newPlayerName.trim() || '?';
    
    if (imageMode === 'avatar') {
       return getAvatarUrl(selectedAvatarSeed);
    }
    
    if (imageMode === 'initials') {
       return `https://ui-avatars.com/api/?name=${encodeURIComponent(nameSeed)}&background=random&size=128&bold=true`;
    }
    
    if (imageMode === 'custom') {
       return customImage;
    }
    
    return '';
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        setCustomImage(reader.result as string);
        setImageMode('custom');
      };
      reader.readAsDataURL(file);
    }
  };

  const processUrl = async () => {
      if (!customUrl.trim()) return;
      setIsProcessing(true);
      try {
          const response = await fetch(customUrl.trim());
          const blob = await response.blob();
          const reader = new FileReader();
          reader.onloadend = () => {
              setCustomImage(reader.result as string);
              setIsProcessing(false);
              setCustomUrl('');
          };
          reader.onerror = () => {
              console.warn("Could not convert URL via fetch, using fallback");
              setCustomImage(customUrl.trim()); // Fallback to direct URL if fetch fails
              setIsProcessing(false);
              setCustomUrl('');
          };
          reader.readAsDataURL(blob);
      } catch (e) {
          console.warn("CORS/Network error on image fetch, using direct URL", e);
          setCustomImage(customUrl.trim());
          setIsProcessing(false);
          setCustomUrl('');
      }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = newPlayerName.trim();
    if (!trimmedName) return;

    // Check for duplicate name (case-insensitive)
    const duplicate = players.some(p => p.name.toLowerCase() === trimmedName.toLowerCase());
    if (duplicate) {
        setError('Deze naam bestaat al. Kies een andere naam.');
        return;
    }

    const finalImage = getPreviewImage();

    const newPlayer: Player = {
      id: Date.now().toString(),
      name: trimmedName,
      image: finalImage || `https://ui-avatars.com/api/?name=${encodeURIComponent(trimmedName)}&background=random`
    };

    addPlayer(newPlayer);
    if (onPlayerAdded) {
        onPlayerAdded(newPlayer);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
        <div className="bg-surface-light dark:bg-surface-dark w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-gray-100 dark:border-gray-700 animate-slide-down overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center mb-4 shrink-0">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Nieuwe Speler</h3>
                <button 
                  type="button" 
                  onClick={onClose} 
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
                >
                    <span className="material-symbols-outlined">close</span>
                </button>
            </div>
            
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto no-scrollbar">
                <div className="flex flex-col items-center mb-6">
                    {/* Main Preview (Large) */}
                    <div className="relative w-24 h-24 mb-6 shrink-0">
                        <div className="w-24 h-24 rounded-full bg-gray-100 dark:bg-gray-800 border-4 border-white dark:border-gray-600 shadow-lg overflow-hidden flex items-center justify-center">
                            {(imageMode === 'custom' && !customImage) ? (
                                <span className="material-symbols-outlined text-gray-300 text-4xl">image</span>
                            ) : (
                                <img 
                                    src={getPreviewImage()} 
                                    alt="Preview" 
                                    className="w-full h-full object-cover"
                                />
                            )}
                        </div>
                        {imageMode === 'custom' && (
                            <button 
                                type="button"
                                onClick={() => setCustomImage('')}
                                className="absolute bottom-0 right-0 p-1.5 bg-red-500 text-white rounded-full shadow-md hover:bg-red-600 transition-colors"
                            >
                                <span className="material-symbols-outlined text-sm">close</span>
                            </button>
                        )}
                    </div>

                    {/* Name Input */}
                    <div className="w-full mb-6">
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5 text-center">Naam</label>
                        <input 
                            type="text" 
                            autoFocus
                            value={newPlayerName}
                            onChange={(e) => {
                                setNewPlayerName(e.target.value);
                                setError('');
                            }}
                            placeholder="Bijv. Mark"
                            className={`w-full text-center rounded-xl bg-gray-50 dark:bg-gray-800 border focus:ring-2 text-slate-900 dark:text-white p-3 font-medium placeholder:text-slate-400 transition-colors ${error ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : 'border-gray-200 dark:border-gray-700 focus:border-primary focus:ring-primary/20'}`}
                        />
                         {error && (
                            <p className="text-red-500 text-xs font-bold text-center mt-2 animate-slide-down">
                                {error}
                            </p>
                        )}
                    </div>

                    {/* Image Type Selector */}
                    <div className="flex p-1 bg-gray-100 dark:bg-gray-800 rounded-xl w-full mb-6 shrink-0">
                        <button
                            type="button"
                            onClick={() => setImageMode('avatar')}
                            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${imageMode === 'avatar' ? 'bg-white dark:bg-gray-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                        >
                            Poppetje
                        </button>
                        <button
                            type="button"
                            onClick={() => setImageMode('initials')}
                            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${imageMode === 'initials' ? 'bg-white dark:bg-gray-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                        >
                            Letters
                        </button>
                        <button
                            type="button"
                            onClick={() => setImageMode('custom')}
                            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${imageMode === 'custom' ? 'bg-white dark:bg-gray-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                        >
                            Upload
                        </button>
                    </div>

                    {/* Avatar Selection Grid (Categorized without labels) */}
                    {imageMode === 'avatar' && (
                        <div className="w-full mb-4 space-y-2">
                            {AVATAR_CONFIG.map((row, rowIdx) => (
                                <div key={rowIdx} className={`grid grid-cols-5 gap-2 ${rowIdx === 3 ? 'mt-6 pt-6 border-t border-gray-100 dark:border-gray-800' : ''}`}>
                                    {row.seeds.map((seed) => (
                                        <button
                                            key={seed}
                                            type="button"
                                            onClick={() => setSelectedAvatarSeed(seed)}
                                            className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all ${selectedAvatarSeed === seed ? 'border-primary ring-2 ring-primary/20 scale-105 z-10' : 'border-transparent hover:border-gray-300 dark:hover:border-gray-600 bg-gray-50 dark:bg-gray-800'}`}
                                        >
                                            <img 
                                                src={getAvatarUrl(seed)}
                                                alt={seed}
                                                className="w-full h-full object-cover"
                                            />
                                            {selectedAvatarSeed === seed && (
                                                <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                                                    <span className="material-symbols-outlined text-white font-bold text-sm drop-shadow-md">check</span>
                                                </div>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            ))}
                        </div>
                    )}

                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleFileChange} 
                        accept="image/*" 
                        className="hidden" 
                    />
                </div>

                <div className="space-y-4 shrink-0">
                    {imageMode === 'custom' && !customImage && (
                        <div className="space-y-3">
                            <div 
                                onClick={() => fileInputRef.current?.click()}
                                className="w-full py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl flex items-center justify-center gap-2 text-slate-500 cursor-pointer hover:border-primary hover:text-primary transition-colors bg-gray-50 dark:bg-gray-800/50"
                            >
                                <span className="material-symbols-outlined">add_photo_alternate</span>
                                <span className="text-sm font-bold">Kies afbeelding van schijf</span>
                            </div>
                            
                            <div className="flex gap-2">
                                <input 
                                    type="text" 
                                    placeholder="Of plak een afbeeldingslink..." 
                                    value={customUrl}
                                    onChange={(e) => setCustomUrl(e.target.value)}
                                    className="flex-1 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-1 focus:ring-primary focus:border-primary"
                                />
                                <button 
                                    type="button"
                                    onClick={processUrl}
                                    disabled={!customUrl.trim() || isProcessing}
                                    className="px-3 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50 transition-colors"
                                >
                                    {isProcessing ? <span className="material-symbols-outlined animate-spin text-lg">refresh</span> : <span className="material-symbols-outlined text-lg">download</span>}
                                </button>
                            </div>
                        </div>
                    )}
                    
                    <button 
                        type="submit"
                        disabled={!newPlayerName.trim()}
                        className="w-full py-3.5 font-bold bg-primary text-white rounded-xl shadow-lg shadow-primary/30 hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98] mt-2"
                    >
                        Speler Toevoegen
                    </button>
                </div>
            </form>
        </div>
    </div>
  );
};

export default AddPlayerModal;
