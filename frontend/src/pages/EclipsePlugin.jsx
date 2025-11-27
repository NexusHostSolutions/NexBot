import React, { useState, useEffect } from 'react';
import { Shield, Server, CheckCircle, Edit2, Trash2, Eye, EyeOff, Loader2, Copy, Check, Zap } from 'lucide-react';
import Modal from '../components/Modal';

const EclipsePluginSettings = ({ api }) => {
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState({ open: false, type: 'success', title: '', message: '' });
  const [showKey, setShowKey] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);
  const [activeTabLocal, setActiveTabLocal] = useState('create');
  const [config, setConfig] = useState({ api_url: '', api_key: '' });

  // Estado do formulário de criação
  const [createForm, setCreateForm] = useState({
    tipo: 'teste', // teste ou usuario
    validade: 120,  // 120 minutos para teste
    limite: 1,
    valor: 20,      // R$ 20,00
    modo_conta: 'ssh',
    sendzap: false,
    numero: ''
  });

  // Estado do modal de resultado
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
        setConfig(data);
        setIsConfigured(true);
      }
    });
  }, []);

  // Gerar login automático: NexBot + 4 números
  const generateLogin = () => {
    const numbers = Math.floor(1000 + Math.random() * 9000); // 4 dígitos
    return `NexBot${numbers}`;
  };

  // Gerar senha automática: 6 caracteres alfanuméricos
  const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let password = '';
    for (let i = 0; i < 8; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

  const handleSaveConfig = async () => {
    setLoading(true);
    try {
      await api.saveEclipseSettings(config);
      setModal({ open: true, type: 'success', title: '✅ Conexão Aprovada!', message: 'O sistema conseguiu se conectar ao seu painel com sucesso.' });
      setIsConfigured(true);
    } catch (e) {
      setModal({ open: true, type: 'error', title: '❌ Falha na Conexão', message: e.message });
    }
    setLoading(false);
  };

  const handleDisconnect = () => {
    setIsConfigured(false);
    setConfig({ api_url: '', api_key: '' });
  };

  const handleCreate = async () => {
    if (!isConfigured) {
      setModal({ open: true, type: 'error', title: '⚠️ Configuração Pendente', message: "Configure a API Key na aba 'Configuração'." });
      setActiveTabLocal('config');
      return;
    }

    // Gerar login e senha automaticamente
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
        sendzap: createForm.sendzap,
        numero: createForm.numero || '',
        categoria: 1
      };

      // Se for usuário, adicionar período
      if (createForm.tipo === 'usuario') {
        payload.periodo = 30;
      }

      const res = await api.createEclipseTest(payload);

      // Mostrar modal de resultado
      setResultModal({
        open: true,
        login: login,
        senha: senha,
        limite: createForm.limite,
        validade: createForm.validade,
        valor: createForm.valor,
        xray: res.mensagem?.xray || '',
        modo: createForm.modo_conta
      });

    } catch (e) {
      setModal({ open: true, type: 'error', title: '❌ Erro ao Criar', message: e.message });
    }
    setLoading(false);
  };

  // Texto formatado para copiar
  const getFormattedText = () => {
    const tipoTexto = createForm.tipo === 'teste' ? '🧪 TESTE' : '👤 USUÁRIO';
    let text = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ ${tipoTexto} GERADO COM SUCESSO!
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

    if (resultModal.xray) {
      text += `
🖥️ Código Xray Gerado 👇
${resultModal.xray}
`;
    }

    text += `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚀 NexusHost Solutions
━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

    return text.trim();
  };

  const handleCopy = async () => {
    const text = getFormattedText();
    try {
      // Tentar clipboard API primeiro
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback para HTTP (sem HTTPS)
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        textArea.style.top = '-9999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error('Erro ao copiar:', e);
      // Fallback final
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-9999px';
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto animate-fade-in">
      {/* Modal padrão */}
      <Modal isOpen={modal.open} onClose={() => setModal({ ...modal, open: false })} type={modal.type} title={modal.title} message={modal.message} />

      {/* Modal de Resultado - Compacto */}
      {resultModal.open && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-fade-in">
            {/* Header Compacto */}
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

            {/* Conteúdo Compacto */}
            <div className="p-4 space-y-2">
              {/* Login e Senha em Grid */}
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

              {/* Info em linha */}
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

              {/* Link App */}
              <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg text-center">
                <p className="text-xs text-emerald-700 dark:text-emerald-300">
                  📱 <a href="https://store.nexushostsolutions.com.br/" target="_blank" rel="noopener noreferrer" className="underline">Baixe o App</a>
                </p>
              </div>

              {/* Xray se existir */}
              {resultModal.xray && (
                <div className="p-2 bg-slate-100 dark:bg-slate-900 rounded-lg">
                  <p className="text-xs text-slate-500 mb-1">🖥️ Código Xray</p>
                  <p className="font-mono text-xs text-slate-700 dark:text-slate-300 break-all line-clamp-2">{resultModal.xray}</p>
                </div>
              )}
            </div>

            {/* Botões */}
            <div className="px-4 pb-4 flex gap-2">
              <button
                onClick={handleCopy}
                className={`flex-1 py-2.5 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition ${copied
                    ? 'bg-emerald-600 text-white'
                    : 'bg-emerald-600 text-white hover:bg-emerald-700'
                  }`}
              >
                {copied ? <><Check size={16} /> Copiado!</> : <><Copy size={16} /> Copiar</>}
              </button>
              <button
                onClick={() => setResultModal({ ...resultModal, open: false })}
                className="px-4 py-2.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-white rounded-lg font-bold text-sm hover:bg-slate-300 dark:hover:bg-slate-600 transition"
              >
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
          <h1 className="text-3xl font-bold text-slate-800 dark:text-white">Eclipse Integração</h1>
          <p className="text-slate-500 dark:text-slate-400">Integração com NexusHost API</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTabLocal('create')}
          className={`px-4 py-2 rounded-lg font-bold transition flex items-center gap-2 ${activeTabLocal === 'create'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'bg-white dark:bg-slate-800 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
        >
          <Zap size={18} /> Criar Acesso
        </button>
        <button
          onClick={() => setActiveTabLocal('config')}
          className={`px-4 py-2 rounded-lg font-bold transition flex items-center gap-2 ${activeTabLocal === 'config'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'bg-white dark:bg-slate-800 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
        >
          <Server size={18} /> Configuração
        </button>
      </div>

      {/* Content */}
      <div className="bg-white dark:bg-slate-800 p-8 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700">
        {/* Tab Config */}
        {activeTabLocal === 'config' && (
          <div className="space-y-6 animate-fade-in">
            <h2 className="text-xl font-semibold text-slate-800 dark:text-white flex items-center gap-2">
              <Server size={20} /> Credenciais de API
            </h2>
            {isConfigured ? (
              <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-8 text-center">
                <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-800 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
                </div>
                <h3 className="text-xl font-bold text-emerald-800 dark:text-emerald-300 mb-2">✅ Conectado com Sucesso!</h3>
                <p className="text-emerald-600 dark:text-emerald-400 text-sm mb-4">Sua API está configurada e pronta para uso.</p>
                <div className="flex gap-3 justify-center">
                  <button onClick={() => setIsConfigured(false)} className="flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-300 font-bold text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition shadow-sm">
                    <Edit2 size={16} /> Editar
                  </button>
                  <button onClick={handleDisconnect} className="flex items-center gap-2 px-5 py-2.5 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/50 rounded-lg text-red-600 dark:text-red-400 font-bold text-sm hover:bg-red-100 dark:hover:bg-red-900/30 transition shadow-sm">
                    <Trash2 size={16} /> Desconectar
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">URL da API</label>
                  <input
                    value={config.api_url}
                    onChange={e => setConfig({ ...config, api_url: e.target.value })}
                    placeholder="https://areadocliente.nexushostsolutions.com.br/api/"
                    className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">API Key</label>
                  <div className="relative">
                    <input
                      type={showKey ? "text" : "password"}
                      value={config.api_key}
                      onChange={e => setConfig({ ...config, api_key: e.target.value })}
                      placeholder="Sua chave API..."
                      className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg dark:text-white pr-10"
                    />
                    <button onClick={() => setShowKey(!showKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      {showKey ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
                <button onClick={handleSaveConfig} disabled={loading} className="w-full bg-emerald-600 text-white p-3 rounded-lg font-bold hover:bg-emerald-700 transition shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2">
                  {loading ? <Loader2 className="animate-spin" /> : <CheckCircle size={18} />}
                  {loading ? 'Testando...' : 'Testar e Salvar'}
                </button>
              </>
            )}
          </div>
        )}

        {/* Tab Create */}
        {activeTabLocal === 'create' && (
          <div className="space-y-6 animate-fade-in">
            <h2 className="text-xl font-semibold text-slate-800 dark:text-white flex items-center gap-2">
              <Zap size={20} /> Gerar Acesso Rápido
            </h2>

            {!isConfigured && (
              <div className="p-4 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 rounded-lg text-sm mb-4 border border-amber-100 dark:border-amber-800 flex items-center gap-2">
                <Shield size={16} />
                <span>⚠️ Configure a integração primeiro na aba "Configuração".</span>
              </div>
            )}

            {/* Tipo de Acesso */}
            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Tipo de Acesso</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setCreateForm({ ...createForm, tipo: 'teste', validade: 120, valor: 20 })}
                  disabled={!isConfigured}
                  className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 disabled:opacity-50 ${createForm.tipo === 'teste'
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                    }`}
                >
                  <span className="text-2xl">🧪</span>
                  <span className="font-bold text-slate-700 dark:text-white">Teste</span>
                  <span className="text-xs text-slate-500">120 min / R$ 20</span>
                </button>
                <button
                  onClick={() => setCreateForm({ ...createForm, tipo: 'usuario', validade: 30, valor: 20 })}
                  disabled={!isConfigured}
                  className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 disabled:opacity-50 ${createForm.tipo === 'usuario'
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                    }`}
                >
                  <span className="text-2xl">👤</span>
                  <span className="font-bold text-slate-700 dark:text-white">Usuário</span>
                  <span className="text-xs text-slate-500">30 dias / R$ 20</span>
                </button>
              </div>
            </div>

            {/* Modo da Conta */}
            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Modo da Conta</label>
              <select
                value={createForm.modo_conta}
                onChange={e => setCreateForm({ ...createForm, modo_conta: e.target.value })}
                disabled={!isConfigured}
                className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg dark:text-white disabled:opacity-50"
              >
                <option value="ssh">SSH</option>
               {/* <option value="v2ray">V2Ray</option> */}
                <option value="xray">Xray</option>
                <option value="ssh_xray">SSH + Xray</option>
               {/* <option value="ssh_v2ray">SSH + V2Ray</option> */}
              </select>
            </div>

            {/* Grid de opções */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                  Validade ({createForm.tipo === 'teste' ? 'minutos' : 'dias'})
                </label>
                <input
                  type="number"
                  value={createForm.validade}
                  onChange={e => setCreateForm({ ...createForm, validade: parseInt(e.target.value) || 0 })}
                  disabled={!isConfigured}
                  className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg dark:text-white disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Limite de Conexões</label>
                <input
                  type="number"
                  value={createForm.limite}
                  onChange={e => setCreateForm({ ...createForm, limite: parseInt(e.target.value) || 1 })}
                  disabled={!isConfigured}
                  className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg dark:text-white disabled:opacity-50"
                />
              </div>
            </div>

            {/* Valor e WhatsApp (só para usuário) */}
            {createForm.tipo === 'usuario' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Valor (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={createForm.valor}
                    onChange={e => setCreateForm({ ...createForm, valor: parseFloat(e.target.value) || 0 })}
                    disabled={!isConfigured}
                    className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg dark:text-white disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">WhatsApp (opcional)</label>
                  <input
                    type="text"
                    placeholder="5511999999999"
                    value={createForm.numero}
                    onChange={e => setCreateForm({ ...createForm, numero: e.target.value.replace(/\D/g, '') })}
                    disabled={!isConfigured}
                    className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg dark:text-white disabled:opacity-50"
                  />
                </div>
              </div>
            )}

            {/* Enviar WhatsApp */}
            <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-900 rounded-xl">
              <input
                type="checkbox"
                id="sendzap"
                checked={createForm.sendzap}
                onChange={e => setCreateForm({ ...createForm, sendzap: e.target.checked })}
                disabled={!isConfigured}
                className="w-5 h-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 disabled:opacity-50"
              />
              <label htmlFor="sendzap" className="text-sm text-slate-700 dark:text-slate-300">
                📱 Enviar dados pelo WhatsApp automaticamente
              </label>
            </div>

            {/* Info Box */}
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                💡 <strong>Login e senha</strong> serão gerados automaticamente no formato <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">NexBot0000</code>
              </p>
            </div>

            {/* Botão Criar */}
            <button
              onClick={handleCreate}
              disabled={loading || !isConfigured}
              className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white p-4 rounded-xl font-bold hover:from-emerald-700 hover:to-teal-700 transition flex justify-center items-center gap-2 shadow-lg shadow-emerald-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" /> Criando...
                </>
              ) : (
                <>
                  <Zap size={20} /> Criar {createForm.tipo === 'teste' ? 'Teste' : 'Usuário'} Agora
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default EclipsePluginSettings;
