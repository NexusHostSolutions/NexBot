import React, { useState, useEffect, useRef } from 'react';
import {
    QrCode, Zap, Loader2, PhoneOff, Users, Eye, Settings,
    RefreshCw, LogOut, Trash2, Save, Smartphone, MessageSquare,
    CheckCheck, Radio, Plus, Link, Phone
} from 'lucide-react';
import Modal from '../components/Modal';

const WhatsAppSession = ({ api }) => {
    const [session, setSession] = useState(null);
    const [status, setStatus] = useState('LOADING');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [settings, setSettings] = useState({
        reject_call: false,
        msg_call: 'Desculpe, não aceitamos chamadas de voz ou vídeo.',
        groups_ignore: false,
        always_online: false,
        read_messages: false,
        read_status: false
    });

    const [modal, setModal] = useState({ open: false, type: 'success', title: '', message: '', onConfirm: null });
    const [showConnectModal, setShowConnectModal] = useState(false);
    const [connectData, setConnectData] = useState({ instance_name: '', method: 'qrcode', phone_number: '' });
    const [connectLoading, setConnectLoading] = useState(false);
    const [qrCode, setQrCode] = useState(null);
    const [pairingCode, setPairingCode] = useState(null);

    // Modal de QR Code para reconexão
    const [showQRModal, setShowQRModal] = useState(false);
    const [reconnectQR, setReconnectQR] = useState(null);

    const pollingRef = useRef(null);

    // ==========================================
    // FETCH SESSION
    // ==========================================
    const fetchSession = async () => {
        try {
            const data = await api.getWhatsApp();
            console.log('[NEXBOT] API retornou:', data);
            console.log('[NEXBOT] Número recebido:', data.number);

            const currentStatus = data.status || 'NO_INSTANCE';
            setStatus(currentStatus);
            setSession(data);

            if (currentStatus === 'CONNECTED') {
                setSettings({
                    reject_call: data.reject_call || false,
                    msg_call: data.msg_call || 'Desculpe, não aceitamos chamadas de voz ou vídeo.',
                    groups_ignore: data.groups_ignore || false,
                    always_online: data.always_online || false,
                    read_messages: data.read_messages || false,
                    read_status: data.read_status || false
                });
                stopPolling();
                setShowConnectModal(false);
                setShowQRModal(false);
                setQrCode(null);
                setReconnectQR(null);
                setPairingCode(null);
            }
        } catch (e) {
            console.error('[NEXBOT] Erro ao buscar sessão:', e);
            setStatus('NO_INSTANCE');
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchSession();
        return () => stopPolling();
    }, []);

    // ==========================================
    // POLLING
    // ==========================================
    const startPolling = () => {
        stopPolling();
        console.log('[NEXBOT] Iniciando polling...');
        pollingRef.current = setInterval(async () => {
            try {
                const data = await api.getWhatsApp();
                console.log('[POLLING] Status:', data.status);

                if (data.status === 'CONNECTED') {
                    console.log('[POLLING] Conectado!');
                    stopPolling();
                    setStatus('CONNECTED');
                    setSession(data);
                    setSettings({
                        reject_call: data.reject_call || false,
                        msg_call: data.msg_call || '',
                        groups_ignore: data.groups_ignore || false,
                        always_online: data.always_online || false,
                        read_messages: data.read_messages || false,
                        read_status: data.read_status || false
                    });
                    setShowConnectModal(false);
                    setShowQRModal(false);
                    setQrCode(null);
                    setReconnectQR(null);
                    setPairingCode(null);
                    setModal({
                        open: true,
                        type: 'success',
                        title: 'Conectado!',
                        message: 'WhatsApp conectado com sucesso!'
                    });
                }
            } catch (e) {
                console.error('[POLLING] Erro:', e);
            }
        }, 3000);
    };

    const stopPolling = () => {
        if (pollingRef.current) {
            console.log('[NEXBOT] Parando polling...');
            clearInterval(pollingRef.current);
            pollingRef.current = null;
        }
    };

    // ==========================================
    // CRIAR NOVA INSTÂNCIA
    // ==========================================
    const handleConnectSubmit = async () => {
        if (!connectData.instance_name) {
            return setModal({ open: true, type: 'error', title: 'Erro', message: 'Nome do Bot é obrigatório' });
        }
        if (!connectData.phone_number) {
            return setModal({ open: true, type: 'error', title: 'Erro', message: 'Número é obrigatório (Ex: 5511999999999)' });
        }

        setConnectLoading(true);
        try {
            const res = await api.connectWhatsApp(connectData);
            console.log('[NEXBOT] Resposta connect:', res);

            if (res.status === 'QRCODE' && res.qr_code) {
                setQrCode(res.qr_code);
                setStatus('QRCODE');
                startPolling();
            } else if (res.status === 'PAIRING' && res.pairing_code) {
                setPairingCode(res.pairing_code);
                setStatus('PAIRING');
                startPolling();
            } else if (res.status === 'CONNECTED') {
                await fetchSession();
            } else if (res.error) {
                setModal({ open: true, type: 'error', title: 'Erro', message: res.error });
            }
        } catch (e) {
            setModal({ open: true, type: 'error', title: 'Erro ao Conectar', message: e.message });
        }
        setConnectLoading(false);
    };

    // ==========================================
    // RECONECTAR - Gera QR Code sem criar nova instância
    // ==========================================
    const handleReconnectNow = async () => {
        setConnectLoading(true);
        setShowQRModal(true);

        try {
            const res = await api.reconnectWhatsApp({});
            console.log('[NEXBOT] Resposta reconnect:', res);

            if (res.status === 'QRCODE' && res.qr_code) {
                setReconnectQR(res.qr_code);
                startPolling();
            } else if (res.status === 'CONNECTED') {
                setModal({ open: true, type: 'success', title: 'Conectado!', message: 'WhatsApp já está conectado!' });
                setShowQRModal(false);
                await fetchSession();
            } else if (res.error) {
                setModal({ open: true, type: 'error', title: 'Erro', message: res.error });
                setShowQRModal(false);
            }
        } catch (e) {
            setModal({ open: true, type: 'error', title: 'Erro', message: e.message });
            setShowQRModal(false);
        }
        setConnectLoading(false);
    };

    // ==========================================
    // FECHAR MODAIS
    // ==========================================
    const closeConnectModal = () => {
        stopPolling();
        setShowConnectModal(false);
        setQrCode(null);
        setPairingCode(null);
        setConnectData({ instance_name: '', method: 'qrcode', phone_number: '' });
        setConnectLoading(false);
        fetchSession();
    };

    const closeQRModal = () => {
        stopPolling();
        setShowQRModal(false);
        setReconnectQR(null);
        setConnectLoading(false);
        fetchSession();
    };

    // ==========================================
    // AÇÕES
    // ==========================================
    const handleRefresh = async () => {
        setLoading(true);
        await fetchSession();
        setModal({ open: true, type: 'success', title: 'Atualizado', message: 'Dados sincronizados com a Evolution API!' });
    };

    const handleRestart = async () => {
        try {
            const res = await api.restartWhatsApp();
            setModal({ open: true, type: 'success', title: 'Reiniciado', message: res.message || 'Instância reiniciada com sucesso!' });
            setTimeout(fetchSession, 2000);
        } catch (e) {
            setModal({ open: true, type: 'error', title: 'Erro', message: e.message });
        }
    };

    const handleLogout = async () => {
        setModal({
            open: true,
            type: 'confirm',
            title: 'Desconectar WhatsApp?',
            message: 'Você poderá reconectar depois usando o botão "Conectar Agora".',
            onConfirm: async () => {
                try {
                    await api.logoutWhatsApp();
                    setModal({ open: true, type: 'success', title: 'Desconectado', message: 'WhatsApp desconectado com sucesso!' });
                    await fetchSession();
                } catch (e) {
                    setModal({ open: true, type: 'error', title: 'Erro', message: e.message });
                }
            }
        });
    };

    const handleDelete = async () => {
        setModal({
            open: true,
            type: 'confirm',
            title: 'Excluir Instância?',
            message: 'Isso irá apagar todos os dados permanentemente. Você precisará criar uma nova conta.',
            onConfirm: async () => {
                try {
                    await api.deleteWhatsApp();
                    setStatus('NO_INSTANCE');
                    setSession(null);
                    setModal({ open: true, type: 'success', title: 'Excluído', message: 'Instância excluída com sucesso!' });
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
            setModal({ open: true, type: 'success', title: 'Salvo!', message: 'Configurações atualizadas com sucesso!' });
        } catch (e) {
            setModal({ open: true, type: 'error', title: 'Erro', message: e.message });
        }
        setSaving(false);
    };

    const formatPhoneNumber = (value) => value.replace(/\D/g, '');

    const formatDisplayNumber = (number) => {
        if (!number) return '';
        // Formatar como +55 (11) 95657-3515
        const cleaned = number.replace(/\D/g, '');
        if (cleaned.length === 13) {
            return `+${cleaned.slice(0, 2)} (${cleaned.slice(2, 4)}) ${cleaned.slice(4, 9)}-${cleaned.slice(9)}`;
        }
        return `+${cleaned}`;
    };

    // ==========================================
    // COMPONENTES
    // ==========================================
    const Toggle = ({ enabled, onChange }) => (
        <button
            onClick={onChange}
            className={`w-12 h-6 rounded-full transition-colors relative ${enabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}
        >
            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform shadow ${enabled ? 'left-7' : 'left-1'}`}></div>
        </button>
    );

    const SettingItem = ({ icon: Icon, title, description, enabled, onChange, iconColor }) => (
        <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${enabled ? iconColor : 'bg-slate-200 text-slate-500 dark:bg-slate-700'}`}>
                    <Icon size={20} />
                </div>
                <div>
                    <div className="font-bold text-slate-700 dark:text-slate-200">{title}</div>
                    <div className="text-xs text-slate-500">{description}</div>
                </div>
            </div>
            <Toggle enabled={enabled} onChange={onChange} />
        </div>
    );

    // Card de Perfil - Usado tanto em CONNECTED quanto DISCONNECTED
    const ProfileCard = ({ isConnected }) => (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className={`h-24 bg-gradient-to-r ${isConnected ? 'from-emerald-500 to-teal-500' : 'from-amber-500 to-orange-500'}`}></div>
            <div className="px-6 pb-6 -mt-12 text-center">
                <img
                    src={session?.profile_pic || `https://ui-avatars.com/api/?name=${session?.session_name || 'Bot'}&background=10b981&color=fff&size=200`}
                    alt="Profile"
                    className="w-24 h-24 rounded-full border-4 border-white dark:border-slate-800 mx-auto shadow-lg object-cover"
                    onError={(e) => { e.target.src = `https://ui-avatars.com/api/?name=${session?.session_name || 'Bot'}&background=10b981&color=fff&size=200`; }}
                />
                <h2 className="text-xl font-bold text-slate-800 dark:text-white mt-4">
                    {session?.profile_name || session?.session_name || 'WhatsApp Bot'}
                </h2>

                {/* Número do WhatsApp */}
                {session?.number && (
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 flex items-center justify-center gap-1">
                        <Phone size={14} />
                        {formatDisplayNumber(session.number)}
                    </p>
                )}

                {/* Status/Recado */}
                {session?.profile_status && (
                    <p className="text-sm text-slate-400 dark:text-slate-500 mt-1 italic">
                        "{session.profile_status}"
                    </p>
                )}

                {/* Indicador de Status */}
                <div className="flex items-center justify-center gap-2 mt-3">
                    <div className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-amber-500'}`}></div>
                    <span className={`text-sm font-medium ${isConnected ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>
                        {isConnected ? 'Conectado' : 'Desconectado'}
                    </span>
                </div>

                {/* Botões de Ação */}
                <div className="mt-6 flex gap-2 justify-center flex-wrap">
                    {isConnected ? (
                        <>
                            <button onClick={handleRefresh} className="p-2.5 border border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-400 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition" title="Atualizar">
                                <RefreshCw size={18} />
                            </button>
                            <button onClick={handleRestart} className="p-2.5 border border-blue-200 text-blue-600 dark:border-blue-900/50 dark:text-blue-400 rounded-lg hover:bg-blue-50 transition" title="Reiniciar">
                                <Radio size={18} />
                            </button>
                            <button onClick={handleLogout} className="p-2.5 border border-amber-200 text-amber-600 dark:border-amber-900/50 dark:text-amber-400 rounded-lg hover:bg-amber-50 transition" title="Desconectar">
                                <LogOut size={18} />
                            </button>
                            <button onClick={handleDelete} className="p-2.5 border border-red-200 text-red-600 dark:border-red-900/50 dark:text-red-400 rounded-lg hover:bg-red-50 transition" title="Excluir">
                                <Trash2 size={18} />
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                onClick={handleReconnectNow}
                                disabled={connectLoading}
                                className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 transition flex items-center gap-2 disabled:opacity-50"
                            >
                                {connectLoading ? <Loader2 size={18} className="animate-spin" /> : <Link size={18} />}
                                Conectar Agora
                            </button>
                            <button onClick={handleRefresh} className="p-2.5 border border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-400 rounded-lg hover:bg-slate-50 transition" title="Atualizar">
                                <RefreshCw size={18} />
                            </button>
                            <button onClick={handleDelete} className="p-2.5 border border-red-200 text-red-600 dark:border-red-900/50 dark:text-red-400 rounded-lg hover:bg-red-50 transition" title="Excluir">
                                <Trash2 size={18} />
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );

    // ==========================================
    // LOADING
    // ==========================================
    if (loading) {
        return (
            <div className="p-8 flex flex-col items-center justify-center h-[80vh]">
                <Loader2 className="animate-spin text-emerald-600 w-12 h-12" />
                <p className="mt-4 text-slate-500">Carregando...</p>
            </div>
        );
    }

    // ==========================================
    // NO_INSTANCE - Nenhuma conta criada
    // ==========================================
    if (status === 'NO_INSTANCE') {
        return (
            <div className="p-8 animate-fade-in flex flex-col items-center justify-center h-[80vh]">
                <Modal isOpen={modal.open} onClose={() => setModal({ ...modal, open: false })} type={modal.type} title={modal.title} message={modal.message} onConfirm={modal.onConfirm} />

                {/* Modal de Criar Conta */}
                <Modal isOpen={showConnectModal} onClose={closeConnectModal} type="connect" title="Criar Conta WhatsApp">
                    <div className="space-y-4">
                        {!qrCode && !pairingCode ? (
                            <>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Nome do Bot</label>
                                    <input
                                        value={connectData.instance_name}
                                        onChange={e => setConnectData({ ...connectData, instance_name: e.target.value.replace(/\s/g, '') })}
                                        className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg dark:text-white"
                                        placeholder="Ex: MeuBot"
                                        disabled={connectLoading}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Número do WhatsApp</label>
                                    <input
                                        value={connectData.phone_number}
                                        onChange={e => setConnectData({ ...connectData, phone_number: formatPhoneNumber(e.target.value) })}
                                        className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg dark:text-white"
                                        placeholder="5511999999999"
                                        disabled={connectLoading}
                                        maxLength={13}
                                    />
                                    <p className="text-xs text-slate-400 mt-1">Com DDI e DDD</p>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Método</label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setConnectData({ ...connectData, method: 'qrcode' })}
                                            disabled={connectLoading}
                                            className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${connectData.method === 'qrcode' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' : 'border-slate-200 dark:border-slate-700'}`}
                                        >
                                            <QrCode size={28} />
                                            <span className="font-semibold">QR Code</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setConnectData({ ...connectData, method: 'pairing' })}
                                            disabled={connectLoading}
                                            className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${connectData.method === 'pairing' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' : 'border-slate-200 dark:border-slate-700'}`}
                                        >
                                            <Smartphone size={28} />
                                            <span className="font-semibold">Código</span>
                                        </button>
                                    </div>
                                </div>

                                <button
                                    onClick={handleConnectSubmit}
                                    disabled={connectLoading}
                                    className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition flex justify-center items-center gap-2 disabled:opacity-50"
                                >
                                    {connectLoading ? <Loader2 size={20} className="animate-spin" /> : <Zap size={20} />}
                                    {connectLoading ? 'Criando...' : 'Criar e Conectar'}
                                </button>
                            </>
                        ) : (
                            <div className="text-center py-4">
                                {qrCode ? (
                                    <>
                                        <p className="text-slate-500 mb-4">Escaneie o QR Code com seu WhatsApp</p>
                                        <div className="flex justify-center">
                                            <img src={qrCode} alt="QR Code" className="w-64 h-64 border-4 border-white shadow-lg rounded-lg" />
                                        </div>
                                        <p className="text-xs text-emerald-600 mt-4 animate-pulse">Aguardando leitura...</p>
                                    </>
                                ) : (
                                    <>
                                        <p className="text-slate-500 mb-4">Digite este código no WhatsApp:</p>
                                        <div className="text-4xl font-mono font-bold text-emerald-600 tracking-widest bg-emerald-50 dark:bg-emerald-900/20 px-6 py-4 rounded-xl border border-emerald-200">
                                            {pairingCode}
                                        </div>
                                        <p className="text-sm text-slate-400 mt-4">WhatsApp → Dispositivos Vinculados → Vincular com número</p>
                                        <p className="text-xs text-emerald-600 mt-2 animate-pulse">Aguardando inserção...</p>
                                    </>
                                )}
                                <button onClick={closeConnectModal} className="mt-6 px-6 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-white rounded-lg hover:bg-slate-300 transition">
                                    Fechar e Atualizar
                                </button>
                            </div>
                        )}
                    </div>
                </Modal>

                <div className="w-24 h-24 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6">
                    <Smartphone size={48} className="text-slate-400" />
                </div>
                <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">Nenhuma Conta Criada</h2>
                <p className="text-slate-500 mb-8 text-center max-w-md">Crie uma conta WhatsApp para começar a usar o NexBot.</p>
                <button onClick={() => setShowConnectModal(true)} className="px-8 py-4 bg-emerald-600 text-white rounded-xl font-bold text-lg hover:bg-emerald-700 transition flex items-center gap-2 shadow-lg">
                    <Plus size={20} /> Criar Conta Agora
                </button>
            </div>
        );
    }

    // ==========================================
    // DISCONNECTED ou CONNECTED - Mesma estrutura com ProfileCard
    // ==========================================
    const isConnected = status === 'CONNECTED';

    return (
        <div className="p-8 animate-fade-in max-w-5xl mx-auto">
            <Modal isOpen={modal.open} onClose={() => setModal({ ...modal, open: false })} type={modal.type} title={modal.title} message={modal.message} onConfirm={modal.onConfirm} />

            {/* Modal de QR Code para Reconexão */}
            <Modal isOpen={showQRModal} onClose={closeQRModal} type="connect" title="Conectar WhatsApp">
                <div className="text-center py-4">
                    {reconnectQR ? (
                        <>
                            <p className="text-slate-500 mb-4">Escaneie o QR Code com seu WhatsApp</p>
                            <div className="flex justify-center">
                                <img src={reconnectQR} alt="QR Code" className="w-64 h-64 border-4 border-white shadow-lg rounded-lg" />
                            </div>
                            <p className="text-xs text-emerald-600 mt-4 animate-pulse">Aguardando leitura do QR Code...</p>
                        </>
                    ) : (
                        <div className="flex flex-col items-center py-8">
                            <Loader2 size={48} className="animate-spin text-emerald-600" />
                            <p className="text-slate-500 mt-4">Gerando QR Code...</p>
                        </div>
                    )}
                    <button onClick={closeQRModal} className="mt-6 px-6 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-white rounded-lg hover:bg-slate-300 transition">
                        Fechar e Atualizar
                    </button>
                </div>
            </Modal>

            <div className="flex flex-col lg:flex-row gap-8">
                {/* Perfil */}
                <div className="w-full lg:w-1/3">
                    <ProfileCard isConnected={isConnected} />
                </div>

                {/* Settings - Só mostra quando conectado */}
                {isConnected ? (
                    <div className="flex-1 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 lg:p-8">
                        <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
                            <Settings size={20} className="text-emerald-600" /> Configurações do Bot
                        </h3>

                        <div className="space-y-4">
                            <SettingItem icon={Users} title="Responder em Grupos" description="Responde mensagens de grupos" enabled={!settings.groups_ignore} onChange={() => setSettings({ ...settings, groups_ignore: !settings.groups_ignore })} iconColor="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" />
                            <SettingItem icon={Eye} title="Ver Status do WhatsApp" description="Visualiza os status publicados" enabled={settings.read_status} onChange={() => setSettings({ ...settings, read_status: !settings.read_status })} iconColor="bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400" />
                            <SettingItem icon={CheckCheck} title="Marcar como Lidas" description="Envia confirmação de leitura" enabled={settings.read_messages} onChange={() => setSettings({ ...settings, read_messages: !settings.read_messages })} iconColor="bg-cyan-100 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400" />
                            <SettingItem icon={Radio} title="Sempre Online" description="Mantém status online" enabled={settings.always_online} onChange={() => setSettings({ ...settings, always_online: !settings.always_online })} iconColor="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" />
                            <SettingItem icon={PhoneOff} title="Rejeitar Chamadas" description="Rejeita chamadas automaticamente" enabled={settings.reject_call} onChange={() => setSettings({ ...settings, reject_call: !settings.reject_call })} iconColor="bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" />

                            {settings.reject_call && (
                                <div className="animate-fade-in">
                                    <label className="block text-sm font-bold text-slate-600 dark:text-slate-400 mb-2">
                                        <MessageSquare size={16} className="inline mr-1" /> Mensagem de Rejeição
                                    </label>
                                    <textarea
                                        value={settings.msg_call}
                                        onChange={e => setSettings({ ...settings, msg_call: e.target.value })}
                                        className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg text-sm dark:text-white resize-none"
                                        placeholder="Ex: Desculpe, não aceitamos chamadas."
                                        rows={2}
                                    />
                                </div>
                            )}

                            <button onClick={handleSaveSettings} disabled={saving} className="w-full py-3 mt-4 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition shadow-lg flex justify-center items-center gap-2 disabled:opacity-50">
                                {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                                {saving ? 'Salvando...' : 'Salvar Configurações'}
                            </button>
                        </div>
                    </div>
                ) : (
                    // Quando desconectado, mostra informação
                    <div className="flex-1 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 lg:p-8 flex flex-col items-center justify-center">
                        <div className="text-center">
                            <div className="w-20 h-20 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                                <QrCode size={40} className="text-amber-600" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">WhatsApp Desconectado</h3>
                            <p className="text-slate-500 mb-6 max-w-sm">
                                Clique no botão "Conectar Agora" no card ao lado para escanear o QR Code e reconectar.
                            </p>
                            <p className="text-sm text-slate-400">
                                Suas configurações serão restauradas automaticamente após a conexão.
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default WhatsAppSession;
