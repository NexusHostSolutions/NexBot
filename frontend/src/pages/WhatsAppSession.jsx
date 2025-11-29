import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    QrCode, Zap, Loader2, PhoneOff, Users, Eye, Settings,
    RefreshCw, LogOut, Trash2, Save, Smartphone, MessageSquare,
    CheckCheck, Radio, Link, Phone, X, AlertTriangle, CheckCircle, Info
} from 'lucide-react';

// ==========================================
// COMPONENTE MODAL INTERNO (VISUAL PRO)
// ==========================================
const Modal = ({ isOpen, onClose, type = 'info', title, message, onConfirm, isLoading, children }) => {
    // Hook para capturar teclas Enter e ESC
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (!isOpen || isLoading) return; // Bloqueia ações se estiver carregando

            if (e.key === 'Escape') {
                onClose();
            }

            if (e.key === 'Enter') {
                if (onConfirm) {
                    e.preventDefault();
                    onConfirm();
                } else if (!children && type !== 'connect') {
                    onClose();
                }
            }
        };

        if (isOpen) {
            window.addEventListener('keydown', handleKeyDown);
        }

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, onClose, onConfirm, children, type, isLoading]);

    if (!isOpen) return null;

    // Definição de Cores e Ícones baseados no tipo
    const getModalStyles = () => {
        switch (type) {
            case 'success': 
                return { 
                    border: 'border-emerald-500', 
                    icon: <CheckCircle className="text-emerald-500 w-14 h-14 mx-auto mb-4 animate-bounce-short" />,
                    btn: 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200'
                };
            case 'error': 
                return { 
                    border: 'border-red-500', 
                    icon: <X className="text-red-500 w-14 h-14 mx-auto mb-4 bg-red-50 rounded-full p-2" />,
                    btn: 'bg-red-600 hover:bg-red-700 shadow-red-200'
                };
            case 'confirm': 
                return { 
                    border: 'border-amber-500', 
                    icon: <AlertTriangle className="text-amber-500 w-14 h-14 mx-auto mb-4" />,
                    btn: 'bg-amber-600 hover:bg-amber-700 shadow-amber-200'
                };
            case 'loading':
                return {
                    border: 'border-blue-500',
                    icon: <Loader2 className="text-blue-500 w-14 h-14 mx-auto mb-4 animate-spin" />,
                    btn: 'bg-blue-600'
                };
            default: // info/connect
                return { 
                    border: 'border-emerald-600', 
                    icon: <Info className="text-blue-500 w-14 h-14 mx-auto mb-4" />,
                    btn: 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200'
                };
        }
    };

    const styles = getModalStyles();
    const isConnectModal = type === 'connect';
    const isLoadingState = type === 'loading' || isLoading;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
            <div className={`bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full ${isConnectModal ? 'max-w-md' : 'max-w-sm'} overflow-hidden transform transition-all scale-100 outline-none border-t-4 ${styles.border}`}>
                
                {/* Header */}
                <div className="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-700">
                    <h3 className="font-bold text-lg text-slate-800 dark:text-white">{title}</h3>
                    {!isLoadingState && (
                        <button type="button" onClick={onClose} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full text-slate-400 transition">
                            <X size={20} />
                        </button>
                    )}
                </div>

                {/* Content */}
                <div className="p-8">
                    {!isConnectModal && styles.icon}
                    
                    {message && (
                        <p className="text-center text-slate-600 dark:text-slate-300 mb-6 font-medium leading-relaxed">
                            {message}
                        </p>
                    )}

                    {children}

                    {/* Footer Buttons standard */}
                    {!isConnectModal && !children && !isLoadingState && (
                        <div className="flex gap-3 justify-center mt-4">
                            {type === 'confirm' && (
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 font-medium transition shadow-sm"
                                >
                                    Cancelar
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() => {
                                    if (onConfirm) onConfirm();
                                    else onClose();
                                }}
                                className={`px-8 py-2.5 text-white rounded-xl font-bold transition shadow-lg ${styles.btn}`}
                            >
                                {type === 'confirm' ? 'Confirmar' : 'OK'}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// ==========================================
// COMPONENTE PRINCIPAL
// ==========================================
const WhatsAppSession = ({ api }) => {
    const [session, setSession] = useState(null);
    const [status, setStatus] = useState('LOADING');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    
    // Novo estado para controlar o loading de desconexão especificamente
    const [disconnecting, setDisconnecting] = useState(false);

    const [settings, setSettings] = useState({
        reject_call: false,
        msg_call: 'Desculpe, não aceitamos chamadas de voz ou vídeo.',
        groups_ignore: true, 
        always_online: false,
        read_messages: false,
        read_status: false
    });

    const [modal, setModal] = useState({ open: false, type: 'success', title: '', message: '', onConfirm: null });
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [createData, setCreateData] = useState({ name: '', phone: '' });
    const [showConnectionModal, setShowConnectionModal] = useState(false);
    const [connectionData, setConnectionData] = useState({ method: 'qrcode', phone_number: '' });
    
    const [connectLoading, setConnectLoading] = useState(false);
    const [qrCode, setQrCode] = useState(null);
    const [pairingCode, setPairingCode] = useState(null);

    const pollingRef = useRef(null);

    // ==========================================
    // HELPERS
    // ==========================================
    const updateSettingsState = (data) => {
        setSettings({
            reject_call: data.reject_call || false,
            msg_call: data.msg_call || 'Desculpe, não aceitamos chamadas de voz ou vídeo.',
            groups_ignore: data.groups_ignore !== undefined ? data.groups_ignore : true,
            always_online: data.always_online || false,
            read_messages: data.read_messages || false,
            read_status: data.read_status || false
        });
    };

    const stopPolling = useCallback(() => {
        if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
        }
    }, []);

    // ==========================================
    // FETCH SESSION
    // ==========================================
    const fetchSession = useCallback(async (source = 'init') => {
        try {
            const data = await api.getWhatsApp();
            console.log(`[NEXBOT] Sessão carregada (${source}):`, data.status, data.profile_name);

            const currentStatus = data.status || 'NO_INSTANCE';

            if (status === "PAIRING" && currentStatus === "CONNECTING") return;

            setStatus(currentStatus);
            setSession(data);

            if (data.number) {
                setConnectionData(prev => ({ ...prev, phone_number: data.number }));
            }

            if (currentStatus === 'PAIRING') {
                setStatus('PAIRING');
                return;
            }

            if (currentStatus === 'CONNECTED') {
                stopPolling();
                updateSettingsState(data);
            }
        } catch (e) {
            console.error('[NEXBOT] Erro fetch:', e);
            setStatus('NO_INSTANCE');
        } finally {
            setLoading(false);
        }
    }, [api, status, stopPolling]);

    // ==========================================
    // POLLING
    // ==========================================
    const startPolling = useCallback(() => {
        stopPolling();
        
        pollingRef.current = setInterval(async () => {
            try {
                const data = await api.getWhatsApp();
                
                if (data.status === 'CONNECTED') {
                    stopPolling();
                    
                    setStatus('CONNECTED');
                    setSession(data);
                    updateSettingsState(data);

                    setShowCreateModal(false);
                    setShowConnectionModal(false);
                    setQrCode(null);
                    setPairingCode(null);
                    setConnectLoading(false);

                    setModal({
                        open: true, type: 'success', title: 'Conectado!', 
                        message: 'WhatsApp conectado com sucesso!'
                    });

                    setTimeout(() => {
                        fetchSession('metadata_sync');
                    }, 2500);
                }
            } catch (e) {
                // Silencioso
            }
        }, 3000);
    }, [api, stopPolling, fetchSession]);

    useEffect(() => {
        fetchSession('mount');
        return () => stopPolling();
    }, []);

    // ==========================================
    // AÇÕES
    // ==========================================
    const handleCreateSubmit = async () => {
        if (!createData.name.trim() || !createData.phone.trim()) {
            setShowCreateModal(false);
            return setModal({ open: true, type: 'error', title: 'Erro', message: 'Preencha todos os campos.' });
        }

        setConnectLoading(true);
        try {
            const res = await api.connectWhatsApp({ 
                instance_name: createData.name.replace(/\s/g, ''),
                phone_number: createData.phone.replace(/\D/g, ''),
                method: 'create' 
            });

            if (res.error) {
                setShowCreateModal(false);
                setModal({ open: true, type: 'error', title: 'Erro', message: res.error });
            } else {
                setShowCreateModal(false);
                setCreateData({ name: '', phone: '' });
                await fetchSession('create_success');
                setModal({ 
                    open: true, type: 'success', title: 'Conexão Criada', 
                    message: 'Sua conexão foi criada! Agora clique em "Conectar Agora".' 
                });
            }
        } catch (e) {
            setShowCreateModal(false);
            setModal({ open: true, type: 'error', title: 'Erro', message: e.message });
        }
        setConnectLoading(false);
    };

    const handleConnectionSubmit = async () => {
        if (connectionData.method === 'pairing' && !connectionData.phone_number) {
            return setModal({ open: true, type: 'error', title: 'Erro', message: 'Número é obrigatório.' });
        }

        setConnectLoading(true);
        setQrCode(null);
        setPairingCode(null);

        try {
            const payload = {
                method: connectionData.method,
                number: connectionData.phone_number.replace(/\D/g, '') 
            };

            const res = await api.reconnectWhatsApp(payload);

            if (res.status === 'QRCODE' && res.qr_code) {
                setQrCode(res.qr_code);
                setStatus('QRCODE');
                startPolling();
            }
            else if (res.status === 'PAIRING' && res.pairing_code) {
                setPairingCode(res.pairing_code);
                setStatus('PAIRING');
                startPolling(); 
            }
            else if (res.status === 'CONNECTED') {
                closeAllModals();
                await fetchSession('already_connected');
                setModal({ open: true, type: 'success', title: 'Conectado', message: 'Já está conectado!' });
            }
            else if (res.error) {
                setModal({ open: true, type: 'error', title: 'Erro', message: res.error });
            }
        } catch (e) {
            setModal({ open: true, type: 'error', title: 'Erro', message: e.message });
        }
        setConnectLoading(false);
    };

    const closeAllModals = () => {
        setShowCreateModal(false);
        setShowConnectionModal(false);
        setQrCode(null);
        setPairingCode(null);
        setConnectLoading(false);
        stopPolling(); 
    };

    const handleReconnectClick = () => {
        const initialPhone = session?.number || '';
        setConnectionData({ method: 'qrcode', phone_number: initialPhone });
        setQrCode(null);
        setPairingCode(null);
        setShowConnectionModal(true);
    };

    const handleRestart = async () => {
        setLoading(true);
        try {
            const res = await api.restartWhatsApp({ restart: true });
            if (res.error) throw new Error(res.error);

            setModal({
                open: true, type: "success", title: "Reiniciado",
                message: "Aguarde alguns segundos..."
            });
            setTimeout(() => fetchSession('restart'), 3000);
        } catch (e) {
            setModal({ open: true, type: "error", title: "Erro", message: e.message });
            setLoading(false);
        }
    };

    // LOGOUT COM LOADING SPINNER
    const handleLogout = (e) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        
        setModal({
            open: true, 
            type: 'confirm', 
            title: 'Desconectar?',
            message: 'Tem certeza que deseja desconectar o WhatsApp?',
            onConfirm: async () => {
                // Fecha modal de confirmação e ativa estado de loading
                setModal({ ...modal, open: false }); 
                setDisconnecting(true); // Ativa o modal de loading

                try {
                    await api.logoutWhatsApp();
                    await fetchSession('logout');
                } catch (e) { 
                    setModal({ open: true, type: 'error', title: 'Erro', message: e.message }); 
                } finally {
                    setDisconnecting(false); // Desativa modal de loading
                }
            }
        });
    };

    const handleDelete = async () => {
        setModal({
            open: true, type: 'confirm', title: 'Excluir?',
            message: 'Isso apaga os dados permanentemente.',
            onConfirm: async () => {
                try {
                    await api.deleteWhatsApp();
                    stopPolling();
                    setStatus('NO_INSTANCE');
                    setSession(null);
                    setModal({ open: true, type: 'success', title: 'Removido', message: 'Instância excluída.' });
                } catch (e) {
                    setModal({ open: true, type: 'error', title: 'Erro', message: e.message });
                }
            }
        });
    };

    const handleSaveSettings = async () => {
        setSaving(true);
        try {
            await api.updateWhatsAppSettings(settings);
            setModal({ open: true, type: 'success', title: 'Salvo!', message: 'Configurações atualizadas.' });
        } catch (e) { 
            setModal({ open: true, type: 'error', title: 'Erro', message: e.message }); 
        }
        setSaving(false);
    };

    const formatDisplayNumber = (n) => {
        if (!n) return '';
        const c = n.replace(/\D/g, '');
        return c.length === 13 ? `+${c.slice(0, 2)} (${c.slice(2, 4)}) ${c.slice(4, 9)}-${c.slice(9)}` : `+${c}`;
    };

    if (loading) {
        return (
            <div className="p-8 flex flex-col items-center justify-center h-[80vh]">
                <Loader2 className="animate-spin text-emerald-600 w-12 h-12" />
                <p className="mt-4 text-slate-500">Carregando sessão...</p>
            </div>
        );
    }

    return (
        <div className="p-8 animate-fade-in max-w-5xl mx-auto">
            {/* Modal Genérico */}
            <Modal 
                isOpen={modal.open} 
                onClose={() => setModal({ ...modal, open: false })} 
                type={modal.type} 
                title={modal.title} 
                message={modal.message} 
                onConfirm={modal.onConfirm} 
            />

            {/* Modal de Desconexão (Spinner) */}
            <Modal
                isOpen={disconnecting}
                onClose={() => {}} // Não fecha clicando fora
                type="loading"
                title="Desconectando"
                message="Encerrando a sessão do WhatsApp, aguarde..."
                isLoading={true}
            />

            {/* Tela NO_INSTANCE */}
            {status === 'NO_INSTANCE' && (
                <div className="flex flex-col items-center justify-center h-[60vh] animate-fade-in">
                    <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} type="connect" title="Criar Nova Sessão">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Nome do Bot</label>
                                <input value={createData.name} onChange={e => setCreateData({ ...createData, name: e.target.value })} className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg dark:text-white outline-none focus:ring-2 focus:ring-emerald-500 transition" placeholder="Ex: Atendimento" disabled={connectLoading} />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Número do WhatsApp</label>
                                <input value={createData.phone} onChange={e => setCreateData({ ...createData, phone: e.target.value.replace(/\D/g, '') })} className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg dark:text-white outline-none font-mono focus:ring-2 focus:ring-emerald-500 transition" placeholder="Ex: 5511999999999" maxLength={13} disabled={connectLoading} />
                            </div>
                            <button type="button" onClick={handleCreateSubmit} disabled={connectLoading} className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition flex justify-center items-center gap-2 disabled:opacity-50 shadow-emerald-200 shadow-lg">
                                {connectLoading ? <Loader2 size={20} className="animate-spin" /> : <Zap size={20} />}
                                {connectLoading ? 'Criando...' : 'Criar Nova Conexão'}
                            </button>
                        </div>
                    </Modal>

                    <div className="w-24 h-24 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6 shadow-inner">
                        <Smartphone size={48} className="text-slate-400" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">Nenhuma Sessão Ativa</h2>
                    <p className="text-slate-500 mb-8 max-w-md mx-auto text-center">Crie uma nova instância para conectar seu WhatsApp.</p>
                    <button type="button" onClick={() => setShowCreateModal(true)} className="px-8 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition shadow-lg hover:shadow-xl transform hover:-translate-y-1">
                        Criar Nova Sessão
                    </button>
                </div>
            )}

            {/* Tela CONNECTED / DISCONNECTED */}
            {status !== 'NO_INSTANCE' && (
                <>
                    <Modal isOpen={showConnectionModal} onClose={closeAllModals} type="connect" title="Conectar WhatsApp">
                        <div className="space-y-6">
                            {!qrCode && !pairingCode && (
                                <div className="grid grid-cols-2 gap-3">
                                    <button type="button" onClick={() => setConnectionData({ ...connectionData, method: 'qrcode' })} className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${connectionData.method === 'qrcode' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50'}`}>
                                        <QrCode size={24} /> <span className="font-semibold text-sm">QR Code</span>
                                    </button>
                                    <button type="button" onClick={() => setConnectionData({ ...connectionData, method: 'pairing' })} className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${connectionData.method === 'pairing' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50'}`}>
                                        <Smartphone size={24} /> <span className="font-semibold text-sm">Código</span>
                                    </button>
                                </div>
                            )}

                            <div className="min-h-[200px] flex flex-col justify-center">
                                {!qrCode && !pairingCode && (
                                    <div className="space-y-4 animate-fade-in">
                                        {connectionData.method === 'pairing' ? (
                                            <div>
                                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Número do WhatsApp</label>
                                                <input value={connectionData.phone_number} onChange={e => setConnectionData({ ...connectionData, phone_number: e.target.value.replace(/\D/g, '') })} className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg dark:text-white font-mono focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="Ex: 5511999999999" maxLength={13} />
                                                <p className="text-xs text-slate-400 mt-2">Confirme o número para receber o código.</p>
                                            </div>
                                        ) : (
                                            <p className="text-center text-slate-500 text-sm">Clique em "Gerar QR Code" para escanear.</p>
                                        )}
                                        <button type="button" onClick={handleConnectionSubmit} disabled={connectLoading} className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition flex justify-center items-center gap-2 disabled:opacity-50 shadow-md">
                                            {connectLoading ? <Loader2 size={20} className="animate-spin" /> : (connectionData.method === 'pairing' ? <Smartphone size={20} /> : <QrCode size={20} />)}
                                            {connectLoading ? 'Gerando...' : 'Gerar Código'}
                                        </button>
                                    </div>
                                )}
                                {qrCode && (
                                    <div className="text-center animate-fade-in">
                                        <p className="text-slate-500 mb-4 text-sm">Abra o WhatsApp &gt; Aparelhos Conectados &gt; Conectar</p>
                                        <div className="flex justify-center p-2 bg-white rounded-xl shadow-sm inline-block border border-slate-100"><img src={qrCode} alt="QR Code" className="w-56 h-56 object-contain" /></div>
                                        <p className="text-xs text-emerald-600 mt-4 animate-pulse font-medium">Aguardando leitura...</p>
                                    </div>
                                )}
                                {pairingCode && (
                                    <div className="text-center animate-fade-in">
                                        <p className="text-slate-500 mb-4 text-sm">Digite no WhatsApp:</p>
                                        <div className="flex items-center justify-center gap-2 mb-2">{pairingCode.split('').map((char, i) => (<div key={i} className="w-10 h-12 flex items-center justify-center bg-slate-100 dark:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600 font-mono font-bold text-xl text-emerald-600 shadow-sm">{char}</div>))}</div>
                                        <p className="text-xs text-emerald-600 mt-2 animate-pulse font-medium">Aguardando...</p>
                                    </div>
                                )}
                            </div>
                            
                            <div className="pt-4 border-t border-slate-100 dark:border-slate-700 mt-4">
                                <button type="button" onClick={closeAllModals} className="w-full py-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition text-sm font-medium">Cancelar / Fechar</button>
                            </div>
                        </div>
                    </Modal>

                    <div className="flex flex-col lg:flex-row gap-8">
                        <div className="w-full lg:w-1/3">
                            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                                <div className={`h-24 bg-gradient-to-r ${status === 'CONNECTED' ? 'from-emerald-500 to-teal-500' : 'from-amber-500 to-orange-500'}`}></div>
                                <div className="px-6 pb-6 -mt-12 text-center">
                                    <img src={session?.profile_pic || `https://ui-avatars.com/api/?name=${session?.session_name || 'Bot'}&background=10b981&color=fff&size=200`} alt="Profile" className="w-24 h-24 rounded-full border-4 border-white dark:border-slate-800 mx-auto shadow-lg object-cover bg-white" onError={(e) => { e.target.src = `https://ui-avatars.com/api/?name=${session?.session_name || 'Bot'}&background=10b981&color=fff&size=200`; }} />
                                    <h2 className="text-xl font-bold text-slate-800 dark:text-white mt-4">{session?.profile_name || session?.session_name || 'WhatsApp Bot'}</h2>
                                    {session?.number && <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 flex items-center justify-center gap-1"><Phone size={14} />{formatDisplayNumber(session.number)}</p>}
                                    <div className="flex items-center justify-center gap-2 mt-3 mb-6">
                                        <div className={`w-2.5 h-2.5 rounded-full ${status === 'CONNECTED' ? 'bg-green-500 animate-pulse' : 'bg-amber-500'}`}></div>
                                        <span className={`text-sm font-medium ${status === 'CONNECTED' ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>{status === 'CONNECTED' ? 'Conectado' : 'Desconectado'}</span>
                                    </div>
                                    <div className="flex gap-2 justify-center flex-wrap">
                                        {status !== 'CONNECTED' && (
                                            <>
                                                <button type="button" onClick={handleReconnectClick} disabled={connectLoading} className="w-full mb-2 px-4 py-3 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 transition flex items-center justify-center gap-2 disabled:opacity-50 shadow-md"><Link size={18} /> Conectar Agora</button>
                                                <button type="button" onClick={handleDelete} className="p-2.5 border border-red-200 text-red-600 dark:border-red-900/50 dark:text-red-400 rounded-lg hover:bg-red-50 transition" title="Excluir"><Trash2 size={18} /></button>
                                            </>
                                        )}
                                        {status === 'CONNECTED' && (
                                            <>
                                                <button type="button" onClick={async () => { setLoading(true); await fetchSession('manual_refresh'); setModal({ open: true, type: "success", title: "Atualizado!", message: "Sincronizado." }); }} className="p-2.5 border border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-400 rounded-lg hover:bg-slate-50 transition" title="Atualizar"><RefreshCw size={18} /></button>
                                                <button type="button" onClick={handleRestart} className="p-2.5 border border-blue-200 text-blue-600 dark:border-blue-900/50 dark:text-blue-400 rounded-lg hover:bg-blue-50 transition" title="Reiniciar"><Radio size={18} /></button>
                                                <button type="button" onClick={(e) => handleLogout(e)} className="p-2.5 border border-amber-200 text-amber-600 dark:border-amber-900/50 dark:text-amber-400 rounded-lg hover:bg-amber-50 transition" title="Desconectar"><LogOut size={18} /></button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {status === 'CONNECTED' ? (
                            <div className="flex-1 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 lg:p-8">
                                <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2"><Settings size={20} className="text-emerald-600" /> Configurações</h3>
                                <div className="space-y-4">
                                    {[
                                        { k: 'groups_ignore', l: 'Responder em Grupos', d: 'Permitir bot em grupos', i: Users, c: 'bg-blue-100 text-blue-600' },
                                        { k: 'read_status', l: 'Ver Status', d: 'Visualizar status dos contatos', i: Eye, c: 'bg-purple-100 text-purple-600' },
                                        { k: 'read_messages', l: 'Marcar Lidas', d: 'Envia confirmação de leitura', i: CheckCheck, c: 'bg-cyan-100 text-cyan-600' },
                                        { k: 'always_online', l: 'Sempre Online', d: 'Mantém status online', i: Radio, c: 'bg-green-100 text-green-600' },
                                        { k: 'reject_call', l: 'Rejeitar Chamadas', d: 'Bloqueia chamadas de voz/vídeo', i: PhoneOff, c: 'bg-red-100 text-red-600' },
                                    ].map((item) => (
                                        <div key={item.k} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-700">
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-lg ${item.c} dark:bg-opacity-20`}><item.i size={20} /></div>
                                                <div><div className="font-bold text-slate-700 dark:text-slate-200">{item.l}</div><div className="text-xs text-slate-500">{item.d}</div></div>
                                            </div>
                                            <button type="button" onClick={() => setSettings({ ...settings, [item.k]: !settings[item.k] })} className={`w-12 h-6 rounded-full transition-colors relative ${!settings.groups_ignore && item.k === 'groups_ignore' ? 'bg-emerald-500' : settings[item.k] && item.k !== 'groups_ignore' ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}>
                                                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform shadow ${(!settings.groups_ignore && item.k === 'groups_ignore') || (settings[item.k] && item.k !== 'groups_ignore') ? 'left-7' : 'left-1'}`}></div>
                                            </button>
                                        </div>
                                    ))}
                                    {settings.reject_call && (
                                        <div className="animate-fade-in pt-2">
                                            <label className="block text-sm font-bold text-slate-600 dark:text-slate-400 mb-2">Mensagem de Rejeição</label>
                                            <textarea value={settings.msg_call} onChange={e => setSettings({ ...settings, msg_call: e.target.value })} className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg text-sm dark:text-white resize-none focus:ring-2 focus:ring-emerald-500 outline-none" rows={2} />
                                        </div>
                                    )}
                                    <button type="button" onClick={handleSaveSettings} disabled={saving} className="w-full py-3 mt-4 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition shadow-lg flex justify-center items-center gap-2 disabled:opacity-50">
                                        {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} {saving ? 'Salvar Configurações' : 'Salvar Alterações'}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 lg:p-8 flex flex-col items-center justify-center text-center">
                                <div className="w-20 h-20 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mb-4"><Link size={40} className="text-amber-600" /></div>
                                <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Instância Desconectada</h3>
                                <p className="text-slate-500 mb-6 max-w-sm">Clique em <strong>Conectar Agora</strong> no painel ao lado para escolher entre QR Code ou Código de Pareamento.</p>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

export default WhatsAppSession;