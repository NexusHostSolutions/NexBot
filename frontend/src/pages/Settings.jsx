import React, { useState } from 'react';

const SettingsPage = ({ settings, setSettings }) => {
  const [localSettings, setLocalSettings] = useState(settings);
  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-3xl font-bold text-slate-800 dark:text-white mb-2">Configurações</h1>
      <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 space-y-6">
        <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Nome</label>
            <input value={localSettings.appName} onChange={(e) => setLocalSettings({...localSettings, appName: e.target.value})} className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg dark:text-white"/>
        </div>
        <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">URL da Logo</label>
            <input value={localSettings.logoUrl} onChange={(e) => setLocalSettings({...localSettings, logoUrl: e.target.value})} placeholder="https://..." className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg dark:text-white"/>
        </div>
        <button onClick={() => {setSettings(localSettings); alert('Salvo!')}} className="px-6 py-3 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 transition">Salvar</button>
      </div>
    </div>
  );
};

export default SettingsPage;
