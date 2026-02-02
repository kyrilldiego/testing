
import React from 'react';
import { Link } from 'react-router-dom';

const HeaderActions: React.FC = () => {
  return (
    <div className="flex items-center gap-1 relative">
        {/* Settings Button */}
        <Link to="/settings" className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-slate-600 dark:text-white z-40">
            <span className="material-symbols-outlined text-2xl">settings</span>
        </Link>
    </div>
  );
};

export default HeaderActions;
