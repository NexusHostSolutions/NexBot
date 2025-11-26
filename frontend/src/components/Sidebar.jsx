import React, { useState } from 'react';
import { Activity, Smartphone, MessageSquare, Shield, CreditCard, Settings, Users, LogOut, Sun, Moon, Menu } from 'lucide-react';
import Logo from './Logo';

const NavItem = ({ icon, label, id, active, setView, collapsed }) => (
  <button 
    onClick={() => setView(id)}
    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group relative
      ${active === id 
        ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400 font-semibold' 
        : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200'
      }
      ${collapsed ? 'justify-center' : ''}
    `}
  >
    <span className={`${active === id ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300'}`}>
      {icon}
    </span>
    {!collapsed && <span className="text-sm">{label}</span>}
    {collapsed && (
      <div className="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-lg">
        {label}
      </div>
    )}
  </button>
);

const Sidebar = ({ role, userPlugins, activeView, setView, logout, theme, toggleTheme, settings }) => {
  const [collapsed, setCollapsed] = useState(false);
  
  // Admin vê tudo. Cliente vê se tiver o plugin.
  const hasEclipse = role === 'admin' || (userPlugins && userPlugins.includes('eclipse'));

  return (
    <div className={`h-screen bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col transition-all duration-300 ${collapsed ? 'w-20' : 'w-64'} fixed left-0 top-0 z-50 shadow-sm`}>
      <div className="p-4 flex flex-col h-full">
        <div className="flex items-center justify-between mb-6">
          <Logo url={settings.logoUrl} name={settings.appName} collapsed={collapsed} />
          {!collapsed && (
             <button onClick={() => setCollapsed(!collapsed)} className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400">
               <Menu size={16}/>
             </button>
          )}
        </div>
        {collapsed && (
            <button onClick={() => setCollapsed(!collapsed)} className="mb-6 mx-auto p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400">
               <Menu size={20}/>
            </button>
        )}

        <nav className="flex-1 space-y-1 overflow-y-auto">
          
          {/* MÓDULO WHATSAPP (Visível para Todos) */}
          <div className="mb-4">
            {!collapsed && <p className="px-4 text-xs font-bold text-slate-400 uppercase mb-2">Automação</p>}
            <NavItem icon={<Activity />} label="Dashboard" id="dashboard" active={activeView} setView={setView} collapsed={collapsed} />
            <NavItem icon={<Smartphone />} label="Sessões WA" id="sessions" active={activeView} setView={setView} collapsed={collapsed} />
            <NavItem icon={<MessageSquare />} label="Flow Builder" id="flows" active={activeView} setView={setView} collapsed={collapsed} />
          </div>

          {/* MÓDULO PLUGINS (Eclipse, Financeiro) */}
          <div className="mb-4">
             {!collapsed && <p className="px-4 text-xs font-bold text-slate-400 uppercase mb-2">Plugins</p>}
             {hasEclipse && (
                <NavItem icon={<Shield />} label="Plugin VPN" id="eclipse" active={activeView} setView={setView} collapsed={collapsed} />
             )}
             <NavItem icon={<CreditCard />} label="Financeiro" id="financial" active={activeView} setView={setView} collapsed={collapsed} />
          </div>

          {/* ÁREA ADMIN (Só para Admin) */}
          {role === 'admin' && (
            <div className="mb-4 pt-4 border-t border-slate-100 dark:border-slate-800">
              {!collapsed && <p className="px-4 text-xs font-bold text-slate-400 uppercase mb-2">Administração</p>}
              <NavItem icon={<Activity />} label="Admin Dash" id="admin_dash" active={activeView} setView={setView} collapsed={collapsed} />
              <NavItem icon={<Users />} label="Clientes" id="clients" active={activeView} setView={setView} collapsed={collapsed} />
              <NavItem icon={<Settings />} label="Gerenciar Plugins" id="plugins" active={activeView} setView={setView} collapsed={collapsed} />
            </div>
          )}

           <div className="pt-2 mt-auto border-t border-slate-100 dark:border-slate-800">
             <NavItem icon={<Settings />} label="Configurações" id="settings" active={activeView} setView={setView} collapsed={collapsed} />
           </div>
        </nav>

        <div className="space-y-2 mt-4">
          <button 
            onClick={toggleTheme} 
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 ${collapsed ? 'justify-center' : ''}`}
            title="Alternar Tema"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            {!collapsed && <span className="text-sm font-medium">Tema {theme === 'dark' ? 'Claro' : 'Escuro'}</span>}
          </button>
          
          <button 
            onClick={logout} 
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 ${collapsed ? 'justify-center' : ''}`}
          >
            <LogOut size={18} />
            {!collapsed && <span className="text-sm font-medium">Sair</span>}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
