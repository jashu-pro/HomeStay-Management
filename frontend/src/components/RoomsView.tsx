import React, { useState, useEffect } from 'react';
import { translations, Language } from '../lib/translations';
import { Room } from '../types';
import { 
  Plus, DoorOpen, Badge, Edit3, Trash2, X, AlertTriangle, ShieldCheck, ClipboardCheck
} from 'lucide-react';

interface RoomsViewProps {
  lang: Language;
  token: string;
  role: 'admin' | 'viewer';
}

export default function RoomsView({ lang, token, role }: RoomsViewProps) {
  const t = translations[lang];
  const isAdmin = role === 'admin';

  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Add Room fields
  const [showAddModal, setShowAddModal] = useState(false);
  const [roomNumber, setRoomNumber] = useState('');
  const [category, setCategory] = useState('Deluxe Room');
  const [pricePerNight, setPricePerNight] = useState('');
  const [capacity, setCapacity] = useState('2');
  const [status, setStatus] = useState<'available' | 'occupied' | 'cleaning' | 'maintenance'>('available');

  const fetchRooms = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/rooms', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setRooms(await res.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRooms();
  }, [token]);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomNumber || !pricePerNight || !capacity) {
      setError('Please fill in all room fields.');
      return;
    }

    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          roomNumber,
          category,
          pricePerNight: Number(pricePerNight),
          capacity: Number(capacity),
          status
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to add room.');
      }

      setSuccess(`Room ${roomNumber} added successfully!`);
      setShowAddModal(false);
      setRoomNumber('');
      setPricePerNight('');
      setCapacity('2');
      setStatus('available');
      fetchRooms();
      setTimeout(() => setSuccess(''), 4000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleUpdateStatus = async (number: string, newStatus: 'available' | 'occupied' | 'cleaning' | 'maintenance') => {
    try {
      const res = await fetch(`/api/rooms/${number}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (res.ok) {
        setSuccess(`Room ${number} status updated to ${newStatus}!`);
        fetchRooms();
        setTimeout(() => setSuccess(''), 4000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top action bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="text-xl font-sans font-bold text-slate-900">{t.rooms}</h2>
          <p className="text-xs text-slate-500 mt-1">
            {lang === 'en' ? 'Manage homestay room types, tariffs, capacities, and trigger housekeeping cleaning flags.' : 'గదుల లభ్యత, కేటగిరీలు, రాత్రికి ధరలు మరియు వాటి ప్రస్తుత స్థితిని నిర్వహించండి.'}
          </p>
        </div>
        {isAdmin && (
          <button
            id="add-room-btn"
            onClick={() => {
              setError('');
              setShowAddModal(true);
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-xs font-semibold tracking-wider transition-all flex items-center gap-2 shadow-md shadow-blue-600/10 self-stretch sm:self-auto justify-center cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{t.addRoom}</span>
          </button>
        )}
      </div>

      {success && (
        <div id="rooms-success" className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2 shadow-xs">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          {success}
        </div>
      )}

      {/* Rooms Cards Grid */}
      {loading ? (
        <div className="flex justify-center items-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {rooms.map((r) => (
            <div key={r.roomNumber} className="bg-white border border-slate-200/80 p-5 rounded-xl flex flex-col justify-between hover:border-slate-300 transition-all space-y-4 shadow-xs">
              
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                  <span className="p-2 bg-blue-50 border border-blue-100 rounded-xl text-blue-700 font-sans font-bold text-sm">
                    {r.roomNumber}
                  </span>
                  <div>
                    <h4 className="text-xs font-bold text-slate-950">{r.category}</h4>
                    <span className="text-[10px] text-slate-500 font-sans">Cap: {r.capacity} Guest(s)</span>
                  </div>
                </div>

                <span className={`px-2 py-0.5 text-[9px] font-mono font-bold uppercase rounded-full ${
                  r.status === 'available' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                  r.status === 'occupied' ? 'bg-rose-50 text-rose-700 border border-rose-100' :
                  r.status === 'cleaning' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                  'bg-slate-50 text-slate-500 border border-slate-200'
                }`}>
                  {r.status === 'available' ? t.available :
                   r.status === 'occupied' ? t.occupied :
                   r.status === 'cleaning' ? t.cleaning : t.maintenance}
                </span>
              </div>

              <div className="flex justify-between items-end border-t border-slate-100 pt-3">
                <div>
                  <span className="block text-[10px] text-slate-400 uppercase font-mono">Tariff Plan</span>
                  <span className="font-sans font-bold text-slate-900 text-sm">₹{r.pricePerNight.toLocaleString()}/N</span>
                </div>
              </div>

              {/* Status control buttons for admin */}
              {isAdmin && (
                <div className="pt-2 border-t border-slate-100 mt-1">
                  <span className="block text-[9px] font-mono uppercase text-slate-400 mb-2">Change status:</span>
                  <div className="grid grid-cols-4 gap-1.5 text-[9px] font-mono font-bold text-center">
                    <button
                      onClick={() => handleUpdateStatus(r.roomNumber, 'available')}
                      className={`p-1.5 rounded border transition-colors cursor-pointer ${r.status === 'available' ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-800 hover:bg-slate-100'}`}
                    >
                      AV
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(r.roomNumber, 'occupied')}
                      className={`p-1.5 rounded border transition-colors cursor-pointer ${r.status === 'occupied' ? 'bg-rose-600 border-rose-500 text-white' : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-800 hover:bg-slate-100'}`}
                    >
                      OC
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(r.roomNumber, 'cleaning')}
                      className={`p-1.5 rounded border transition-colors cursor-pointer ${r.status === 'cleaning' ? 'bg-amber-500 border-amber-400 text-white' : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-800 hover:bg-slate-100'}`}
                    >
                      CL
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(r.roomNumber, 'maintenance')}
                      className={`p-1.5 rounded border transition-colors cursor-pointer ${r.status === 'maintenance' ? 'bg-slate-600 border-slate-500 text-white' : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-800 hover:bg-slate-100'}`}
                    >
                      MN
                    </button>
                  </div>
                </div>
              )}

            </div>
          ))}
        </div>
      )}

      {/* ---------------- MODAL ADD ROOM ---------------- */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 w-full max-w-sm rounded-xl shadow-xl animate-scaleUp">
            
            <div className="flex justify-between items-center p-5 border-b border-slate-100">
              <h3 className="text-sm font-sans font-bold text-slate-900 flex items-center gap-1.5">
                <ClipboardCheck className="w-4 h-4 text-blue-600" />
                {t.addRoom}
              </h3>
              <button 
                onClick={() => setShowAddModal(false)}
                className="p-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-500 hover:text-slate-800 transition-all cursor-pointer"
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

            <form onSubmit={handleCreateRoom} className="p-5 space-y-4">
              
              <div>
                <label className="block text-[10px] font-mono text-slate-500 mb-1">Room Number *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 101, 102"
                  value={roomNumber}
                  onChange={(e) => setRoomNumber(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono text-slate-500 mb-1">Room Category *</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="Deluxe Room">Deluxe Room (Double Bed)</option>
                  <option value="Premium Suite">Premium Suite (Luxury Living)</option>
                  <option value="Super Deluxe">Super Deluxe (Double Bed + Balcony)</option>
                  <option value="Standard Single">Standard Single (Single Bed)</option>
                  <option value="Family Suite">Family Suite (4 Bed Dorm)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-mono text-slate-500 mb-1">{t.pricePerNight} *</label>
                  <input
                    type="number"
                    required
                    placeholder="e.g. 2500"
                    value={pricePerNight}
                    onChange={(e) => setPricePerNight(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 font-mono focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-slate-500 mb-1">{t.capacity} *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    max="10"
                    value={capacity}
                    onChange={(e) => setCapacity(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 font-mono focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-mono text-slate-500 mb-1">Initial Status</label>
                <select
                  value={status}
                  onChange={(e: any) => setStatus(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="available">Available</option>
                  <option value="cleaning">Cleaning</option>
                  <option value="maintenance">Maintenance</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-white border border-slate-200 text-slate-600 hover:text-slate-800 rounded-lg text-xs font-semibold cursor-pointer"
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

    </div>
  );
}
