import React from 'react';
import { Check, X, AlertTriangle, Smartphone } from 'lucide-react';

const Modal = ({ isOpen, onClose, type, title, message, onConfirm, children }) => {
  if (!isOpen) return null;
  const isConfirm = type === 'confirm';
  const isError = type === 'error';
  
  let icon = <Check size={24} />;
  let colorClass = 'bg-green-100 text-green-600';
  let btnClass = 'bg-green-600 hover:bg-green-700';

  if (isError) {
      icon = <X size={24} />;
      colorClass = 'bg-red-100 text-red-600';
      btnClass = 'bg-red-600 hover:bg-red-700';
  } else if (isConfirm) {
      icon = <AlertTriangle size={24} />;
      colorClass = 'bg-amber-100 text-amber-600';
      btnClass = 'bg-emerald-600 hover:bg-emerald-700';
  } else if (type === 'connect') {
      icon = <Smartphone size={24} />;
      colorClass = 'bg-blue-100 text-blue-600';
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4 transform transition-all scale-100 border border-slate-100 dark:border-slate-700">
        {type !== 'connect' && (
            <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 mx-auto ${colorClass}`}>
              {icon}
            </div>
        )}
        <h3 className="text-xl font-bold text-center text-slate-800 dark:text-white mb-2">{title}</h3>
        
        {children ? children : <p className="text-center text-slate-500 dark:text-slate-400 mb-6 break-words">{message}</p>}
        
        {!children && (
            <div className="flex gap-3 mt-4">
                {isConfirm ? (
                    <>
                        <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition">Cancelar</button>
                        <button onClick={() => { onConfirm(); onClose(); }} className="flex-1 py-3 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 transition">Confirmar</button>
                    </>
                ) : (
                    <button onClick={onClose} className={`w-full py-3 rounded-xl font-bold text-white transition ${btnClass}`}>
                      Entendido
                    </button>
                )}
            </div>
        )}
      </div>
    </div>
  );
};

export default Modal;
