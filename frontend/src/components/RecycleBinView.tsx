import React, { useState, useEffect } from 'react';
import { 
  Trash2, RotateCcw, Eye, Search, Settings, AlertCircle, Calendar, User, Phone, 
  ShieldCheck, Clock, ShieldAlert, X, AlertTriangle, FileText, CheckCircle
} from 'lucide-react';
import { RecycleBinItem, CleanupSettings } from '../types';
import { translations, Language } from '../lib/translations';

interface RecycleBinViewProps {
  lang: Language;
  token: string;
  role: 'admin' | 'viewer';
}

export default function RecycleBinView({ lang, token, role }: RecycleBinViewProps) {
  const t = translations[lang];
  const isAdmin = role === 'admin';

  // State variables
  const [items, setItems] = useState<RecycleBinItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Search and Filter states
  const [search, setSearch] = useState('');
  const [selectedRoomFilter, setSelectedRoomFilter] = useState('all');

  // Auto-cleanup settings
  const [cleanupSettings, setCleanupSettings] = useState<CleanupSettings>({ retentionDays: 'never' });
  const [savingSettings, setSavingSettings] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Modal states
  const [viewingItem, setViewingItem] = useState<RecycleBinItem | null>(null);
  const [restoringItem, setRestoringItem] = useState<RecycleBinItem | null>(null);
  const [permanentlyDeletingItem, setPermanentlyDeletingItem] = useState<RecycleBinItem | null>(null);

  // Fetch Recycle Bin items
  const fetchItems = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/recycle-bin', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setItems(data);
      } else {
        const errData = await res.json();
        setError(errData.error || 'Failed to load Recycle Bin.');
      }
    } catch (err) {
      console.error(err);
      setError('Connection error loading Recycle Bin.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch auto-cleanup settings
  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/recycle-bin/settings', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCleanupSettings(data);
      }
    } catch (err) {
      console.error('Error fetching settings:', err);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchItems();
      fetchSettings();
    }
  }, [token, isAdmin]);

  // Handle setting update
  const handleUpdateSettings = async (retentionDays: 'never' | '30' | '60' | '90') => {
    try {
      setSavingSettings(true);
      const res = await fetch('/api/recycle-bin/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ retentionDays })
      });
      const data = await res.json();
      if (res.ok) {
        setCleanupSettings(data.cleanupSettings);
        setSuccess('Auto-cleanup settings updated successfully.');
        setTimeout(() => setSuccess(''), 4000);
      } else {
        setError(data.error || 'Failed to update cleanup policy.');
      }
    } catch (err) {
      console.error(err);
      setError('Connection error updating cleanup policy.');
    } finally {
      setSavingSettings(false);
    }
  };

  // Handle Restore
  const handleRestore = async () => {
    if (!restoringItem) return;
    try {
      const res = await fetch(`/api/recycle-bin/${restoringItem.id}/restore`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess('Guest record restored successfully.');
        setRestoringItem(null);
        fetchItems();
        setTimeout(() => setSuccess(''), 4000);
      } else {
        alert(data.error || 'Failed to restore guest record.');
      }
    } catch (err) {
      console.error(err);
      alert('Error connecting to server.');
    }
  };

  // Handle Permanent Delete
  const handlePermanentDelete = async () => {
    if (!permanentlyDeletingItem) return;
    try {
      const res = await fetch(`/api/recycle-bin/${permanentlyDeletingItem.id}/permanent`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess('Guest record permanently deleted.');
        setPermanentlyDeletingItem(null);
        fetchItems();
        setTimeout(() => setSuccess(''), 4000);
      } else {
        alert(data.error || 'Failed to permanently delete guest record.');
      }
    } catch (err) {
      console.error(err);
      alert('Error connecting to server.');
    }
  };

  // Filter items
  const filteredItems = items.filter(item => {
    const searchLower = search.toLowerCase();
    const guest = item.guest;
    if (!guest) return false;
    
    const matchesSearch = 
      guest.fullName.toLowerCase().includes(searchLower) ||
      guest.phone.toLowerCase().includes(searchLower) ||
      guest.aadhaarNumber.toLowerCase().includes(searchLower) ||
      (item.deletedBy && item.deletedBy.toLowerCase().includes(searchLower));

    // Get room numbers from bookings
    const rooms = item.bookings.map(b => b.roomNumber);
    const matchesRoom = selectedRoomFilter === 'all' || rooms.includes(selectedRoomFilter);

    return matchesSearch && matchesRoom;
  });

  // Extract unique room list for filters
  const allRoomsInRecycleBin = Array.from(
    new Set(items.flatMap(item => item.bookings.map(b => b.roomNumber)))
  ).sort();

  if (!isAdmin) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-4 max-w-lg mx-auto mt-12 shadow-xs">
        <div className="p-3.5 bg-rose-50 border border-rose-100 rounded-full w-14 h-14 flex items-center justify-center mx-auto text-rose-500">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-lg font-sans font-bold text-slate-900">Access Denied</h2>
        <p className="text-xs text-slate-500 leading-relaxed">
          The Recycle Bin is a high-privilege system reserved for Administrators. Guest data, identity documents, billing information, and booking histories cannot be restored or permanently removed by staff viewers.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn font-sans">
      
      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Trash2 className="w-6 h-6 text-red-600 animate-pulse" />
            <h2 className="text-xl font-bold text-slate-900">Recycle Bin</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {lang === 'en' 
              ? 'View and manage soft-deleted guest profiles, legal identity records, bookings, and billing files.' 
              : 'సాఫ్ట్-డిలీట్ చేసిన అతిథి ప్రొఫైల్‌లు, వారి ప్రభుత్వ గుర్తింపు పత్రాలు, మరియు బిల్లింగ్ రికార్డులను ఇక్కడ నిర్వహించండి.'}
          </p>
        </div>

        {/* Action Toggle Settings */}
        <button
          onClick={() => setShowSettings(!showSettings)}
          className={`px-4 py-2.5 rounded-lg text-xs font-semibold border flex items-center gap-2 transition-all cursor-pointer ${
            showSettings 
              ? 'bg-blue-50 border-blue-200 text-blue-600' 
              : 'bg-white border-slate-200 hover:border-slate-300 text-slate-600 hover:text-slate-800'
          }`}
        >
          <Settings className={`w-4 h-4 ${showSettings ? 'rotate-45' : ''} transition-transform`} />
          <span>Auto-Cleanup Policy</span>
        </button>
      </div>

      {/* Success and Error Alerts */}
      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2.5 shadow-xs">
          <CheckCircle className="w-4 h-4 text-emerald-600" />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center gap-2.5 shadow-xs">
          <AlertTriangle className="w-4 h-4 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Auto-Cleanup Settings panel */}
      {showSettings && (
        <div className="bg-blue-50/40 border border-blue-100 p-5 rounded-xl space-y-4 animate-slideDown">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-blue-900 font-mono uppercase tracking-wider">Automated Storage Retention Settings</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Configure the automated permanent data deletion threshold. Soft-deleted records matching this policy will be purged from the storage system permanently.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <span className="text-xs text-slate-700 font-medium">Permanently purge guest data after:</span>
            <div className="inline-flex gap-1.5 p-1 bg-white border border-slate-200 rounded-lg shadow-2xs">
              {(['never', '30', '60', '90'] as const).map((days) => (
                <button
                  key={days}
                  onClick={() => handleUpdateSettings(days)}
                  disabled={savingSettings}
                  className={`px-3 py-1.5 rounded-md text-[11px] font-mono font-bold uppercase transition-all cursor-pointer ${
                    cleanupSettings.retentionDays === days
                      ? 'bg-red-600 text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  {days === 'never' ? 'Never (Default)' : `${days} Days`}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Search and Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by Guest Name, Aadhaar, Phone, or Deleted By..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-lg pl-10 pr-4 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div className="w-full md:w-48 shrink-0">
          <select
            value={selectedRoomFilter}
            onChange={(e) => setSelectedRoomFilter(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="all">All Deleted Rooms</option>
            {allRoomsInRecycleBin.map(roomNum => (
              <option key={roomNum} value={roomNum}>Room {roomNum}</option>
            ))}
          </select>
        </div>

        <div className="text-[11px] font-mono text-slate-400 shrink-0 self-center md:self-auto pt-1 md:pt-2.5">
          {filteredItems.length} records in trash
        </div>
      </div>

      {/* Recycle Bin Grid / Table */}
      {loading ? (
        <div className="flex justify-center items-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 py-16 text-center text-slate-400 space-y-4 shadow-xs">
          <div className="w-16 h-16 bg-slate-50 border border-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-300">
            <Trash2 className="w-8 h-8 stroke-1" />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-700">Recycle Bin is Empty</p>
            <p className="text-[11px] text-slate-400 max-w-xs mx-auto">No soft-deleted guest files or compliance records currently occupy the trash bin.</p>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden shadow-xs">
          <div className="overflow-x-auto font-sans">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 text-[10px] font-mono uppercase tracking-wider">
                  <th className="py-4 px-5">Guest Name</th>
                  <th className="py-4 px-5">Mobile & Aadhaar</th>
                  <th className="py-4 px-5">Room & Check-in</th>
                  <th className="py-4 px-5">Deleted Details</th>
                  <th className="py-4 px-5">Reason</th>
                  <th className="py-4 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/60 text-xs">
                {filteredItems.map((item) => {
                  const guest = item.guest;
                  // Grab room and check-in date from bookings
                  const roomNum = item.bookings.length > 0 ? item.bookings[0].roomNumber : 'N/A';
                  const checkInDate = item.bookings.length > 0 ? item.bookings[0].checkIn : 'N/A';

                  return (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors text-slate-600">
                      <td className="py-4 px-5">
                        <div className="font-bold text-slate-900 flex items-center gap-2">
                          {guest.fullName}
                          {item.id.startsWith('rb-v-') && (
                            <span className="px-1.5 py-0.5 bg-purple-50 text-[9px] font-mono font-bold uppercase text-purple-600 border border-purple-100 rounded">
                              Visitor Log
                            </span>
                          )}
                        </div>
                        <span className="inline-flex items-center gap-1 text-[9px] font-mono text-slate-400 uppercase tracking-widest mt-0.5">
                          {guest.nationality} • {guest.gender}
                        </span>
                      </td>
                      <td className="py-4 px-5 space-y-1">
                        <div className="flex items-center gap-1.5 font-mono text-slate-700">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>{guest.phone}</span>
                        </div>
                        <div className="text-[11px] text-blue-600 font-mono font-medium">
                          ID: {guest.aadhaarNumber}
                        </div>
                      </td>
                      <td className="py-4 px-5 space-y-1">
                        {item.id.startsWith('rb-v-') ? (
                          <>
                            <div className="font-bold text-purple-700 font-mono text-[11px]">
                              VISITOR ENTRY
                            </div>
                            <div className="flex items-center gap-1 text-[11px] font-mono text-slate-400">
                              <Clock className="w-3 h-3 shrink-0" />
                              <span>Arrived: {item.visitorLogs?.[0]?.arrive?.replace('T', ' ') || 'N/A'}</span>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="font-bold text-slate-800">
                              Room {roomNum}
                            </div>
                            <div className="flex items-center gap-1 text-[11px] font-mono text-slate-400">
                              <Calendar className="w-3 h-3 shrink-0" />
                              <span>Check-in: {checkInDate}</span>
                            </div>
                          </>
                        )}
                      </td>
                      <td className="py-4 px-5 space-y-1">
                        <div className="flex items-center gap-1 text-[11px] font-mono text-slate-700">
                          <Clock className="w-3 h-3 text-red-500 shrink-0" />
                          <span>{new Date(item.deletedAt).toLocaleString()}</span>
                        </div>
                        <div className="text-[10px] text-slate-400">
                          By: <span className="text-slate-600 font-medium font-mono">@{item.deletedBy}</span>
                        </div>
                      </td>
                      <td className="py-4 px-5 max-w-[160px] truncate">
                        <span className="text-[11px] text-slate-500 italic" title={item.reason || 'No reason provided'}>
                          {item.reason || '—'}
                        </span>
                      </td>
                      <td className="py-4 px-5 text-right space-x-1.5 shrink-0 whitespace-nowrap">
                        {/* View Details */}
                        <button
                          onClick={() => setViewingItem(item)}
                          className="p-1.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-600 hover:text-slate-800 rounded-lg transition-all cursor-pointer inline-flex items-center gap-1 text-[11px] font-bold"
                          title="View complete record details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span className="hidden lg:inline">View</span>
                        </button>

                        {/* Restore Button */}
                        <button
                          onClick={() => setRestoringItem(item)}
                          className="p-1.5 bg-emerald-50 border border-emerald-200 hover:border-emerald-300 text-emerald-700 hover:text-emerald-800 rounded-lg transition-all cursor-pointer inline-flex items-center gap-1 text-[11px] font-bold"
                          title="Restore all record details"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span className="hidden lg:inline">Restore</span>
                        </button>

                        {/* Permanent Delete Button */}
                        <button
                          onClick={() => setPermanentlyDeletingItem(item)}
                          className="p-1.5 bg-rose-50 border border-rose-200 hover:border-rose-300 text-rose-700 hover:text-rose-800 rounded-lg transition-all cursor-pointer inline-flex items-center gap-1 text-[11px] font-bold"
                          title="Permanently Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                          <span className="hidden lg:inline text-rose-600">Delete</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ---------------- MODAL: VIEW ITEM DETAILS (👁 VIEW) ---------------- */}
      {viewingItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 w-full max-w-4xl rounded-xl max-h-[90vh] overflow-y-auto shadow-xl animate-scaleUp">
            
            {/* Modal Header */}
            <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <Eye className="w-5 h-5 text-blue-600" />
                <h3 className="text-md font-sans font-bold text-slate-900">
                  {viewingItem.id.startsWith('rb-v-') ? 'Soft-Deleted Visitor Entry' : 'Soft-Deleted Guest Profile'}
                </h3>
                <span className="px-2 py-0.5 rounded-md bg-rose-100 text-[10px] font-mono font-bold uppercase text-rose-700 border border-rose-200">
                  Trash State
                </span>
              </div>
              <button 
                onClick={() => setViewingItem(null)}
                className="p-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-500 hover:text-slate-800 transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 overflow-y-auto">
              
              {/* Warnings Header */}
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-950 text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-bold">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span>Soft-Deleted Audit Flag</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-normal pl-5.5">
                  This profile was moved to the Recycle Bin on <span className="font-bold">{new Date(viewingItem.deletedAt).toLocaleString()}</span> by <span className="font-bold">@{viewingItem.deletedBy}</span>. Deletion Reason: <span className="italic">"{viewingItem.reason || 'None specified'}"</span>.
                </p>
              </div>

              {viewingItem.id.startsWith('rb-v-') ? (
                <div className="bg-slate-50 p-5 rounded-xl border border-slate-100 space-y-4">
                  <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200 pb-1">
                    Visitor Information
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-y-3.5 gap-x-2 text-xs">
                    <div>
                      <span className="block text-[10px] font-mono text-slate-400">Hosting Guest Name</span>
                      <span className="font-bold text-slate-900">{viewingItem.visitorLogs?.[0]?.guestName}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] font-mono text-slate-400">Number of Visitors</span>
                      <span className="text-slate-800 font-bold">{viewingItem.visitorLogs?.[0]?.visitorsCount}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] font-mono text-slate-400">Arrival Time</span>
                      <span className="text-slate-800 font-mono">{viewingItem.visitorLogs?.[0]?.arrive?.replace('T', ' ')}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] font-mono text-slate-400">Departure Time</span>
                      <span className="text-slate-800 font-mono">{viewingItem.visitorLogs?.[0]?.depart ? viewingItem.visitorLogs?.[0]?.depart?.replace('T', ' ') : 'In-house'}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] font-mono text-slate-400">Vehicle Number</span>
                      <span className="text-blue-600 font-mono font-bold uppercase">{viewingItem.visitorLogs?.[0]?.vehicleNumber || '—'}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] font-mono text-slate-400">Emergency Contact No</span>
                      <span className="text-slate-800 font-mono">{viewingItem.visitorLogs?.[0]?.emergencyContact || '—'}</span>
                    </div>
                    <div className="col-span-1 md:col-span-2">
                      <span className="block text-[10px] font-mono text-slate-400">Purpose of Visit</span>
                      <span className="text-slate-800 font-semibold leading-relaxed">
                        {viewingItem.visitorLogs?.[0]?.purpose}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    
                    {/* Profile Card details */}
                    <div className="bg-slate-50 p-5 rounded-xl border border-slate-100 space-y-4">
                      <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200 pb-1">
                        Personal Information
                      </h4>
                      <div className="grid grid-cols-2 gap-y-3.5 gap-x-2 text-xs">
                        <div>
                          <span className="block text-[10px] font-mono text-slate-400">Full Name</span>
                          <span className="font-bold text-slate-900">{viewingItem.guest.fullName}</span>
                        </div>
                        <div>
                          <span className="block text-[10px] font-mono text-slate-400">Gender / DOB</span>
                          <span className="text-slate-800">{viewingItem.guest.gender} • {viewingItem.guest.dob}</span>
                        </div>
                        <div>
                          <span className="block text-[10px] font-mono text-slate-400">Phone Number</span>
                          <span className="text-slate-800 font-mono">{viewingItem.guest.phone}</span>
                        </div>
                        <div>
                          <span className="block text-[10px] font-mono text-slate-400">Email Address</span>
                          <span className="text-slate-800">{viewingItem.guest.email || '—'}</span>
                        </div>
                        <div className="col-span-2">
                          <span className="block text-[10px] font-mono text-slate-400">Address</span>
                          <span className="text-slate-800 leading-relaxed">
                            {viewingItem.guest.address}, {viewingItem.guest.city}, {viewingItem.guest.state}, {viewingItem.guest.country} - {viewingItem.guest.pinCode}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Identity Cards details */}
                    <div className="bg-slate-50 p-5 rounded-xl border border-slate-100 space-y-4">
                      <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200 pb-1">
                        Legal Identifications
                      </h4>
                      <div className="grid grid-cols-2 gap-3.5 text-xs">
                        <div>
                          <span className="block text-[10px] font-mono text-slate-400">Aadhaar Number</span>
                          <span className="font-bold text-blue-600 font-mono">{viewingItem.guest.aadhaarNumber}</span>
                        </div>
                        <div>
                          <span className="block text-[10px] font-mono text-slate-400">Nationality</span>
                          <span className="text-slate-800">{viewingItem.guest.nationality}</span>
                        </div>
                        <div>
                          <span className="block text-[10px] font-mono text-slate-400">Passport Number</span>
                          <span className="text-slate-800 font-mono">{viewingItem.guest.passportNumber || '—'}</span>
                        </div>
                        <div>
                          <span className="block text-[10px] font-mono text-slate-400">Driving License</span>
                          <span className="text-slate-800 font-mono">{viewingItem.guest.drivingLicense || '—'}</span>
                        </div>
                      </div>
                    </div>

                  </div>

                  {/* Uploaded Documents */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-1">
                      Uploaded Aadhaar Documents
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col items-center justify-center min-h-[140px]">
                        <span className="text-[10px] font-mono text-slate-500 mb-2">Aadhaar Front Side</span>
                        {viewingItem.guest.aadhaarFront ? (
                          <img src={viewingItem.guest.aadhaarFront} alt="Aadhaar Front" className="max-h-[140px] rounded object-contain border border-slate-200 shadow-xs" referrerPolicy="no-referrer" />
                        ) : (
                          <span className="text-xs text-slate-400 italic">No document image uploaded</span>
                        )}
                      </div>

                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col items-center justify-center min-h-[140px]">
                        <span className="text-[10px] font-mono text-slate-500 mb-2">Aadhaar Back Side</span>
                        {viewingItem.guest.aadhaarBack ? (
                          <img src={viewingItem.guest.aadhaarBack} alt="Aadhaar Back" className="max-h-[140px] rounded object-contain border border-slate-200 shadow-xs" referrerPolicy="no-referrer" />
                        ) : (
                          <span className="text-xs text-slate-400 italic">No document image uploaded</span>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Booking History / Related Entities (bookings, invoices, payments, visitor logs) */}
              <div className="space-y-4">
                <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-1">
                  Associated Bookings, Invoices & Logs
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  
                  {/* Bookings */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                    <div className="text-[11px] uppercase tracking-wider font-mono font-bold text-slate-400 flex items-center justify-between">
                      <span>Bookings</span>
                      <span className="bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded text-[9px]">{viewingItem.bookings.length}</span>
                    </div>
                    {viewingItem.bookings.length === 0 ? (
                      <p className="text-[11px] text-slate-400 italic">No booking history.</p>
                    ) : (
                      <div className="space-y-2 max-h-36 overflow-y-auto">
                        {viewingItem.bookings.map(b => (
                          <div key={b.id} className="p-2 bg-white rounded border border-slate-100 text-[11px]">
                            <div className="font-bold">Room {b.roomNumber} ({b.roomType})</div>
                            <div className="text-slate-400 font-mono mt-0.5">{b.checkIn} to {b.checkOut}</div>
                            <span className="inline-flex text-[8px] bg-slate-100 border px-1 rounded font-mono uppercase mt-1">Status: {b.status}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Invoices */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                    <div className="text-[11px] uppercase tracking-wider font-mono font-bold text-slate-400 flex items-center justify-between">
                      <span>Invoices & Payments</span>
                      <span className="bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded text-[9px]">{viewingItem.invoices.length}</span>
                    </div>
                    {viewingItem.invoices.length === 0 ? (
                      <p className="text-[11px] text-slate-400 italic">No billings recorded.</p>
                    ) : (
                      <div className="space-y-2 max-h-36 overflow-y-auto">
                        {viewingItem.invoices.map(inv => (
                          <div key={inv.invoiceNumber} className="p-2 bg-white rounded border border-slate-100 text-[11px]">
                            <div className="font-bold">{inv.invoiceNumber}</div>
                            <div className="text-slate-500">Total: ₹{inv.totalAmount.toLocaleString()}</div>
                            <div className="text-rose-600 font-mono mt-0.5">Due: ₹{inv.remainingBalance.toLocaleString()}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Visitor Logs */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                    <div className="text-[11px] uppercase tracking-wider font-mono font-bold text-slate-400 flex items-center justify-between">
                      <span>Visitor Logs</span>
                      <span className="bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded text-[9px]">{viewingItem.visitorLogs.length}</span>
                    </div>
                    {viewingItem.visitorLogs.length === 0 ? (
                      <p className="text-[11px] text-slate-400 italic">No visitors logged.</p>
                    ) : (
                      <div className="space-y-2 max-h-36 overflow-y-auto">
                        {viewingItem.visitorLogs.map(v => (
                          <div key={v.id} className="p-2 bg-white rounded border border-slate-100 text-[11px]">
                            <div className="font-bold">{v.visitorsCount} visitor(s)</div>
                            <div className="text-slate-400 font-mono mt-0.5">Arrived: {new Date(v.arrive).toLocaleString()}</div>
                            <div className="text-slate-500 mt-1 truncate">{v.purpose}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                </div>
              </div>

            </div>

            <div className="p-5 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setViewingItem(null)}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold cursor-pointer"
              >
                Close Profile
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ---------------- CONFIRMATION DIALOG: RESTORE RECORD (ROTATECCW) ---------------- */}
      {restoringItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 w-full max-w-md rounded-xl p-6 shadow-xl animate-scaleUp space-y-4">
            
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-600 shrink-0">
                <RotateCcw className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-md font-sans font-bold text-slate-900">
                  {restoringItem.id.startsWith('rb-v-') ? 'Restore Visitor Log Entry' : 'Restore Guest Record'}
                </h3>
                <span className="text-xs text-slate-400 font-mono">
                  @{restoringItem.id.startsWith('rb-v-') ? (restoringItem.visitorLogs?.[0]?.guestName || restoringItem.guest.fullName) : restoringItem.guest.fullName}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Do you want to restore this {restoringItem.id.startsWith('rb-v-') ? 'visitor log entry' : 'guest record'}?
              <br />
              {restoringItem.id.startsWith('rb-v-')
                ? 'It will be immediately returned to the active Visitor Log list.'
                : 'All information including identity documents, associated bookings, invoices, payments, and visitor logs will be returned to active operations instantly.'}
            </p>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setRestoringItem(null)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleRestore}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-md shadow-emerald-600/10 cursor-pointer"
              >
                Restore
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ---------------- CONFIRMATION DIALOG: PERMANENT DELETE (DARK RED WARNING) ---------------- */}
      {permanentlyDeletingItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 w-full max-w-md rounded-xl p-6 shadow-xl animate-scaleUp space-y-4">
            
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-full bg-rose-100 border border-rose-200 text-red-700 shrink-0">
                <AlertTriangle className="w-6 h-6 text-red-600 animate-bounce" />
              </div>
              <div>
                <h3 className="text-md font-sans font-bold text-slate-900">
                  {permanentlyDeletingItem.id.startsWith('rb-v-') ? 'Purge Visitor Log Entry' : 'Permanent Delete'}
                </h3>
                <span className="text-xs text-slate-400 font-mono">
                  @{permanentlyDeletingItem.id.startsWith('rb-v-') ? (permanentlyDeletingItem.visitorLogs?.[0]?.guestName || permanentlyDeletingItem.guest.fullName) : permanentlyDeletingItem.guest.fullName}
                </span>
              </div>
            </div>

            <div className="p-3 bg-red-50 border border-red-100 text-red-800 text-xs rounded-lg font-mono">
              <strong>CRITICAL WARNING: This action is irreversible.</strong>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              {permanentlyDeletingItem.id.startsWith('rb-v-')
                ? 'This visitor log entry will be permanently purged from the system archives.'
                : 'All guest information including Aadhaar documents, bookings, invoices, payment history, visitor logs, and uploaded files will be permanently deleted.'}
              <br /><br />
              Are you sure?
            </p>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setPermanentlyDeletingItem(null)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handlePermanentDelete}
                className="px-4 py-2.5 bg-red-800 hover:bg-red-950 text-white rounded-lg text-xs font-bold transition-all shadow-md shadow-red-700/15 cursor-pointer"
              >
                Delete Permanently
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
