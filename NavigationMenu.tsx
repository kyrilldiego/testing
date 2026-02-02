
import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const NavigationMenu: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const handleNavigation = (path: string) => {
    setIsOpen(false);
    navigate(path);
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="relative z-50">
      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm transition-opacity"
          onClick={() => setIsOpen(false)}
        ></div>
      )}

      {/* Toggle Button */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-slate-900 dark:text-white relative z-50"
      >
        <span className="material-symbols-outlined text-2xl">{isOpen ? 'close' : 'menu'}</span>
      </button>
      
      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-64 bg-surface-light dark:bg-surface-dark rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-700 overflow-hidden ring-1 ring-black/5 animate-slide-down origin-top z-50">
          <div className="p-2 space-y-1">
            <button 
                onClick={() => handleNavigation('/')} 
                className={`w-full flex items-center gap-3 px-4 py-3 text-left rounded-xl transition-all group ${isActive('/') ? 'bg-primary/5 text-primary dark:bg-primary/10' : 'hover:bg-primary/5 hover:text-primary dark:hover:bg-primary/10'}`}
            >
              <span className={`material-symbols-outlined text-[20px] ${isActive('/') ? 'text-primary' : 'text-slate-500 dark:text-slate-400 group-hover:text-primary'}`}>grid_view</span>
              <span className="text-sm font-bold">Alle Spellen</span>
            </button>

            <button 
                onClick={() => handleNavigation('/statistics')} 
                className={`w-full flex items-center gap-3 px-4 py-3 text-left rounded-xl transition-all group ${isActive('/statistics') ? 'bg-primary/5 text-primary dark:bg-primary/10' : 'hover:bg-primary/5 hover:text-primary dark:hover:bg-primary/10'}`}
            >
              <span className={`material-symbols-outlined text-[20px] ${isActive('/statistics') ? 'text-primary' : 'text-slate-500 dark:text-slate-400 group-hover:text-primary'}`}>monitoring</span>
              <span className="text-sm font-bold">Statistieken</span>
            </button>

            <button 
                onClick={() => handleNavigation('/players')} 
                className={`w-full flex items-center gap-3 px-4 py-3 text-left rounded-xl transition-all group ${isActive('/players') ? 'bg-primary/5 text-primary dark:bg-primary/10' : 'hover:bg-primary/5 hover:text-primary dark:hover:bg-primary/10'}`}
            >
              <span className={`material-symbols-outlined text-[20px] ${isActive('/players') ? 'text-primary' : 'text-slate-500 dark:text-slate-400 group-hover:text-primary'}`}>group</span>
              <span className="text-sm font-bold">Spelers</span>
            </button>

            <button 
                onClick={() => handleNavigation('/matches')} 
                className={`w-full flex items-center gap-3 px-4 py-3 text-left rounded-xl transition-all group ${isActive('/matches') ? 'bg-primary/5 text-primary dark:bg-primary/10' : 'hover:bg-primary/5 hover:text-primary dark:hover:bg-primary/10'}`}
            >
              <span className={`material-symbols-outlined text-[20px] ${isActive('/matches') ? 'text-primary' : 'text-slate-500 dark:text-slate-400 group-hover:text-primary'}`}>history</span>
              <span className="text-sm font-bold">Potjes</span>
            </button>

            <button 
                onClick={() => handleNavigation('/profile')} 
                className={`w-full flex items-center gap-3 px-4 py-3 text-left rounded-xl transition-all group ${isActive('/profile') ? 'bg-primary/5 text-primary dark:bg-primary/10' : 'hover:bg-primary/5 hover:text-primary dark:hover:bg-primary/10'}`}
            >
              <span className={`material-symbols-outlined text-[20px] ${isActive('/profile') ? 'text-primary' : 'text-slate-500 dark:text-slate-400 group-hover:text-primary'}`}>person</span>
              <span className="text-sm font-bold">Speler Stats</span>
            </button>

            <button 
                onClick={() => handleNavigation('/new-round')} 
                className={`w-full flex items-center gap-3 px-4 py-3 text-left rounded-xl transition-all group ${isActive('/new-round') ? 'bg-primary/5 text-primary dark:bg-primary/10' : 'hover:bg-primary/5 hover:text-primary dark:hover:bg-primary/10'}`}
            >
              <span className={`material-symbols-outlined text-[20px] ${isActive('/new-round') ? 'text-primary' : 'text-slate-500 dark:text-slate-400 group-hover:text-primary'}`}>add_circle</span>
              <span className="text-sm font-bold">Potje Toevoegen</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NavigationMenu;
