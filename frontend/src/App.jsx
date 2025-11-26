import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import WhatsAppSession from './pages/WhatsAppSession';
import FlowBuilder from './pages/FlowBuilder';
import SettingsPage from './pages/Settings';
import EclipsePlugin from './pages/EclipsePlugin';
import AdminPlugins from './pages/Admin';

const API_BASE = `http://${window.location.hostname}:8080/api/nexbot`;

const getAuthHeader = () => {
  const token = localStorage.getItem('nexbot_token');
  return token ? { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
};

// API Wrapper Centralizado
const api = {
  login: async (creds) => {
    const res = await fetch(`${API_BASE}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(creds) });
    if (!res.ok) throw new Error('Falha no login');
    const data = await res.json();
    localStorage.setItem('nexbot_token', data.token);
    data.plugins = ['eclipse']; 
    return data;
  },
  getWhatsApp: async () => {
      const res = await fetch(`${API_BASE}/whatsapp`, { headers: getAuthHeader() });
      if (!res.ok) return { status: 'DISCONNECTED' };
      return await res.json();
  },
  connectWhatsApp: async (data) => {
      const res = await fetch(`${API_BASE}/whatsapp/connect`, { method: 'POST', headers: getAuthHeader(), body: JSON.stringify(data) });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Erro ao conectar'); }
      return await res.json();
  },
  restartWhatsApp: async () => {
      const res = await fetch(`${API_BASE}/whatsapp/restart`, { method: 'POST', headers: getAuthHeader() });
      if (!res.ok) throw new Error('Erro ao reiniciar');
      return true;
  },
  deleteWhatsApp: async () => {
      const res = await fetch(`${API_BASE}/whatsapp/delete`, { method: 'POST', headers: getAuthHeader() });
      if (!res.ok) throw new Error('Erro ao deletar');
      return true;
  },
  updateWhatsAppSettings: async (data) => {
      const res = await fetch(`${API_BASE}/whatsapp/settings`, { method: 'PUT', headers: getAuthHeader(), body: JSON.stringify(data) });
      if (!res.ok) throw new Error('Erro ao salvar configs');
      return await res.json();
  },
  logoutWhatsApp: async () => {
      await fetch(`${API_BASE}/whatsapp/logout`, { method: 'POST', headers: getAuthHeader() });
      return true;
  },
  saveEclipseSettings: async (data) => {
    const res = await fetch(`${API_BASE}/eclipse/settings`, { method: 'POST', headers: getAuthHeader(), body: JSON.stringify(data) });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Erro ao salvar'); }
    return await res.json();
  },
  getEclipseSettings: async () => {
    const res = await fetch(`${API_BASE}/eclipse/settings`, { headers: getAuthHeader() });
    if (!res.ok) return { api_url: '', api_key: '' };
    return await res.json();
  },
  createEclipseTest: async (data) => {
    const res = await fetch(`${API_BASE}/eclipse/create-test`, { method: 'POST', headers: getAuthHeader(), body: JSON.stringify(data) });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Erro ao criar teste'); }
    return await res.json();
  }
};

export default function App() {
  const [auth, setAuth] = useState(null);
  const [view, setView] = useState('dashboard');
  const [theme, setTheme] = useState('light');
  const [settings, setSettings] = useState({ appName: 'NexBot', logoUrl: '' });

  useEffect(() => { if (theme === 'dark') document.documentElement.classList.add('dark'); else document.documentElement.classList.remove('dark'); }, [theme]);
  useEffect(() => { const token = localStorage.getItem('nexbot_token'); if (token) setAuth({ role: 'admin', plugins: ['eclipse'] }); }, []);

  const handleLogin = async (creds) => { const data = await api.login(creds); setAuth(data); setView('admin_dash'); };
  const logout = () => { localStorage.removeItem('nexbot_token'); setAuth(null); }

  if (!auth) return <Login onLogin={handleLogin} theme={theme} />;

  return (
    <div className={`flex min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-sans`}>
      <Sidebar role={auth.role} userPlugins={auth.plugins} activeView={view} setView={setView} logout={logout} theme={theme} toggleTheme={() => setTheme(theme === 'light' ? 'dark' : 'light')} settings={settings} />
      <div className="flex-1 ml-20 md:ml-64 transition-all duration-300">
        {view === 'dashboard' && <Dashboard />}
        {view === 'settings' && <SettingsPage settings={settings} setSettings={setSettings} />}
        {view === 'eclipse' && <EclipsePlugin api={api} />}
        {view === 'admin_dash' && <div className="p-8"><h1 className="text-3xl font-bold">Painel Administrativo</h1></div>}
        {view === 'plugins' && <AdminPlugins setView={setView} />}
        {view === 'flows' && <FlowBuilder />}
        {view === 'sessions' && <WhatsAppSession api={api} />}
      </div>
    </div>
  );
}
