import React, { useState, useEffect } from 'react';
import { Shield, Server, CheckCircle, Edit2, Trash2, Eye, EyeOff, Loader2 } from 'lucide-react';
import Modal from '../components/Modal';

const EclipsePluginSettings = ({ api }) => {
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState({ open: false, type: 'success', title: '', message: '' });
  const [showKey, setShowKey] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);
  const [activeTabLocal, setActiveTabLocal] = useState('create'); 
  const [config, setConfig] = useState({ api_url: '', api_key: '' });
  const [testData, setTestData] = useState({ login: '', password: '' });

  useEffect(() => {
      api.getEclipseSettings().then(data => {
          if(data.api_url && data.api_key) { setConfig(data); setIsConfigured(true); }
      });
  }, []);

  const handleSaveConfig = async () => {
      setLoading(true);
      try {
          await api.saveEclipseSettings(config);
          setModal({ open: true, type: 'success', title: 'Conexão Aprovada!', message: 'O sistema conseguiu se conectar ao seu painel com sucesso.' });
          setIsConfigured(true);
      } catch (e) { setModal({ open: true, type: 'error', title: 'Falha na Conexão', message: e.message }); }
      setLoading(false);
  };
  const handleDisconnect = () => { setIsConfigured(false); setConfig({ api_url: '', api_key: '' }); };
  const handleCreate = async () => {
    if (!isConfigured) { setModal({ open: true, type: 'error', title: 'Configuração Pendente', message: "Configure a API Key na aba 'Configuração'." }); setActiveTabLocal('config'); return; }
    setLoading(true);
    try {
        const res = await api.createEclipseTest({ ...testData, duration: 60 });
        setModal({ open: true, type: 'success', title: 'Usuário Criado!', message: `Login: ${res.login}` });
    } catch (e) { setModal({ open: true, type: 'error', title: 'Erro ao Criar', message: e.message }); }
    setLoading(false);
  };

  return (
    <div className="p-8 max-w-4xl mx-auto animate-fade-in">
      <Modal isOpen={modal.open} onClose={() => setModal({...modal, open: false})} type={modal.type} title={modal.title} message={modal.message} />
      <div className="flex items-center gap-4 mb-6">
        <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl"><Shield className="w-8 h-8 text-emerald-600 dark:text-emerald-400"/></div>
        <div><h1 className="text-3xl font-bold text-slate-800 dark:text-white">Eclipse Integração</h1><p className="text-slate-500 dark:text-slate-400">Integração com NexusHost API.</p></div>
      </div>
      <div className="flex gap-2 mb-6">
          <button onClick={() => setActiveTabLocal('create')} className={`px-4 py-2 rounded-lg font-bold transition ${activeTabLocal === 'create' ? 'bg-emerald-600 text-white shadow-md' : 'bg-white dark:bg-slate-800 text-slate-500'}`}>Criar Teste Manual</button>
          <button onClick={() => setActiveTabLocal('config')} className={`px-4 py-2 rounded-lg font-bold transition ${activeTabLocal === 'config' ? 'bg-emerald-600 text-white shadow-md' : 'bg-white dark:bg-slate-800 text-slate-500'}`}>Configuração</button>
      </div>
      <div className="bg-white dark:bg-slate-800 p-8 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700">
            {activeTabLocal === 'config' && (
                <div className="space-y-6 animate-fade-in">
                    <h2 className="text-xl font-semibold text-slate-800 dark:text-white flex items-center gap-2"><Server size={20}/> Credenciais de API</h2>
                    {isConfigured ? (
                        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-8 text-center">
                            <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-800 rounded-full flex items-center justify-center mx-auto mb-4"><CheckCircle className="w-8 h-8 text-emerald-600 dark:text-emerald-400" /></div>
                            <h3 className="text-xl font-bold text-emerald-800 dark:text-emerald-300 mb-2">Conectado com Sucesso!</h3>
                            <div className="flex gap-3 justify-center"><button onClick={() => setIsConfigured(false)} className="flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-300 font-bold text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition shadow-sm"><Edit2 size={16}/> Editar</button><button onClick={handleDisconnect} className="flex items-center gap-2 px-5 py-2.5 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/50 rounded-lg text-red-600 dark:text-red-400 font-bold text-sm hover:bg-red-100 dark:hover:bg-red-900/30 transition shadow-sm"><Trash2 size={16}/> Desconectar</button></div>
                        </div>
                    ) : (
                        <>
                            <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">URL da API</label><input value={config.api_url} onChange={e => setConfig({...config, api_url: e.target.value})} placeholder="https://..." className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg dark:text-white"/></div>
                            <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">API Key</label><div className="relative"><input type={showKey ? "text" : "password"} value={config.api_key} onChange={e => setConfig({...config, api_key: e.target.value})} placeholder="Sua chave API..." className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg dark:text-white pr-10"/><button onClick={() => setShowKey(!showKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">{showKey ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div></div>
                            <button onClick={handleSaveConfig} disabled={loading} className="w-full bg-emerald-600 text-white p-3 rounded-lg font-bold hover:bg-emerald-700 transition shadow-lg shadow-emerald-600/20">{loading ? <Loader2 className="animate-spin mx-auto"/> : "Testar e Salvar"}</button>
                        </>
                    )}
                </div>
            )}
            {activeTabLocal === 'create' && (
              <div className="space-y-4 animate-fade-in">
                <h2 className="text-xl font-semibold text-slate-800 dark:text-white">Gerar Teste Manual</h2>
                {!isConfigured && <div className="p-4 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 rounded-lg text-sm mb-4 border border-amber-100 dark:border-amber-800 flex items-center gap-2"><Shield size={16}/> <span>Configure a integração primeiro.</span></div>}
                <div className="grid grid-cols-2 gap-4"><input placeholder="Login" disabled={!isConfigured} className="p-3 bg-slate-50 dark:bg-slate-900 border dark:border-slate-700 rounded dark:text-white disabled:opacity-50" onChange={e => setTestData({...testData, login: e.target.value})} /><input placeholder="Senha" type="password" disabled={!isConfigured} className="p-3 bg-slate-50 dark:bg-slate-900 border dark:border-slate-700 rounded dark:text-white disabled:opacity-50" onChange={e => setTestData({...testData, password: e.target.value})} /></div>
                <button onClick={handleCreate} disabled={loading || !isConfigured} className="w-full bg-emerald-600 text-white p-3 rounded-lg font-bold hover:bg-emerald-700 transition flex justify-center shadow-lg shadow-emerald-600/20 disabled:opacity-50">{loading ? <Loader2 className="animate-spin"/> : "Criar Agora"}</button>
              </div>
            )}
      </div>
    </div>
  );
};

export default EclipsePluginSettings;
