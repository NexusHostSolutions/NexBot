import React, { useState, useEffect } from 'react';
import { QrCode, Zap, Loader2, PhoneOff, Users as UsersGroup, Eye as EyeIcon, Settings, RefreshCw, LogOut, Trash2 } from 'lucide-react';
import Modal from '../components/Modal';

const WhatsAppSession = ({ api }) => {
    const [session, setSession] = useState(null); 
    const [loading, setLoading] = useState(true);
    const [settings, setSettings] = useState({ reject_calls: false, reject_msg: '', ignore_groups: false, always_online: false });
    const [modal, setModal] = useState({ open: false, type: 'success', title: '', message: '', onConfirm: null });
    
    const [showConnectModal, setShowConnectModal] = useState(false);
    const [connectData, setConnectData] = useState({ instance_name: '', method: 'qrcode', phone_number: '' });
    const [connectLoading, setConnectLoading] = useState(false);
    const [qrCode, setQrCode] = useState(null);
    const [pairingCode, setPairingCode] = useState(null);

    const fetchSession = async () => {
        setLoading(true);
        try {
            const data = await api.getWhatsApp();
            setSession(data);
            if(data.status === 'CONNECTED') {
                setSettings({
                    reject_calls: data.reject_calls,
                    reject_msg: data.reject_msg,
                    ignore_groups: data.ignore_groups,
                    always_online: data.always_online
                });
            }
        } catch(e) { console.error(e); }
        setLoading(false);
    };

    useEffect(() => { fetchSession(); }, []);

    const handleConnectSubmit = async () => {
        if (!connectData.instance_name) return alert('Nome do Bot é obrigatório');
        if (!connectData.phone_number) return alert('Número é obrigatório (Ex: 5511999999999)');

        setConnectLoading(true);
        try {
            const res = await api.connectWhatsApp(connectData);
            
            if (res.status === 'QRCODE') {
                setQrCode(res.qr_code);
            } else if (res.status === 'PAIRING') {
                setPairingCode(res.pairing_code);
            }
        } catch(e) { 
            setModal({ open: true, type: 'error', title: 'Erro ao Conectar', message: e.message });
            setShowConnectModal(false);
        }
        setConnectLoading(false);
    };

    const closeConnectModal = () => {
        setShowConnectModal(false);
        setQrCode(null);
        setPairingCode(null);
        setConnectData({ instance_name: '', method: 'qrcode', phone_number: '' });
        fetchSession();
    };

    const handleLogout = async () => {
        if(confirm('Tem certeza que deseja desconectar?')) {
            await api.logoutWhatsApp();
            await fetchSession();
        }
    };
    
    const handleRestart = async () => {
        try {
            await api.restartWhatsApp();
            setModal({ open: true, type: 'success', title: 'Reiniciado', message: 'Instância reiniciada com sucesso.' });
            fetchSession();
        } catch(e) { setModal({ open: true, type: 'error', title: 'Erro', message: e.message }); }
    };

    const handleDelete = async () => {
        setModal({
            open: true, type: 'confirm', title: 'Excluir Instância?', message: 'Isso irá apagar todos os dados da conexão.',
            onConfirm: async () => {
                await api.deleteWhatsApp();
                await fetchSession();
            }
        });
    };

    const handleSaveSettings = async () => {
        try {
            await api.updateWhatsAppSettings(settings);
            setModal({ open: true, type: 'success', title: 'Salvo!', message: 'Configurações de privacidade atualizadas.' });
        } catch(e) { setModal({ open: true, type: 'error', title: 'Erro', message: e.message }); }
    };

    if (loading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-emerald-600"/></div>;

    if (!session || session.status === 'DISCONNECTED' || session.status === 'QRCODE') {
        return (
            <div className="p-8 animate-fade-in flex flex-col items-center justify-center h-[80vh]">
                
                <Modal isOpen={showConnectModal} onClose={closeConnectModal} type="connect" title="Nova Conexão">
                    <div className="space-y-4">
                        {!qrCode && !pairingCode ? (
                            <>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Nome do Bot</label>
                                    <input 
                                        value={connectData.instance_name} 
                                        onChange={e => setConnectData({...connectData, instance_name: e.target.value})}
                                        className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg dark:text-white"
                                        placeholder="Ex: Atendimento"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Número (Com DDD)</label>
                                    <input 
                                        value={connectData.phone_number} 
                                        onChange={e => setConnectData({...connectData, phone_number: e.target.value})}
                                        className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg dark:text-white"
                                        placeholder="Ex: 5511999999999"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Método</label>
                                    <div className="flex gap-3">
                                        <button 
                                            onClick={() => setConnectData({...connectData, method: 'qrcode'})}
                                            className={`flex-1 py-3 border rounded-lg font-bold text-sm transition ${connectData.method === 'qrcode' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-500'}`}
                                        >
                                            QR Code
                                        </button>
                                        <button 
                                            onClick={() => setConnectData({...connectData, method: 'pairing'})}
                                            className={`flex-1 py-3 border rounded-lg font-bold text-sm transition ${connectData.method === 'pairing' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-500'}`}
                                        >
                                            Código
                                        </button>
                                    </div>
                                </div>

                                <button onClick={handleConnectSubmit} disabled={connectLoading} className="w-full py-3 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 transition flex justify-center">
                                    {connectLoading ? <Loader2 className="animate-spin"/> : "Gerar Conexão"}
                                </button>
                            </>
                        ) : (
                            <div className="flex flex-col items-center text-center animate-fade-in">
                                {qrCode ? (
                                    <>
                                        <p className="text-slate-500 mb-4">Escaneie o QR Code:</p>
                                        <img src={qrCode} alt="QR Code" className="w-64 h-64 border-4 border-white shadow-lg rounded-lg"/>
                                    </>
                                ) : (
                                    <>
                                        <p className="text-slate-500 mb-4">Digite este código no WhatsApp:</p>
                                        <div className="text-4xl font-mono font-bold text-emerald-600 tracking-widest bg-emerald-50 px-6 py-4 rounded-xl border border-emerald-200">
                                            {pairingCode}
                                        </div>
                                    </>
                                )}
                                <button onClick={closeConnectModal} className="mt-6 text-sm text-slate-500 hover:text-slate-800 underline">Fechar e Atualizar</button>
                            </div>
                        )}
                    </div>
                </Modal>

                <Modal isOpen={modal.open} onClose={() => setModal({...modal, open: false})} type={modal.type} title={modal.title} message={modal.message} onConfirm={modal.onConfirm} />

                <div className="w-24 h-24 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6">
                    <QrCode size={48} className="text-slate-400"/>
                </div>
                <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">WhatsApp Desconectado</h2>
                <p className="text-slate-500 mb-8 text-center max-w-md">Conecte seu número para começar a enviar mensagens e gerenciar seus clientes.</p>
                <button onClick={() => setShowConnectModal(true)} className="px-8 py-4 bg-emerald-600 text-white rounded-xl font-bold text-lg hover:bg-emerald-700 transition flex items-center gap-2 shadow-lg shadow-emerald-600/20">
                    <Zap size={20}/> Nova Conexão
                </button>
            </div>
        );
    }

    return (
        <div className="p-8 animate-fade-in max-w-5xl mx-auto">
            <Modal isOpen={modal.open} onClose={() => setModal({...modal, open: false})} type={modal.type} title={modal.title} message={modal.message} onConfirm={modal.onConfirm} />
            
            <div className="flex flex-col md:flex-row gap-8">
                <div className="w-full md:w-1/3">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 text-center relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-r from-emerald-500 to-teal-500"></div>
                        <div className="relative z-10 mt-12">
                            <img src={session.profile_pic || 'https://i.pravatar.cc/150?u=nexbot'} alt="Profile" className="w-24 h-24 rounded-full border-4 border-white dark:border-slate-800 mx-auto shadow-lg object-cover"/>
                            <h2 className="text-xl font-bold text-slate-800 dark:text-white mt-4">{session.profile_name || session.session_name}</h2>
                            <div className="flex items-center justify-center gap-2 mt-2">
                                <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse"></div>
                                <span className="text-sm font-medium text-green-600 dark:text-green-400">Online e Operando</span>
                            </div>
                            
                            <div className="mt-6 flex gap-2 justify-center">
                                <button onClick={handleRestart} className="p-2 border border-blue-200 text-blue-600 dark:border-blue-900/50 dark:text-blue-400 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition" title="Reiniciar"><RefreshCw size={18}/></button>
                                <button onClick={handleLogout} className="p-2 border border-amber-200 text-amber-600 dark:border-amber-900/50 dark:text-amber-400 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20 transition" title="Desconectar"><LogOut size={18}/></button>
                                <button onClick={handleDelete} className="p-2 border border-red-200 text-red-600 dark:border-red-900/50 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition" title="Excluir"><Trash2 size={18}/></button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex-1 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-8">
                    <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
                        <Settings size={20} className="text-emerald-600"/> Comportamento do Bot
                    </h3>

                    <div className="space-y-6">
                        <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-700">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${settings.reject_calls ? 'bg-red-100 text-red-600' : 'bg-slate-200 text-slate-500'}`}><PhoneOff size={20}/></div>
                                <div>
                                    <div className="font-bold text-slate-700 dark:text-slate-200">Recusar Ligações</div>
                                    <div className="text-xs text-slate-500">Rejeita chamadas de voz/vídeo automaticamente.</div>
                                </div>
                            </div>
                            <button onClick={() => setSettings({...settings, reject_calls: !settings.reject_calls})} className={`w-12 h-6 rounded-full transition-colors relative ${settings.reject_calls ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}>
                                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${settings.reject_calls ? 'left-7' : 'left-1'}`}></div>
                            </button>
                        </div>

                        {settings.reject_calls && (
                            <div className="animate-fade-in">
                                <label className="block text-xs font-bold uppercase text-slate-400 mb-1 ml-1">Mensagem de Recusa</label>
                                <input 
                                    value={settings.reject_msg}
                                    onChange={e => setSettings({...settings, reject_msg: e.target.value})}
                                    className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg text-sm dark:text-white"
                                    placeholder="Ex: Não atendo ligações, envie texto."
                                />
                            </div>
                        )}

                        <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-700">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${settings.ignore_groups ? 'bg-orange-100 text-orange-600' : 'bg-slate-200 text-slate-500'}`}><UsersGroup size={20}/></div>
                                <div>
                                    <div className="font-bold text-slate-700 dark:text-slate-200">Ignorar Grupos</div>
                                    <div className="text-xs text-slate-500">Não responde a mensagens vindas de grupos.</div>
                                </div>
                            </div>
                            <button onClick={() => setSettings({...settings, ignore_groups: !settings.ignore_groups})} className={`w-12 h-6 rounded-full transition-colors relative ${settings.ignore_groups ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}>
                                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${settings.ignore_groups ? 'left-7' : 'left-1'}`}></div>
                            </button>
                        </div>

                        <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-700">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${settings.always_online ? 'bg-blue-100 text-blue-600' : 'bg-slate-200 text-slate-500'}`}><EyeIcon size={20}/></div>
                                <div>
                                    <div className="font-bold text-slate-700 dark:text-slate-200">Visto por Último (Always Online)</div>
                                    <div className="text-xs text-slate-500">Mantém o status online mesmo sem uso.</div>
                                </div>
                            </div>
                            <button onClick={() => setSettings({...settings, always_online: !settings.always_online})} className={`w-12 h-6 rounded-full transition-colors relative ${settings.always_online ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}>
                                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${settings.always_online ? 'left-7' : 'left-1'}`}></div>
                            </button>
                        </div>

                        <button onClick={handleSaveSettings} className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition shadow-lg shadow-emerald-600/20 flex justify-center items-center gap-2">
                            <Save size={18}/> Salvar Preferências
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WhatsAppSession;
