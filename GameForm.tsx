
import React, { useState, useEffect, useRef } from 'react';
import { Game, ScoreColumn, GameExtension } from '../types';

interface GameFormProps {
  initialData?: Game;
  initialExtensionData?: GameExtension & { parentId: number }; // New prop for editing extensions directly
  pageTitle: string;
  buttonLabel: string;
  // Updated signature to support extension data
  onSubmit: (data: Partial<Game>, extensionData?: { parentId: number, title: string, image: string, rating?: number, customColumns?: ScoreColumn[] }) => void;
  onCancel: () => void;
  customValidation?: (title: string) => string | null;
  availableGames?: Game[]; // Needed for selecting parent game for extensions
  // New props for pre-filling logic
  initialEntryType?: 'game' | 'extension';
  preSelectedParentId?: number | null;
}

const GameForm: React.FC<GameFormProps> = ({ 
    initialData, 
    initialExtensionData, 
    pageTitle, 
    buttonLabel, 
    onSubmit, 
    onCancel, 
    customValidation, 
    availableGames = [],
    initialEntryType,
    preSelectedParentId
}) => {
  // Mode State
  const [entryType, setEntryType] = useState<'game' | 'extension'>('game');
  const [parentId, setParentId] = useState<number | null>(null);

  const [title, setTitle] = useState('');
  const [error, setError] = useState('');
  const [gameMode, setGameMode] = useState<'score' | 'team'>('score');
  const [image, setImage] = useState('');
  const [rating, setRating] = useState<number | undefined>(undefined);
  
  // Ownership State
  const [ownershipStatus, setOwnershipStatus] = useState<'owned' | 'wishlist' | null>(null);

  // Groups/Tags State
  const [groups, setGroups] = useState<string[]>([]);
  const [groupInput, setGroupInput] = useState('');
  const [isGroupSuggestionsOpen, setIsGroupSuggestionsOpen] = useState(false);

  // Score Sheet Configuration
  const [scoreType, setScoreType] = useState<'standard' | 'custom'>('standard');
  
  // Custom Settings (Used for both Game AND Extension columns)
  const [customColumns, setCustomColumns] = useState<ScoreColumn[]>([
    { id: 'col_1', name: 'Ronde 1', type: 'input', modifier: 'add' }
  ]);
  
  const [winningCondition, setWinningCondition] = useState<'highest' | 'lowest'>('highest');
  const [description, setDescription] = useState('');
  
  // Extensions (For Game Mode)
  const [extensions, setExtensions] = useState<GameExtension[]>([]);

  // Search Modal State
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [pastedUrl, setPastedUrl] = useState('');
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [isParentDropdownOpen, setIsParentDropdownOpen] = useState(false);
  
  // Ref for the hidden file input
  const fileInputRef = useRef<HTMLInputElement>(null);
  const parentDropdownRef = useRef<HTMLDivElement>(null);

  // Initialize Data
  useEffect(() => {
    if (initialExtensionData) {
        // Mode: Editing an existing extension
        setEntryType('extension');
        setParentId(initialExtensionData.parentId);
        setTitle(initialExtensionData.title);
        setRating(initialExtensionData.rating);
        // Image logic ignored for extensions
        if (initialExtensionData.customColumns && initialExtensionData.customColumns.length > 0) {
            setCustomColumns(initialExtensionData.customColumns);
        } else {
            setCustomColumns([]);
        }
    } else if (initialData) {
      // Mode: Editing an existing game
      setEntryType('game');
      setTitle(initialData.title || '');
      setGameMode(initialData.type === 'team' ? 'team' : 'score');
      setImage(initialData.image || '');
      setRating(initialData.rating);
      setGroups(initialData.groups || []);
      setWinningCondition(initialData.winningCondition || 'highest');
      setDescription(initialData.description || '');
      setOwnershipStatus(initialData.ownershipStatus || null);
      
      // Load score sheet settings
      setScoreType(initialData.scoreType || 'standard');
      
      if (initialData.customColumns && initialData.customColumns.length > 0) {
        setCustomColumns(initialData.customColumns);
      }

      if (initialData.extensions && initialData.extensions.length > 0) {
          setExtensions(initialData.extensions);
      }
    } else {
        // Handling New Creation with Pre-filled props
        if (initialEntryType) {
            setEntryType(initialEntryType);
        }
        if (preSelectedParentId) {
            setParentId(preSelectedParentId);
        }
    }
  }, [initialData, initialExtensionData, initialEntryType, preSelectedParentId]);

  // Pre-fill search query
  useEffect(() => {
      if (showSearchModal && !searchQuery && title) {
          setSearchQuery(title);
      }
  }, [showSearchModal, title]);

  // Close parent dropdown on outside click
  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
          if (parentDropdownRef.current && !parentDropdownRef.current.contains(event.target as Node)) {
              setIsParentDropdownOpen(false);
          }
      };
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // When switching to Extension mode MANUALLY, default customColumns to empty array or simple suggestion
  // Only trigger this if we aren't loading initial data
  useEffect(() => {
      if (!initialExtensionData && !initialData) {
        if (entryType === 'extension' && customColumns.length === 1 && customColumns[0].name === 'Ronde 1') {
            setCustomColumns([]);
        } else if (entryType === 'game' && customColumns.length === 0) {
            setCustomColumns([{ id: 'col_1', name: 'Ronde 1', type: 'input', modifier: 'add' }]);
        }
      }
  }, [entryType, initialExtensionData, initialData]);

  const handleSave = () => {
    if (!title.trim()) {
        setError('Vul een naam in.');
        return;
    }

    if (entryType === 'extension' && !parentId) {
        setError('Kies een basisspel voor deze uitbreiding.');
        return;
    }

    // Validation for duplicates (skip if editing same item)
    if (customValidation && entryType === 'game') {
        const validationError = customValidation(title);
        if (validationError) {
            setError(validationError);
            return;
        }
    }

    // Logic to determine the image
    let finalImage = image.trim();
    
    // If no image provided, generate one based on the title (Only for games)
    if (entryType === 'game' && !finalImage) {
      finalImage = `https://ui-avatars.com/api/?name=${encodeURIComponent(title)}&background=random&size=512&font-size=0.33&length=2&bold=true&color=fff`;
    }

    if (entryType === 'extension' && parentId) {
        // Submit as Extension
        // For extensions, we only save customColumns if they are defined
        onSubmit({}, {
            parentId: parentId,
            title: title.trim(),
            image: '', // Extensions don't have images anymore
            rating: rating,
            customColumns: customColumns.filter(c => c.name.trim() !== '')
        });
    } else {
        // Submit as Game
        const formData: Partial<Game> = {
            title: title.trim(),
            type: gameMode,
            image: finalImage,
            winningCondition,
            rating,
            groups,
            description: description.trim(),
            ownershipStatus,
            scoreType,
            inputMethod: 'numeric', 
            customColumns: scoreType === 'custom' ? customColumns.filter(c => c.name.trim() !== '') : undefined,
            extensions: extensions.filter(e => e.title.trim() !== '')
        };
        onSubmit(formData);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      
      reader.onload = (event) => {
        if (event.target?.result) {
          setImage(event.target.result as string);
        }
      };
      
      reader.readAsDataURL(file);
    }
  };

  // --- Search Integration ---

  const openGoogleImages = () => {
      if (!searchQuery.trim()) return;
      const url = `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(searchQuery + ' board game box')}`;
      window.open(url, '_blank');
  };

  const processUrlToBase64 = async (url: string): Promise<string> => {
      try {
          const response = await fetch(url);
          const blob = await response.blob();
          return await new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(blob);
          });
      } catch (error) {
          console.warn("Could not fetch image for local storage (CORS), using link instead:", error);
          return url;
      }
  };

  const confirmPastedImage = async () => {
      if (pastedUrl.trim()) {
          setIsProcessingImage(true);
          const processedImage = await processUrlToBase64(pastedUrl.trim());
          setImage(processedImage);
          setIsProcessingImage(false);
          setShowSearchModal(false);
          setPastedUrl('');
      }
  };

  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  // --- Groups Logic ---
  const addGroup = (group: string) => {
      const trimmed = group.trim();
      if (trimmed && !groups.includes(trimmed)) {
          setGroups([...groups, trimmed]);
      }
      setGroupInput('');
      setIsGroupSuggestionsOpen(false);
  };

  const removeGroup = (group: string) => {
      setGroups(groups.filter(g => g !== group));
  };

  // Collect unique available groups for suggestions
  const availableGroups = Array.from(new Set(availableGames.flatMap(g => g.groups || [])))
      .filter(g => !groups.includes(g))
      .sort();

  // --- Extensions Logic (Inside Game Mode) ---
  const addExtension = () => {
      setExtensions([...extensions, { id: `ext_${Date.now()}`, title: '' }]);
  };

  const updateExtension = (index: number, field: keyof GameExtension, value: string) => {
      const newExts = [...extensions];
      newExts[index] = { ...newExts[index], [field]: value };
      setExtensions(newExts);
  };

  const removeExtension = (index: number) => {
      setExtensions(extensions.filter((_, i) => i !== index));
  };

  // --- Custom Column Logic ---

  const addColumn = () => {
    const newId = `col_${Date.now()}`;
    setCustomColumns([
      ...customColumns, 
      { 
        id: newId, 
        name: entryType === 'extension' ? 'Extra Score' : `Nieuwe Kolom`, 
        type: 'input', 
        modifier: 'add' 
      }
    ]);
  };

  const updateColumn = (index: number, updates: Partial<ScoreColumn>) => {
    const newCols = [...customColumns];
    newCols[index] = { ...newCols[index], ...updates };
    
    if (updates.type === 'input') {
       newCols[index].formula = undefined;
       if (!newCols[index].modifier) newCols[index].modifier = 'add';
    }
    if (updates.type === 'calculated') {
       newCols[index].modifier = undefined;
       if (!newCols[index].formula) newCols[index].formula = '';
    }

    setCustomColumns(newCols);
  };

  const removeColumn = (index: number) => {
    // For extensions, we allow deleting all columns (empty array is valid)
    // For games, we usually kept at least one, but it's fine to allow 0 if user wants.
    const newCols = customColumns.filter((_, i) => i !== index);
    setCustomColumns(newCols);
  };

  // --- Calculator Logic ---
  const addToFormula = (colIndex: number, value: string) => {
    const col = customColumns[colIndex];
    const currentFormula = col.formula || '';
    updateColumn(colIndex, { formula: currentFormula + value });
  };
  
  const backspaceFormula = (colIndex: number) => {
    const col = customColumns[colIndex];
    const currentFormula = col.formula || '';
    
    if (currentFormula.endsWith('}')) {
        const lastOpen = currentFormula.lastIndexOf('{');
        if (lastOpen !== -1) {
            updateColumn(colIndex, { formula: currentFormula.substring(0, lastOpen) });
            return;
        }
    }
    updateColumn(colIndex, { formula: currentFormula.slice(0, -1) });
  };

  const renderFormulaDisplay = (formula: string) => {
    if (!formula) return <span className="text-gray-400 italic">Maak een berekening...</span>;
    const parts = formula.split(/({[^}]+})/g);
    
    return (
        <span className="font-mono text-sm">
            {parts.map((part, i) => {
                if (part.startsWith('{') && part.endsWith('}')) {
                    const id = part.slice(1, -1);
                    const col = customColumns.find(c => c.id === id);
                    return (
                        <span key={i} className="inline-block bg-primary/10 text-primary border border-primary/20 px-1 rounded mx-0.5 font-sans font-bold text-xs">
                            {col?.name || '???'}
                        </span>
                    );
                }
                return <span key={i}>{part}</span>;
            })}
        </span>
    );
  };

  const selectedParentGame = availableGames.find(g => g.id === parentId);

  return (
    <div className="bg-background-light dark:bg-background-dark font-display antialiased min-h-screen flex flex-col max-w-md mx-auto relative shadow-2xl">
      {/* Top App Bar */}
      <div className="sticky top-0 z-50 flex items-center bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-md p-4 pb-2 justify-between border-b border-gray-200 dark:border-gray-800">
        <button onClick={onCancel} className="text-gray-900 dark:text-white flex size-12 shrink-0 items-center justify-center rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors">
          <span className="material-symbols-outlined text-2xl">close</span>
        </button>
        <h2 className="text-gray-900 dark:text-white text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center">{pageTitle}</h2>
        <div className="w-12"></div>
      </div>
      
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
        
        {/* Toggle Mode (Only show if not editing existing data or explicit extension mode or creating new extension from scratch) */}
        {!initialData && !initialExtensionData && !preSelectedParentId && (
            <div className="flex p-1 bg-surface-light dark:bg-surface-dark rounded-xl border border-gray-200 dark:border-gray-700">
                <button 
                    onClick={() => { setEntryType('game'); setError(''); }}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${entryType === 'game' ? 'bg-primary text-white shadow-sm' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
                >
                    Nieuw Spel
                </button>
                <button 
                    onClick={() => { setEntryType('extension'); setError(''); }}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${entryType === 'extension' ? 'bg-primary text-white shadow-sm' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
                >
                    Nieuwe Uitbreiding
                </button>
            </div>
        )}

        {/* Extension: Parent Game Selector (Only if NOT editing an existing one, or if we want to allow moving it - keeping it fixed for editing is safer) */}
        {entryType === 'extension' && !initialExtensionData && !preSelectedParentId && (
            <div className="animate-slide-down">
                <label className="block text-sm font-bold text-gray-900 dark:text-white mb-2">Hoort bij spel</label>
                <div className="relative" ref={parentDropdownRef}>
                    <button 
                        onClick={() => setIsParentDropdownOpen(!isParentDropdownOpen)}
                        className={`w-full flex items-center justify-between p-3 rounded-xl bg-surface-light dark:bg-surface-dark border transition-all ${isParentDropdownOpen ? 'border-primary ring-2 ring-primary/20' : 'border-gray-200 dark:border-gray-700'}`}
                    >
                        {selectedParentGame ? (
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded bg-cover bg-center bg-gray-200 dark:bg-gray-700" style={{backgroundImage: `url("${selectedParentGame.image}")`}}></div>
                                <span className="font-bold text-sm text-slate-900 dark:text-white">{selectedParentGame.title}</span>
                            </div>
                        ) : (
                            <span className="text-slate-400 text-sm">Selecteer een basisspel...</span>
                        )}
                        <span className="material-symbols-outlined text-slate-400">expand_more</span>
                    </button>

                    {isParentDropdownOpen && (
                        <div className="absolute top-full left-0 w-full mt-2 bg-surface-light dark:bg-surface-dark rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 z-50 max-h-60 overflow-y-auto custom-scrollbar animate-slide-down">
                            {availableGames.length === 0 ? (
                                <div className="p-4 text-center text-slate-400 text-xs">Geen spellen gevonden</div>
                            ) : (
                                availableGames.map(g => (
                                    <button 
                                        key={g.id} 
                                        onClick={() => { setParentId(g.id); setIsParentDropdownOpen(false); }}
                                        className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left border-b border-gray-50 dark:border-gray-800 last:border-0"
                                    >
                                        <div className="w-8 h-8 rounded bg-cover bg-center bg-gray-200 dark:bg-gray-700 shrink-0" style={{backgroundImage: `url("${g.image}")`}}></div>
                                        <span className="text-sm font-medium text-slate-900 dark:text-white truncate">{g.title}</span>
                                        {parentId === g.id && <span className="material-symbols-outlined text-primary text-lg ml-auto">check</span>}
                                    </button>
                                ))
                            )}
                        </div>
                    )}
                </div>
            </div>
        )}

        {/* Image Selection - ONLY FOR GAMES */}
        {entryType === 'game' && (
            <div className="flex flex-col items-center justify-center mb-6 animate-slide-down">
              {/* Hidden File Input */}
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileSelect} 
                accept="image/jpeg, image/png, image/webp" 
                className="hidden" 
              />
              
              <div 
                 onClick={triggerFileUpload}
                 className="w-32 h-32 rounded-2xl bg-surface-light dark:bg-surface-dark border-2 border-dashed border-gray-300 dark:border-gray-700 flex items-center justify-center cursor-pointer hover:border-primary transition-colors group bg-cover bg-center overflow-hidden relative shadow-sm"
                 style={image ? {backgroundImage: `url("${image}")`} : {}}
              >
                {!image && (
                  <div className="flex flex-col items-center gap-1">
                     <span className="material-symbols-outlined text-3xl text-gray-400 group-hover:text-primary transition-colors">add_photo_alternate</span>
                     <span className="text-[10px] text-gray-400 font-medium">Upload</span>
                  </div>
                )}
                {image && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="material-symbols-outlined text-white">edit</span>
                  </div>
                )}
              </div>
              
              <button 
                type="button"
                onClick={() => setShowSearchModal(true)}
                className="mt-3 text-xs font-bold text-primary hover:underline flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-sm">public</span>
                Zoek afbeelding online
              </button>
            </div>
        )}

        {/* Extension Icon Placeholder (Visual Feedback) */}
        {entryType === 'extension' && (
            <div className="flex flex-col items-center justify-center mb-6 animate-slide-down">
                <div className="w-24 h-24 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 flex items-center justify-center">
                    <span className="material-symbols-outlined text-5xl text-indigo-300 dark:text-indigo-400">extension</span>
                </div>
            </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-900 dark:text-white mb-2">
                {entryType === 'extension' ? 'Naam van de uitbreiding' : 'Naam van het spel'}
            </label>
            <input 
              type="text" 
              placeholder={entryType === 'extension' ? "Bijv. Zeevaarders" : "Bijv. 30 Seconds"}
              value={title}
              onChange={(e) => {
                  setTitle(e.target.value);
                  setError('');
              }}
              className={`w-full rounded-xl bg-surface-light dark:bg-surface-dark border focus:ring-2 text-gray-900 dark:text-white py-3 px-4 focus:outline-none placeholder:text-gray-400 transition-colors ${error ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : 'border-gray-200 dark:border-gray-700 focus:ring-primary/50 focus:border-primary'}`}
            />
            {error && (
                <p className="text-red-500 text-xs font-bold mt-2 animate-slide-down">
                    {error}
                </p>
            )}
          </div>

          {/* Rating Section (Visible for both Games & Extensions) */}
          <div className="animate-slide-down">
              <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-bold text-gray-900 dark:text-white">Mijn Waardering</label>
                  {rating !== undefined && (
                      <span className="text-sm font-bold text-amber-500 flex items-center gap-1">
                          <span className="material-symbols-outlined text-lg fill-current">star</span>
                          {rating}
                      </span>
                  )}
              </div>
              <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-gray-200 dark:border-gray-700 p-3">
                  <div className="flex items-center gap-4">
                      <div className="flex-1 relative h-6 flex items-center">
                          <input 
                              type="range" 
                              min="0" 
                              max="100" 
                              step="1"
                              value={rating !== undefined ? rating * 10 : 0}
                              onChange={(e) => {
                                  const val = parseInt(e.target.value);
                                  setRating(val / 10);
                              }}
                              className="w-full accent-primary h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
                          />
                      </div>
                      <input 
                          type="number" 
                          min="0" 
                          max="10" 
                          step="0.1"
                          placeholder="-"
                          value={rating !== undefined ? rating : ''}
                          onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              if (!isNaN(val) && val >= 0 && val <= 10) {
                                  setRating(Math.round(val * 10) / 10);
                              } else if (e.target.value === '') {
                                  setRating(undefined);
                              }
                          }}
                          className="w-16 text-center font-bold text-lg rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-slate-900 dark:text-white p-1.5 focus:ring-2 focus:ring-primary/50"
                      />
                  </div>
                  <div className="flex justify-between text-[10px] font-medium text-gray-400 mt-2 px-1">
                      <span>0</span>
                      <span>5</span>
                      <span>10</span>
                  </div>
              </div>
          </div>
          
          {/* ONLY SHOW REST OF FORM IF NOT EXTENSION MODE */}
          {entryType === 'game' && (
            <div className="space-y-4 animate-slide-down">
                
                {/* Groups / Tags Section */}
                <div>
                    <label className="block text-sm font-bold text-gray-900 dark:text-white mb-2">Groepen</label>
                    <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-gray-200 dark:border-gray-700 p-3">
                        <div className="flex flex-wrap gap-2 mb-3">
                            {groups.map((group) => (
                                <span key={group} className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-lg text-xs font-bold border border-indigo-100 dark:border-indigo-800">
                                    {group}
                                    <button onClick={() => removeGroup(group)} className="hover:text-indigo-900 dark:hover:text-white">
                                        <span className="material-symbols-outlined text-[14px]">close</span>
                                    </button>
                                </span>
                            ))}
                            {groups.length === 0 && <span className="text-xs text-gray-400 italic py-1">Geen groepen geselecteerd</span>}
                        </div>
                        
                        <div className="relative">
                            <div className="flex gap-2">
                                <input 
                                    type="text" 
                                    value={groupInput}
                                    onChange={(e) => {
                                        setGroupInput(e.target.value);
                                        setIsGroupSuggestionsOpen(true);
                                    }}
                                    onFocus={() => setIsGroupSuggestionsOpen(true)}
                                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addGroup(groupInput))}
                                    placeholder="Nieuwe groep toevoegen..."
                                    className="flex-1 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-sm py-2 px-3 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                />
                                <button 
                                    type="button"
                                    onClick={() => addGroup(groupInput)}
                                    disabled={!groupInput.trim()}
                                    className="px-3 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    <span className="material-symbols-outlined text-lg">add</span>
                                </button>
                            </div>

                            {/* Group Suggestions Dropdown */}
                            {isGroupSuggestionsOpen && (groupInput || availableGroups.length > 0) && (
                                <div className="absolute top-full left-0 w-full mt-2 bg-surface-light dark:bg-surface-dark rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-10 max-h-40 overflow-y-auto custom-scrollbar">
                                    {availableGroups
                                        .filter(g => g.toLowerCase().includes(groupInput.toLowerCase()))
                                        .map(g => (
                                        <button
                                            key={g}
                                            type="button"
                                            onClick={() => addGroup(g)}
                                            className="w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center justify-between"
                                        >
                                            {g}
                                            <span className="material-symbols-outlined text-xs text-gray-400">add</span>
                                        </button>
                                    ))}
                                    {groupInput && !availableGroups.some(g => g.toLowerCase() === groupInput.toLowerCase()) && (
                                        <div className="px-3 py-2 text-xs text-gray-400 italic">
                                            Druk op + om "{groupInput}" toe te voegen
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Ownership Status */}
                <div>
                    <label className="block text-sm font-bold text-gray-900 dark:text-white mb-2">Status</label>
                    <div className="flex bg-surface-light dark:bg-surface-dark rounded-xl border border-gray-200 dark:border-gray-700 p-1">
                        <button
                            type="button" 
                            onClick={() => setOwnershipStatus('owned')}
                            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 ${ownershipStatus === 'owned' ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
                        >
                            <span className="material-symbols-outlined text-[16px]">check_circle</span>
                            In bezit
                        </button>
                        <button
                            type="button" 
                            onClick={() => setOwnershipStatus('wishlist')}
                            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 ${ownershipStatus === 'wishlist' ? 'bg-purple-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
                        >
                            <span className="material-symbols-outlined text-[16px]">card_giftcard</span>
                            Verlanglijst
                        </button>
                        <button
                            type="button" 
                            onClick={() => setOwnershipStatus(null)}
                            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${ownershipStatus === null ? 'bg-white dark:bg-gray-600 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
                        >
                            Geen
                        </button>
                    </div>
                </div>
                
                <div>
                    <label className="block text-sm font-bold text-gray-900 dark:text-white mb-2">Spelmodus</label>
                    <div className="grid grid-cols-2 gap-3 mb-4">
                    <button 
                        onClick={() => setGameMode('score')}
                        className={`flex items-center justify-center gap-2 p-3 rounded-xl border transition-all ${gameMode === 'score' ? 'bg-primary text-white border-primary shadow-md shadow-primary/20' : 'bg-surface-light dark:bg-surface-dark border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                    >
                        <span className="material-symbols-outlined text-xl">person</span>
                        Ieder voor zich
                    </button>
                    <button 
                        onClick={() => setGameMode('team')}
                        className={`flex items-center justify-center gap-2 p-3 rounded-xl border transition-all ${gameMode === 'team' ? 'bg-primary text-white border-primary shadow-md shadow-primary/20' : 'bg-surface-light dark:bg-surface-dark border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                    >
                        <span className="material-symbols-outlined text-xl">groups</span>
                        Teams
                    </button>
                    </div>

                    <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-4">
                    <div>
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 block">Spelregels</label>
                        <div className="flex p-1 bg-background-light dark:bg-background-dark rounded-lg">
                        <button 
                            onClick={() => setWinningCondition('highest')}
                            className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${winningCondition === 'highest' ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                        >
                            Hoogste wint
                        </button>
                        <button 
                            onClick={() => setWinningCondition('lowest')}
                            className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${winningCondition === 'lowest' ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                        >
                            Laagste wint
                        </button>
                        </div>
                    </div>

                    {/* Score Sheet Selection */}
                    <div>
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 block">Scoreblad</label>
                        <div className="flex gap-4 mb-4">
                            <button 
                            onClick={() => setScoreType('standard')}
                            className={`flex-1 flex flex-col items-center justify-center gap-1 p-3 rounded-xl border-2 transition-all ${scoreType === 'standard' ? 'border-primary bg-primary/5 text-primary' : 'border-gray-200 dark:border-gray-700 bg-transparent text-gray-500 hover:border-gray-300 dark:hover:border-gray-600'}`}
                            >
                                <span className="material-symbols-outlined">table_chart</span>
                                <span className="text-sm font-bold">Standaard</span>
                            </button>
                            <button 
                            onClick={() => setScoreType('custom')}
                            className={`flex-1 flex flex-col items-center justify-center gap-1 p-3 rounded-xl border-2 transition-all ${scoreType === 'custom' ? 'border-primary bg-primary/5 text-primary' : 'border-gray-200 dark:border-gray-700 bg-transparent text-gray-500 hover:border-gray-300 dark:hover:border-gray-600'}`}
                            >
                                <span className="material-symbols-outlined">edit_note</span>
                                <span className="text-sm font-bold">Zelf maken</span>
                            </button>
                        </div>
                    </div>
                    </div>
                    </div>

                    <div>
                    <label className="block text-sm font-bold text-gray-900 dark:text-white mb-2">Uitbreidingen (Optioneel)</label>
                    <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
                        {extensions.map((ext, idx) => (
                            <div key={ext.id} className="flex items-center gap-2">
                                <input 
                                    type="text" 
                                    value={ext.title}
                                    onChange={(e) => updateExtension(idx, 'title', e.target.value)}
                                    placeholder="Naam van uitbreiding"
                                    className="flex-1 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-2 text-sm font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/50"
                                />
                                <button 
                                    onClick={() => removeExtension(idx)}
                                    className="size-9 flex items-center justify-center rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 transition-colors"
                                >
                                    <span className="material-symbols-outlined text-[18px]">delete</span>
                                </button>
                            </div>
                        ))}
                        <button 
                            onClick={addExtension}
                            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-primary hover:text-primary hover:bg-primary/5 transition-all text-xs font-bold uppercase tracking-wide"
                        >
                            <span className="material-symbols-outlined text-[16px]">add</span>
                            Uitbreiding Toevoegen
                        </button>
                    </div>
                    </div>

                    <div>
                    <label className="block text-sm font-bold text-gray-900 dark:text-white mb-2">Omschrijving (optioneel)</label>
                    <textarea 
                        rows={3} 
                        placeholder="Korte notitie over het spel..." 
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="w-full rounded-xl bg-surface-light dark:bg-surface-dark border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-primary/50 focus:border-primary text-gray-900 dark:text-white py-3 px-4 resize-none focus:outline-none placeholder:text-gray-400"
                    ></textarea>
                    </div>
            </div>
          )}

          {/* COLUMN CONFIGURATION - SHARED logic for Game (scoreType=custom) and Extension */}
          {( (entryType === 'game' && scoreType === 'custom') || entryType === 'extension' ) && (
                <div className="animate-slide-down space-y-4">
                    <div className="flex justify-between items-center">
                        <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                            {entryType === 'extension' ? 'Extra Score Kolommen (Optioneel)' : 'Kolommen configureren:'}
                        </label>
                    </div>
                    
                    <div className="space-y-4">
                        {customColumns.map((col, idx) => (
                            <div key={col.id} className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 relative">
                                {/* Column Header & Actions */}
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="size-6 flex items-center justify-center rounded-full bg-slate-200 dark:bg-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300">
                                        {idx + 1}
                                    </div>
                                    <input 
                                        type="text" 
                                        value={col.name}
                                        onChange={(e) => updateColumn(idx, { name: e.target.value })}
                                        placeholder={`Naam (bijv. Bonus)`}
                                        className="flex-1 rounded-lg bg-white dark:bg-surface-dark border border-gray-200 dark:border-gray-700 p-1.5 text-sm font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/50"
                                    />
                                    <button 
                                        onClick={() => removeColumn(idx)}
                                        className="size-8 flex items-center justify-center rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 transition-colors"
                                    >
                                        <span className="material-symbols-outlined text-[18px]">delete</span>
                                    </button>
                                </div>

                                {/* Column Type Selector */}
                                <div className="flex p-1 bg-white dark:bg-surface-dark rounded-lg border border-gray-200 dark:border-gray-700 mb-3">
                                    <button 
                                        onClick={() => updateColumn(idx, { type: 'input' })}
                                        className={`flex-1 py-1.5 text-xs font-bold rounded transition-all ${col.type === 'input' ? 'bg-primary text-white' : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'}`}
                                    >
                                        Invoer
                                    </button>
                                    <button 
                                        onClick={() => updateColumn(idx, { type: 'calculated' })}
                                        className={`flex-1 py-1.5 text-xs font-bold rounded transition-all ${col.type === 'calculated' ? 'bg-primary text-white' : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'}`}
                                    >
                                        Berekening
                                    </button>
                                </div>

                                {/* Specific Settings based on Type */}
                                {col.type === 'input' && (
                                    <div className="flex items-center gap-2 animate-slide-down">
                                        <span className="text-xs text-gray-500">Punten tellen:</span>
                                        <div className="flex gap-2 flex-1">
                                            <button 
                                                onClick={() => updateColumn(idx, { modifier: 'add' })}
                                                className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg border text-xs font-bold transition-colors ${col.modifier === 'add' ? 'bg-emerald-500/10 border-emerald-500 text-emerald-600 dark:text-emerald-400' : 'border-gray-200 dark:border-gray-700 text-gray-500'}`}
                                            >
                                                <span className="material-symbols-outlined text-[14px]">add</span>
                                                Positief
                                            </button>
                                            <button 
                                                onClick={() => updateColumn(idx, { modifier: 'subtract' })}
                                                className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg border text-xs font-bold transition-colors ${col.modifier === 'subtract' ? 'bg-red-500/10 border-red-500 text-red-600 dark:text-red-400' : 'border-gray-200 dark:border-gray-700 text-gray-500'}`}
                                            >
                                                <span className="material-symbols-outlined text-[14px]">remove</span>
                                                Negatief
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {col.type === 'calculated' && (
                                    <div className="space-y-3 animate-slide-down">
                                        {/* Calculator Display */}
                                        <div className="w-full bg-white dark:bg-surface-dark border border-gray-300 dark:border-gray-600 rounded-lg p-3 min-h-[40px] flex items-center text-sm break-all font-mono shadow-inner">
                                            {renderFormulaDisplay(col.formula || '')}
                                        </div>

                                        <div className="text-xs text-gray-500 font-medium uppercase mt-2">Variabelen (Kolommen)</div>
                                        <div className="flex flex-wrap gap-2">
                                            {customColumns.map((sourceCol) => {
                                                if (sourceCol.id === col.id) return null; // Avoid circular
                                                return (
                                                    <button
                                                        key={sourceCol.id}
                                                        onClick={() => addToFormula(idx, `{${sourceCol.id}}`)}
                                                        className="px-2 py-1.5 rounded-lg text-xs font-bold bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 transition-colors"
                                                    >
                                                        {sourceCol.name || 'Kolom'}
                                                    </button>
                                                );
                                            })}
                                            {customColumns.length <= 1 && <span className="text-xs text-gray-400 italic">Geen andere kolommen</span>}
                                        </div>

                                        <div className="text-xs text-gray-500 font-medium uppercase mt-2">Rekenmachine</div>
                                        <div className="grid grid-cols-4 gap-2">
                                            {['7','8','9','/'].map(k => (
                                                <button key={k} onClick={() => addToFormula(idx, k)} className="h-8 rounded-md bg-white dark:bg-surface-dark border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 font-bold text-sm text-gray-700 dark:text-gray-200">{k}</button>
                                            ))}
                                            {['4','5','6','*'].map(k => (
                                                <button key={k} onClick={() => addToFormula(idx, k)} className="h-8 rounded-md bg-white dark:bg-surface-dark border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 font-bold text-sm text-gray-700 dark:text-gray-200">{k}</button>
                                            ))}
                                            {['1','2','3','-'].map(k => (
                                                <button key={k} onClick={() => addToFormula(idx, k)} className="h-8 rounded-md bg-white dark:bg-surface-dark border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 font-bold text-sm text-gray-700 dark:text-gray-200">{k}</button>
                                            ))}
                                            <button onClick={() => addToFormula(idx, '0')} className="h-8 rounded-md bg-white dark:bg-surface-dark border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 font-bold text-sm text-gray-700 dark:text-gray-200">0</button>
                                            <button onClick={() => addToFormula(idx, '(')} className="h-8 rounded-md bg-white dark:bg-surface-dark border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 font-bold text-sm text-gray-700 dark:text-gray-200">(</button>
                                            <button onClick={() => addToFormula(idx, ')')} className="h-8 rounded-md bg-white dark:bg-surface-dark border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 font-bold text-sm text-gray-700 dark:text-gray-200">)</button>
                                            <button onClick={() => addToFormula(idx, '+')} className="h-8 rounded-md bg-white dark:bg-surface-dark border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 font-bold text-sm text-gray-700 dark:text-gray-200">+</button>
                                            
                                            <button onClick={() => backspaceFormula(idx)} className="col-span-4 h-8 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-400 font-bold text-sm flex items-center justify-center gap-1 hover:bg-red-100 dark:hover:bg-red-900/30">
                                                <span className="material-symbols-outlined text-sm">backspace</span> Wis
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                    
                    <button 
                        onClick={addColumn}
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-primary hover:text-primary hover:bg-primary/5 transition-all text-sm font-bold"
                    >
                        <span className="material-symbols-outlined text-[20px]">add</span>
                        Kolom Toevoegen
                    </button>
                </div>
          )}
        </div>
      </div>

      <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-background-light dark:bg-background-dark">
        <button onClick={handleSave} className="w-full bg-primary hover:bg-primary/90 text-white font-bold text-lg py-4 rounded-xl shadow-lg shadow-primary/30 transition-all active:scale-[0.98]">
          {buttonLabel}
        </button>
      </div>

      {/* Search Modal */}
      {showSearchModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-surface-light dark:bg-surface-dark w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-gray-100 dark:border-gray-700 animate-slide-down flex flex-col max-h-[85vh]">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Afbeelding Zoeken</h3>
                    <button type="button" onClick={() => setShowSearchModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>
                
                <div className="space-y-6">
                    {/* Step 1: Search */}
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <span className="size-6 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center text-xs font-bold">1</span>
                            <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Zoek op Google</label>
                        </div>
                        <input 
                            type="text" 
                            value={searchQuery} 
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Naam van het spel..."
                            className="w-full mb-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm p-3"
                        />
                        <button 
                            onClick={openGoogleImages}
                            className="w-full flex items-center justify-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-bold rounded-xl border border-blue-100 dark:border-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                        >
                            <span className="material-symbols-outlined text-lg">public</span>
                            Open Google Afbeeldingen
                        </button>
                    </div>

                    <div className="h-px bg-gray-100 dark:bg-gray-800"></div>

                    {/* Step 2: Paste */}
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <span className="size-6 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center text-xs font-bold">2</span>
                            <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Plak Link</label>
                        </div>
                        <p className="text-xs text-slate-500 mb-2 pl-8">
                            Kopieer het adres van de afbeelding (rechtermuisknop) en plak het hieronder.
                        </p>
                        <div className="flex items-center bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-1">
                            <span className="material-symbols-outlined text-gray-400">link</span>
                            <input 
                                type="text" 
                                value={pastedUrl}
                                onChange={(e) => setPastedUrl(e.target.value)}
                                placeholder="https://..."
                                className="w-full bg-transparent border-none focus:ring-0 text-sm text-slate-900 dark:text-white p-2"
                            />
                        </div>
                    </div>

                    {/* Preview */}
                    {pastedUrl && (
                        <div className="animate-slide-down">
                            <div className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 text-center">Voorbeeld</div>
                            <div className="h-32 rounded-xl bg-gray-100 dark:bg-gray-800 bg-contain bg-center bg-no-repeat border-2 border-dashed border-gray-200 dark:border-gray-700" style={{backgroundImage: `url("${pastedUrl}")`}}></div>
                            
                            <button 
                                onClick={confirmPastedImage}
                                disabled={isProcessingImage}
                                className="w-full mt-4 py-3 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/30 hover:bg-primary/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {isProcessingImage ? (
                                    <>
                                        <span className="material-symbols-outlined animate-spin">refresh</span>
                                        Afbeelding downloaden...
                                    </>
                                ) : (
                                    'Gebruik deze afbeelding'
                                )}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default GameForm;
