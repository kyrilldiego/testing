
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGames } from '../context/GameContext';

// --- CONSTANTS FOR BUILDER ---
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

const Login: React.FC = () => {
  const { registerUser } = useGames();
  const navigate = useNavigate();
  
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Builder State
  const [builderConfig, setBuilderConfig] = useState({
    hair: 0, 
    hairColor: 0,
    expression: 0,
    skin: 0,
    accessory: 0
  });

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

  const getBuilderUrl = () => {
      const baseSeed = name.trim() || 'base'; 
      
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    setIsLoading(true);

    const finalImage = getBuilderUrl();

    setTimeout(() => {
        registerUser(name.trim(), finalImage);
        navigate('/');
    }, 600);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#101622] text-white bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-[#101622] to-[#101622]">
      <div className="w-full max-w-sm animate-fade-in flex flex-col items-center max-h-screen overflow-y-auto no-scrollbar py-4">
        
        <div className="text-center mb-6 shrink-0">
            <h1 className="text-3xl font-black tracking-tight text-white mb-2">Wie ben jij?</h1>
            <p className="text-slate-400 font-medium text-sm">Stel je profiel in om te beginnen.</p>
        </div>

        <div className="relative w-36 h-36 mb-6 shrink-0">
            <div className="w-36 h-36 rounded-full bg-surface-dark border-4 border-slate-700 shadow-2xl overflow-hidden flex items-center justify-center ring-4 ring-primary/20">
                <img 
                    src={getBuilderUrl()} 
                    alt="Preview" 
                    className="w-full h-full object-cover"
                />
            </div>
        </div>

        <form onSubmit={handleSubmit} className="w-full space-y-6">
            
            <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <span className="material-symbols-outlined text-slate-500 group-focus-within:text-primary transition-colors text-xl">badge</span>
                </div>
                <input 
                    type="text" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Jouw Naam"
                    autoFocus
                    className="w-full bg-surface-dark/50 backdrop-blur-md border border-slate-700 rounded-2xl py-3 pl-12 pr-4 text-white placeholder:text-slate-600 focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all outline-none text-lg font-bold text-center shadow-lg"
                />
            </div>

            <div className="space-y-3 bg-surface-dark/30 p-4 rounded-2xl border border-white/5">
                
                <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400 w-16">Haarstijl</span>
                    <div className="flex items-center gap-2 flex-1 justify-end">
                        <button type="button" onClick={() => cycleOption('hair', 'prev')} className="size-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 active:scale-95 transition-all"><span className="material-symbols-outlined text-lg">chevron_left</span></button>
                        <span className="text-xs font-mono font-bold text-slate-500 w-12 text-center">{builderConfig.hair + 1}/{HAIR_STYLES.length}</span>
                        <button type="button" onClick={() => cycleOption('hair', 'next')} className="size-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 active:scale-95 transition-all"><span className="material-symbols-outlined text-lg">chevron_right</span></button>
                    </div>
                </div>

                <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400 w-16">Kleur</span>
                    <div className="flex items-center gap-2 flex-1 justify-end">
                        <button type="button" onClick={() => cycleOption('hairColor', 'prev')} className="size-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 active:scale-95 transition-all"><span className="material-symbols-outlined text-lg">chevron_left</span></button>
                        <div className="w-12 flex justify-center"><div className="w-6 h-6 rounded-full border-2 border-white/20" style={{ backgroundColor: `#${HAIR_COLORS[builderConfig.hairColor]}` }}></div></div>
                        <button type="button" onClick={() => cycleOption('hairColor', 'next')} className="size-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 active:scale-95 transition-all"><span className="material-symbols-outlined text-lg">chevron_right</span></button>
                    </div>
                </div>

                <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400 w-16">Gezicht</span>
                    <div className="flex items-center gap-2 flex-1 justify-end">
                        <button type="button" onClick={() => cycleOption('expression', 'prev')} className="size-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 active:scale-95 transition-all"><span className="material-symbols-outlined text-lg">chevron_left</span></button>
                        <span className="text-xs font-mono font-bold text-slate-500 w-12 text-center">{builderConfig.expression + 1}/{EXPRESSION_CONFIG.length}</span>
                        <button type="button" onClick={() => cycleOption('expression', 'next')} className="size-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 active:scale-95 transition-all"><span className="material-symbols-outlined text-lg">chevron_right</span></button>
                    </div>
                </div>

                <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400 w-16">Huid</span>
                    <div className="flex items-center gap-2 flex-1 justify-end">
                        <button type="button" onClick={() => cycleOption('skin', 'prev')} className="size-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 active:scale-95 transition-all"><span className="material-symbols-outlined text-lg">chevron_left</span></button>
                        <div className="w-12 flex justify-center"><div className="w-6 h-6 rounded-full border-2 border-white/20" style={{ backgroundColor: `#${SKIN_COLORS[builderConfig.skin]}` }}></div></div>
                        <button type="button" onClick={() => cycleOption('skin', 'next')} className="size-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 active:scale-95 transition-all"><span className="material-symbols-outlined text-lg">chevron_right</span></button>
                    </div>
                </div>

                <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400 w-16">Bril</span>
                    <div className="flex items-center gap-2 flex-1 justify-end">
                        <button type="button" onClick={() => cycleOption('accessory', 'prev')} className="size-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 active:scale-95 transition-all"><span className="material-symbols-outlined text-lg">chevron_left</span></button>
                        <span className="text-xs font-mono font-bold text-slate-500 w-12 text-center">{builderConfig.accessory === 0 ? '-' : `${builderConfig.accessory}/${ACCESSORIES.length - 1}`}</span>
                        <button type="button" onClick={() => cycleOption('accessory', 'next')} className="size-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 active:scale-95 transition-all"><span className="material-symbols-outlined text-lg">chevron_right</span></button>
                    </div>
                </div>

            </div>

            <button 
                type="submit"
                disabled={!name.trim() || isLoading}
                className="w-full py-4 bg-primary hover:bg-primary/90 text-white font-bold text-lg rounded-2xl shadow-lg shadow-primary/25 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
            >
                {isLoading ? (
                    <span className="material-symbols-outlined animate-spin">refresh</span>
                ) : (
                    <>
                        Starten
                        <span className="material-symbols-outlined">arrow_forward</span>
                    </>
                )}
            </button>
        </form>
        
        <p className="mt-8 text-xs text-slate-600 font-medium">Game Master v1.6</p>
      </div>
    </div>
  );
};

export default Login;
