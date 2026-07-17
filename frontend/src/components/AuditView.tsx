import React, { useState, useEffect } from 'react';
import { translations, Language } from '../lib/translations';
import { AuditLog } from '../types';
import { ShieldAlert, RefreshCw, Calendar, User } from 'lucide-react';

interface AuditViewProps {
  lang: Language;
  token: string;
}

export default function AuditView({ lang, token }: AuditViewProps) {
  const t = translations[lang];
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/audit-logs', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setLogs(await res.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [token]);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex justify-between items-center bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="text-xl font-sans font-bold text-slate-900">{t.auditTrail}</h2>
          <p className="text-xs text-slate-500 mt-1">
            {lang === 'en' ? 'Review all system state transactions, secure credentials validation, and role modifications.' : 'వ్యవస్థలో జరిగిన మార్పులు, లాగిన్లు మరియు లావాదేవీల పూర్తి సెక్యూరిటీ చరిత్రను ఇక్కడ చూడండి.'}
          </p>
        </div>
        <button
          onClick={fetchLogs}
          className="p-2.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-slate-600 hover:text-slate-800 transition-all flex items-center gap-1 text-xs font-semibold cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Logs Listing */}
      {loading ? (
        <div className="flex justify-center items-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
        </div>
      ) : logs.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 py-16 text-center text-slate-500 space-y-3 shadow-xs">
          <ShieldAlert className="w-12 h-12 mx-auto text-slate-300 stroke-1" />
          <p className="text-xs font-mono">No actions recorded in audit trail.</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
          {logs.map((log) => (
            <div key={log.id} className="bg-white hover:bg-slate-50/50 border border-slate-200/80 p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all shadow-xs">
              
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 text-[9px] font-mono font-bold uppercase rounded ${
                    log.action.includes('CREATE') ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/50' :
                    log.action.includes('UPDATE') ? 'bg-blue-50 text-blue-800 border border-blue-200/50' :
                    log.action.includes('DELETE') ? 'bg-rose-50 text-rose-800 border border-rose-200/50' :
                    'bg-slate-50 text-slate-700 border border-slate-200'
                  }`}>
                    {log.action}
                  </span>
                  <span className="text-xs font-sans text-slate-900 font-semibold">{log.details}</span>
                </div>
                
                <div className="flex items-center gap-4 text-[10px] text-slate-500 font-mono">
                  <span className="flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    Operator: <span className="text-blue-600 font-bold">{log.username} ({log.userId})</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    Timestamp: {new Date(log.timestamp).toLocaleString()}
                  </span>
                </div>
              </div>

              <span className="text-[10px] font-mono text-slate-400 shrink-0 self-start md:self-auto uppercase">
                ID: {log.id}
              </span>

            </div>
          ))}
        </div>
      )}
    </div>
  );
}
