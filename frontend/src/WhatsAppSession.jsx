import React, { useState, useEffect, useRef } from 'react';
import {
    QrCode, Zap, Loader2, PhoneOff, PhoneCall, Users, Eye, Settings,
    RefreshCw, LogOut, Trash2, Save, Smartphone, MessageSquare,
    CheckCheck, Radio, X, WifiOff, Plus, Link, AlertCircle
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

    const [modal, setModal] = useState({ open: false, type: 'success', title: '', message: '', onConfirm: null>
    const [showConnectModal, setShowConnectModal] = useState(false);
    const [connectData, setConnectData] = useState({ instance_name: '', method: 'qrcode', phone_number: '' });
    const [connectLoading, setConnectLoading] = useState(false);
    const [qrCode, setQrCode] = useState(null);
    const [pairingCode, setPairingCode] = useState(null);

    const pollingRef = useRef(null);

    // ==========================================
    // FETCH SESSION
    // ==========================================
    const fetchSession = async () => {
        try {
            const data = await api.getWhatsApp();
            console.log('[NEXBOT] API retornou:', data);

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
                setQrCode(null);
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
                    setQrCode(null);
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
            return alert('Nome do Bot é obrigatório');
        }
        if (!connectData.phone_number) {
            return alert('Número é obrigatório (Ex: 5511999999999)');
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
    // RECONECTAR
    // ==========================================
    const handleReconnect = async (method = 'qrcode') => {
        setConnectLoading(true);
        setShowConnectModal(true);
        setConnectData({ ...connectData, method });

        try {
            const res = await api.reconnectWhatsApp({
                method,
                phone_number: connectData.phone_number || ''
            });
            console.log('[NEXBOT] Resposta reconnect:', res);

            if (res.status === 'QRCODE' && res.qr_code) {
                setQrCode(res.qr_code);
                setStatus('QRCODE');
                startPolling();
            } else if (res.status === 'PAIRING' && res.pairing_code) {
                setPairingCode(res.pairing_code);
                setStatus('PAIRING');
                startPolling();
            }
        } catch (e) {
            setModal({ open: true, type: 'error', title: 'Erro', message: e.message });
        }
        setConnectLoading(false);
    };

    // ==========================================
    // FECHAR MODAL
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

    // ==========================================
    // AÇÕES
    // ==========================================
    const handleLogout = async () => {
        if (confirm('Tem certeza que deseja desconectar?')) {
            await api.logoutWhatsApp();
            await fetchSession();
        }
    };

    const handleRestart = async () => {
    setConnectLoading(true);
    setShowConnectModal(true); // abre o modal correto

    // mantém método padrão qrcode
    setConnectData({
        ...connectData,
        method: "qrcode"
    });

    try {
        const res = await api.restartWhatsApp();
        console.log('[NEXBOT] Resposta restart:', res);

        if (res.status === 'QRCODE' && res.qr_code) {
            setQrCode(res.qr_code);
            setStatus('QRCODE');
            startPolling();
        } else if (res.status === 'PAIRING' && res.pairing_code) {
            setPairingCode(res.pairing_code);
            setStatus('PAIRING');
            startPolling();
        } else {
            setModal({ open: true, type: 'error', title: 'Erro', message: 'Erro ao gerar QR Code.' });
        }
    } catch (e) {
        setModal({ open: true, type: 'error', title: 'Erro', message: e.message });
    }

    setConnectLoading(false);
};

    const handleDelete = async () => {
        setModal({
            open: true,
            type: 'confirm',
            title: 'Excluir Instância?',
            message: 'Isso irá apagar todos os dados. Você precisará criar uma nova conta.',
            onConfirm: async () => {
                await api.deleteWhatsApp();
                setStatus('NO_INSTANCE');
                setSession(null);
                setModal({ open: false });
            }
        });
    };

    const handleRefresh = async () => {
        setLoading(true);
        await fetchSession();
        setModal({ open: true, type: 'success', title: 'Atualizado', message: 'Dados atualizados!' });
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

    const formatPhoneNumber = (value) => value.replace(/\D/g, '');

    // ==========================================
    // COMPONENTES
    // ==========================================
    const Toggle = ({ enabled, onChange }) => (
        <button
            onClick={onChange}
            className={`w-12 h-6 rounded-full transition-colors relative ${enabled ? 'bg-emerald-500' : 'bg-sl>
        >
            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform shadow ${enable>
        </button>
    );

    const SettingItem = ({ icon: Icon, title, description, enabled, onChange, iconColor }) => (
        <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border >
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${enabled ? iconColor : 'bg-slate-200 text-slate-500 dark:bg-s>
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
    // NO_INSTANCE
    // ==========================================
    if (status === 'NO_INSTANCE') {
        return (
            <div className="p-8 animate-fade-in flex flex-col items-center justify-center h-[80vh]">
                <Modal isOpen={modal.open} onClose={() => setModal({ ...modal, open: false })} type={modal.typ>

                <Modal isOpen={showConnectModal} onClose={closeConnectModal} type="connect" title="Criar Conta>
                    <div className="space-y-4">
                        {!qrCode && !pairingCode ? (
                            <>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-3>
                                    <input
                                        value={connectData.instance_name}
                                        onChange={e => setConnectData({ ...connectData, instance_name: e.targe>
                                        className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slat>
                                        placeholder="Ex: MeuBot"
                                        disabled={connectLoading}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-3>
                                    <input
                                        value={connectData.phone_number}
                                        onChange={e => setConnectData({ ...connectData, phone_number: formatPh>
                                        className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slat>
                                        placeholder="5511999999999"
                                        disabled={connectLoading}
                                       maxLength={13}
                                    />
                                    <p className="text-xs text-slate-400 mt-1">Com DDI e DDD</p>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-3>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setConnectData({ ...connectData, method: 'qrcode' }>
                                            disabled={connectLoading}
                                            className={`p-4 rounded-xl border-2 transition-all flex flex-col i>
                                        >
                                            <QrCode size={28} />
                                            <span className="font-semibold">QR Code</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setConnectData({ ...connectData, method: 'pairing' >
                                            disabled={connectLoading}
                                            className={`p-4 rounded-xl border-2 transition-all flex flex-col i>
                                        >
                                            <Smartphone size={28} />
                                            <span className="font-semibold">Código</span>
                                        </button>
                                    </div>
                                </div>

                                <button
                                    onClick={handleConnectSubmit}
                                    disabled={connectLoading}
                                    className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold hove>
                                >
                                    {connectLoading ? <Loader2 size={20} className="animate-spin" /> : <Zap si>
                                    {connectLoading ? 'Criando...' : 'Criar e Conectar'}
                                </button>
                            </>
                        ) : (
                            <div className="text-center py-4">
                                {qrCode ? (
                                    <>
                                        <p className="text-slate-500 mb-4">Escaneie o QR Code com seu WhatsApp>
                                        <div className="flex justify-center">
                                            <img src={qrCode} alt="QR Code" className="w-64 h-64 border-4 bord>
                                        </div>
                                        <p className="text-xs text-emerald-600 mt-4 animate-pulse">Aguardando >
                                    </>
                                ) : (
                                    <>
                                        <p className="text-slate-500 mb-4">Digite este código no WhatsApp:</p>
                                        <div className="text-4xl font-mono font-bold text-emerald-600 tracking>
                                            {pairingCode}
                                        </div>
                                        <p className="text-sm text-slate-400 mt-4">WhatsApp → Dispositivos Vin>
                                        <p className="text-xs text-emerald-600 mt-2 animate-pulse">Aguardando >
                                    </>
                                )}
                                <button onClick={closeConnectModal} className="mt-6 px-6 py-2 bg-slate-200 dar>
                                    Fechar e Atualizar
                                </button>
                            </div>
                        )}
                    </div>
                </Modal>

                <div className="w-24 h-24 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justif>
                    <Smartphone size={48} className="text-slate-400" />
                </div>
                <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">Nenhuma Conta Criada</h>
                <p className="text-slate-500 mb-8 text-center max-w-md">Crie uma conta WhatsApp para começar a>
                <button onClick={() => setShowConnectModal(true)} className="px-8 py-4 bg-emerald-600 text-whi>
                    <Plus size={20} /> Criar Conta Agora
                </button>
            </div>
        );
    }

    // ==========================================
    // DISCONNECTED
    // ==========================================
    if (status === 'DISCONNECTED') {
        return (
            <div className="p-8 animate-fade-in flex flex-col items-center justify-center h-[80vh]">
                <Modal isOpen={modal.open} onClose={() => setModal({ ...modal, open: false })} type={modal.typ>

                <Modal isOpen={showConnectModal} onClose={closeConnectModal} type="connect" title="Reconectar >
                    <div className="space-y-4">
                        {!qrCode && !pairingCode ? (
                            <>
                                <p className="text-slate-500 text-center">Instância: <strong className="text-e>

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-3>
                                    <input
                                        value={connectData.phone_number}
                                        onChange={e => setConnectData({ ...connectData, phone_number: formatPh>
                                        className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slat>
                                        placeholder="5511999999999"
                                        maxLength={13}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <button onClick={() => handleReconnect('qrcode')} disabled={connectLoading>
                                        {connectLoading && connectData.method === 'qrcode' ? <Loader2 size={28>
                                        <span className="font-semibold">Via QR Code</span>
                                    </button>
                                    <button onClick={() => handleReconnect('pairing')} disabled={connectLoadin>
                                        {connectLoading && connectData.method === 'pairing' ? <Loader2 size={2>
                                        <span className="font-semibold">Via Código</span>
                                    </button>
                                </div>
                            </>
                        ) : (
                            <div className="text-center py-4">
                                {qrCode ? (
                                    <>
                                        <p className="text-slate-500 mb-4">Escaneie o QR Code</p>
                                        <div className="flex justify-center">
                                            <img src={qrCode} alt="QR Code" className="w-64 h-64 border-4 bord>
                                        </div>
                                        <p className="text-xs text-emerald-600 mt-4 animate-pulse">Aguardando >
                                    </>
                                ) : (
                                    <>
                                        <p className="text-slate-500 mb-4">Digite este código:</p>
                                        <div className="text-4xl font-mono font-bold text-emerald-600 tracking>
                                            {pairingCode}
                                        </div>
                                        <p className="text-xs text-emerald-600 mt-4 animate-pulse">Aguardando >
                                    </>
                                )}
                                <button onClick={closeConnectModal} className="mt-6 px-6 py-2 bg-slate-200 dar>
                            </div>
                        )}
                    </div>
                </Modal>

                <div className="w-24 h-24 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center jus>
                    <WifiOff size={48} className="text-amber-500" />
                </div>
                <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">WhatsApp Desconectado</>
                <p className="text-slate-500 mb-2">Instância: <strong className="text-emerald-600">{session?.s>
                <p className="text-slate-400 mb-8 text-center max-w-md">Reconecte para continuar usando o NexB>

                <div className="flex gap-4">
                    <button onClick={() => setShowConnectModal(true)} className="px-6 py-3 bg-emerald-600 text>
                        <Link size={18} /> Reconectar
                    </button>
                    <button onClick={handleDelete} className="px-6 py-3 bg-red-100 text-red-600 dark:bg-red-90>
                        <Trash2 size={18} /> Excluir
                    </button>
                </div>

                <button onClick={handleRefresh} className="mt-4 text-sm text-slate-500 hover:text-slate-700 fl>
                    <RefreshCw size={14} /> Atualizar Status
                </button>
            </div>
        );
    }

    // ==========================================
    // CONNECTED
    // ==========================================
    return (
        <div className="p-8 animate-fade-in max-w-5xl mx-auto">
            <Modal isOpen={modal.open} onClose={() => setModal({ ...modal, open: false })} type={modal.type} t>

            <div className="flex flex-col lg:flex-row gap-8">
                {/* Perfil */}
                <div className="w-full lg:w-1/3">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 d>
                        <div className="h-24 bg-gradient-to-r from-emerald-500 to-teal-500"></div>
                        <div className="px-6 pb-6 -mt-12 text-center">
                            <img
                                src={session?.profile_pic || `https://ui-avatars.com/api/?name=${session?.sess>
                                alt="Profile"
                                className="w-24 h-24 rounded-full border-4 border-white dark:border-slate-800 >
                                onError={(e) => { e.target.src = `https://ui-avatars.com/api/?name=${session?.>
                            />
                            <h2 className="text-xl font-bold text-slate-800 dark:text-white mt-4">
                              {session?.profile_name}</h2>
							{session?.number && (<p className="text-sm text-slate-500 dark:text-slate-400 mt-1">+{session.number}</p>
                            )}

                            {session?.profile_status && ( <p className="text-sm text-slate-500 dark:text-slate-400 mt-1"> {session.profile_status}
                             </p>
                            )}
                            <div className="flex items-center justify-center gap-2 mt-3">
                                <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse"></div>
                                <span className="text-sm font-medium text-green-600 dark:text-green-400">Conec>
                            </div>
                            <div className="mt-6 flex gap-2 justify-center">
                                <button onClick={handleRefresh} className="p-2.5 border border-slate-200 text->
                                <button onClick={handleRestart} className="p-2.5 border border-blue-200 text-b>
                                <button onClick={handleLogout} className="p-2.5 border border-amber-200 text-a>
                                <button onClick={handleDelete} className="p-2.5 border border-red-200 text-red>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Settings */}
                <div className="flex-1 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-20>
                    <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-6 flex items-center gap>
                        <Settings size={20} className="text-emerald-600" /> Configurações do Bot
                    </h3>

                    <div className="space-y-4">
                        <SettingItem icon={Users} title="Responder em Grupos" description="Responde mensagens >
                        <SettingItem icon={Eye} title="Ver Status do WhatsApp" description="Visualiza os statu>
                        <SettingItem icon={CheckCheck} title="Marcar como Lidas" description="Envia confirmaçã>
                        <SettingItem icon={Radio} title="Sempre Online" description="Mantém status online" ena>
                        <SettingItem icon={PhoneOff} title="Rejeitar Chamadas" description="Rejeita chamadas a>

                        {settings.reject_call && (
                            <div className="animate-fade-in">
                                <label className="block text-sm font-bold text-slate-600 dark:text-slate-400 m>
                                    <MessageSquare size={16} className="inline mr-1" /> Mensagem de Rejeição
                                </label>
                                <textarea
                                    value={settings.msg_call}
                                    onChange={e => setSettings({ ...settings, msg_call: e.target.value })}
                                    className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-20>
                                    placeholder="Ex: Desculpe, não aceitamos chamadas."
                                    rows={2}
                                />
                            </div>
                        )}

                        <button onClick={handleSaveSettings} disabled={saving} className="w-full py-3 mt-4 bg->
                            {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                            {saving ? 'Salvando...' : 'Salvar Configurações'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WhatsAppSession;
