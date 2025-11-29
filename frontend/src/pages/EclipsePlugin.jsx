import React, { useState, useEffect } from 'react';
import { 
  Shield, Server, CheckCircle, Edit2, Trash2, Eye, EyeOff, Loader2, Copy, Check, Zap, X, AlertTriangle, 
  Bot, GitBranch, Plus, Activity, MessageSquare, Info, AlertCircle, RefreshCw, Send, Users, UserPlus, Code, List
} from 'lucide-react';

// --- COMPONENTE MODAL INTERNO (Versão local para corrigir compilação) ---
const CustomModal = ({ isOpen, onClose, type = 'info', title, message, onConfirm }) => {
  if (!isOpen) return null;

  const styles = (() => {
    switch (type) {
      case 'success': return { icon: <CheckCircle className="w-6 h-6 text-emerald-500" />, bgIcon: 'bg-emerald-100 dark:bg-emerald-900/30', border: 'border-l-4 border-emerald-500', btnClass: 'bg-emerald-600 hover:bg-emerald-700' };
      case 'error': return { icon: <AlertCircle className="w-6 h-6 text-red-500" />, bgIcon: 'bg-red-100 dark:bg-red-900/30', border: 'border-l-4 border-red-500', btnClass: 'bg-red-600 hover:bg-red-700' };
      case 'confirm': return { icon: <AlertTriangle className="w-6 h-6 text-amber-500" />, bgIcon: 'bg-amber-100 dark:bg-amber-900/30', border: 'border-l-4 border-amber-500', btnClass: 'bg-red-600 hover:bg-red-700' };
      default: return { icon: <Info className="w-6 h-6 text-blue-500" />, bgIcon: 'bg-blue-100 dark:bg-blue-900/30', border: 'border-l-4 border-blue-500', btnClass: 'bg-emerald-600 hover:bg-emerald-700' };
    }
  })();

  const handleClose = () => { if (onConfirm) onConfirm(false); onClose(); };
  const handleConfirm = () => { if (onConfirm) onConfirm(true); onClose(); };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div 
        className={`bg-white dark:bg-slate-800 w-full max-w-md rounded-lg shadow-2xl overflow-hidden transform transition-all scale-100 border border-slate-100 dark:border-slate-700 ${styles.border}`}
        role="dialog" aria-modal="true"
      >
        <div className="flex justify-between items-start p-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full ${styles.bgIcon}`}>
              {styles.icon}
            </div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-white">
              {title}
            </h3>
          </div>
          <button onClick={handleClose} className="p-1 rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition">
            <X size={20} />
          </button>
        </div>
        <div className="p-4 pt-0">
          <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed mb-4">
            {message}
          </p>
          <div className="flex justify-end gap-2">
            {styles.type === 'confirm' && (
              <button
                onClick={handleClose}
                className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-white text-sm font-semibold rounded-lg transition-colors"
              >
                Cancelar
              </button>
            )}
            <button
              onClick={handleConfirm}
              className={`px-4 py-2 text-white text-sm font-semibold rounded-lg transition-colors ${styles.btnClass}`}
            >
              {styles.type === 'confirm' ? 'Confirmar' : 'Fechar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
// --- FIM DO COMPONENTE MODAL ---

// ===============================================
// Componente Principal - EclipsePluginSettings
// ===============================================
const EclipsePluginSettings = ({ api, setView }) => {
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState({ open: false, type: 'success', title: '', message: '', onConfirm: null });
  const [showKey, setShowKey] = useState(false);
  const [isConfiguredEclipse, setIsConfiguredEclipse] = useState(false);
  const [activeTabLocal, setActiveTabLocal] = useState('create'); 
  const [configEclipse, setConfigEclipse] = useState({ api_url: '', api_key: '' });
  
  // Estado para Criar Acesso Rápido
  const [createForm, setCreateForm] = useState({
    tipo: 'teste',
    validade: 120,
    limite: 1,
    valor: 15,
    modo_conta: 'ssh',
    sendzap: false,
    numero: ''
  });

  const [resultModal, setResultModal] = useState({
    open: false,
    login: '',
    senha: '',
    limite: 1,
    validade: 60,
    valor: 0,
    xray: '',
    modo: 'ssh'
  });

  const [copied, setCopied] = useState(false);
  
  useEffect(() => {
    api.getEclipseSettings().then(data => {
      if (data.api_url && data.api_key) {
        setConfigEclipse(data);
        setIsConfiguredEclipse(true);
      }
    });
  }, []);

  const generateLogin = () => `NexBot${Math.floor(1000 + Math.random() * 9000)}`;
  const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let password = '';
    for (let i = 0; i < 8; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };
  
  // ===================================
  // ECLIPSE HANDLERS (Configuração)
  // ===================================
  const handleSaveConfigEclipse = async () => {
    setLoading(true);
    try {
      await api.saveEclipseSettings(configEclipse);
      setModal({ open: true, type: 'success', title: '✅ Conexão Aprovada!', message: 'O sistema conseguiu se conectar ao seu painel com sucesso.' });
      setIsConfiguredEclipse(true);
    } catch (e) {
      setModal({ open: true, type: 'error', title: '❌ Falha na Conexão', message: e.message });
    }
    setLoading(false);
  };

  const handleTestConnectionEclipse = async () => {
    setLoading(true);
    try {
      await api.saveEclipseSettings(configEclipse); 
      setModal({ open: true, type: 'success', title: '📡 Conexão Operacional', message: 'A comunicação com a API está a funcionar perfeitamente!' });
    } catch (e) {
      setModal({ open: true, type: 'error', title: '❌ Falha no Teste', message: 'Não foi possível conectar: ' + e.message });
    }
    setLoading(false);
  };

  const handleDisconnectEclipse = () => {
    setIsConfiguredEclipse(false);
    setConfigEclipse({ api_url: '', api_key: '' });
  };
  
  // ===================================
  // ECLIPSE HANDLERS (Criação de Acesso Rápido)
  // ===================================
  const handleCreateEclipse = async () => {
    if (!isConfiguredEclipse) {
      setModal({ open: true, type: 'error', title: '⚠️ Configuração Pendente', message: "Configure a API Key na aba 'Configuração'." });
      setActiveTabLocal('config');
      return;
    }

    if (createForm.valor < 15) {
      setModal({ open: true, type: 'error', title: '⚠️ Valor Inválido', message: 'O valor mínimo é R$ 15,00' });
      return;
    }

    const login = generateLogin();
    const senha = generatePassword();

    setLoading(true);
    try {
      const payload = {
        method: createForm.tipo === 'teste' ? 'CriarTest' : 'CriarUser',
        login: login,
        senha: senha,
        limite: createForm.limite,
        validade: createForm.validade,
        valor: createForm.valor,
        modo_conta: createForm.modo_conta,
        xray: (createForm.modo_conta.includes('xray')),
        sendzap: createForm.sendzap,
        numero: createForm.numero || '',
        categoria: 1
      };

      if (createForm.tipo === 'usuario') {
        payload.periodo = 30;
      }

      const res = await api.createEclipseTest(payload);
      const xrayCode = res.xray || '';

      setResultModal({
        open: true,
        login: login,
        senha: senha,
        limite: createForm.limite,
        validade: createForm.validade,
        valor: createForm.valor,
        xray: xrayCode,
        modo: createForm.modo_conta
      });

    } catch (e) {
      setModal({ open: true, type: 'error', title: '❌ Erro ao Criar', message: e.message });
    }
    setLoading(false);
  };
  
  // ===================================
  // UTILITÁRIOS (Mantidos)
  // ===================================
  const getFormattedText = () => {
    let text = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ ${createForm.tipo === 'teste' ? 'TESTE' : 'USUÁRIO'} GERADO COM SUCESSO!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

👤 Usuário: ${resultModal.login}
🔐 Senha: ${resultModal.senha}
📊 Limite: ${resultModal.limite} conexão(ões)
⏱️ Validade: ${resultModal.validade} ${createForm.tipo === 'teste' ? 'minutos' : 'dias'}
💰 Valor: R$ ${resultModal.valor.toFixed(2)}
🔧 Modo: ${resultModal.modo.toUpperCase()}

📱 Baixe Nosso Aplicativo 👇
https://store.nexushostsolutions.com.br/
`;
    if (resultModal.xray) text += `\n🖥️ Código Xray Gerado 👇\n${resultModal.xray}\n`;
    text += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🚀 NexusHost Solutions\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
    return text.trim();
  };

  const handleCopy = async () => {
    const text = getFormattedText();
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error(e);
      setModal({ open: true, type: 'error', title: 'Erro ao Copiar', message: 'Falha ao copiar o texto. Tente novamente.' });
    }
  };


  return (
    <div className="p-8 max-w-5xl mx-auto animate-fade-in">
      {/* O Modal Padrão */}
      <CustomModal 
        isOpen={modal.open} 
        onClose={() => setModal({ ...modal, open: false })} 
        type={modal.type} 
        title={modal.title} 
        message={modal.message} 
        onConfirm={modal.onConfirm} 
      />

      {/* Modal Resultado - Eclipse (MANTIDO) */}
      {resultModal.open && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-fade-in">
            <div className="bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-3 flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">
                  {createForm.tipo === 'teste' ? '🧪 Teste Criado!' : '👤 Usuário Criado!'}
                </h2>
              </div>
            </div>
            <div className="p-4 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2 bg-slate-50 dark:bg-slate-900 rounded-lg">
                  <p className="text-xs text-slate-500">👤 Usuário</p>
                  <p className="font-bold text-sm text-slate-800 dark:text-white">{resultModal.login}</p>
                </div>
                <div className="p-2 bg-slate-50 dark:bg-slate-900 rounded-lg">
                  <p className="text-xs text-slate-500">🔐 Senha</p>
                  <p className="font-bold text-sm text-slate-800 dark:text-white font-mono">{resultModal.senha}</p>
                </div>
              </div>
              <div className="flex gap-2 text-xs">
                <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
                  📊 {resultModal.limite} conexão
                </span>
                <span className="px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded">
                  ⏱️ {resultModal.validade} {createForm.tipo === 'teste' ? 'min' : 'dias'}
                </span>
                <span className="px-2 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded">
                  🔧 {resultModal.modo.toUpperCase()}
                </span>
              </div>
              {resultModal.xray && (
                <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                  <p className="text-xs text-purple-700 dark:text-purple-300 mb-1 font-bold">🖥️ Código Xray Gerado</p>
                  <p className="font-mono text-xs text-slate-700 dark:text-slate-300 break-all line-clamp-3 hover:line-clamp-none transition-all">{resultModal.xray}</p>
                </div>
              )}
            </div>
            <div className="px-4 pb-4 flex gap-2">
              <button onClick={handleCopy} className={`flex-1 py-2.5 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition ${copied ? 'bg-emerald-600 text-white' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}>
                {copied ? <><Check size={16} /> Copiado!</> : <><Copy size={16} /> Copiar</>}
              </button>
              <button onClick={() => setResultModal({ ...resultModal, open: false })} className="px-4 py-2.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-white rounded-lg font-bold text-sm hover:bg-slate-300 dark:hover:bg-slate-600 transition">
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl">
          <Shield className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-slate-800 dark:text-white">Plugin VPN</h1>
          <p className="text-slate-500 dark:text-slate-400">Integração com NexusHost API</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        <button 
          onClick={() => setActiveTabLocal('create')} 
          className={`px-4 py-2 rounded-lg font-bold transition flex items-center gap-2 whitespace-nowrap ${activeTabLocal === 'create' ? 'bg-emerald-600 text-white shadow-md' : 'bg-white dark:bg-slate-800 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
        >
          <Zap size={18} /> Criar Acesso Rápido
        </button>
        <button 
          onClick={() => setActiveTabLocal('config')} 
          className={`px-4 py-2 rounded-lg font-bold transition flex items-center gap-2 whitespace-nowrap ${activeTabLocal === 'config' ? 'bg-emerald-600 text-white shadow-md' : 'bg-white dark:bg-slate-800 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
        >
          <Server size={18} /> Configuração
        </button>
      </div>

      <div className="bg-white dark:bg-slate-800 p-8 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700">
        
        {/* Tab Criar Acesso Rápido */}
        {activeTabLocal === 'create' && (
           <div className="space-y-6 animate-fade-in">
            <h2 className="text-xl font-semibold text-slate-800 dark:text-white flex items-center gap-2">
              <Zap size={20} /> Gerar Acesso Rápido
            </h2>

            {!isConfiguredEclipse && (
              <div className="p-4 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 rounded-lg text-sm mb-4 border border-amber-100 dark:border-amber-800 flex items-center gap-2">
                <Shield size={16} />
                <span>⚠️ Configure a integração Eclipse primeiro na aba "Configuração".</span>
              </div>
            )}

            {/* Tipo de Acesso */}
            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Tipo de Acesso</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setCreateForm({ ...createForm, tipo: 'teste', validade: 120, valor: 15 })}
                  disabled={!isConfiguredEclipse}
                  className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 disabled:opacity-50 ${createForm.tipo === 'teste'
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                    }`}
                >
                  <span className="text-2xl">🧪</span>
                  <span className="font-bold text-slate-700 dark:text-white">Teste</span>
                  <span className="text-xs text-slate-500">120 min / R$ 15</span>
                </button>
                <button
                  onClick={() => setCreateForm({ ...createForm, tipo: 'usuario', validade: 30, valor: 15 })}
                  disabled={!isConfiguredEclipse}
                  className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 disabled:opacity-50 ${createForm.tipo === 'usuario'
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                    }`}
                >
                  <span className="text-2xl">👤</span>
                  <span className="font-bold text-slate-700 dark:text-white">Usuário</span>
                  <span className="text-xs text-slate-500">30 dias / R$ 15</span>
                </button>
              </div>
            </div>

            {/* Campos do Formulário (Validade, Limite, Valor, WhatsApp, Botão) */}
            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Modo da Conta</label>
              <select
                value={createForm.modo_conta}
                onChange={e => setCreateForm({ ...createForm, modo_conta: e.target.value })}
                disabled={!isConfiguredEclipse}
                className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg dark:text-white disabled:opacity-50"
              >
                <option value="ssh">SSH</option>
                <option value="xray">Xray</option>
                <option value="ssh_xray">SSH + Xray</option>
              </select>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Validade ({createForm.tipo === 'teste' ? 'min' : 'dias'})</label>
                <input
                  type="number" value={createForm.validade} onChange={e => setCreateForm({ ...createForm, validade: parseInt(e.target.value) || 0 })} disabled={!isConfiguredEclipse} min={createForm.tipo === 'teste' ? 1 : 30}
                  className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg dark:text-white disabled:opacity-50"
                />
                {createForm.tipo === 'usuario' && (<p className="text-xs text-amber-600 dark:text-amber-400 mt-1">⚠️ Mín: 30</p>)}
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Limite</label>
                <input
                  type="number" value={createForm.limite} onChange={e => setCreateForm({ ...createForm, limite: parseInt(e.target.value) || 1 })} disabled={!isConfiguredEclipse}
                  className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg dark:text-white disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Valor (R$)</label>
                <input
                  type="number" step="0.01" min="15.00" value={createForm.valor} onChange={e => setCreateForm({ ...createForm, valor: parseFloat(e.target.value) || 15 })} disabled={!isConfiguredEclipse}
                  className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg dark:text-white disabled:opacity-50"
                />
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">⚠️ Mín: R$ 15</p>
              </div>
            </div>

            {createForm.tipo === 'usuario' && (
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">WhatsApp (opcional)</label>
                <input
                  type="text" placeholder="5511999999999" value={createForm.numero} onChange={e => setCreateForm({ ...createForm, numero: e.target.value.replace(/\D/g, '') })} disabled={!isConfiguredEclipse}
                  className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg dark:text-white disabled:opacity-50"
                />
              </div>
            )}

            <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-900 rounded-xl">
              <input type="checkbox" id="sendzap" checked={createForm.sendzap} onChange={e => setCreateForm({ ...createForm, sendzap: e.target.checked })} disabled={!isConfiguredEclipse}
                className="w-5 h-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 disabled:opacity-50"
              />
              <label htmlFor="sendzap" className="text-sm text-slate-700 dark:text-slate-300">📱 Enviar dados pelo WhatsApp automaticamente</label>
            </div>

            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-700 dark:text-blue-300">💡 <strong>Login e senha</strong> serão gerados automaticamente no formato <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">NexBot0000</code></p>
            </div>

            <button
              onClick={handleCreateEclipse}
              disabled={loading || !isConfiguredEclipse}
              className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white p-4 rounded-xl font-bold hover:from-emerald-700 hover:to-teal-700 transition flex justify-center items-center gap-2 shadow-lg shadow-emerald-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (<><Loader2 className="animate-spin" /> Criando...</>) : (<><Zap size={20} /> Criar {createForm.tipo === 'teste' ? 'Teste' : 'Usuário'} Agora</>)}
            </button>
          </div>
        )}
        
        {/* Tab Configuração */}
        {activeTabLocal === 'config' && (
             <div className="space-y-6 animate-fade-in">
                <h2 className="text-xl font-semibold text-slate-800 dark:text-white flex items-center gap-2">
                  <Server size={20} /> Credenciais Eclipse (NexusHost)
                </h2>
                {isConfiguredEclipse ? (
                  <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-8 text-center">
                    <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-800 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle size={32} className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <h3 className="text-xl font-bold text-emerald-800 dark:text-emerald-300 mb-2">✅ Conectado com Sucesso!</h3>
                    <p className="text-emerald-600 dark:text-emerald-400 text-sm mb-4">Sua API está configurada e pronta para uso.</p>
                    <div className="flex gap-3 justify-center flex-wrap">
                      <button onClick={handleTestConnectionEclipse} disabled={loading} className="flex items-center gap-2 px-5 py-2.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/50 rounded-lg text-blue-600 dark:text-blue-400 font-bold text-sm hover:bg-blue-100 dark:hover:bg-blue-900/30 transition shadow-sm">
                        {loading ? <Loader2 size={16} className="animate-spin" /> : <Activity size={16} />} Testar API
                      </button>
                      <button onClick={() => setIsConfiguredEclipse(false)} className="flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-300 font-bold text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition shadow-sm">
                        <Edit2 size={16} /> Editar
                      </button>
                      <button onClick={handleDisconnectEclipse} className="flex items-center gap-2 px-5 py-2.5 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/50 rounded-lg text-red-600 dark:text-red-400 font-bold text-sm hover:bg-red-100 dark:hover:bg-red-900/30 transition shadow-sm">
                        <Trash2 size={16} /> Desconectar
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">URL da API</label>
                      <input value={configEclipse.api_url} onChange={e => setConfigEclipse({ ...configEclipse, api_url: e.target.value })} placeholder="https://areadocliente.nexushostsolutions.com.br/api/" className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg dark:text-white" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">API Key</label>
                      <div className="relative">
                        <input type={showKey ? "text" : "password"} value={configEclipse.api_key} onChange={e => setConfigEclipse({ ...configEclipse, api_key: e.target.value })} placeholder="Sua chave API..." className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg dark:text-white pr-10" />
                        <button onClick={() => setShowKey(!showKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">{showKey ? <EyeOff size={18} /> : <Eye size={18} />}</button>
                      </div>
                    </div>
                    <button onClick={handleSaveConfigEclipse} disabled={loading} className="w-full bg-emerald-600 text-white p-3 rounded-lg font-bold hover:bg-emerald-700 transition shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2">
                      {loading ? <Loader2 className="animate-spin" /> : <CheckCircle size={18} />} {loading ? 'Testando...' : 'Testar e Salvar'}
                    </button>
                  </>
                )}
             </div>
        )}
      </div>
    </div>
  );
};

export default EclipsePluginSettings;