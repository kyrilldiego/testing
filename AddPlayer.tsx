
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Player } from '../types';
import { useGames } from '../context/GameContext';

// --- CONSTANTS ---

const HAIR_STYLES = [
  'short01', 'short02', 'short03', 'short04', 'short05', 'short06', 'short07', 'short08', 
  'short09', 'short10', 'short11', 'short12', 'short13', 'short14', 'short15', 'short16',
  'long01', 'long02', 'long03', 'long04', 'long05', 'long06', 'long07', 'long08', 
  'long09', 'long10', 'long11', 'long12', 'long13', 'long14', 'long15', 'long16'
];

const EXPRESSION_CONFIG = [
  { eyebrows: 'variant01', eyes: 'variant01', mouth: 'variant01' }, // Neutral
  { eyebrows: 'variant02', eyes: 'variant02', mouth: 'variant02' }, // Happy
  { eyebrows: 'variant02', eyes: 'variant02', mouth: 'variant06' }, // Smile
  { eyebrows: 'variant06', eyes: 'variant06', mouth: 'variant05' }, // Proud
  { eyebrows: 'variant05', eyes: 'variant05', mouth: 'variant03' }, // Surprised
  { eyebrows: 'variant09', eyes: 'variant09', mouth: 'variant09' }, // Angry
  { eyebrows: 'variant10', eyes: 'variant10', mouth: 'variant10' }, // Scared
  { eyebrows: 'variant12', eyes: 'variant12', mouth: 'variant11' }, // Tired
  { eyebrows: 'variant02', eyes: 'variant11', mouth: 'variant06' }, // Wink
  { eyebrows: 'variant08', eyes: 'variant08', mouth: 'variant08' }, // Serious
  { eyebrows: 'variant04', eyes: 'variant04', mouth: 'variant26' }, // Shocked
  { eyebrows: 'variant14', eyes: 'variant14', mouth: 'variant14' }, // Confused
  { eyebrows: 'variant15', eyes: 'variant15', mouth: 'variant15' }, // Sleeping
  { eyebrows: 'variant12', eyes: 'variant12', mouth: 'variant13' }, // Annoyed
  { eyebrows: 'variant03', eyes: 'variant03', mouth: 'variant30' }, // Cool
  { eyebrows: 'variant07', eyes: 'variant07', mouth: 'variant07' }, // Sad
  { eyebrows: 'variant11', eyes: 'variant13', mouth: 'variant12' }, // Skeptical
  { eyebrows: 'variant13', eyes: 'variant16', mouth: 'variant22' }, // Disgusted
  { eyebrows: 'variant03', eyes: 'variant22', mouth: 'variant27' }, // Sarcastic
  { eyebrows: 'variant15', eyes: 'variant17', mouth: 'variant18' }, // Dizzy/Sick
  { eyebrows: 'variant02', eyes: 'variant23', mouth: 'variant04' }, // Excited
  { eyebrows: 'variant05', eyes: 'variant26', mouth: 'variant29' }, // Awestruck
  { eyebrows: 'variant09', eyes: 'variant25', mouth: 'variant16' }  // Furious
];

const ACCESSORIES = [
  '', 
  'variant01', 'variant02', 'variant03', 
  'variant04', 'variant05'
];

const SKIN_COLORS = ['ecad80', '6d4c41', 'ffcc80', '80deea', 'ce93d8', 'a5d6a7', 'ef9a9a'];
const HAIR_COLORS = ['263238', 'fdd835', 'ff5252', '76ff03', '2979ff', 'ffffff', 'ff9800', '4a148c', '004d40'];

const AVATAR_CONFIG = [
  { seeds: ['Adam', 'Brian', 'Charlie', 'David', 'Ethan'], params: '&hair=short16&eyebrows=variant02' },
  { seeds: ['Frank', 'Greg', 'Henry', 'Ian', 'James'], params: '&hair=short16&eyebrows=variant09' },
  { seeds: ['Kevin', 'Liam', 'Mike', 'Noah', 'Oscar'], params: '&hair=short04&eyebrows=variant05' },
  { seeds: ['Alice', 'Bella', 'Clara', 'Diana', 'Eva'], params: '&hair=long01' },
  { seeds: ['Fiona', 'Grace', 'Hannah', 'Iris', 'Julia'], params: '&hair=long01&glasses=variant02' },
  { seeds: ['Karen', 'Luna', 'Mia', 'Nora', 'Olivia'], params: '&hair=long04' }
];

const AddPlayer: React.FC = () => {
  const { addPlayer, players, defaultPlayerImageMode } = useGames();
  const navigate = useNavigate();
  
  // Form State
  const [newPlayerName, setNewPlayerName] = useState('');
  const [error, setError] = useState('');
  const [imageMode, setImageMode] = useState<'avatar' | 'builder' | 'initials' | 'custom'>('avatar');
  
  // Default to first seed of first row
  const [selectedAvatarSeed, setSelectedAvatarSeed] = useState(AVATAR_CONFIG[0].seeds[0]);
  const [customImage, setCustomImage] = useState<string>('');
  
  // Builder State
  const [builderConfig, setBuilderConfig] = useState({
    hair: 0, 
    hairColor: 0,
    expression: 0,
    skin: 0,
    accessory: 0
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize with preference
  useEffect(() => {
      setImageMode(defaultPlayerImageMode);
  }, [defaultPlayerImageMode]);

  // Helper to get URL with correct params based on the seed
  const getAvatarUrl = (seed: string) => {
    const baseUrl = `https://api.dicebear.com/9.x/adventurer/svg?seed=${encodeURIComponent(seed)}`;
    const rowIdx = AVATAR_CONFIG.findIndex(row => row.seeds.includes(seed));
    const config = AVATAR_CONFIG[rowIdx];
    
    if (config) {
        const seedIdx = config.seeds.indexOf(seed);
        const skinIndex = (seedIdx + rowIdx) % SKIN_COLORS.length;
        const hairIndex = (seedIdx + (rowIdx * 2)) % HAIR_COLORS.length; 
        const skin = SKIN_COLORS[skinIndex];
        const hair = HAIR_COLORS[hairIndex];
        return `${baseUrl}${config.params}&skinColor=${skin}&hairColor=${hair}`;
    }
    return baseUrl;
  };

  const getBuilderUrl = () => {
      const baseSeed = newPlayerName.trim() || 'base'; 
      
      const hair = HAIR_STYLES[builderConfig.hair];
      const hairColor = HAIR_COLORS[builderConfig.hairColor];
      const skin = SKIN_COLORS[builderConfig.skin];
      const expression = EXPRESSION_CONFIG[builderConfig.expression];
      const glasses = ACCESSORIES[builderConfig.accessory];
      
      let url = `https://api.dicebear.com/9.x/adventurer/svg?seed=${encodeURIComponent(baseSeed)}`;
      
      // Feature Overrides
      url += `&hair=${hair}`;
      url += `&hairColor=${hairColor}`;
      url += `&skinColor=${skin}`;
      
      // Expression Overrides (Eyes, Mouth, Eyebrows)
      url += `&eyebrows=${expression.eyebrows}`;
      url += `&eyes=${expression.eyes}`;
      url += `&mouth=${expression.mouth}`;
      
      // Fix for accessories: force probability
      if (glasses) {
          url += `&glasses=${glasses}&glassesProbability=100`;
      } else {
          url += `&glassesProbability=0`;
      }
      
      return url;
  };

  const getPreviewImage = () => {
    const nameSeed = newPlayerName.trim() || '?';
    
    if (imageMode === 'avatar') return getAvatarUrl(selectedAvatarSeed);
    if (imageMode === 'builder') return getBuilderUrl();
    if (imageMode === 'initials') return `https://ui-avatars.com/api/?name=${encodeURIComponent(nameSeed)}&background=random&size=128&bold=true`;
    if (imageMode === 'custom') return customImage;
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

  const cycleOption = (key: keyof typeof builderConfig, direction: 'next' | 'prev') => {
      setBuilderConfig(prev => {
          let max = 0;
          switch(key) {
              case 'hair': max = HAIR_STYLES.length; break;
              case 'hairColor': max = HAIR_COLORS.length; break;
              case 'expression': max = EXPRESSION_CONFIG.length; break;
              case 'skin': max = SKIN_COLORS.length; break;
              case 'accessory': max = ACCESSORIES.length; break;
          }
          
          let newVal = prev[key];
          if (direction === 'next') newVal = (newVal + 1) % max;
          else newVal = (newVal - 1 + max) % max;
          
          return { ...prev, [key]: newVal };
      });
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
    navigate(-1); // Go back to the previous screen (Players list or New Round)
  };

  return (
    <div className="bg-background-light dark:bg-background-dark font-display antialiased min-h-screen flex flex-col max-w-md mx-auto relative shadow-2xl">
        <div className="sticky top-0 z-50 flex items-center bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-md p-4 pb-2 justify-between border-b border-gray-200 dark:border-gray-800">
            <button 
              type="button" 
              onClick={() => navigate(-1)} 
              className="text-slate-900 dark:text-white flex size-12 shrink-0 items-center justify-center rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
            >
                <span className="material-symbols-outlined text-2xl">close</span>
            </button>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white flex-1 text-center">Nieuwe Speler</h3>
            <div className="w-12"></div>
        </div>
        
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-4 py-6 pb-32">
            <div className="flex flex-col items-center mb-6">
                {/* Main Preview (Large) */}
                <div className="relative w-32 h-32 mb-6 shrink-0">
                    <div className="w-32 h-32 rounded-full bg-gray-100 dark:bg-gray-800 border-4 border-white dark:border-gray-600 shadow-lg overflow-hidden flex items-center justify-center">
                        {(imageMode === 'custom' && !customImage) ? (
                            <span className="material-symbols-outlined text-gray-300 text-5xl">image</span>
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
                            onClick={() => fileInputRef.current?.click()}
                            className="absolute bottom-0 right-0 p-2 bg-primary text-white rounded-full shadow-md hover:bg-primary/90 transition-colors"
                        >
                            <span className="material-symbols-outlined text-lg">edit</span>
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
                        onClick={() => setImageMode('builder')}
                        className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${imageMode === 'builder' ? 'bg-white dark:bg-gray-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                    >
                        Maken
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

                {/* Quick Select Grid */}
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

                {/* Builder Controls */}
                {imageMode === 'builder' && (
                    <div className="w-full space-y-4">
                        <div className="flex items-center justify-between bg-surface-light dark:bg-surface-dark border border-gray-200 dark:border-gray-700 p-2 rounded-xl">
                            <span className="text-xs font-bold text-slate-600 dark:text-slate-300 ml-2 uppercase tracking-wide">Haarstijl</span>
                            <div className="flex items-center gap-3">
                                <button type="button" onClick={() => cycleOption('hair', 'prev')} className="size-8 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800 text-slate-500 hover:text-primary active:scale-95 transition-all"><span className="material-symbols-outlined text-lg">chevron_left</span></button>
                                <span className="text-[10px] font-bold w-12 text-center">{builderConfig.hair + 1}</span>
                                <button type="button" onClick={() => cycleOption('hair', 'next')} className="size-8 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800 text-slate-500 hover:text-primary active:scale-95 transition-all"><span className="material-symbols-outlined text-lg">chevron_right</span></button>
                            </div>
                        </div>

                        <div className="flex items-center justify-between bg-surface-light dark:bg-surface-dark border border-gray-200 dark:border-gray-700 p-2 rounded-xl">
                            <span className="text-xs font-bold text-slate-600 dark:text-slate-300 ml-2 uppercase tracking-wide">Kleur</span>
                            <div className="flex items-center gap-3">
                                <button type="button" onClick={() => cycleOption('hairColor', 'prev')} className="size-8 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800 text-slate-500 hover:text-primary active:scale-95 transition-all"><span className="material-symbols-outlined text-lg">chevron_left</span></button>
                                <div className="w-12 flex justify-center"><div className="w-6 h-6 rounded-full border border-gray-200 dark:border-gray-700 shadow-sm" style={{ backgroundColor: `#${HAIR_COLORS[builderConfig.hairColor]}` }}></div></div>
                                <button type="button" onClick={() => cycleOption('hairColor', 'next')} className="size-8 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800 text-slate-500 hover:text-primary active:scale-95 transition-all"><span className="material-symbols-outlined text-lg">chevron_right</span></button>
                            </div>
                        </div>

                        <div className="flex items-center justify-between bg-surface-light dark:bg-surface-dark border border-gray-200 dark:border-gray-700 p-2 rounded-xl">
                            <span className="text-xs font-bold text-slate-600 dark:text-slate-300 ml-2 uppercase tracking-wide">Gezicht</span>
                            <div className="flex items-center gap-3">
                                <button type="button" onClick={() => cycleOption('expression', 'prev')} className="size-8 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800 text-slate-500 hover:text-primary active:scale-95 transition-all"><span className="material-symbols-outlined text-lg">chevron_left</span></button>
                                <span className="text-[10px] font-bold w-12 text-center">{builderConfig.expression + 1}</span>
                                <button type="button" onClick={() => cycleOption('expression', 'next')} className="size-8 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800 text-slate-500 hover:text-primary active:scale-95 transition-all"><span className="material-symbols-outlined text-lg">chevron_right</span></button>
                            </div>
                        </div>

                        <div className="flex items-center justify-between bg-surface-light dark:bg-surface-dark border border-gray-200 dark:border-gray-700 p-2 rounded-xl">
                            <span className="text-xs font-bold text-slate-600 dark:text-slate-300 ml-2 uppercase tracking-wide">Huid</span>
                            <div className="flex items-center gap-3">
                                <button type="button" onClick={() => cycleOption('skin', 'prev')} className="size-8 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800 text-slate-500 hover:text-primary active:scale-95 transition-all"><span className="material-symbols-outlined text-lg">chevron_left</span></button>
                                <div className="w-12 flex justify-center"><div className="w-6 h-6 rounded-full border border-gray-200 dark:border-gray-700 shadow-sm" style={{ backgroundColor: `#${SKIN_COLORS[builderConfig.skin]}` }}></div></div>
                                <button type="button" onClick={() => cycleOption('skin', 'next')} className="size-8 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800 text-slate-500 hover:text-primary active:scale-95 transition-all"><span className="material-symbols-outlined text-lg">chevron_right</span></button>
                            </div>
                        </div>

                        <div className="flex items-center justify-between bg-surface-light dark:bg-surface-dark border border-gray-200 dark:border-gray-700 p-2 rounded-xl">
                            <span className="text-xs font-bold text-slate-600 dark:text-slate-300 ml-2 uppercase tracking-wide">Bril</span>
                            <div className="flex items-center gap-3">
                                <button type="button" onClick={() => cycleOption('accessory', 'prev')} className="size-8 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800 text-slate-500 hover:text-primary active:scale-95 transition-all"><span className="material-symbols-outlined text-lg">chevron_left</span></button>
                                <span className="text-[10px] font-bold w-12 text-center">{builderConfig.accessory === 0 ? '-' : builderConfig.accessory}</span>
                                <button type="button" onClick={() => cycleOption('accessory', 'next')} className="size-8 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800 text-slate-500 hover:text-primary active:scale-95 transition-all"><span className="material-symbols-outlined text-lg">chevron_right</span></button>
                            </div>
                        </div>
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

            <div className="fixed bottom-0 left-0 w-full p-4 bg-gradient-to-t from-background-light dark:from-background-dark via-background-light dark:via-background-dark to-transparent pt-10 max-w-md mx-auto z-40">
                <button 
                    type="submit"
                    disabled={!newPlayerName.trim()}
                    className="w-full py-4 font-bold bg-primary text-white rounded-xl shadow-lg shadow-primary/30 hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
                >
                    Speler Opslaan
                </button>
            </div>
        </form>
    </div>
  );
};

export default AddPlayer;
