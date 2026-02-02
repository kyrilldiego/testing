
import React, { useState, useEffect, useRef } from 'react';
import { useGames } from '../context/GameContext';

interface LocationSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

const LocationSelector: React.FC<LocationSelectorProps> = ({ value, onChange }) => {
  const { locations } = useGames();
  const [isOpen, setIsOpen] = useState(false);
  const [filteredLocations, setFilteredLocations] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!value.trim()) {
      setFilteredLocations(locations);
    } else {
      const lower = value.toLowerCase();
      setFilteredLocations(locations.filter(loc => loc.toLowerCase().includes(lower)));
    }
  }, [locations, value]);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (loc: string) => {
    onChange(loc);
    setIsOpen(false);
  };

  const isExactMatch = locations.some(l => l.toLowerCase() === value.trim().toLowerCase());

  return (
    <div className="relative" ref={containerRef}>
        <div className="flex items-center bg-surface-light dark:bg-surface-dark rounded-xl border border-gray-200 dark:border-gray-700 px-3 transition-colors focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary">
            <span className="material-symbols-outlined text-gray-400 mr-2">place</span>
            <input 
                type="text" 
                value={value}
                onChange={(e) => {
                    onChange(e.target.value);
                    if (!isOpen) setIsOpen(true);
                }}
                onFocus={() => setIsOpen(true)}
                placeholder="Bijv. Thuis, Kantine..."
                className="w-full bg-transparent border-none focus:ring-0 text-slate-900 dark:text-white py-3 font-medium placeholder:text-gray-400"
            />
            {isOpen ? (
                <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                    <span className="material-symbols-outlined text-lg">expand_less</span>
                </button>
            ) : (
                <button onClick={() => setIsOpen(true)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                    <span className="material-symbols-outlined text-lg">expand_more</span>
                </button>
            )}
        </div>

        {isOpen && (
            <div className="absolute top-full left-0 w-full mt-2 bg-surface-light dark:bg-surface-dark rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 z-50 max-h-56 overflow-y-auto custom-scrollbar animate-slide-down">
                {value && !isExactMatch && (
                    <button 
                        onClick={() => handleSelect(value)}
                        className="w-full text-left px-4 py-3 flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-primary font-bold border-b border-gray-100 dark:border-gray-800"
                    >
                        <span className="material-symbols-outlined text-lg">add</span>
                        <span>Gebruik "{value}"</span>
                    </button>
                )}
                
                {filteredLocations.map(loc => (
                    <button
                        key={loc}
                        onClick={() => handleSelect(loc)}
                        className={`w-full text-left px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${loc === value ? 'bg-primary/5 text-primary' : 'text-slate-900 dark:text-white'}`}
                    >
                        <span className="font-medium">{loc}</span>
                        {loc === value && <span className="material-symbols-outlined text-sm">check</span>}
                    </button>
                ))}

                {filteredLocations.length === 0 && !value && (
                    <div className="px-4 py-3 text-slate-400 text-sm text-center italic">
                        Geen locaties gevonden
                    </div>
                )}
            </div>
        )}
    </div>
  );
};

export default LocationSelector;
