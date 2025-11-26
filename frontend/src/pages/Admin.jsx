import React from 'react';
import { Shield } from 'lucide-react';

const AdminPlugins = ({ setView }) => (
  <div className="p-8 animate-fade-in">
    <h1 className="text-3xl font-bold text-slate-800 dark:text-white mb-2">Plugins do Sistema</h1>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-lg"><Shield size={24} /></div>
                <div><h3 className="font-bold text-slate-800 dark:text-white">Eclipse VPN</h3><span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">Ativo</span></div>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 line-clamp-2">Integração completa com NexusHost.</p>
            <button onClick={() => setView('eclipse')} className="w-full py-2.5 border border-emerald-600 text-emerald-600 dark:text-emerald-400 rounded-lg text-sm font-bold hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition">Abrir Painel</button>
        </div>
    </div>
  </div>
);

export default AdminPlugins;
