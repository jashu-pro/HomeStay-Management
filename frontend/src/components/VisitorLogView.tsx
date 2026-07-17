import React, { useState, useEffect } from 'react';
import { translations, Language } from '../lib/translations';
import { VisitorLog } from '../types';
import { 
  Plus, Search, UserCheck, Edit3, Trash2, X, AlertTriangle, ShieldCheck, Clipboard
} from 'lucide-react';

interface VisitorLogViewProps {
  lang: Language;
  token: string;
  role: 'admin' | 'viewer';
}

export default function VisitorLogView({ lang, token, role }: VisitorLogViewProps) {
  const t = translations[lang];
  const isAdmin = role === 'admin';

  const [visitorLogs, setVisitorLogs] = useState<VisitorLog[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Modals state
  const [showModal, setShowModal] = useState(false);
  const [formId, setFormId] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [logToDelete, setLogToDelete] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Form Fields
  const [guestName, setGuestName] = useState('');
  const [arrive, setArrive] = useState('');
  const [depart, setDepart] = useState('');
  const [purpose, setPurpose] = useState('');
  const [visitorsCount, setVisitorsCount] = useState(1);
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/visitors?search=${encodeURIComponent(search)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setVisitorLogs(await res.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [search, token]);

  const resetForm = () => {
    setFormId('');
    setGuestName('');
    setArrive(new Date().toISOString().substring(0, 16));
    setDepart('');
    setPurpose('');
    setVisitorsCount(1);
    setVehicleNumber('');
    setEmergencyContact('');
    setError('');
  };

  const handleOpenAddModal = () => {
    resetForm();
    setShowModal(true);
  };

  const closeModal = () => {
    resetForm();
    setShowModal(false);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showModal) {
        closeModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showModal]);

  const handleOpenEditModal = (log: VisitorLog) => {
    resetForm();
    setFormId(log.id);
    setGuestName(log.guestName);
    setArrive(log.arrive);
    setDepart(log.depart);
    setPurpose(log.purpose);
    setVisitorsCount(log.visitorsCount);
    setVehicleNumber(log.vehicleNumber);
    setEmergencyContact(log.emergencyContact);
    setShowModal(true);
  };

  const handleSaveLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName || !arrive || !purpose) {
      setError('Please fill in Guest Name, Arrival time, and Purpose of stay.');
      return;
    }

    const payload = {
      guestName,
      arrive,
      depart,
      purpose,
      visitorsCount: Number(visitorsCount),
      vehicleNumber,
      emergencyContact
    };

    try {
      const url = formId ? `/api/visitors/${formId}` : '/api/visitors';
      const method = formId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to record entry.');
      }

      setSuccess(formId ? 'Visitor entry modified.' : 'Visitor entry recorded successfully.');
      setShowModal(false);
      fetchLogs();
      setTimeout(() => setSuccess(''), 4000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleConfirmDelete = async () => {
    if (!logToDelete) return;
    setDeleteLoading(true);
    setDeleteError('');

    try {
      const res = await fetch(`/api/visitors/${logToDelete}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        setSuccess('Entry moved to Recycle Bin successfully.');
        fetchLogs();
        setTimeout(() => setSuccess(''), 4000);
        setShowDeleteModal(false);
        setLogToDelete(null);
      } else {
        const data = await res.json();
        setDeleteError(data.error || 'Failed to move log to Recycle Bin.');
      }
    } catch (err: any) {
      console.error(err);
      setDeleteError(err.message || 'An unexpected error occurred.');
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Action */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="text-xl font-sans font-bold text-slate-900">{t.visitorLog}</h2>
          <p className="text-xs text-slate-500 mt-1">
            {lang === 'en' ? 'Maintain precise legal register of external visitors, vehicle entries, and timings.' : 'సిబ్బంది లేదా అతిథుల సందర్శకులు, వారి వాహనం మరియు వచ్చే/వెళ్లే వివరాలను నమోదు చేయండి.'}
          </p>
        </div>
        {isAdmin && (
          <button
            id="add-visitor-btn"
            onClick={handleOpenAddModal}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-xs font-semibold tracking-wider transition-all flex items-center gap-2 shadow-md shadow-blue-600/10 self-stretch sm:self-auto justify-center cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{t.addVisitor}</span>
          </button>
        )}
      </div>

      {success && (
        <div id="visitor-success" className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2 shadow-xs">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          {success}
        </div>
      )}

      {/* Search system */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 flex flex-col md:flex-row gap-4 items-center shadow-xs">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
          <input
            id="visitor-search-input"
            type="text"
            placeholder={lang === 'en' ? 'Search by hosting guest, vehicle number, purpose...' : 'సందర్శకుడు, వాహనం నంబర్ ద్వారా వెతకండి...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-lg pl-10 pr-4 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div className="text-[11px] font-mono text-slate-500 shrink-0">
          {visitorLogs.length} {lang === 'en' ? 'entries recorded' : 'నమోదులు కనుగొనబడ్డాయి'}
        </div>
      </div>

      {/* Table List */}
      {loading ? (
        <div className="flex justify-center items-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
        </div>
      ) : visitorLogs.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200/80 py-16 text-center text-slate-500 space-y-3 shadow-xs">
          <Clipboard className="w-12 h-12 mx-auto text-slate-300 stroke-1" />
          <p className="text-xs font-mono">{lang === 'en' ? 'No visitor logs registered.' : 'సందర్శకుల నమోదులు లేవు.'}</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-slate-600 text-[10px] font-mono uppercase tracking-wider">
                  <th className="py-4 px-5">{t.guestName}</th>
                  <th className="py-4 px-5">{t.arriveTime}</th>
                  <th className="py-4 px-5">{t.departTime}</th>
                  <th className="py-4 px-5">{t.purpose}</th>
                  <th className="py-4 px-5">{t.vehicleNumber}</th>
                  <th className="py-4 px-5">{t.emergencyContact}</th>
                  {isAdmin && <th className="py-4 px-5 text-right">{t.actions}</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-800">
                {visitorLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 px-5">
                      <div className="font-semibold text-slate-900">{log.guestName}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{log.visitorsCount} visitor(s)</div>
                    </td>
                    <td className="py-4 px-5 font-mono text-slate-600">{log.arrive.replace('T', ' ')}</td>
                    <td className="py-4 px-5 font-mono text-slate-600">{log.depart ? log.depart.replace('T', ' ') : <span className="text-amber-600 font-sans italic font-bold">In-house</span>}</td>
                    <td className="py-4 px-5 max-w-[200px] truncate text-slate-700" title={log.purpose}>{log.purpose}</td>
                    <td className="py-4 px-5 font-mono uppercase text-blue-600 font-semibold">{log.vehicleNumber || '-'}</td>
                    <td className="py-4 px-5 font-mono text-slate-600">{log.emergencyContact || '-'}</td>
                    {isAdmin && (
                      <td className="py-4 px-5 text-right space-x-1.5 shrink-0 whitespace-nowrap">
                        <button
                          onClick={() => handleOpenEditModal(log)}
                          className="p-1.5 bg-white border border-slate-200 rounded hover:border-blue-500 hover:text-blue-600 text-slate-500 transition-all cursor-pointer"
                          title={t.edit}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            setLogToDelete(log.id);
                            setDeleteError('');
                            setDeleteLoading(false);
                            setShowDeleteModal(true);
                          }}
                          className="p-1.5 bg-white border border-slate-200 rounded hover:border-rose-500 hover:text-rose-600 text-slate-500 transition-all cursor-pointer"
                          title={t.delete}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ---------------- MODAL FORM ENTRY ---------------- */}
      {showModal && (
        <div onClick={closeModal} className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div onClick={(e) => e.stopPropagation()} className="bg-white border border-slate-200 w-full max-w-md rounded-xl shadow-xl animate-scaleUp max-h-[90vh] overflow-y-auto">
            
            <div className="flex justify-between items-center p-5 border-b border-slate-100">
              <h3 className="text-md font-sans font-bold text-slate-900 flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-blue-600" />
                {formId ? 'Edit Visitor Entry' : t.addVisitor}
              </h3>
              <button 
                type="button"
                onClick={closeModal}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-all cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {error && (
              <div className="mx-5 mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                {error}
              </div>
            )}

            <form onSubmit={handleSaveLog} className="p-5 space-y-4">
              
              <div>
                <label className="block text-[10px] font-mono text-slate-500 mb-1">{t.guestName} *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Kumar"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-mono text-slate-500 mb-1">{t.arriveTime} *</label>
                  <input
                    type="datetime-local"
                    required
                    value={arrive}
                    onChange={(e) => setArrive(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none font-mono focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-slate-500 mb-1">{t.departTime}</label>
                  <input
                    type="datetime-local"
                    value={depart}
                    onChange={(e) => setDepart(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none font-mono focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-mono text-slate-500 mb-1">{t.visitorsCount}</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={visitorsCount}
                    onChange={(e) => setVisitorsCount(Number(e.target.value))}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none font-mono focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-slate-500 mb-1">{t.vehicleNumber}</label>
                  <input
                    type="text"
                    placeholder="e.g. TS09-XY-1234"
                    value={vehicleNumber}
                    onChange={(e) => setVehicleNumber(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none font-mono uppercase focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-mono text-slate-500 mb-1">{t.emergencyContact}</label>
                <input
                  type="tel"
                  placeholder="e.g. 9848022338"
                  value={emergencyContact}
                  onChange={(e) => setEmergencyContact(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none font-mono focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono text-slate-500 mb-1">{t.purpose} *</label>
                <textarea
                  required
                  placeholder="e.g. Business discussion / Friend meetup"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none h-20 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 bg-slate-500 hover:bg-slate-600 text-white rounded-lg text-xs font-semibold cursor-pointer transition-all"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
                >
                  {t.save}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ---------------- DELETE CONFIRMATION MODAL ---------------- */}
      {showDeleteModal && (
        <div onClick={() => { setShowDeleteModal(false); setLogToDelete(null); }} className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div onClick={(e) => e.stopPropagation()} className="bg-white border border-slate-200 w-full max-w-sm rounded-xl shadow-xl animate-scaleUp p-5 text-center space-y-4">
            <div className="w-12 h-12 bg-rose-50 border border-rose-200 rounded-full flex items-center justify-center mx-auto text-rose-600">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-md font-sans font-bold text-slate-900">
                {lang === 'en' ? 'Move to Recycle Bin?' : 'రీసైకిల్ బిన్‌కి తరలించాలా?'}
              </h3>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                {lang === 'en' 
                  ? 'Are you sure you want to move this visitor log entry to the Recycle Bin? It can be restored or permanently cleared later.' 
                  : 'సందర్శకుల నమోదును రీసైకిల్ బిన్‌కి తరలించాలనుకుంటున్నారా? తరువాత రీస్టోర్ చేసుకోవచ్చు.'}
              </p>
            </div>

            {deleteError && (
              <div className="p-3 bg-rose-50 border border-rose-100 rounded-lg text-rose-800 text-xs flex items-start gap-2 text-left">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                <span>{deleteError}</span>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => { setShowDeleteModal(false); setLogToDelete(null); }}
                disabled={deleteLoading}
                className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed text-slate-700 rounded-lg text-xs font-semibold cursor-pointer transition-all border border-slate-200"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleteLoading}
                className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-400 disabled:cursor-not-allowed text-white rounded-lg text-xs font-semibold cursor-pointer transition-all"
              >
                {deleteLoading 
                  ? (lang === 'en' ? 'Moving...' : 'తరలిస్తోంది...') 
                  : (lang === 'en' ? 'Yes, Move' : 'అవును, తరలించు')}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
