import React from 'react';
import { MessageSquare, Smartphone, Shield } from 'lucide-react';

const Card = ({ title, value, trend, icon, bg }) => (
  <div className={`${bg} p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 hover:shadow-md transition-shadow`}>
    <div className="flex justify-between items-start mb-4">
      <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
        {icon}
      </div>
      <span className="text-xs font-medium text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-md">{trend}</span>
    </div>
    <h3 className="text-slate-500 dark:text-slate-400 text-sm font-medium">{title}</h3>
    <p className="text-3xl font-bold text-slate-800 dark:text-white mt-1">{value}</p>
  </div>
);

const Dashboard = () => (
  <div className="p-8 animate-fade-in">
    <h1 className="text-3xl font-bold text-slate-800 dark:text-white mb-8">Dashboard</h1>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <Card title="Mensagens" value="12,450" trend="+12%" icon={<MessageSquare size={24} className="text-emerald-600 dark:text-emerald-400" />} bg="bg-white dark:bg-slate-800"/>
      <Card title="Sessões" value="8" trend="Estável" icon={<Smartphone size={24} className="text-blue-600 dark:text-blue-400" />} bg="bg-white dark:bg-slate-800"/>
      <Card title="Testes VPN" value="142" trend="+5 hoje" icon={<Shield size={24} className="text-purple-600 dark:text-purple-400" />} bg="bg-white dark:bg-slate-800"/>
    </div>
  </div>
);

export default Dashboard;
