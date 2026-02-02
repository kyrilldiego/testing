
import React, { useState, useRef, useEffect } from 'react';

interface EditAvatarModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentImage: string;
  playerName: string;
  onSave: (newImage: string, newName: string) => void;
}

// --- CONSTANTS FOR AVATAR BUILDER ---

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

const EditAvatarModal: React.FC<EditAvatarModalProps> = ({ isOpen, onClose, currentImage, playerName, onSave }) => {
  const [imageMode, setImageMode] = useState<'avatar' | 'builder' | 'initials' | 'custom'>('avatar');
  const [selectedAvatarSeed, setSelectedAvatarSeed] = useState(AVATAR_CONFIG[0].seeds[0]);
  const [customImage, setCustomImage] = useState<string>('');
  const [editName, setEditName] = useState(playerName);
  const [customUrl, setCustomUrl] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Builder State
  const [builderConfig, setBuilderConfig] = useState({
    hair: 0, 
    hairColor: 0, 
    expression: 0, 
    skin: 0, 
    accessory: 0 
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize and Restore State from URL
  useEffect(() => {
    if (isOpen) {
        setEditName(playerName);
        setCustomUrl('');
        
        let initialMode: 'avatar' | 'builder' | 'initials' | 'custom' = 'avatar';

        if (currentImage.startsWith('data:image')) {
            initialMode = 'custom';
            setCustomImage(currentImage);
        } else if (currentImage.includes('ui-avatars.com')) {
            initialMode = 'initials';
        } else if (currentImage.includes('dicebear') && currentImage.includes('adventurer')) {
            try {
                const url = new URL(currentImage);
                const params = url.searchParams;
                const seed = params.get('seed') || '';
                
                const isQuickSelect = AVATAR_CONFIG.some(row => row.seeds.includes(seed));
                
                if (isQuickSelect) {
                    initialMode = 'avatar';
                    setSelectedAvatarSeed(seed);
                } else {
                    initialMode = 'builder';
                    const findIdx = (arr: string[], val: string | null) => {
                        if (!val) return 0;
                        const idx = arr.indexOf(val);
                        return idx !== -1 ? idx : 0;
                    };

                    const eyebrows = params.get('eyebrows');
                    const eyes = params.get('eyes');
                    const mouth = params.get('mouth');
                    
                    const exprIdx = EXPRESSION_CONFIG.findIndex(e => 
                        (e.eyebrows === eyebrows || (!eyebrows && e.eyebrows === 'variant01')) &&
                        (e.eyes === eyes || (!eyes && e.eyes === 'variant01')) &&
                        (e.mouth === mouth || (!mouth && e.mouth === 'variant01'))
                    );

                    setBuilderConfig({
                        hair: findIdx(HAIR_STYLES, params.get('hair')),
                        hairColor: findIdx(HAIR_COLORS, params.get('hairColor')),
                        skin: findIdx(SKIN_COLORS, params.get('skinColor')),
                        accessory: findIdx(ACCESSORIES, params.get('glasses')),
                        expression: exprIdx !== -1 ? exprIdx : 0
                    });
                }
            } catch (e) {
                const randomRow = Math.floor(Math.random() * AVATAR_CONFIG.length);
                const randomSeed = Math.floor(Math.random() * 5);
                setSelectedAvatarSeed(AVATAR_CONFIG[randomRow].seeds[randomSeed]);
            }
        } else if (currentImage && currentImage.trim() !== '') {
            initialMode = 'custom';
            setCustomImage(currentImage);
        } else {
            const randomRow = Math.floor(Math.random() * AVATAR_CONFIG.length);
            const randomSeed = Math.floor(Math.random() * 5);
            setSelectedAvatarSeed(AVATAR_CONFIG[randomRow].seeds[randomSeed]);
        }
        
        setImageMode(initialMode);
    }
  }, [isOpen, currentImage, playerName]);

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
      const baseSeed = editName.trim() || 'base'; 
      
      const hair = HAIR_STYLES[builderConfig.hair];
      const hairColor = HAIR_COLORS[builderConfig.hairColor];
      const skin = SKIN_COLORS[builderConfig.skin];
      const expression = EXPRESSION_CONFIG[builderConfig.expression];
      const glasses = ACCESSORIES[builderConfig.accessory];
      
      let url = `https://api.dicebear.com/9.x/adventurer/svg?seed=${encodeURIComponent(baseSeed)}`;
      
      url += `&hair=${hair}`;
      url += `&hairColor=${hairColor}`;
      url += `&skinColor=${skin}`;
      
      url += `&eyebrows=${expression.eyebrows}`;
      url += `&eyes=${expression.eyes}`;
      url += `&mouth=${expression.mouth}`;
      
      if (glasses) {
          url += `&glasses=${glasses}&glassesProbability=100`;
      } else {
          url += `&glassesProbability=0`;
      }
      
      return url;
  };

  const getPreviewImage = () => {
    if (imageMode === 'avatar') return getAvatarUrl(selectedAvatarSeed);
    if (imageMode === 'builder') return getBuilderUrl();
    if (imageMode === 'initials') return `https://ui-avatars.com/api/?name=${encodeURIComponent(editName)}&background=random&size=128&bold=true`;
    if (imageMode === 'custom') return customImage || currentImage;
    return currentImage;
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
              setCustomImage(customUrl.trim()); // Fallback
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
    if (!editName.trim()) return;
    onSave(getPreviewImage(), editName.trim());
    onClose();
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
        <div className="bg-surface-light dark:bg-surface-dark w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-gray-100 dark:border-gray-700 animate-slide-down flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Profiel Bewerken</h3>
                <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                    <span className="material-symbols-outlined">close</span>
                </button>
            </div>
            
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto no-scrollbar pb-2">
                <div className="flex flex-col items-center mb-6">
                    <div className="relative w-32 h-32 mb-6">
                        <div className="w-32 h-32 rounded-full bg-gray-100 dark:bg-gray-800 border-4 border-white dark:border-gray-600 shadow-lg overflow-hidden flex items-center justify-center">
                            {(imageMode === 'custom' && !customImage && !currentImage) ? (
                                <span className="material-symbols-outlined text-gray-300 text-5xl">image</span>
                            ) : (
                                <img src={getPreviewImage()} alt="Preview" className="w-full h-full object-cover" />
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

                    <div className="w-full mb-6">
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5 text-center">Naam</label>
                        <input 
                            type="text" 
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="w-full text-center rounded-xl bg-gray-50 dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 focus:border-primary focus:ring-primary/20 text-slate-900 dark:text-white p-3 font-bold text-lg"
                            placeholder="Naam"
                        />
                    </div>

                    <div className="flex p-1 bg-gray-100 dark:bg-gray-800 rounded-xl w-full mb-6">
                        <button type="button" onClick={() => setImageMode('avatar')} className={`flex-1 py-2 rounded-lg text-[10px] font-bold transition-all ${imageMode === 'avatar' ? 'bg-white dark:bg-gray-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Poppetje</button>
                        <button type="button" onClick={() => setImageMode('builder')} className={`flex-1 py-2 rounded-lg text-[10px] font-bold transition-all ${imageMode === 'builder' ? 'bg-white dark:bg-gray-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Maken</button>
                        <button type="button" onClick={() => setImageMode('initials')} className={`flex-1 py-2 rounded-lg text-[10px] font-bold transition-all ${imageMode === 'initials' ? 'bg-white dark:bg-gray-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Letters</button>
                        <button type="button" onClick={() => setImageMode('custom')} className={`flex-1 py-2 rounded-lg text-[10px] font-bold transition-all ${imageMode === 'custom' ? 'bg-white dark:bg-gray-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Upload</button>
                    </div>

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
                                            <img src={getAvatarUrl(seed)} alt={seed} className="w-full h-full object-cover" />
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

                    {imageMode === 'builder' && (
                        <div className="w-full space-y-4">
                            <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-800/50 p-2 rounded-xl">
                                <span className="text-xs font-bold text-slate-600 dark:text-slate-300 ml-2">Haarstijl</span>
                                <div className="flex items-center gap-3">
                                    <button type="button" onClick={() => cycleOption('hair', 'prev')} className="size-8 flex items-center justify-center rounded-lg bg-white dark:bg-gray-700 shadow-sm border border-gray-200 dark:border-gray-600 text-slate-500 hover:text-primary active:scale-95 transition-all">
                                        <span className="material-symbols-outlined text-lg">chevron_left</span>
                                    </button>
                                    <span className="text-[10px] font-bold w-24 text-center truncate">{builderConfig.hair + 1} / {HAIR_STYLES.length}</span>
                                    <button type="button" onClick={() => cycleOption('hair', 'next')} className="size-8 flex items-center justify-center rounded-lg bg-white dark:bg-gray-700 shadow-sm border border-gray-200 dark:border-gray-600 text-slate-500 hover:text-primary active:scale-95 transition-all">
                                        <span className="material-symbols-outlined text-lg">chevron_right</span>
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-800/50 p-2 rounded-xl">
                                <span className="text-xs font-bold text-slate-600 dark:text-slate-300 ml-2">Haarkleur</span>
                                <div className="flex items-center gap-3">
                                    <button type="button" onClick={() => cycleOption('hairColor', 'prev')} className="size-8 flex items-center justify-center rounded-lg bg-white dark:bg-gray-700 shadow-sm border border-gray-200 dark:border-gray-700 text-slate-500 hover:text-primary active:scale-95 transition-all">
                                        <span className="material-symbols-outlined text-lg">chevron_left</span>
                                    </button>
                                    <div className="w-24 flex justify-center">
                                        <div className="w-8 h-8 rounded-full border-2 border-white shadow-sm" style={{ backgroundColor: `#${HAIR_COLORS[builderConfig.hairColor]}` }}></div>
                                    </div>
                                    <button type="button" onClick={() => cycleOption('hairColor', 'next')} className="size-8 flex items-center justify-center rounded-lg bg-white dark:bg-gray-700 shadow-sm border border-gray-200 dark:border-gray-700 text-slate-500 hover:text-primary active:scale-95 transition-all">
                                        <span className="material-symbols-outlined text-lg">chevron_right</span>
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-800/50 p-2 rounded-xl">
                                <span className="text-xs font-bold text-slate-600 dark:text-slate-300 ml-2">Gezicht</span>
                                <div className="flex items-center gap-3">
                                    <button type="button" onClick={() => cycleOption('expression', 'prev')} className="size-8 flex items-center justify-center rounded-lg bg-white dark:bg-gray-700 shadow-sm border border-gray-200 dark:border-gray-600 text-slate-500 hover:text-primary active:scale-95 transition-all">
                                        <span className="material-symbols-outlined text-lg">chevron_left</span>
                                    </button>
                                    <span className="text-[10px] font-bold w-24 text-center truncate">{builderConfig.expression + 1} / {EXPRESSION_CONFIG.length}</span>
                                    <button type="button" onClick={() => cycleOption('expression', 'next')} className="size-8 flex items-center justify-center rounded-lg bg-white dark:bg-gray-700 shadow-sm border border-gray-200 dark:border-gray-600 text-slate-500 hover:text-primary active:scale-95 transition-all">
                                        <span className="material-symbols-outlined text-lg">chevron_right</span>
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-800/50 p-2 rounded-xl">
                                <span className="text-xs font-bold text-slate-600 dark:text-slate-300 ml-2">Huidskleur</span>
                                <div className="flex items-center gap-3">
                                    <button type="button" onClick={() => cycleOption('skin', 'prev')} className="size-8 flex items-center justify-center rounded-lg bg-white dark:bg-gray-700 shadow-sm border border-gray-200 dark:border-gray-700 text-slate-500 hover:text-primary active:scale-95 transition-all">
                                        <span className="material-symbols-outlined text-lg">chevron_left</span>
                                    </button>
                                    <div className="w-24 flex justify-center">
                                        <div className="w-8 h-8 rounded-full border-2 border-white shadow-sm" style={{ backgroundColor: `#${SKIN_COLORS[builderConfig.skin]}` }}></div>
                                    </div>
                                    <button type="button" onClick={() => cycleOption('skin', 'next')} className="size-8 flex items-center justify-center rounded-lg bg-white dark:bg-gray-700 shadow-sm border border-gray-200 dark:border-gray-700 text-slate-500 hover:text-primary active:scale-95 transition-all">
                                        <span className="material-symbols-outlined text-lg">chevron_right</span>
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-800/50 p-2 rounded-xl">
                                <span className="text-xs font-bold text-slate-600 dark:text-slate-300 ml-2">Accesoire</span>
                                <div className="flex items-center gap-3">
                                    <button type="button" onClick={() => cycleOption('accessory', 'prev')} className="size-8 flex items-center justify-center rounded-lg bg-white dark:bg-gray-700 shadow-sm border border-gray-200 dark:border-gray-600 text-slate-500 hover:text-primary active:scale-95 transition-all">
                                        <span className="material-symbols-outlined text-lg">chevron_left</span>
                                    </button>
                                    <span className="text-[10px] font-bold w-24 text-center truncate">{builderConfig.accessory + 1} / {ACCESSORIES.length}</span>
                                    <button type="button" onClick={() => cycleOption('accessory', 'next')} className="size-8 flex items-center justify-center rounded-lg bg-white dark:bg-gray-700 shadow-sm border border-gray-200 dark:border-gray-600 text-slate-500 hover:text-primary active:scale-95 transition-all">
                                        <span className="material-symbols-outlined text-lg">chevron_right</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
                </div>
                
                {imageMode === 'custom' && (
                    <div className="mb-4 space-y-3 px-1">
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

                <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
                    <button 
                        type="submit"
                        className="w-full py-3.5 font-bold bg-primary text-white rounded-xl shadow-lg shadow-primary/30 hover:bg-primary/90 transition-all active:scale-[0.98]"
                    >
                        Opslaan
                    </button>
                </div>
            </form>
        </div>
    </div>
  );
};

export default EditAvatarModal;
