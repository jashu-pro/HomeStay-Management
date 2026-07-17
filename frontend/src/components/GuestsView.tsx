import React, { useState, useEffect } from 'react';
import { translations, Language } from '../lib/translations';
import { Guest } from '../types';
import { safeFetch } from '../lib/api';
import { 
  Plus, Search, UserPlus, Eye, Edit3, Trash2, X, Upload, ShieldCheck, Mail, Phone, MapPin, Badge, AlertTriangle
} from 'lucide-react';

interface GuestsViewProps {
  lang: Language;
  token: string;
  role: 'admin' | 'viewer';
}

export default function GuestsView({ lang, token, role }: GuestsViewProps) {
  const t = translations[lang];
  const isAdmin = role === 'admin';

  const [guests, setGuests] = useState<Guest[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Modals state
  const [showFormModal, setShowFormModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null);

  // Form fields
  const [formId, setFormId] = useState('');
  const [fullName, setFullName] = useState('');
  const [gender, setGender] = useState('Male');
  const [dob, setDob] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [country, setCountry] = useState('India');
  const [pinCode, setPinCode] = useState('');
  const [nationality, setNationality] = useState('Indian');
  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [aadhaarFront, setAadhaarFront] = useState<string | undefined>(undefined);
  const [aadhaarBack, setAadhaarBack] = useState<string | undefined>(undefined);
  const [passportNumber, setPassportNumber] = useState('');
  const [drivingLicense, setDrivingLicense] = useState('');
  const [panCard, setPanCard] = useState('');

  // Image upload validations state
  const [uploadError, setUploadError] = useState('');

  const fetchGuests = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await safeFetch(`/api/guests?search=${encodeURIComponent(search)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setGuests(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to load guests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGuests();
  }, [search, token]);

  const resetForm = () => {
    setFormId('');
    setFullName('');
    setGender('Male');
    setDob('');
    setPhone('');
    setEmail('');
    setAddress('');
    setCity('');
    setState('');
    setCountry('India');
    setPinCode('');
    setNationality('Indian');
    setAadhaarNumber('');
    setAadhaarFront(undefined);
    setAadhaarBack(undefined);
    setPassportNumber('');
    setDrivingLicense('');
    setPanCard('');
    setError('');
    setUploadError('');
  };

  const handleOpenAddModal = () => {
    resetForm();
    setShowFormModal(true);
  };

  const handleOpenEditModal = (guest: Guest) => {
    resetForm();
    setFormId(guest.id);
    setFullName(guest.fullName);
    setGender(guest.gender);
    setDob(guest.dob);
    setPhone(guest.phone);
    setEmail(guest.email);
    setAddress(guest.address);
    setCity(guest.city);
    setState(guest.state);
    setCountry(guest.country);
    setPinCode(guest.pinCode);
    setNationality(guest.nationality);
    setAadhaarNumber(guest.aadhaarNumber);
    setAadhaarFront(guest.aadhaarFront);
    setAadhaarBack(guest.aadhaarBack);
    setPassportNumber(guest.passportNumber || '');
    setDrivingLicense(guest.drivingLicense || '');
    setPanCard(guest.panCard || '');
    
    setShowFormModal(true);
  };

  const handleOpenProfileModal = (guest: Guest) => {
    setSelectedGuest(guest);
    setShowProfileModal(true);
  };

  // Secure File upload helper
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, field: 'front' | 'back') => {
    setUploadError('');
    const file = e.target.files?.[0];
    if (!file) return;

    // Secure Validations: Type checks & Size constraint (Max 2MB)
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setUploadError('Invalid file type! Please upload JPG, PNG, or WEBP images only.');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setUploadError('File size is too large! Maximum image limit is 2MB.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        if (field === 'front') {
          setAadhaarFront(reader.result);
        } else {
          setAadhaarBack(reader.result);
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveGuest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !phone || !aadhaarNumber) {
      setError('Please fill in Name, Phone, and Aadhaar card number.');
      return;
    }

    // Basic regex checks for extra security
    const aadhaarRegex = /^\d{4}-\d{4}-\d{4}$/;
    if (!aadhaarRegex.test(aadhaarNumber)) {
      setError('Aadhaar Number must follow the standard formats: e.g. 1234-5678-9012');
      return;
    }

    const payload: Partial<Guest> = {
      fullName,
      gender,
      dob,
      phone,
      email,
      address,
      city,
      state,
      country,
      pinCode,
      nationality,
      aadhaarNumber,
      aadhaarFront,
      aadhaarBack,
      passportNumber,
      drivingLicense,
      panCard
    };

    try {
      const url = formId ? `/api/guests/${formId}` : '/api/guests';
      const method = formId ? 'PUT' : 'POST';

      await safeFetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      setSuccess(formId ? 'Guest updated successfully!' : 'New guest added successfully!');
      setShowFormModal(false);
      fetchGuests();
      setTimeout(() => setSuccess(''), 4000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [guestToDelete, setGuestToDelete] = useState<Guest | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const handleDeleteClick = (guest: Guest) => {
    setGuestToDelete(guest);
    setDeleteReason('');
    setDeleteError('');
    setShowDeleteModal(true);
  };

  const moveGuestToRecycleBin = async (guestId: string, reason: string) => {
    const data = await safeFetch(`/api/guests/${guestId}`, {
      method: 'DELETE',
      headers: { 
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}` 
      },
      body: JSON.stringify({ reason })
    });
    return data;
  };

  const removeGuestFromUI = (guestId: string) => {
    setGuests(prev => prev.filter(g => g.id !== guestId));
  };

  const closeModal = () => {
    setShowDeleteModal(false);
    setGuestToDelete(null);
    setDeleteError('');
  };

  const showToast = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 4000);
  };

  const handleMoveToBin = async () => {
    if (!guestToDelete) return;
    setDeleteLoading(true);
    setDeleteError('');
    try {
      await moveGuestToRecycleBin(guestToDelete.id, deleteReason);
      removeGuestFromUI(guestToDelete.id);
      closeModal();
      showToast('Guest moved to Recycle Bin successfully.');
    } catch (err: any) {
      setDeleteError(err.message);
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top action block */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="text-xl font-sans font-bold text-slate-900">{t.guests}</h2>
          <p className="text-xs text-slate-500 mt-1">
            {lang === 'en' ? 'Manage legal guest registers, upload identity cards, and view guest history.' : 'అతిథుల వివరాలు, ప్రభుత్వ గుర్తింపు పత్రాలు మరియు బుకింగ్స్ చరిత్రను ఇక్కడ నిర్వహించండి.'}
          </p>
        </div>
        {isAdmin && (
          <button
            id="add-guest-btn"
            onClick={handleOpenAddModal}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-xs font-semibold tracking-wider transition-all flex items-center gap-2 shadow-md shadow-blue-600/10 self-stretch sm:self-auto justify-center cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{t.addGuest}</span>
          </button>
        )}
      </div>

      {success && (
        <div id="guest-success" className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2 shadow-xs">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          {success}
        </div>
      )}

      {/* Search and Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
          <input
            id="guest-search-input"
            type="text"
            placeholder={t.searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-lg pl-10 pr-4 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div className="text-[11px] font-mono text-slate-500 shrink-0">
          {guests.length} {lang === 'en' ? 'guests found' : 'అతిథులు కనుగొనబడ్డారు'}
        </div>
      </div>

      {/* Guests table */}
      {loading ? (
        <div className="flex justify-center items-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
        </div>
      ) : guests.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 py-16 text-center text-slate-400 space-y-3 shadow-xs">
          <UserPlus className="w-12 h-12 mx-auto text-slate-300 stroke-1" />
          <p className="text-xs font-mono">{lang === 'en' ? 'No guests recorded.' : 'రికార్డులు లేవు.'}</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 text-[10px] font-mono uppercase tracking-wider">
                  <th className="py-4 px-5">{t.fullName}</th>
                  <th className="py-4 px-5">{t.phone}</th>
                  <th className="py-4 px-5">{t.city}</th>
                  <th className="py-4 px-5">{t.aadhaarNumber}</th>
                  <th className="py-4 px-5">{t.nationality}</th>
                  <th className="py-4 px-5 text-right">{t.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/60 text-xs">
                {guests.map((g) => (
                  <tr key={g.id} className="hover:bg-slate-50 transition-colors text-slate-600">
                    <td className="py-4 px-5">
                      <div className="font-semibold text-slate-900">{g.fullName}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{g.gender} • {g.dob}</div>
                    </td>
                    <td className="py-4 px-5 font-mono text-slate-700">{g.phone}</td>
                    <td className="py-4 px-5 text-slate-700">{g.city}, {g.state}</td>
                    <td className="py-4 px-5 font-mono text-slate-900 font-medium">{g.aadhaarNumber}</td>
                    <td className="py-4 px-5">
                      <span className="px-2 py-0.5 rounded bg-slate-50 text-[10px] border border-slate-200 text-slate-600">
                        {g.nationality}
                      </span>
                    </td>
                    <td className="py-4 px-5 text-right space-x-1.5 shrink-0 whitespace-nowrap">
                      <button
                        onClick={() => handleOpenProfileModal(g)}
                        className="p-1.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-500 hover:text-slate-800 rounded transition-all cursor-pointer"
                        title={t.view}
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleOpenEditModal(g)}
                        className={`p-1.5 bg-white border border-slate-200 rounded transition-all cursor-pointer ${
                          isAdmin 
                            ? 'hover:border-blue-300 text-slate-500 hover:text-blue-600' 
                            : 'opacity-40 cursor-not-allowed text-slate-400'
                        }`}
                        disabled={!isAdmin}
                        title={t.edit}
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteClick(g)}
                        className={`p-1.5 bg-white border border-slate-200 rounded transition-all cursor-pointer ${
                          isAdmin 
                            ? 'hover:border-rose-300 text-slate-500 hover:text-rose-600' 
                            : 'opacity-40 cursor-not-allowed text-slate-400'
                        }`}
                        disabled={!isAdmin}
                        title={t.delete}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ---------------- MODAL FORM GUEST (ADD/EDIT) ---------------- */}
      {showFormModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 w-full max-w-4xl rounded-xl max-h-[90vh] overflow-y-auto shadow-xl animate-scaleUp">
            
            {/* Modal Header */}
            <div className="flex justify-between items-center p-5 border-b border-slate-100">
              <h3 className="text-md font-sans font-bold text-slate-900 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-blue-600" />
                {formId ? t.editGuest : t.addGuest}
              </h3>
              <button 
                onClick={() => setShowFormModal(false)}
                className="p-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-500 hover:text-slate-800 transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Error alerts */}
            {error && (
              <div className="mx-5 mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg flex items-center gap-2 font-sans">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                {error}
              </div>
            )}

            {/* Modal Body */}
            <form onSubmit={handleSaveGuest} className="p-5 space-y-6">
              
              {/* Part 1: Personal details */}
              <div className="space-y-4">
                <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-blue-600 border-b border-slate-100 pb-1">
                  {t.personalDetails}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  
                  <div>
                    <label className="block text-[10px] font-mono text-slate-500 mb-1">{t.fullName} *</label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono text-slate-500 mb-1">{t.gender}</label>
                    <select
                      value={gender}
                      onChange={(e) => setGender(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono text-slate-500 mb-1">{t.dob} *</label>
                    <input
                      type="date"
                      required
                      value={dob}
                      onChange={(e) => setDob(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono text-slate-500 mb-1">{t.phone} *</label>
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono text-slate-500 mb-1">{t.email}</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono text-slate-500 mb-1">{t.nationality}</label>
                    <input
                      type="text"
                      value={nationality}
                      onChange={(e) => setNationality(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-mono text-slate-500 mb-1">{t.address}</label>
                    <input
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono text-slate-500 mb-1">{t.city}</label>
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono text-slate-500 mb-1">{t.state}</label>
                    <input
                      type="text"
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Part 2: Gov ID Documents */}
              <div className="space-y-4">
                <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-blue-600 border-b border-slate-100 pb-1">
                  {t.govIdentity}
                </h4>

                {uploadError && (
                  <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-lg flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    {uploadError}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-[10px] font-mono text-slate-500 mb-1">{t.aadhaarNumber} *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 1234-5678-9012"
                      value={aadhaarNumber}
                      onChange={(e) => setAadhaarNumber(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono text-slate-500 mb-1">{t.passportNumber}</label>
                    <input
                      type="text"
                      value={passportNumber}
                      onChange={(e) => setPassportNumber(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono text-slate-500 mb-1">{t.drivingLicense}</label>
                    <input
                      type="text"
                      value={drivingLicense}
                      onChange={(e) => setDrivingLicense(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono text-slate-500 mb-1">{t.panCard}</label>
                    <input
                      type="text"
                      value={panCard}
                      onChange={(e) => setPanCard(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 font-mono"
                    />
                  </div>
                </div>

                {/* Aadhaar Images Upload fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                  
                  {/* Aadhaar Front */}
                  <div className="space-y-2">
                    <span className="block text-[10px] font-mono text-slate-500">{t.aadhaarFront} (Max 2MB)</span>
                    <div className="border border-dashed border-slate-200 rounded-xl p-4 bg-slate-50 text-center flex flex-col items-center justify-center min-h-[140px] relative hover:border-slate-300 transition-all group">
                      {aadhaarFront ? (
                        <div className="w-full h-full flex flex-col items-center justify-center space-y-2">
                          <img src={aadhaarFront} alt="Aadhaar Front Preview" className="max-h-[110px] rounded object-cover border border-slate-200" />
                          <button
                            type="button"
                            onClick={() => setAadhaarFront(undefined)}
                            className="text-[10px] font-mono text-rose-500 hover:text-rose-600 cursor-pointer"
                          >
                            Remove Image
                          </button>
                        </div>
                      ) : (
                        <label className="cursor-pointer w-full h-full flex flex-col items-center justify-center space-y-2 py-4">
                          <Upload className="w-6 h-6 text-slate-400 group-hover:text-blue-600 transition-colors" />
                          <span className="text-[10px] text-slate-500 font-sans group-hover:text-slate-700">{t.imageUpload}</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleImageUpload(e, 'front')}
                            className="hidden"
                          />
                        </label>
                      )}
                    </div>
                  </div>

                  {/* Aadhaar Back */}
                  <div className="space-y-2">
                    <span className="block text-[10px] font-mono text-slate-500">{t.aadhaarBack} (Max 2MB)</span>
                    <div className="border border-dashed border-slate-200 rounded-xl p-4 bg-slate-50 text-center flex flex-col items-center justify-center min-h-[140px] relative hover:border-slate-300 transition-all group">
                      {aadhaarBack ? (
                        <div className="w-full h-full flex flex-col items-center justify-center space-y-2">
                          <img src={aadhaarBack} alt="Aadhaar Back Preview" className="max-h-[110px] rounded object-cover border border-slate-200" />
                          <button
                            type="button"
                            onClick={() => setAadhaarBack(undefined)}
                            className="text-[10px] font-mono text-rose-500 hover:text-rose-600 cursor-pointer"
                          >
                            Remove Image
                          </button>
                        </div>
                      ) : (
                        <label className="cursor-pointer w-full h-full flex flex-col items-center justify-center space-y-2 py-4">
                          <Upload className="w-6 h-6 text-slate-400 group-hover:text-blue-600 transition-colors" />
                          <span className="text-[10px] text-slate-500 font-sans group-hover:text-slate-700">{t.imageUpload}</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleImageUpload(e, 'back')}
                            className="hidden"
                          />
                        </label>
                      )}
                    </div>
                  </div>

                </div>
              </div>

              {/* Action Buttons */}
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

      {/* ---------------- MODAL PROFILE DETAILS CARD ---------------- */}
      {showProfileModal && selectedGuest && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 w-full max-w-3xl rounded-xl max-h-[85vh] overflow-y-auto shadow-xl animate-scaleUp">
            
            <div className="flex justify-between items-center p-5 border-b border-slate-100">
              <h3 className="text-md font-sans font-bold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-blue-600" />
                {t.guestProfile}
              </h3>
              <button 
                onClick={() => setShowProfileModal(false)}
                className="p-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-500 hover:text-slate-800 transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              
              {/* Profile Card Header Block */}
              <div className="flex flex-col sm:flex-row items-center gap-4 bg-slate-50 p-5 rounded-xl border border-slate-200">
                <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100">
                  <span className="text-2xl font-serif font-bold">
                    {selectedGuest.fullName.substring(0, 1).toUpperCase()}
                  </span>
                </div>
                <div className="text-center sm:text-left">
                  <h4 className="text-lg font-sans font-bold text-slate-900">{selectedGuest.fullName}</h4>
                  <p className="text-xs text-slate-500 mt-1">{selectedGuest.gender} • Born {selectedGuest.dob} ({selectedGuest.nationality})</p>
                </div>
              </div>

              {/* Grid content */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                
                {/* Contact information */}
                <div className="space-y-3">
                  <span className="block text-[10px] font-mono uppercase tracking-wider text-slate-400">{t.personalDetails}</span>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center gap-2.5 text-slate-700">
                      <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="font-mono">{selectedGuest.phone}</span>
                    </div>
                    {selectedGuest.email && (
                      <div className="flex items-center gap-2.5 text-slate-700">
                        <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                        <span>{selectedGuest.email}</span>
                      </div>
                    )}
                    <div className="flex items-start gap-2.5 text-slate-700">
                      <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                      <span>
                        {selectedGuest.address || '-'}<br />
                        {selectedGuest.city}, {selectedGuest.state} {selectedGuest.pinCode}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Identity Details */}
                <div className="space-y-3">
                  <span className="block text-[10px] font-mono uppercase tracking-wider text-slate-400">{t.govIdentity}</span>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between border-b border-slate-100 pb-1.5">
                      <span className="text-slate-500">{t.aadhaarNumber}</span>
                      <span className="font-mono font-semibold text-slate-900">{selectedGuest.aadhaarNumber}</span>
                    </div>
                    {selectedGuest.passportNumber && (
                      <div className="flex justify-between border-b border-slate-100 pb-1.5">
                        <span className="text-slate-500">{t.passportNumber}</span>
                        <span className="font-mono font-semibold text-slate-900">{selectedGuest.passportNumber}</span>
                      </div>
                    )}
                    {selectedGuest.drivingLicense && (
                      <div className="flex justify-between border-b border-slate-100 pb-1.5">
                        <span className="text-slate-500">{t.drivingLicense}</span>
                        <span className="font-mono font-semibold text-slate-900">{selectedGuest.drivingLicense}</span>
                      </div>
                    )}
                    {selectedGuest.panCard && (
                      <div className="flex justify-between border-b border-slate-100 pb-1.5">
                        <span className="text-slate-500">{t.panCard}</span>
                        <span className="font-mono font-semibold text-slate-900">{selectedGuest.panCard}</span>
                      </div>
                    )}
                  </div>
                </div>

              </div>

              {/* Uploaded IDs Preview Blocks */}
              <div className="space-y-4">
                <span className="block text-[10px] font-mono uppercase tracking-wider text-slate-400">Government Document Images</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  
                  {/* Front card */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col items-center justify-center min-h-[140px]">
                    <span className="text-[10px] font-mono text-slate-500 mb-2">{t.aadhaarFront}</span>
                    {selectedGuest.aadhaarFront ? (
                      <img src={selectedGuest.aadhaarFront} alt="Aadhaar Front" className="max-h-[140px] rounded object-contain border border-slate-200 shadow-xs" referrerPolicy="no-referrer" />
                    ) : (
                      <span className="text-xs text-slate-400 italic">No image uploaded</span>
                    )}
                  </div>

                  {/* Back card */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col items-center justify-center min-h-[140px]">
                    <span className="text-[10px] font-mono text-slate-500 mb-2">{t.aadhaarBack}</span>
                    {selectedGuest.aadhaarBack ? (
                      <img src={selectedGuest.aadhaarBack} alt="Aadhaar Back" className="max-h-[140px] rounded object-contain border border-slate-200 shadow-xs" referrerPolicy="no-referrer" />
                    ) : (
                      <span className="text-xs text-slate-400 italic">No image uploaded</span>
                    )}
                  </div>

                </div>
              </div>

            </div>

            <div className="p-5 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setShowProfileModal(false)}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
              >
                {t.close}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ---------------- CUSTOM DELETE/RECYCLE BIN CONFIRMATION DIALOG ---------------- */}
      {showDeleteModal && guestToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 w-full max-w-md rounded-xl p-6 shadow-xl animate-scaleUp space-y-4">
            
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-full bg-rose-50 border border-rose-100 text-rose-600 shrink-0">
                <Trash2 className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <h3 className="text-md font-sans font-bold text-slate-900">Delete Guest Record</h3>
                <span className="text-xs text-slate-400 font-mono">@{guestToDelete.fullName}</span>
              </div>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Are you sure you want to delete this guest record?
              <br />
              <strong className="text-slate-700">This record will be moved to the Recycle Bin and can be restored later.</strong>
            </p>

            <div className="space-y-1.5">
              <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                Reason for deletion (Optional)
              </label>
              <textarea
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                placeholder="Specify the reason e.g., guest check-out audit, manual duplication, guest request..."
                rows={3}
                className="w-full bg-slate-50 hover:bg-slate-50/50 border border-slate-200 hover:border-slate-300 rounded-lg p-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all"
              />
            </div>

            {deleteError && (
              <div className="p-3 bg-rose-50 border border-rose-100 rounded-lg text-rose-800 text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                <span>{deleteError}</span>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={closeModal}
                disabled={deleteLoading}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed text-slate-700 rounded-lg text-xs font-bold transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleMoveToBin}
                disabled={deleteLoading}
                className="px-4 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-red-400 disabled:cursor-not-allowed text-white rounded-lg text-xs font-bold transition-all shadow-md shadow-red-600/10 cursor-pointer flex items-center justify-center gap-1.5"
              >
                {deleteLoading ? 'Moving...' : 'Move to Recycle Bin'}
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
