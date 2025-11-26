import React, { useState } from 'react';
import { Zap, CheckCircle, Loader2 } from 'lucide-react';

const Login = ({ onLogin, theme }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
      setLoading(true);
      setError('');
      try {
          await onLogin({ username, password });
      } catch (err) {
          setError('Usuário ou senha incorretos.');
      }
      setLoading(false);
  };

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-900 transition-colors duration-300 ${theme}`}>
      <div className="bg-white dark:bg-slate-800 w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row h-[600px] animate-fade-in border border-slate-100 dark:border-slate-800">
        
        {/* Left Side (Form) */}
        <div className="flex-1 p-12 flex flex-col justify-center relative">
          <div className="mb-10">
            <div className="w-12 h-12 bg-emerald-600 rounded-xl flex items-center justify-center text-white mb-6 shadow-lg shadow-emerald-600/20">
               <Zap size={28} fill="currentColor"/>
            </div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2 tracking-tight">Bem-vindo de volta.</h1>
            <p className="text-slate-500 dark:text-slate-400">Faça login para gerenciar suas automações.</p>
          </div>

          <div className="space-y-4">
            {error && <div className="text-red-500 text-sm font-medium bg-red-50 p-3 rounded-lg">{error}</div>}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Usuário</label>
              <input 
                className="w-full p-3.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 dark:text-white transition" 
                placeholder="ex: agoa"
                value={username}
                onChange={e => setUsername(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Senha</label>
              <input 
                className="w-full p-3.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 dark:text-white transition" 
                placeholder="••••••••"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>
            
            <button 
              onClick={handleSubmit}
              disabled={loading}
              className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold hover:bg-emerald-700 transition shadow-lg shadow-emerald-600/30 text-lg mt-4 flex justify-center"
            >
              {loading ? <Loader2 className="animate-spin" /> : "Entrar na Plataforma"}
            </button>
          </div>

          <div className="mt-auto pt-6 text-center text-xs text-slate-400">
            &copy; 2024 NexBot Enterprise. Todos os direitos reservados.
          </div>
        </div>

        {/* Right Side (Visual) */}
        <div className="hidden md:flex flex-1 bg-emerald-900 relative items-center justify-center p-12 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-600 to-emerald-900 opacity-90"></div>
          <div className="absolute top-0 right-0 w-96 h-96 bg-white opacity-5 rounded-full blur-3xl -mr-20 -mt-20"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-400 opacity-10 rounded-full blur-3xl -ml-10 -mb-10"></div>
          
          <div className="relative z-10 text-white max-w-sm">
             <div className="mb-6 inline-block p-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10">
                <CheckCircle size={32} className="text-emerald-300" />
             </div>
             <h2 className="text-3xl font-bold mb-4 leading-tight">Automatize seu WhatsApp em escala.</h2>
             <p className="text-emerald-100/80 leading-relaxed">
               Conecte-se com seus clientes, gerencie grupos e venda mais com nossa plataforma enterprise.
             </p>
             
             <div className="mt-8 flex gap-2">
               <div className="w-2 h-2 rounded-full bg-white"></div>
               <div className="w-2 h-2 rounded-full bg-white/30"></div>
               <div className="w-2 h-2 rounded-full bg-white/30"></div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
