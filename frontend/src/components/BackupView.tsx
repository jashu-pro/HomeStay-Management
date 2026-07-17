import React, { useState, useRef } from 'react';
import { translations, Language } from '../lib/translations';
import { Download, Upload, ShieldCheck, ShieldAlert, AlertTriangle, FileCheck, LogOut } from 'lucide-react';

interface BackupViewProps {
  lang: Language;
  token: string;
  role: 'admin' | 'viewer';
  username: string;
}

export default function BackupView({ lang, token, role, username }: BackupViewProps) {
  const t = translations[lang];
  const isAdmin = role === 'admin';
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const handleExportBackup = async () => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/backup/export', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error('Failed to retrieve backup file.');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `homestay_backup_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      setSuccess('Database secure backup file exported and downloaded successfully!');
    } catch (err: any) {
      setError(err.message || 'Export failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError('');
    setSuccess('');
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        setLoading(true);
        const restoreData = JSON.parse(reader.result as string);
        
        // Structure check validation
        if (!restoreData.users || !restoreData.guests || !restoreData.bookings || !restoreData.rooms) {
          throw new Error('Invalid file structure. Make sure you selected a valid homestay_backup.json file.');
        }

        const res = await fetch('/api/backup/restore', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ restoreData })
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Restore failed.');
        }

        setSuccess('Homestay database fully restored and initialized from backup file!');
        if (fileInputRef.current) fileInputRef.current.value = '';
      } catch (err: any) {
        setError(err.message || 'Parsing backup file failed.');
      } finally {
        setLoading(false);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs">
        <h2 className="text-xl font-sans font-bold text-slate-900">{t.dataBackup}</h2>
        <p className="text-xs text-slate-500 mt-1">
          {lang === 'en' ? 'Manage legal databases, execute hot backups, and restore operations.' : 'డేటాబేస్ బ్యాకప్ ఫైల్స్ డౌన్‌లోడ్ మరియు రీస్టోర్ అభ్యర్థనలను ఇక్కడ నిర్వహించండి.'}
        </p>
      </div>

      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2 shadow-xs">
          <ShieldCheck className="w-4 h-4 text-emerald-600 animate-bounce" />
          {success}
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center gap-2 shadow-xs">
          <AlertTriangle className="w-4 h-4 text-rose-600 animate-pulse" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Role and Session Status Box */}
        <div className="bg-white border border-slate-200/80 p-5 rounded-xl space-y-4 shadow-xs">
          <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">Security & Authorization Overview</h3>
          
          <div className="flex items-start gap-3 bg-slate-50 p-4 rounded-lg border border-slate-100">
            <div className={`p-2.5 rounded-lg border ${isAdmin ? 'text-emerald-600 bg-emerald-50 border-emerald-200' : 'text-blue-600 bg-blue-50 border-blue-200'}`}>
              {isAdmin ? <ShieldCheck className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
            </div>
            <div>
              <span className="text-[10px] font-mono text-slate-400">{t.roleBasedAccess}</span>
              <h4 className="text-sm font-sans font-bold text-slate-800 mt-0.5">{t.activeUser} <span className="text-blue-600 font-bold">@{username}</span></h4>
              <p className="text-[11px] text-slate-500 leading-normal mt-2">
                {isAdmin ? t.adminNotice : t.viewerNotice}
              </p>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg flex items-center gap-3">
            <LogOut className="w-5 h-5 text-amber-600 shrink-0" />
            <div className="text-[11px] text-amber-800 leading-normal">
              <strong>Auto-Logout Active:</strong> {t.autoLogoutText}
            </div>
          </div>
        </div>

        {/* Database backup buttons */}
        <div className="bg-white border border-slate-200/80 p-5 rounded-xl space-y-5 shadow-xs">
          <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">Data Management</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            All homestay guest logs, invoices, visitor histories, and payments can be packaged into a single JSON file. Backup this data regularly to preserve security audits.
          </p>

          <div className="space-y-3 pt-2">
            
            {/* Export Backup Button */}
            <button
              onClick={handleExportBackup}
              disabled={loading || !isAdmin}
              className={`w-full py-3 px-4 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                isAdmin 
                  ? 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-md shadow-blue-600/10' 
                  : 'bg-slate-50 border border-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              <Download className="w-4 h-4" />
              <span>{t.backupBtn}</span>
            </button>

            {/* Import Backup File upload */}
            {isAdmin ? (
              <label className="w-full py-3 px-4 rounded-lg text-xs font-bold transition-all border border-dashed border-slate-200 hover:border-blue-300 bg-white hover:bg-blue-50/20 text-slate-600 hover:text-blue-600 cursor-pointer flex items-center justify-center gap-2 group">
                <Upload className="w-4 h-4 text-slate-400 group-hover:text-blue-600" />
                <span>{t.restoreBtn}</span>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".json"
                  onChange={handleImportBackup}
                  className="hidden"
                />
              </label>
            ) : (
              <div className="w-full py-3 px-4 rounded-lg text-xs font-bold text-center border border-slate-200 text-slate-400 bg-slate-50 select-none cursor-not-allowed">
                {t.restoreBtn} (Admin Only)
              </div>
            )}

            <span className="block text-[10px] text-slate-400 text-center font-mono">
              * Accepted format: .json generated files only.
            </span>

          </div>
        </div>

      </div>
    </div>
  );
}
