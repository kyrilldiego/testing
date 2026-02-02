
import React, { useState, useMemo } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { useGames } from '../context/GameContext';

const { Link, useNavigate } = ReactRouterDOM as any;

const Settings: React.FC = () => {
  const { 
    currentUser, 
    updateUserName,
    theme, 
    toggleTheme,
    autoStartTimer,
    toggleAutoStartTimer,
    defaultPlayerImageMode,
    setDefaultPlayerImageMode,
    players,
    defaultPlayerIds,
    setDefaultPlayerIds
  } = useGames();
  const navigate = useNavigate();
  
  // Name Editing State
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState('');

  const handleStartEditName = () => {
      setEditName(currentUser.name);
      setIsEditingName(true);
  };

  const handleSaveName = () => {
      if (editName.trim()) {
          updateUserName(currentUser.id, editName.trim());
      }
      setIsEditingName(false);
  };

  const handleBack = () => {
    navigate('/');
  };

  // Identify the current user's player object
  const myPlayer = useMemo(() => players.find(p => p.linkedUserId === currentUser.id), [players, currentUser.id]);

  // Toggle player default selection
  const toggleDefaultPlayer = (playerId: string) => {
      // Prevent deselecting yourself
      if (myPlayer && playerId === myPlayer.id) return;

      setDefaultPlayerIds(
          defaultPlayerIds.includes(playerId)
            ? defaultPlayerIds.filter(id => id !== playerId)
            : [...defaultPlayerIds, playerId]
      );
  };

  // Sorted players for the list
  const sortedPlayers = useMemo(() => {
      return [...players].sort((a, b) => a.name.localeCompare(b.name));
  }, [players]);

  return (
    <div className="bg-background-light dark:bg-background-dark font-display antialiased min-h-screen flex flex-col max-w-md mx-auto relative shadow-2xl text-slate-900 dark:text-white">
      {/* Top App Bar */}
      <div className="sticky top-0 z-50 flex items-center bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-md p-4 pb-2 justify-between border-b border-gray-200 dark:border-gray-800">
        <button onClick={handleBack} className="text-gray-900 dark:text-white flex size-12 shrink-0 items-center justify-center rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors">
          <span className="material-symbols-outlined text-2xl">arrow_back</span>
        </button>
        <h2 className="text-gray-900 dark:text-white text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center">Instellingen</h2>
        <div className="w-12"></div>
      </div>
      
      <div className="p-4 space-y-6">
        {/* Account Section */}
        <section>
          <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 px-2">Jouw Profiel</h3>
          <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden p-4">
            <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-cover bg-center bg-gray-100 dark:bg-gray-800 border-2 border-white dark:border-gray-600 shadow-sm" style={{backgroundImage: `url("${currentUser.image}")`}}></div>
                
                <div className="flex-1 min-w-0">
                    {isEditingName ? (
                        <div className="flex items-center gap-2 animate-fade-in">
                            <input 
                                type="text" 
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                autoFocus
                                className="w-full bg-gray-50 dark:bg-gray-800 border border-primary rounded-lg px-2 py-1 text-sm font-bold focus:outline-none"
                                onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                            />
                            <button onClick={handleSaveName} className="p-1 bg-primary text-white rounded-md">
                                <span className="material-symbols-outlined text-lg">check</span>
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 group cursor-pointer" onClick={handleStartEditName}>
                            <h3 className="font-bold text-lg text-slate-900 dark:text-white truncate">{currentUser.name}</h3>
                            <span className="material-symbols-outlined text-slate-400 text-sm group-hover:text-primary transition-colors">edit</span>
                        </div>
                    )}
                    <Link to="/profile" className="text-xs text-primary font-bold hover:underline mt-1 inline-block">
                        Bekijk volledig profiel
                    </Link>
                </div>
            </div>
          </div>
        </section>

        {/* Game Preferences */}
        <section>
          <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 px-2">Spelvoorkeuren</h3>
          <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden divide-y divide-gray-200 dark:divide-gray-700">
            {/* Auto Start Timer */}
            <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50" onClick={toggleAutoStartTimer}>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-lg">
                    <span className="material-symbols-outlined text-lg">timer</span>
                </div>
                <div className="flex flex-col">
                    <span className="font-bold text-sm">Timer automatisch starten</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">Bij kiezen startspeler</span>
                </div>
              </div>
              <div className="relative inline-block w-12 mr-2 align-middle select-none transition duration-200 ease-in pointer-events-none">
                <input 
                    type="checkbox" 
                    checked={autoStartTimer} 
                    onChange={toggleAutoStartTimer}
                    className={`toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer transition-transform duration-200 ease-in ${autoStartTimer ? 'translate-x-6 border-primary' : 'translate-x-0 border-gray-300'}`}
                />
                <label 
                    className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer transition-colors duration-200 ease-in ${autoStartTimer ? 'bg-primary' : 'bg-gray-300'}`}
                ></label>
              </div>
            </div>

            {/* Default Avatar Mode */}
            <div className="p-4">
                <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-lg">
                        <span className="material-symbols-outlined text-lg">face</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="font-bold text-sm">Nieuwe speler standaard</span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">Starttabblad bij aanmaken</span>
                    </div>
                </div>
                <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
                    {['avatar', 'builder', 'initials', 'custom'].map((mode) => (
                        <button
                            key={mode}
                            onClick={() => setDefaultPlayerImageMode(mode as any)}
                            className={`flex-1 py-2 text-[10px] font-bold rounded-md transition-all uppercase ${defaultPlayerImageMode === mode ? 'bg-white dark:bg-gray-600 shadow text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                        >
                            {mode === 'avatar' ? 'Pop' : mode === 'builder' ? 'Maak' : mode === 'initials' ? 'ABC' : 'Upld'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Default Players Selection */}
            <div className="p-4">
                <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg">
                        <span className="material-symbols-outlined text-lg">group_add</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="font-bold text-sm">Standaard Spelers</span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">Automatisch geselecteerd bij nieuw potje</span>
                    </div>
                </div>
                
                <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                    {sortedPlayers.map(player => {
                        const isMe = myPlayer && player.id === myPlayer.id;
                        const isSelected = isMe || defaultPlayerIds.includes(player.id);
                        
                        return (
                            <button
                                key={player.id}
                                onClick={() => toggleDefaultPlayer(player.id)}
                                className={`relative shrink-0 flex flex-col items-center gap-1 w-14 group ${isMe ? 'cursor-default' : 'cursor-pointer'}`}
                            >
                                <div className={`relative w-10 h-10 rounded-full border-2 transition-all ${isSelected ? 'border-primary' : 'border-transparent grayscale opacity-50 group-hover:opacity-80'}`}>
                                    <img 
                                        src={player.image} 
                                        alt={player.name} 
                                        className="w-full h-full rounded-full object-cover bg-gray-100 dark:bg-gray-800"
                                    />
                                    {isSelected && (
                                        <div className={`absolute -top-1 -right-1 text-white rounded-full p-0.5 border border-white dark:border-surface-dark shadow-sm ${isMe ? 'bg-gray-400' : 'bg-primary'}`}>
                                            <span className="material-symbols-outlined text-[8px] font-bold block">{isMe ? 'lock' : 'check'}</span>
                                        </div>
                                    )}
                                </div>
                                <span className={`text-[9px] font-bold truncate w-full text-center ${isSelected ? 'text-primary' : 'text-slate-400'}`}>
                                    {player.name}
                                </span>
                            </button>
                        );
                    })}
                    {players.length === 0 && (
                        <span className="text-xs text-slate-400 italic">Geen spelers beschikbaar.</span>
                    )}
                </div>
                {defaultPlayerIds.length === 0 && (
                    <p className="text-[10px] text-slate-400 mt-1 italic">
                        Jij wordt altijd automatisch toegevoegd. Selecteer anderen om ook toe te voegen.
                    </p>
                )}
            </div>
          </div>
        </section>

        {/* Data & Import */}
        <section>
          <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 px-2">Data</h3>
          <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <button 
                onClick={() => navigate('/import')}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-orange-500">upload_file</span>
                <div className="flex flex-col">
                    <span className="font-medium text-slate-900 dark:text-white">Potjes Importeren</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">Importeer data van een vriend</span>
                </div>
              </div>
              <span className="material-symbols-outlined text-gray-400">chevron_right</span>
            </button>
          </div>
        </section>

        {/* General Settings */}
        <section>
          <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 px-2">Algemeen</h3>
          <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden divide-y divide-gray-200 dark:divide-gray-700">
            <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50" onClick={toggleTheme}>
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-gray-500">dark_mode</span>
                <span className="font-medium">Donkere modus</span>
              </div>
              <div className="relative inline-block w-12 mr-2 align-middle select-none transition duration-200 ease-in pointer-events-none">
                <input 
                    type="checkbox" 
                    checked={theme === 'dark'} 
                    onChange={toggleTheme}
                    className={`toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer transition-transform duration-200 ease-in ${theme === 'dark' ? 'translate-x-6 border-primary' : 'translate-x-0 border-gray-300'}`}
                />
                <label 
                    className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer transition-colors duration-200 ease-in ${theme === 'dark' ? 'bg-primary' : 'bg-gray-300'}`}
                ></label>
              </div>
            </div>
          </div>
        </section>
         
         <div className="text-center text-xs text-gray-400 mt-6 pb-6">
            Versie 1.5.0
         </div>
      </div>
    </div>
  );
};

export default Settings;
