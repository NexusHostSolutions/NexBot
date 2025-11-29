import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
    Bot, MessageSquare, CornerDownRight, Clock, Plus, GitBranch, Settings, Trash2, Save, Send, Code, Zap, X, 
    Type, Image, SendHorizonal, Link, Hash, Globe, MousePointer2, Loader2, ArrowRight, Shield, List, Radio,
    CheckCircle, AlertCircle, AlertTriangle, Info 
} from 'lucide-react';

// ===============================================
// Componente de Modal Local (FlowModal)
// ===============================================
const FlowModal = ({ isOpen, onClose, type = 'info', title, message, onConfirm }) => {
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

// ===============================================
// UTILITÁRIOS
// ===============================================

const findNodeById = (nodes, id) => nodes.find(n => n.id === id);

// Função para gerar o caminho Bézier (cobrinha)
const getBezierPath = (x1, y1, x2, y2) => {
    // Curvatura vertical Typebot-style
    const c1x = x1;
    const c1y = y1 + 30;
    const c2x = x2;
    const c2y = y2 - 30;
    return `M ${x1} ${y1} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${x2} ${y2}`;
};

// ===============================================
// Componente de Configuração Lateral (NodeConfigPanel)
// ===============================================
const NodeConfigPanel = ({ flowId, node, updateNode, onClose, api }) => {
    if (!node) return null;

    // Se o nó foi criado, o content está vazio. 
    // Se o nó veio do backend, o content é uma string JSON, então precisa de parse.
    const initialContent = (() => {
        if (typeof node.content === 'string' && node.content) {
            try {
                return JSON.parse(node.content);
            } catch (e) {
                console.error("Erro ao parsear content do nó:", e);
                return {};
            }
        }
        return node.content || {};
    })();
    
    const [content, setContent] = useState(initialContent);
    const [currentName, setCurrentName] = useState(node.label);

    useEffect(() => {
        const freshContent = (() => {
            if (typeof node.content === 'string' && node.content) {
                try {
                    return JSON.parse(node.content);
                } catch (e) {
                    return {};
                }
            }
            return node.content || {};
        })();
        setContent(freshContent);
        setCurrentName(node.label);
    }, [node.id, node.content, node.label]);
    
    const handleSave = () => {
        // Validação e atualização de Label
        let newLabel = currentName;
        
        // Verifica se o content atual é um objeto. Se for uma string JSON, converte.
        // Isso é uma medida de segurança, pois o estado `content` deve ser sempre um objeto aqui.
        const currentContentObj = typeof content === 'string' ? JSON.parse(content) : content;

        switch (node.type) {
            case 'message':
                if (!currentContentObj.text && !currentContentObj.media_url) return;
                newLabel = currentContentObj.text ? `Msg: ${currentContentObj.text.substring(0, 20)}...` : (currentContentObj.media_url ? 'Enviar Mídia' : 'Mensagem');
                break;
            case 'trigger':
                if (!currentContentObj.trigger_keyword) return;
                newLabel = `Gatilho: ${currentContentObj.trigger_keyword.split(',')[0]}...`;
                break;
            case 'delay':
                 if (!currentContentObj.duration_seconds) return;
                 newLabel = `Aguardar ${currentContentObj.duration_seconds}s`;
                 break;
            case 'api':
                 if (!currentContentObj.eclipse_command) return;
                 newLabel = `Eclipse: ${currentContentObj.eclipse_command.replace('Criar', '')}`;
                 break;
            case 'buttons':
                if (!currentContentObj.options || currentContentObj.options.length === 0) return;
                newLabel = `Botões: ${currentContentObj.options[0].substring(0, 15)}...`;
                break;
            case 'list':
                if (!currentContentObj.options || currentContentObj.options.length === 0) return;
                newLabel = `Lista: ${currentContentObj.options.length} Itens`;
                break;
            default: break;
        }

        updateNode(node.id, { ...node, content: currentContentObj, label: newLabel });
        onClose(); // FECHA O MODAL APÓS SALVAR
    };

    let title = 'Configuração do Nó';
    let IconComponent = Settings; 
    let color = 'text-slate-500';

    switch (node.type) {
        case 'trigger': title = 'Gatilho do Fluxo'; IconComponent = Zap; color = 'text-purple-600'; break;
        case 'message': title = 'Enviar Mensagem/Mídia'; IconComponent = MessageSquare; color = 'text-emerald-600'; break;
        case 'delay': title = 'Aguardar (Delay)'; IconComponent = Clock; color = 'text-blue-600'; break;
        case 'condition': title = 'Condição (Se/Então)'; IconComponent = CornerDownRight; color = 'text-amber-600'; break;
        case 'api': title = 'Integração Eclipse'; IconComponent = Shield; color = 'text-red-600'; break;
        case 'buttons': title = 'Botões de Resposta Rápida'; IconComponent = Radio; color = 'text-yellow-600'; break;
        case 'list': title = 'Lista de Opções'; IconComponent = List; color = 'text-cyan-600'; break;
        default: break;
    }

    const renderTriggerConfig = () => (
        <div className="space-y-4">
            <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg">
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                    <Hash size={16}/> Palavra Chave (Gatilho)
                </label>
                <input
                    type="text"
                    value={content.trigger_keyword || ''}
                    onChange={(e) => setContent({ ...content, trigger_keyword: e.target.value })}
                    placeholder="Ex: #menu, ola, bom dia. (separados por vírgula)"
                    className="w-full p-3 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-sm dark:text-white"
                />
            </div>
        </div>
    );
    
    const renderMessageConfig = () => (
        <div className="space-y-4">
            <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg">
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                    <Type size={16}/> Conteúdo da Mensagem (Texto)
                </label>
                <textarea
                    value={content.text || ''}
                    onChange={(e) => setContent({ ...content, text: e.target.value })}
                    placeholder="Digite sua mensagem. Use {{nome}} ou {{numero}} para variáveis."
                    rows={6}
                    className="w-full p-3 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-sm dark:text-white resize-none"
                />
            </div>
            
            <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg">
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                    <Image size={16}/> Mídia (URL Opcional)
                </label>
                <input
                    type="url"
                    value={content.media_url || ''}
                    onChange={(e) => setContent({ ...content, media_url: e.target.value })}
                    placeholder="URL de Imagem, Vídeo ou Documento"
                    className="w-full p-3 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-sm dark:text-white"
                />
            </div>
        </div>
    );
    
    const renderDelayConfig = () => (
        <div className="space-y-4">
            <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg">
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                    <Clock size={16}/> Duração do Atraso (segundos)
                </label>
                <input
                    type="number"
                    value={content.duration_seconds || 5}
                    onChange={(e) => setContent({ ...content, duration_seconds: parseInt(e.target.value) || 0 })}
                    placeholder="Tempo em segundos (mínimo 1)"
                    min={1}
                    className="w-full p-3 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-sm dark:text-white"
                />
            </div>
        </div>
    );

    const renderApiConfig = () => (
        <div className="space-y-4">
            <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-200 dark:border-red-800">
                <p className="text-sm text-red-700 dark:text-red-300 font-medium flex items-center gap-2">
                   <Shield size={16}/> Usa as credenciais salvas em "Plugin VPN".
                </p>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg">
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                    <Code size={16}/> Ação Eclipse
                </label>
                <select
                    value={content.eclipse_command || 'CriarTest'}
                    onChange={(e) => setContent({ ...content, eclipse_command: e.target.value })}
                    className="w-full p-3 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-sm dark:text-white"
                >
                    <option value="CriarTest">Criar Teste (60 minutos)</option>
                    <option value="CriarUser">Criar Usuário Final (30 dias)</option>
                    <option value="CriarRevenda">Criar Revenda</option>
                    <option value="SuspenderUser">Suspender Usuário</option>
                    <option value="RenovarUser">Renovar Usuário</option>
                </select>
            </div>
            
            <p className="text-xs text-slate-400 mt-2">
                O bot enviará um payload para sua API Eclipse com a ação e o cliente atual.
            </p>
        </div>
    );
    
    const renderButtonsListConfig = (isList = false) => (
         <div className="space-y-4">
             <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg">
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                    <Type size={16}/> Título da Mensagem
                </label>
                <textarea
                    value={content.text || ''}
                    onChange={(e) => setContent({ ...content, text: e.target.value })}
                    placeholder={isList ? "Corpo da Mensagem (Obrigatório)" : "Mensagem de contexto (Opcional)"}
                    rows={3}
                    className="w-full p-3 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-sm dark:text-white resize-none"
                />
             </div>
             
             <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg">
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                    <List size={16}/> Opções ({isList ? 'Linhas' : 'Botões'})
                </label>
                <textarea
                    value={content.options ? content.options.join('\n') : ''}
                    onChange={(e) => setContent({ ...content, options: e.target.value.split('\n') })}
                    placeholder="Opção 1 (por linha)\nOpção 2\nOpção 3"
                    rows={4}
                    className="w-full p-3 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-sm dark:text-white resize-none"
                />
             </div>
         </div>
    );

    const renderConditionConfig = () => (
        <div className="space-y-4">
            <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg">
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                    <MousePointer2 size={16}/> Condição de Roteamento
                </label>
                <input
                    type="text"
                    value={content.condition_check || ''}
                    onChange={(e) => setContent({ ...content, condition_check: e.target.value })}
                    placeholder="Ex: {{resposta}} == '1' ou {{chat_state}} == 'menu'"
                    className="w-full p-3 font-mono bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-sm dark:text-white"
                />
                <p className="text-xs text-slate-400 mt-2">Define o caminho que o fluxo irá seguir.</p>
            </div>
        </div>
    );

    // --- Renderização Principal do Painel ---
    return (
        <div className="w-96 bg-white dark:bg-slate-800 border-l border-slate-200 dark:border-slate-700 flex flex-col flex-shrink-0 z-30">
            {/* Header do Painel */}
            <div className="p-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-3">
                    <IconComponent size={24} className={color} />
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white">{title}</h3>
                </div>
                <button onClick={onClose} className="p-1 rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition">
                    <X size={20} />
                </button>
            </div>

            {/* Nome do Nó */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-700">
                 <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Nome do Nó (Interno)</label>
                 <input
                    type="text"
                    value={currentName}
                    onChange={(e) => setCurrentName(e.target.value)}
                    onBlur={() => updateNode(node.id, { ...node, label: currentName })}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-sm dark:text-white"
                 />
            </div>

            {/* Conteúdo do Formulário */}
            <div className="flex-1 p-4 space-y-6 overflow-y-auto">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                    ID do Nó: <span className="font-mono bg-slate-100 dark:bg-slate-700 px-1 py-0.5 rounded text-xs">{node.id}</span>
                </p>

                {node.type === 'trigger' && renderTriggerConfig()}
                {node.type === 'message' && renderMessageConfig()}
                {node.type === 'delay' && renderDelayConfig()}
                {node.type === 'api' && renderApiConfig()}
                {node.type === 'condition' && renderConditionConfig()}
                {node.type === 'buttons' && renderButtonsListConfig(false)}
                {node.type === 'list' && renderButtonsListConfig(true)}
                
            </div>

            {/* Rodapé - Botão Salvar */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex justify-end">
                <button
                    onClick={handleSave}
                    className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition flex items-center gap-2 shadow-lg"
                >
                    <SendHorizonal size={18} /> Salvar e Aplicar
                </button>
            </div>
        </div>
    );
};


// ===============================================
// Componente Principal do Flow Builder
// ===============================================
const FlowBuilder = ({ api, setView }) => {
    const [flowId, setFlowId] = useState(0); 
    const [flowName, setFlowName] = useState('Novo Fluxo');
    const [nodes, setNodes] = useState([]);
    const [nextNodeId, setNextNodeId] = useState(1);
    const [selectedNode, setSelectedNode] = useState(null); 
    const flowContainerRef = useRef(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    
    // Estados para Movimento e Conexão
    const [isNodeDragging, setIsNodeDragging] = useState(false); 
    const [draggedNodeId, setDraggedNodeId] = useState(null); 
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 }); // Offset do mouse em relação ao canto do nó
    
    const [connectingNodeId, setConnectingNodeId] = useState(null);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 }); 
    const [modal, setModal] = useState({ open: false, type: 'success', title: '', message: '' });
    
    const findNodeById = (id) => nodes.find(n => n.id === id);
    
    // ... [LÓGICA DE CARREGAMENTO] ...

    const onDrop = (event) => {
        event.preventDefault();
        const type = event.dataTransfer.getData('nodeType');
        if (!flowContainerRef.current || !type) return;

        const containerRect = flowContainerRef.current.getBoundingClientRect();
        
        // CORREÇÃO: Usar a posição do mouse relativa ao container
        const scrollX = flowContainerRef.current.scrollLeft;
        const scrollY = flowContainerRef.current.scrollTop;

        const x = event.clientX - containerRect.left + scrollX;
        const y = event.clientY - containerRect.top + scrollY;
        
        const newTempId = -(nextNodeId); 

        let initialLabel = type.charAt(0).toUpperCase() + type.slice(1);
        if(type === 'trigger') initialLabel = 'Gatilho de Início';
        if(type === 'message') initialLabel = 'Enviar Mensagem';

        const newNode = {
            id: newTempId, 
            type: type,
            label: initialLabel,
            x: x - 100, // Centraliza o nó no mouse
            y: y - 20,
            content: {} 
        };
        
        setNodes(prevNodes => [...prevNodes, newNode]);
        setNextNodeId(nextNodeId + 1);
        setSelectedNode(newNode); 
    };

    const onDragOver = (event) => {
        event.preventDefault();
    };

    const onDragStart = (event, nodeType) => {
        event.dataTransfer.setData('nodeType', nodeType);
    };

    // --- Lógica de Arrastar e Mover (CORRIGIDA) ---
    const handleNodeMouseDown = (e, node) => {
        e.stopPropagation();
        
        // Verifica se clicou na porta de conexão (Input ou Output)
        // Se for o caso, apenas seleciona e deixa o listener de porta cuidar da conexão.
        if (e.target.className.includes('in-port') || e.target.className.includes('out-port')) {
            setSelectedNode(node);
            return;
        }

        // Inicia o arrasto (mover o nó)
        setIsNodeDragging(true); 
        setDraggedNodeId(node.id);
        
        const containerRect = flowContainerRef.current.getBoundingClientRect();
        const scrollX = flowContainerRef.current.scrollLeft;
        const scrollY = flowContainerRef.current.scrollTop;
        
        // Calcula o offset do mouse em relação ao canto do nó, considerando o scroll
        setDragOffset({ 
            x: e.clientX - containerRect.left + scrollX - node.x, 
            y: e.clientY - containerRect.top + scrollY - node.y 
        });
        
        setSelectedNode(node);

        // Adiciona listeners globais para capturar o movimento fora do nó
        window.addEventListener('mousemove', handleNodeMouseMove);
        window.addEventListener('mouseup', handleNodeMouseUp);
    };

    const handleGlobalMouseMove = useCallback((e) => {
        if (flowContainerRef.current) {
            const containerRect = flowContainerRef.current.getBoundingClientRect();
            const scrollX = flowContainerRef.current.scrollLeft;
            const scrollY = flowContainerRef.current.scrollTop;

            setMousePos({ 
                x: e.clientX - containerRect.left + scrollX, 
                y: e.clientY - containerRect.top + scrollY
            });
        }
    }, []);

    const handleNodeMouseMove = (e) => {
        // CORREÇÃO: Garante que só move se o arrasto de nó estiver ativo
        if (!isNodeDragging || draggedNodeId === null || !flowContainerRef.current) return; 

        const containerRect = flowContainerRef.current.getBoundingClientRect();
        const scrollX = flowContainerRef.current.scrollLeft;
        const scrollY = flowContainerRef.current.scrollTop;

        // Calcula a nova posição do nó: (Mouse X/Y + Scroll) - Container Offset - Drag Offset
        let newX = e.clientX - containerRect.left + scrollX - dragOffset.x;
        let newY = e.clientY - containerRect.top + scrollY - dragOffset.y;
        
        // Opcional: Impedir que o nó seja arrastado para fora do topo/esquerda (fora do canvas visível)
        newX = Math.max(0, newX);
        newY = Math.max(0, newY);
        
        setNodes(prevNodes => prevNodes.map(n => 
            n.id === draggedNodeId ? { ...n, x: newX, y: newY } : n
        ));
    };

    const handleNodeMouseUp = () => {
        // Limpa todos os estados e listeners de arrasto
        setIsNodeDragging(false);
        setDraggedNodeId(null);
        window.removeEventListener('mousemove', handleNodeMouseMove);
        window.removeEventListener('mouseup', handleNodeMouseUp);
        
        // Se a conexão estava ativa, cancela
        if (connectingNodeId !== null) {
            setConnectingNodeId(null);
        }
    };
    
    // Listener para o cabo de conexão
    useEffect(() => {
        if (connectingNodeId !== null) {
            window.addEventListener('mousemove', handleGlobalMouseMove);
        } else {
            window.removeEventListener('mousemove', handleGlobalMouseMove);
        }
        return () => window.removeEventListener('mousemove', handleGlobalMouseMove);
    }, [connectingNodeId, handleGlobalMouseMove]);


    // ===============================================
    // LÓGICA DE CONEXÃO (Wiring)
    // ===============================================
    
    const startConnecting = (id) => {
        setConnectingNodeId(id);
    }

    const handleConnectNodes = (startNodeId, endNodeId) => {
        if (startNodeId === endNodeId) {
            setModal({ open: true, type: 'error', title: 'Erro de Conexão', message: "Não é possível conectar um nó a si mesmo." });
            setConnectingNodeId(null);
            return;
        }
        
        setNodes(prevNodes => prevNodes.map(n => {
            // Liga o nó de início ao nó de destino
            if (n.id === startNodeId) {
                // Remove conexões cíclicas básicas (ex: A -> B -> A)
                const endNode = findNodeById(endNodeId);
                let isCycle = endNode?.nextStepId === startNodeId;

                if (isCycle) {
                    setModal({ open: true, type: 'error', title: 'Erro de Ciclo', message: "Conexão rejeitada para evitar um ciclo infinito (A -> B -> A)." });
                    return n;
                }

                return { ...n, nextStepId: endNodeId };
            }
            return n;
        }));
        
        setConnectingNodeId(null); 
    };

    const handleRemoveConnection = (startNodeId) => {
        setNodes(prevNodes => prevNodes.map(n => 
            n.id === startNodeId ? { ...n, nextStepId: null } : n
        ));
        setModal({ open: true, type: 'success', title: 'Desconectado', message: `Conexão do nó ID ${startNodeId} removida.` });
    }

    // ===============================================
    // LÓGICA DE EDIÇÃO E SALVAMENTO (Corrigido)
    // ===============================================

    const updateNode = (id, newNodeData) => {
        setNodes(prevNodes => prevNodes.map(n => 
            n.id === id ? newNodeData : n
        ));
        setSelectedNode(newNodeData); 
    };

    const deleteNode = (id) => {
        setNodes(prevNodes => prevNodes
            .filter(n => n.id !== id)
            .map(n => ({
                ...n,
                nextStepId: n.nextStepId === id ? null : n.nextStepId
            }))
        );
        if (selectedNode && selectedNode.id === id) {
            setSelectedNode(null);
        }
        setModal({ open: true, type: 'success', title: 'Nó Removido', message: `O nó ID ${id} foi removido do fluxo.` });
    }
    
    const handleSaveFlow = async () => {
    if (nodes.length === 0) {
        setModal({
            open: true,
            type: 'error',
            title: 'Erro',
            message: 'Adicione pelo menos um nó ao fluxo antes de salvar.'
        });
        return;
    }

    const triggerNode = nodes.find(n => n.type === 'trigger');
    if (!triggerNode || !triggerNode.content?.trigger_keyword) {
        setModal({
            open: true,
            type: 'error',
            title: 'Erro de Validação',
            message: 'É necessário um nó de Gatilho configurado com uma palavra-chave.'
        });
        return;
    }

    setIsSaving(true);

    // PROCESSA OS STEPS PARA O BACKEND
    const flowSteps = nodes.map(n => {
        // CORREÇÃO CRÍTICA: Se o nextStepId for null ou 0, omitimos o campo
        const nextStepIdValue = n.nextStepId > 0 ? n.nextStepId : null;
        
        // Garante que o content seja uma string JSON (o backend Go espera json.RawMessage que é []byte de JSON)
        const contentData = typeof n.content === 'object' ? JSON.stringify(n.content || {}) : n.content;

        const step = {
            ID: n.id > 0 ? n.id : 0,
            StepType: n.type,
            Content: contentData,
            PositionX: Math.round(n.x),
            PositionY: Math.round(n.y),
        };

        // Adiciona next_step_id APENAS se for um valor válido (evita enviar "0" para NULL)
        if (nextStepIdValue !== null) {
             step.NextStepID = nextStepIdValue;
        }

        return step;
    });

    const flowData = {
        ID: flowId,
        Name: flowName,
        IsActive: true,
        TriggerKeyword: triggerNode.content.trigger_keyword,
        Steps: flowSteps
    };

    // ================================
    // TRY/CATCH — BLOCO CORRETO
    // ================================
    try {

        // console.log("=== ENVIANDO PARA /flows ===");
        // console.log(JSON.stringify(flowData, null, 2));

        const result = await api.saveFlow(flowData);
        // console.log("Resposta do salvamento:", result);

        setModal({
            open: true,
            type: 'success',
            title: 'Fluxo Salvo!',
            message: `Fluxo "${flowName}" salvo com sucesso! ID de retorno: ${result.id}`
        });

        setFlowId(result.id);

    } catch (e) {

        console.error("Erro no Salvamento da API:", e);

        setModal({
            open: true,
            type: 'error',
            title: 'Erro de API',
            message: 'Falha ao salvar o fluxo. O backend retornou um erro inesperado. Verifique os logs do servidor Go.'
        });

    }

    setIsSaving(false);
};

    // ===============================================
    // LÓGICA DE DESENHO DE CONEXÃO (Bézier)
    // ===============================================
    const renderConnections = () => {
        const svgLines = [];
        
        // 1. Desenha conexões salvas
        nodes.forEach(startNode => {
            if (startNode.nextStepId) {
                const endNode = findNodeById(startNode.nextStepId);

                if (endNode) {
                    // Posição ajustada para as portas (centro inferior para centro superior)
                    const x1 = startNode.x + 106; 
                    const y1 = startNode.y + 60; 
                    const x2 = endNode.x + 106; 
                    const y2 = endNode.y + 10;
                    
                    const path = getBezierPath(x1, y1, x2, y2);
                    
                    // Conexão Bézier Visível
                    svgLines.push(
                        <path 
                            key={`conn-${startNode.id}-${endNode.id}`}
                            d={path}
                            stroke="#059669" // Emerald-600
                            fill="none"
                            strokeWidth="2"
                            markerEnd="url(#arrowhead)"
                            className="pointer-events-none" // Não captura mouse aqui
                        />
                    );
                     // Área de clique transparente para remover (Cobrinha)
                     svgLines.push(
                        <path 
                            key={`area-${startNode.id}-${endNode.id}-hit`}
                            d={path}
                            stroke="transparent"
                            fill="none"
                            strokeWidth="10"
                            onDoubleClick={() => handleRemoveConnection(startNode.id)}
                            style={{cursor: 'pointer', pointerEvents: 'all'}} 
                            className="stroke-transparent hover:stroke-red-400/50 transition-all duration-150"
                        />
                    );
                }
            }
        });
        
        // 2. Desenha a linha temporária (Wiring)
        if (connectingNodeId !== null) {
            const startNode = findNodeById(connectingNodeId);
            if (startNode) {
                const x1 = startNode.x + 106;
                const y1 = startNode.y + 60;
                
                const path = getBezierPath(x1, y1, mousePos.x, mousePos.y);

                svgLines.push(
                    <path
                        key="temp-conn"
                        d={path}
                        stroke="#2563eb" // Blue-600
                        fill="none"
                        strokeWidth="2"
                        strokeDasharray="5,5"
                        className="pointer-events-none"
                    />
                );
            }
        }
        
        if (svgLines.length === 0 && connectingNodeId === null) return null;

        return (
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-20">
                {/* Definição da seta (marker) salva */}
                <defs>
                    <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
                        <polygon points="0 0, 10 3.5, 0 7" fill="#059669" />
                    </marker>
                </defs>
                {svgLines}
            </svg>
        );
    }
    
    if (isLoading) {
        return (
            <div className="p-8 flex flex-col items-center justify-center h-screen">
                <Loader2 className="animate-spin text-emerald-600 w-12 h-12" />
                <p className="mt-4 text-slate-500">Carregando Fluxo...</p>
            </div>
        );
    }

    // Ações para os botões do header
    const handleGlobalSettings = () => {
        setModal({ open: true, type: 'info', title: 'Configurações Globais', message: "Aqui você definirá a instância WA para este fluxo e outras regras de prioridade." });
    };
    
    const handleTestFlow = () => {
         setModal({ open: true, type: 'info', title: 'Iniciar Teste', message: "Enviar um gatilho de teste para a Evolution API e monitorar a resposta." });
    };


    return (
        <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-900">
            {/* Modal para feedback */}
            <FlowModal isOpen={modal.open} onClose={() => setModal({ ...modal, open: false })} type={modal.type} title={modal.title} message={modal.message} />

            {/* Header / Barra de Ferramentas */}
            <header className="flex items-center justify-between p-4 bg-white dark:bg-slate-800 shadow-md border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
                <div className="flex items-center gap-4">
                    <Bot size={28} className="text-emerald-600" />
                    <input 
                        type="text"
                        value={flowName}
                        onChange={(e) => setFlowName(e.target.value)}
                        className="text-2xl font-bold bg-transparent outline-none border-b border-transparent focus:border-emerald-500 dark:text-white transition"
                    />
                    <span className="px-2 py-1 text-xs font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded-full">BotFlow</span>
                    {flowId > 0 && <span className="px-2 py-1 text-xs font-semibold bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400 rounded-full">ID: {flowId}</span>}
                </div>
                <div className="flex items-center gap-3">
                    <button 
                        onClick={handleGlobalSettings}
                        className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-white rounded-lg font-semibold hover:bg-slate-300 dark:hover:bg-slate-600 transition flex items-center gap-2"
                    >
                        <Settings size={18} /> Configurações Globais
                    </button>
                    <button 
                        onClick={handleSaveFlow}
                        disabled={isSaving}
                        className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition flex items-center gap-2 shadow-md disabled:opacity-50"
                    >
                        {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} {isSaving ? 'Salvando...' : 'Salvar Fluxo'}
                    </button>
                    <button 
                        onClick={handleTestFlow}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition flex items-center gap-2 shadow-md"
                    >
                        <Send size={18} /> Testar
                    </button>
                </div>
            </header>

            {/* Main Content Area */}
            <div className="flex flex-1 overflow-hidden">
                {/* Paleta de Blocos */}
                <NodePalette onDragStart={onDragStart} />
                
                {/* Área de Construção (Canvas) */}
                <div 
                    ref={flowContainerRef}
                    className={`flex-1 relative bg-slate-100 dark:bg-slate-900/50 overflow-auto ${connectingNodeId !== null ? 'cursor-crosshair' : 'cursor-default'}`}
                    onDrop={onDrop}
                    onDragOver={onDragOver}
                    onMouseUp={handleNodeMouseUp} 
                    onMouseDown={(e) => {
                        // Limpa a seleção e conexão pendente apenas se o clique for no canvas vazio
                        if (e.target === flowContainerRef.current) {
                            handleNodeMouseUp(); // Para o drag/conexão pendente
                            setSelectedNode(null);
                        }
                    }} 
                >
                    {/* Linhas de fundo para visualização */}
                    <div className="absolute inset-0 bg-repeat bg-center z-10" style={{ 
                        backgroundImage: "linear-gradient(to right, #e2e8f0 1px, transparent 1px), linear-gradient(to bottom, #e2e8f0 1px, transparent 1px)",
                        backgroundSize: "20px 20px" 
                    }}></div>
                    
                    {/* Linhas de Conexão */}
                    {renderConnections()}
                    
                    {/* Renderiza os Nós */}
                    {nodes.map(node => (
                        <NodeRenderer 
                            key={node.id} 
                            node={node} 
                            selectedNode={selectedNode}
                            connectingNodeId={connectingNodeId}
                            handleNodeMouseDown={handleNodeMouseDown}
                            startConnecting={startConnecting}
                            deleteNode={deleteNode}
                            handleConnectNodes={handleConnectNodes} // Passado para a porta IN
                        />
                    ))}
                    
                    {/* Mensagem de instrução */}
                    {nodes.length === 0 && (
                         <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 p-8 z-0">
                            <GitBranch size={48} className="mb-4" />
                            <p className="text-lg font-semibold">Arraste e solte um bloco da paleta para começar seu fluxo.</p>
                            <p className="text-sm">O bloco "Início (Mensagem)" é o gatilho principal da automação.</p>
                        </div>
                    )}
                </div>

                {/* Painel de Configuração Lateral */}
                <NodeConfigPanel 
                    flowId={flowId}
                    node={selectedNode}
                    updateNode={updateNode}
                    onClose={() => setSelectedNode(null)}
                    api={api}
                />
            </div>
        </div>
    );
};

// ===============================================
// Componente de Renderização de Nó (separado)
// ===============================================
const NodeRenderer = ({ node, selectedNode, connectingNodeId, handleNodeMouseDown, startConnecting, deleteNode, handleConnectNodes }) => {
    let IconComponent = MessageSquare;
    let color = 'bg-emerald-600';
    let borderColor = 'border-slate-300 dark:border-slate-700';

    switch(node.type) {
        case 'trigger': IconComponent = Zap; color = 'bg-purple-600'; break;
        case 'message': IconComponent = MessageSquare; color = 'bg-emerald-600'; break;
        case 'delay': IconComponent = Clock; color = 'bg-blue-600'; break;
        case 'condition': IconComponent = CornerDownRight; color = 'bg-amber-600'; break;
        case 'api': IconComponent = Shield; color = 'bg-red-600'; break;
        case 'buttons': IconComponent = Radio; color = 'bg-yellow-600'; break;
        case 'list': IconComponent = List; color = 'bg-cyan-600'; break;
    }
    
    if (selectedNode && selectedNode.id === node.id) {
        borderColor = 'border-4 border-dashed border-emerald-500 shadow-emerald-500/50';
    } else if (connectingNodeId === node.id) {
         borderColor = 'border-4 border-solid border-blue-600 shadow-blue-500/50';
    } else {
         borderColor = 'border-slate-300 dark:border-slate-700';
    }


    return (
        <div 
            id={`node-${node.id}`} 
            style={{ top: node.y, left: node.x }}
            // Adicionado pointer-events: auto para garantir que o div capture os eventos de mouse
            className={`absolute w-52 p-4 rounded-xl shadow-xl ${borderColor} bg-white dark:bg-slate-800 transition-all hover:shadow-2xl z-20 cursor-move pointer-events-auto`} 
            onMouseDown={(e) => {
                // Inicia o modo de mover/selecionar
                handleNodeMouseDown(e, node);
            }}
            title={node.label}
        >
            {/* Porta de Entrada (Recebe conexões) */}
            <div 
                className={`in-port absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 pointer-events-auto ${connectingNodeId !== null ? 'hover:bg-blue-500' : 'hover:bg-slate-200'}`}
                onMouseDown={(e) => {
                    e.stopPropagation(); // Evita que o click suba para o container do nó e inicie o drag
                    // Finaliza a conexão ao clicar na porta de entrada
                    if (connectingNodeId !== null && connectingNodeId !== node.id) {
                        handleConnectNodes(connectingNodeId, node.id);
                    }
                }}
            ></div>

            <div className="flex items-center justify-between border-b pb-2 mb-2 border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-2">
                    <div className={`p-1 rounded ${color} text-white`}>
                        <IconComponent size={18} />
                    </div>
                    <span className="font-bold text-sm text-slate-800 dark:text-white truncate max-w-[120px]">{node.label}</span>
                </div>
                <button 
                    onClick={(e) => { e.stopPropagation(); }} 
                    className='text-slate-400 hover:text-blue-500 transition' 
                    title="Configurar Nó"
                >
                    <Settings size={16} />
                </button>
            </div>
            
            <div className="text-xs text-slate-500 dark:text-slate-400">
                {/* Resumo do conteúdo */}
                {node.type === 'trigger' && (node.content?.trigger_keyword ? `Gatilho: ${node.content.trigger_keyword.split(',')[0]}...` : 'Sem gatilho.')}
                {node.type === 'message' && (node.content?.text || node.content?.media_url ? 'Conteúdo definido.' : 'Mensagem vazia.')}
                {node.type === 'delay' && (node.content?.duration_seconds ? `Aguardar ${node.content.duration_seconds}s` : 'Delay de 5s.')}
                {node.type === 'condition' && (node.content?.condition_check ? `SE: ${node.content.condition_check.substring(0, 15)}...` : 'Condição indefinida.')}
                {node.type === 'api' && (node.content?.eclipse_command ? `Comando: ${node.content.eclipse_command}` : 'API Eclipse.')}
                {node.type === 'buttons' && 'Botões: ' + (node.content?.options?.length || 0)}
                {node.type === 'list' && 'Lista: ' + (node.content?.options?.length || 0) + ' Linhas'}

                <div className="mt-3 flex justify-end items-center">
                    <Trash2 
                        size={14} 
                        className='text-red-500 cursor-pointer hover:text-red-700 transition' 
                        onClick={(e) => { e.stopPropagation(); deleteNode(node.id); }}
                        title="Remover Nó"
                    />
                </div>
            </div>
            
            {/* Porta de Saída (Envia conexões) - Typebot style */}
            <div 
                className="out-port absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full border-2 border-emerald-500 bg-white dark:bg-slate-800 hover:bg-emerald-200 pointer-events-auto"
                onMouseDown={(e) => {
                    e.stopPropagation(); // Evita que o click suba para o container do nó e inicie o drag
                    startConnecting(node.id);
                }}
            ></div>
        </div>
    );
}

// ... Componentes NodePalette e NodeItem (Mantidos)

const NodePalette = ({ onDragStart }) => (
    <div className="w-64 bg-white dark:bg-slate-800 p-4 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 flex-shrink-0 space-y-4 h-full overflow-y-auto z-40">
        <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Plus size={18} className="text-emerald-600" /> Blocos
        </h2>
        
        <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-500 uppercase pt-2 border-t dark:border-slate-700">Gatilhos</p>
            <NodeItem 
                icon={Zap} 
                label="Início (Mensagem)" 
                type="trigger"
                onDragStart={onDragStart}
                color="bg-purple-600"
            />
            
            <p className="text-xs font-semibold text-slate-500 uppercase pt-4 border-t dark:border-slate-700">Ações WA</p>
            <NodeItem 
                icon={MessageSquare} 
                label="Enviar Mensagem" 
                type="message"
                onDragStart={onDragStart}
                color="bg-emerald-600"
            />
            <NodeItem 
                icon={Radio} 
                label="Botões Quick Reply" 
                type="buttons"
                onDragStart={onDragStart}
                color="bg-yellow-600"
            />
             <NodeItem 
                icon={List} 
                label="Lista de Opções" 
                type="list"
                onDragStart={onDragStart}
                color="bg-cyan-600"
            />
            <NodeItem 
                icon={Clock} 
                label="Aguardar (Delay)" 
                type="delay"
                onDragStart={onDragStart}
                color="bg-blue-600"
            />
            <NodeItem 
                icon={CornerDownRight} 
                label="Condição (Se/Então)" 
                type="condition"
                onDragStart={onDragStart}
                color="bg-amber-600"
            />
             <NodeItem 
                icon={Shield} 
                label="Comando Eclipse" 
                type="api"
                onDragStart={onDragStart}
                color="bg-red-600"
            />
        </div>
    </div>
);

const NodeItem = ({ icon: Icon, label, type, onDragStart, color }) => (
    <div 
        className={`flex items-center gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-700 cursor-grab transition hover:bg-slate-50 dark:hover:bg-slate-700`}
        draggable
        onDragStart={(e) => onDragStart(e, type)}
    >
        <div className={`p-1 rounded-md ${color} text-white`}>
            <Icon size={18} />
        </div>
        <span className="text-sm font-medium text-slate-800 dark:text-white">{label}</span>
    </div>
);

export default FlowBuilder;