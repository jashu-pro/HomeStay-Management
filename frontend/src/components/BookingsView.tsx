import React, { useState, useEffect } from 'react';
import { translations, Language } from '../lib/translations';
import { Booking, Guest, Room } from '../types';
import { 
  Plus, Search, Calendar, DoorOpen, Badge, Edit3, Trash2, X, ClipboardList, Check, QrCode, AlertTriangle
} from 'lucide-react';

interface BookingsViewProps {
  lang: Language;
  token: string;
  role: 'admin' | 'viewer';
}

export default function BookingsView({ lang, token, role }: BookingsViewProps) {
  const t = translations[lang];
  const isAdmin = role === 'admin';

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Modals
  const [showFormModal, setShowFormModal] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [activeBooking, setActiveBooking] = useState<Booking | null>(null);

  // Form Fields
  const [guestId, setGuestId] = useState('');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [roomNumber, setRoomNumber] = useState('');
  const [bookingStatus, setBookingStatus] = useState<'upcoming' | 'checked-in' | 'checked-out' | 'cancelled'>('upcoming');
  const [specialRequests, setSpecialRequests] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true);
      const headers = { Authorization: `Bearer ${token}` };
      
      const [bookingsRes, guestsRes, roomsRes] = await Promise.all([
        fetch(`/api/bookings?search=${encodeURIComponent(search)}${statusFilter ? `&status=${statusFilter}` : ''}`, { headers }),
        fetch('/api/guests', { headers }),
        fetch('/api/rooms', { headers })
      ]);

      if (bookingsRes.ok && guestsRes.ok && roomsRes.ok) {
        setBookings(await bookingsRes.json());
        setGuests(await guestsRes.json());
        setRooms(await roomsRes.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [search, statusFilter, token]);

  const handleOpenAddModal = () => {
    setGuestId('');
    setCheckIn('');
    setCheckOut('');
    setAdults(2);
    setChildren(0);
    setRoomNumber('');
    setBookingStatus('upcoming');
    setSpecialRequests('');
    setError('');
    setShowFormModal(true);
  };

  const handleCreateBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestId || !checkIn || !checkOut || !roomNumber) {
      setError('Please select Guest, Room, Check-In and Check-Out dates.');
      return;
    }

    if (new Date(checkIn) >= new Date(checkOut)) {
      setError('Check-out date must be after the check-in date.');
      return;
    }

    const selectedGuest = guests.find(g => g.id === guestId);
    const selectedRoom = rooms.find(r => r.roomNumber === roomNumber);

    if (!selectedGuest || !selectedRoom) {
      setError('Invalid Guest or Room details.');
      return;
    }

    const payload = {
      guestId,
      guestName: selectedGuest.fullName,
      checkIn,
      checkOut,
      adults: Number(adults),
      children: Number(children),
      roomNumber,
      roomType: selectedRoom.category,
      status: bookingStatus,
      specialRequests
    };

    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create booking.');
      }

      setSuccess('Booking registered and invoice outline generated!');
      setShowFormModal(false);
      fetchData();
      setTimeout(() => setSuccess(''), 4000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleUpdateStatus = async (booking: Booking, newStatus: 'upcoming' | 'checked-in' | 'checked-out' | 'cancelled') => {
    try {
      const res = await fetch(`/api/bookings/${booking.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update status.');
      }

      setSuccess(`Booking status changed to ${newStatus}`);
      fetchData();
      setTimeout(() => setSuccess(''), 4000);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteBooking = async (id: string) => {
    if (!confirm('Are you sure you want to permanently cancel and delete this booking registration?')) {
      return;
    }

    try {
      const res = await fetch(`/api/bookings/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        setSuccess('Booking deleted successfully.');
        fetchData();
        setTimeout(() => setSuccess(''), 4000);
      } else {
        const data = await res.json();
        alert(data.error || 'Failed.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenQrModal = (booking: Booking) => {
    setActiveBooking(booking);
    setShowQrModal(true);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top action block */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="text-xl font-sans font-bold text-slate-900">{t.bookings}</h2>
          <p className="text-xs text-slate-500 mt-1">
            {lang === 'en' ? 'Track room reservations, schedule checking parameters, and issue reservation codes.' : 'గదుల బుకింగ్‌లు, చెక్-ఇన్/అవుట్ తేదీలు మరియు రూమ్ స్థితిని ఇక్కడ ట్రాక్ చేయండి.'}
          </p>
        </div>
        {isAdmin && (
          <button
            id="add-booking-btn"
            onClick={handleOpenAddModal}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-xs font-semibold tracking-wider transition-all flex items-center gap-2 shadow-md shadow-blue-600/10 self-stretch sm:self-auto justify-center cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{t.addBooking}</span>
          </button>
        )}
      </div>

      {success && (
        <div id="booking-success" className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2 shadow-xs">
          <Check className="w-4 h-4 text-emerald-600" />
          {success}
        </div>
      )}

      {/* Search and Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 flex flex-col md:flex-row gap-4 items-center shadow-xs">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
          <input
            id="booking-search-input"
            type="text"
            placeholder={lang === 'en' ? 'Search by guest name or room number...' : 'పేరు లేదా గది సంఖ్య ద్వారా వెతకండి...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-lg pl-10 pr-4 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        
        <div className="flex gap-2 w-full md:w-auto self-stretch">
          <select
            id="booking-status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-white border border-slate-200 text-slate-700 text-xs rounded-lg px-3 py-2.5 focus:outline-none w-full md:w-44 focus:ring-1 focus:ring-blue-500"
          >
            <option value="">{lang === 'en' ? 'All Bookings' : 'అన్ని బుకింగ్‌లు'}</option>
            <option value="upcoming">{t.upcoming}</option>
            <option value="checked-in">{t.checkedIn}</option>
            <option value="checked-out">{t.checkedOut}</option>
            <option value="cancelled">{t.cancelled}</option>
          </select>
        </div>
      </div>

      {/* Booking List Grid */}
      {loading ? (
        <div className="flex justify-center items-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
        </div>
      ) : bookings.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 py-16 text-center text-slate-400 space-y-3 shadow-xs">
          <Calendar className="w-12 h-12 mx-auto text-slate-300 stroke-1" />
          <p className="text-xs font-mono">{lang === 'en' ? 'No reservation logs found.' : 'బుకింగ్‌లు లేవు.'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {bookings.map((b) => {
            // Find room
            const room = rooms.find(r => r.roomNumber === b.roomNumber);
            return (
              <div key={b.id} className="bg-white border border-slate-200/80 p-5 rounded-xl flex flex-col justify-between hover:border-slate-300 transition-all space-y-4 shadow-xs">
                
                {/* Header card info */}
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <span className="text-[10px] font-mono font-bold text-slate-400 uppercase">Booking ID: {b.id}</span>
                    <h4 className="text-sm font-sans font-bold text-slate-900 mt-1">{b.guestName}</h4>
                  </div>
                  <span className={`px-2 py-0.5 text-[9px] font-mono font-bold uppercase rounded-full ${
                    b.status === 'upcoming' ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' :
                    b.status === 'checked-in' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                    b.status === 'checked-out' ? 'bg-slate-50 text-slate-500 border border-slate-200' :
                    'bg-rose-50 text-rose-700 border border-rose-100'
                  }`}>
                    {b.status === 'upcoming' ? t.upcoming :
                     b.status === 'checked-in' ? t.checkedIn :
                     b.status === 'checked-out' ? t.checkedOut : t.cancelled}
                  </span>
                </div>

                {/* Date specifics */}
                <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <div>
                    <span className="block text-[10px] font-mono text-slate-500">{t.checkInDate}</span>
                    <span className="font-semibold text-slate-800 font-mono mt-0.5 block">{b.checkIn}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-mono text-slate-500">{t.checkOutDate}</span>
                    <span className="font-semibold text-slate-800 font-mono mt-0.5 block">{b.checkOut}</span>
                  </div>
                </div>

                {/* Rooms and Capacity details */}
                <div className="text-xs space-y-1.5 text-slate-500">
                  <div className="flex justify-between">
                    <span>{t.roomNumber}:</span>
                    <span className="font-mono font-semibold text-slate-800">Room {b.roomNumber} ({b.roomType})</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t.nights}:</span>
                    <span className="font-mono text-slate-800">{b.nights} {lang === 'en' ? 'Nights' : 'రాత్రులు'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Occupants:</span>
                    <span className="text-slate-800">{b.adults} Adults {b.children > 0 ? `, ${b.children} Children` : ''}</span>
                  </div>
                  {b.specialRequests && (
                    <div className="pt-2 border-t border-slate-100 mt-1">
                      <span className="block text-[10px] text-slate-400 font-sans uppercase">Requests:</span>
                      <p className="text-[11px] text-slate-500 mt-0.5 italic">"{b.specialRequests}"</p>
                    </div>
                  )}
                </div>

                {/* Operations bar */}
                <div className="flex justify-between items-center pt-3 border-t border-slate-100">
                  
                  {/* QR Pre-register action */}
                  <button
                    onClick={() => handleOpenQrModal(b)}
                    className="p-1.5 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-600 hover:text-blue-600 rounded-lg transition-all flex items-center gap-1.5 text-[10px] font-mono uppercase cursor-pointer"
                    title="Generate Desk QR check-in"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>Desk QR</span>
                  </button>

                  <div className="flex gap-1.5">
                    {isAdmin && b.status === 'upcoming' && (
                      <button
                        onClick={() => handleUpdateStatus(b, 'checked-in')}
                        className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[10px] font-semibold rounded-lg border border-emerald-200 transition-all cursor-pointer"
                      >
                        Check-In
                      </button>
                    )}
                    {isAdmin && b.status === 'checked-in' && (
                      <button
                        onClick={() => handleUpdateStatus(b, 'checked-out')}
                        className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 text-[10px] font-semibold rounded-lg border border-rose-200 transition-all cursor-pointer"
                      >
                        Check-Out
                      </button>
                    )}
                    {isAdmin && b.status !== 'cancelled' && b.status !== 'checked-out' && (
                      <button
                        onClick={() => handleUpdateStatus(b, 'cancelled')}
                        className="p-1.5 bg-white hover:bg-slate-50 text-rose-600 border border-slate-200 rounded-lg transition-all text-[10px] font-semibold cursor-pointer"
                        title="Cancel booking"
                      >
                        Cancel
                      </button>
                    )}
                    {isAdmin && (
                      <button
                        onClick={() => handleDeleteBooking(b.id)}
                        className="p-1.5 bg-white hover:bg-slate-50 text-slate-400 hover:text-rose-600 border border-slate-200 rounded-lg transition-all cursor-pointer"
                        title="Delete booking registry"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* ---------------- MODAL CREATE BOOKING ---------------- */}
      {showFormModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 w-full max-w-lg rounded-xl max-h-[90vh] overflow-y-auto shadow-xl animate-scaleUp">
            
            <div className="flex justify-between items-center p-5 border-b border-slate-100">
              <h3 className="text-md font-sans font-bold text-slate-900 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-600" />
                {t.addBooking}
              </h3>
              <button 
                onClick={() => setShowFormModal(false)}
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

            <form onSubmit={handleCreateBooking} className="p-5 space-y-4">
              
              <div>
                <label className="block text-[10px] font-mono text-slate-500 mb-1">Select Registered Guest *</label>
                <select
                  required
                  value={guestId}
                  onChange={(e) => setGuestId(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">-- Choose guest --</option>
                  {guests.map(g => (
                    <option key={g.id} value={g.id}>{g.fullName} ({g.phone})</option>
                  ))}
                </select>
                <span className="text-[10px] text-slate-400 block mt-1">If guest is not registered, go to Guests tab first.</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-mono text-slate-500 mb-1">{t.checkInDate} *</label>
                  <input
                    type="date"
                    required
                    value={checkIn}
                    onChange={(e) => setCheckIn(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-slate-500 mb-1">{t.checkOutDate} *</label>
                  <input
                    type="date"
                    required
                    value={checkOut}
                    onChange={(e) => setCheckOut(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-mono text-slate-500 mb-1">Select Available Room *</label>
                  <select
                    required
                    value={roomNumber}
                    onChange={(e) => setRoomNumber(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">-- Choose room --</option>
                    {rooms.map(r => (
                      <option key={r.roomNumber} value={r.roomNumber}>
                        Room {r.roomNumber} - {r.category} (₹{r.pricePerNight}/N, Status: {r.status})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-mono text-slate-500 mb-1">Initial Status</label>
                  <select
                    value={bookingStatus}
                    onChange={(e) => setBookingStatus(e.target.value as any)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="upcoming">Upcoming (Booked)</option>
                    <option value="checked-in">Check-in Immediately</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-mono text-slate-500 mb-1">{t.adults}</label>
                  <input
                    type="number"
                    min="1"
                    max="6"
                    value={adults}
                    onChange={(e) => setAdults(Number(e.target.value))}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-slate-500 mb-1">{t.children}</label>
                  <input
                    type="number"
                    min="0"
                    max="6"
                    value={children}
                    onChange={(e) => setChildren(Number(e.target.value))}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-mono text-slate-500 mb-1">{t.specialRequests}</label>
                <textarea
                  value={specialRequests}
                  onChange={(e) => setSpecialRequests(e.target.value)}
                  placeholder="Need twin bed, early check-in, dietary restrictions..."
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 h-20"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
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

      {/* ---------------- MODAL QR CHECKIN FOR BOOKING ---------------- */}
      {showQrModal && activeBooking && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 w-full max-w-sm rounded-xl shadow-xl p-6 text-center animate-scaleUp space-y-6">
            
            <div className="flex justify-between items-center border-b border-slate-100 pb-4">
              <h4 className="text-sm font-sans font-bold text-slate-900 flex items-center gap-1.5">
                <QrCode className="w-4 h-4 text-blue-600" />
                {t.qrCodeHeader}
              </h4>
              <button 
                onClick={() => setShowQrModal(false)}
                className="p-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded text-slate-500 hover:text-slate-800 transition-all cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Visual QR Code drawn in Vector SVG */}
            <div className="bg-white p-5 rounded-xl inline-block border border-slate-200 shadow-sm">
              <svg width="180" height="180" viewBox="0 0 100 100" className="mx-auto">
                {/* Simulated outer border boxes for QR Code */}
                <rect x="0" y="0" width="25" height="25" fill="#1e3a8a" stroke="#2563eb" strokeWidth="2" />
                <rect x="5" y="5" width="15" height="15" fill="#ffffff" />
                <rect x="8" y="8" width="9" height="9" fill="#1e3a8a" />

                <rect x="75" y="0" width="25" height="25" fill="#1e3a8a" stroke="#2563eb" strokeWidth="2" />
                <rect x="80" y="5" width="15" height="15" fill="#ffffff" />
                <rect x="83" y="8" width="9" height="9" fill="#1e3a8a" />

                <rect x="0" y="75" width="25" height="25" fill="#1e3a8a" stroke="#2563eb" strokeWidth="2" />
                <rect x="5" y="80" width="15" height="15" fill="#ffffff" />
                <rect x="8" y="83" width="9" height="9" fill="#1e3a8a" />

                {/* Inner simulated random QR bits */}
                <rect x="35" y="5" width="6" height="6" fill="#1e3a8a" />
                <rect x="45" y="10" width="6" height="6" fill="#1e3a8a" />
                <rect x="55" y="5" width="6" height="12" fill="#1e3a8a" />
                <rect x="65" y="15" width="6" height="6" fill="#1e3a8a" />

                <rect x="30" y="30" width="12" height="6" fill="#1e3a8a" />
                <rect x="50" y="35" width="6" height="12" fill="#1e3a8a" />
                <rect x="60" y="30" width="12" height="6" fill="#1e3a8a" />
                <rect x="80" y="35" width="12" height="12" fill="#1e3a8a" />

                <rect x="10" y="45" width="12" height="6" fill="#1e3a8a" />
                <rect x="5" y="55" width="6" height="12" fill="#1e3a8a" />
                <rect x="25" y="50" width="12" height="12" fill="#1e3a8a" />

                <rect x="45" y="55" width="12" height="12" fill="#2563eb" /> {/* Accent QR bit */}
                <rect x="60" y="60" width="6" height="12" fill="#1e3a8a" />
                <rect x="75" y="55" width="12" height="6" fill="#1e3a8a" />

                <rect x="35" y="75" width="6" height="12" fill="#1e3a8a" />
                <rect x="45" y="85" width="12" height="6" fill="#1e3a8a" />
                <rect x="65" y="80" width="6" height="6" fill="#1e3a8a" />
                <rect x="85" y="85" width="10" height="10" fill="#1e3a8a" />
              </svg>
            </div>

            <div className="space-y-1.5">
              <h5 className="font-sans font-bold text-slate-900">{activeBooking.guestName}</h5>
              <p className="text-xs text-slate-500 font-mono">Room {activeBooking.roomNumber} ({activeBooking.roomType})</p>
              <p className="text-[11px] text-slate-400 font-sans max-w-xs mx-auto leading-relaxed pt-2">
                {t.qrCodeDesc}
              </p>
            </div>

            <button
              onClick={() => setShowQrModal(false)}
              className="w-full py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-semibold rounded-lg text-xs cursor-pointer"
            >
              {t.close}
            </button>

          </div>
        </div>
      )}

    </div>
  );
}
