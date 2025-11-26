import React from 'react';
import { Zap } from 'lucide-react';

const Logo = ({ url, name, collapsed }) => (
  <div className={`flex items-center gap-3 px-2 py-4 transition-all duration-300 ${collapsed ? 'justify-center' : ''}`}>
    <div className="relative">
      {url ? (
        <img src={url} alt="Logo" className="w-10 h-10 rounded-lg object-cover shadow-sm" />
      ) : (
        <div className="w-10 h-10 bg-emerald-600 rounded-lg flex items-center justify-center text-white font-bold shadow-sm">
          <Zap size={20} fill="currentColor" />
        </div>
      )}
      <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 border-2 border-white dark:border-slate-900 rounded-full"></div>
    </div>
    {!collapsed && (
      <div>
        <h1 className="font-bold text-lg tracking-tight text-slate-800 dark:text-white leading-tight">
          {name || 'NexBot'}
        </h1>
        <span className="text-[10px] uppercase font-semibold text-emerald-600 dark:text-emerald-400 tracking-wider">Enterprise</span>
      </div>
    )}
  </div>
);

export default Logo;
