import React, { useState, useEffect } from 'react';
import { translations, Language } from '../lib/translations';
import { Invoice, Payment } from '../types';
import { 
  FileText, Search, CreditCard, IndianRupee, Printer, Download, Plus, X, ShieldCheck, AlertTriangle, ListFilter
} from 'lucide-react';

interface BillingViewProps {
  lang: Language;
  token: string;
  role: 'admin' | 'viewer';
}

export default function BillingView({ lang, token, role }: BillingViewProps) {
  const t = translations[lang];
  const isAdmin = role === 'admin';

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  // Modals state
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showEditChargesModal, setShowEditChargesModal] = useState(false);
  
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  // Record Payment fields
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<'Cash' | 'UPI' | 'Credit Card' | 'Debit Card' | 'Bank Transfer'>('UPI');
  const [payTxnId, setPayTxnId] = useState('');
  const [payNotes, setPayNotes] = useState('');

  // Edit Charges fields
  const [foodCharges, setFoodCharges] = useState(0);
  const [laundryCharges, setLaundryCharges] = useState(0);
  const [extraServices, setExtraServices] = useState(0);
  const [discount, setDiscount] = useState(0);

  const fetchData = async () => {
    try {
      setLoading(true);
      const headers = { Authorization: `Bearer ${token}` };
      const [invRes, payRes] = await Promise.all([
        fetch(`/api/invoices?search=${encodeURIComponent(search)}`, { headers }),
        fetch('/api/payments', { headers })
      ]);

      if (invRes.ok && payRes.ok) {
        setInvoices(await invRes.json());
        setPayments(await payRes.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [search, token]);

  const handleOpenInvoice = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setShowInvoiceModal(true);
  };

  const handleOpenRecordPayment = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setPayAmount(invoice.remainingBalance.toString());
    setPayMethod('UPI');
    setPayTxnId('');
    setPayNotes('');
    setError('');
    setShowPaymentModal(true);
  };

  const handleOpenEditCharges = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setFoodCharges(invoice.foodCharges);
    setLaundryCharges(invoice.laundryCharges);
    setExtraServices(invoice.extraServices);
    setDiscount(invoice.discount);
    setError('');
    setShowEditChargesModal(true);
  };

  const handleSaveCharges = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) return;

    try {
      const res = await fetch(`/api/invoices/${selectedInvoice.invoiceNumber}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          foodCharges: Number(foodCharges),
          laundryCharges: Number(laundryCharges),
          extraServices: Number(extraServices),
          discount: Number(discount)
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to modify invoice charges.');
      }

      setSuccess('Invoice billing items updated!');
      setShowEditChargesModal(false);
      
      // Update selected invoice in current view if open
      if (showInvoiceModal) {
        setSelectedInvoice(data);
      }
      
      fetchData();
      setTimeout(() => setSuccess(''), 4000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) return;

    if (!payAmount || Number(payAmount) <= 0) {
      setError('Please enter a valid payment amount.');
      return;
    }

    if (Number(payAmount) > selectedInvoice.remainingBalance) {
      setError('Payment amount exceeds remaining balance due.');
      return;
    }

    try {
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          invoiceNumber: selectedInvoice.invoiceNumber,
          amountPaid: Number(payAmount),
          paymentMethod: payMethod,
          transactionId: payTxnId,
          notes: payNotes
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to post payment.');
      }

      setSuccess(`Successfully recorded payment of ₹${Number(payAmount).toLocaleString()}!`);
      setShowPaymentModal(false);
      setShowInvoiceModal(false);
      fetchData();
      setTimeout(() => setSuccess(''), 4000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top action block */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs print:hidden">
        <div>
          <h2 className="text-xl font-sans font-bold text-slate-900">{t.billing}</h2>
          <p className="text-xs text-slate-500 mt-1">
            {lang === 'en' ? 'Review invoices, add custom service charges, and record payment transactions.' : 'ఇన్‌వాయిస్‌లు, అదనపు సేవలు (ఆహారం, లాండ్రీ) మరియు చెల్లింపు వివరాలను ఇక్కడ నిర్వహించండి.'}
          </p>
        </div>
      </div>

      {success && (
        <div id="billing-success" className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2 shadow-xs print:hidden">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          {success}
        </div>
      )}

      {/* Search system */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 flex flex-col md:flex-row gap-4 items-center shadow-xs print:hidden">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
          <input
            id="billing-search-input"
            type="text"
            placeholder={lang === 'en' ? 'Search by guest name or invoice number...' : 'ఇన్‌వాయిస్ సంఖ్య లేదా పేరు ద్వారా వెతకండి...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-lg pl-10 pr-4 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div className="text-[11px] font-mono text-slate-500 shrink-0">
          {invoices.length} {lang === 'en' ? 'invoices found' : 'ఇన్‌వాయిస్‌లు కనుగొనబడ్డాయి'}
        </div>
      </div>

      {/* Invoices List table */}
      {loading ? (
        <div className="flex justify-center items-center h-48 print:hidden">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
        </div>
      ) : invoices.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200/80 py-16 text-center text-slate-500 space-y-3 shadow-xs print:hidden">
          <FileText className="w-12 h-12 mx-auto text-slate-300 stroke-1" />
          <p className="text-xs font-mono">{lang === 'en' ? 'No invoices issued.' : 'ఇన్‌వాయిస్‌లు లేవు.'}</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden shadow-xs print:hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-slate-600 text-[10px] font-mono uppercase tracking-wider">
                  <th className="py-4 px-5">{t.invoiceNumber}</th>
                  <th className="py-4 px-5">{t.guestName}</th>
                  <th className="py-4 px-5">{t.totalAmount}</th>
                  <th className="py-4 px-5">{t.advancePaid}</th>
                  <th className="py-4 px-5">{t.remainingBalance}</th>
                  <th className="py-4 px-5">{t.status}</th>
                  <th className="py-4 px-5 text-right">{t.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-800">
                {invoices.map((inv) => (
                  <tr key={inv.invoiceNumber} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 px-5 font-mono font-bold text-slate-900">{inv.invoiceNumber}</td>
                    <td className="py-4 px-5">{inv.guestName}</td>
                    <td className="py-4 px-5 font-mono">₹{inv.totalAmount.toLocaleString()}</td>
                    <td className="py-4 px-5 font-mono text-emerald-600">₹{inv.advancePaid.toLocaleString()}</td>
                    <td className="py-4 px-5 font-mono text-rose-600 font-semibold">₹{inv.remainingBalance.toLocaleString()}</td>
                    <td className="py-4 px-5">
                      <span className={`px-2.5 py-0.5 text-[10px] font-mono rounded-full font-bold uppercase ${
                        inv.remainingBalance === 0 
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                          : 'bg-amber-50 text-amber-700 border border-amber-100'
                      }`}>
                        {inv.remainingBalance === 0 ? 'Fully Paid' : 'Pending Bal.'}
                      </span>
                    </td>
                    <td className="py-4 px-5 text-right space-x-1.5 shrink-0 whitespace-nowrap">
                      <button
                        onClick={() => handleOpenInvoice(inv)}
                        className="px-2.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-[11px] transition-all cursor-pointer"
                      >
                        {t.view} Invoice
                      </button>
                      {isAdmin && inv.remainingBalance > 0 && (
                        <button
                          onClick={() => handleOpenRecordPayment(inv)}
                          className="px-2.5 py-1.5 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 text-emerald-700 rounded-lg text-[11px] transition-all font-semibold cursor-pointer"
                        >
                          Record Payment
                        </button>
                      )}
                      {isAdmin && (
                        <button
                          onClick={() => handleOpenEditCharges(inv)}
                          className="px-2.5 py-1.5 bg-blue-50 border border-blue-200 hover:bg-blue-100 text-blue-700 rounded-lg text-[11px] transition-all font-semibold cursor-pointer"
                          title="Add / Edit Additional Charges"
                        >
                          Add Charges
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ---------------- MODAL INVOICE PRINT-FRIENDLY VIEW ---------------- */}
      {showInvoiceModal && selectedInvoice && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 print:p-0 print:static print:bg-white">
          <div className="bg-white border border-slate-200 w-full max-w-2xl rounded-xl shadow-xl max-h-[90vh] overflow-y-auto print:max-h-none print:shadow-none print:border-none print:w-full print:bg-white print:text-slate-900 animate-scaleUp flex flex-col justify-between">
            
            {/* Modal Actions Header */}
            <div className="flex justify-between items-center p-5 border-b border-slate-100 print:hidden">
              <h3 className="text-sm font-sans font-bold text-slate-900 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-blue-600" />
                Invoice Details #{selectedInvoice.invoiceNumber}
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={handlePrint}
                  className="p-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>{t.printInvoice}</span>
                </button>
                <button 
                  onClick={() => setShowInvoiceModal(false)}
                  className="p-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-500 hover:text-slate-800 transition-all cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Printable Content Block */}
            <div className="p-8 space-y-8 print:p-0 print:text-slate-900 print:bg-white" id="invoice-print-area">
              
              {/* Invoice Header */}
              <div className="flex justify-between items-start gap-4">
                <div>
                  <div className="text-xl font-sans font-extrabold text-slate-900 tracking-tight">HOMESTAY RESORT</div>
                  <p className="text-[11px] text-slate-500 mt-1 max-w-xs leading-normal">
                    MDR-46, Araku Valley road,<br />
                    Visakhapatnam District, Andhra Pradesh, India.<br />
                    Phone: +91 95538 88649 | GSTIN: 37AAAAA1111A1Z1
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-xs uppercase tracking-wider text-slate-400 font-mono">Invoice Receipt</div>
                  <div className="text-lg font-mono font-bold text-blue-600 print:text-slate-900 mt-1">{selectedInvoice.invoiceNumber}</div>
                  <div className="text-[10px] text-slate-500 font-mono mt-1">Date: {new Date().toLocaleDateString()}</div>
                </div>
              </div>

              <hr className="border-slate-100 print:border-slate-300" />

              {/* Guest specifics */}
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="block text-[10px] uppercase font-mono text-slate-400">Billed To:</span>
                  <div className="font-bold text-slate-900 print:text-slate-900 mt-1">{selectedInvoice.guestName}</div>
                  <div className="text-slate-500 print:text-slate-500 mt-0.5">Booking Reference: {selectedInvoice.bookingId}</div>
                </div>
                <div className="text-right">
                  <span className="block text-[10px] uppercase font-mono text-slate-400">Stay Particulars:</span>
                  <div className="text-slate-700 print:text-slate-700 mt-1">Standard Double A/C Room</div>
                  <div className="text-slate-500 print:text-slate-500 mt-0.5">12% Luxury Goods/Service Tax Applicable</div>
                </div>
              </div>

              {/* Items Table */}
              <div className="border border-slate-200 print:border-slate-300 rounded-xl overflow-hidden shadow-xs">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 print:bg-slate-100 border-b border-slate-200 print:border-slate-300 text-[10px] font-mono uppercase text-slate-500 print:text-slate-700">
                      <th className="p-3">Service Description</th>
                      <th className="p-3 text-right">Charges (INR)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 print:divide-slate-200 text-slate-700 print:text-slate-800">
                    <tr>
                      <td className="p-3">Room Accommodation Charges (Base Lodging Rate)</td>
                      <td className="p-3 text-right font-mono">₹{selectedInvoice.roomCharges.toLocaleString()}</td>
                    </tr>
                    {selectedInvoice.foodCharges > 0 && (
                      <tr>
                        <td className="p-3">{t.foodCharges}</td>
                        <td className="p-3 text-right font-mono">₹{selectedInvoice.foodCharges.toLocaleString()}</td>
                      </tr>
                    )}
                    {selectedInvoice.laundryCharges > 0 && (
                      <tr>
                        <td className="p-3">{t.laundryCharges}</td>
                        <td className="p-3 text-right font-mono">₹{selectedInvoice.laundryCharges.toLocaleString()}</td>
                      </tr>
                    )}
                    {selectedInvoice.extraServices > 0 && (
                      <tr>
                        <td className="p-3">{t.extraServices} (Amenities, vehicle logs, etc.)</td>
                        <td className="p-3 text-right font-mono">₹{selectedInvoice.extraServices.toLocaleString()}</td>
                      </tr>
                    )}
                    {selectedInvoice.discount > 0 && (
                      <tr className="text-emerald-600 font-semibold">
                        <td className="p-3">{t.discount} (Coupon / Applied Offer)</td>
                        <td className="p-3 text-right font-mono">-₹{selectedInvoice.discount.toLocaleString()}</td>
                      </tr>
                    )}
                    <tr className="font-semibold text-slate-500 print:text-slate-600">
                      <td className="p-3 text-right">Tax (12% GST on balance)</td>
                      <td className="p-3 text-right font-mono">₹{selectedInvoice.taxes.toLocaleString()}</td>
                    </tr>
                    <tr className="bg-slate-50 print:bg-slate-50 font-bold text-slate-900 print:text-slate-900 border-t border-slate-200 print:border-slate-300">
                      <td className="p-3 text-right text-sm">Grand Total Amount</td>
                      <td className="p-3 text-right text-sm font-mono">₹{selectedInvoice.totalAmount.toLocaleString()}</td>
                    </tr>
                    <tr className="font-semibold text-emerald-600 print:text-emerald-700">
                      <td className="p-3 text-right">{t.advancePaid} (Deposited)</td>
                      <td className="p-3 text-right font-mono">-₹{selectedInvoice.advancePaid.toLocaleString()}</td>
                    </tr>
                    <tr className="bg-rose-50 print:bg-rose-50 font-bold text-rose-700 print:text-rose-700 text-sm">
                      <td className="p-3 text-right">{t.remainingBalance} (Balance Due)</td>
                      <td className="p-3 text-right font-mono">₹{selectedInvoice.remainingBalance.toLocaleString()}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Signatures */}
              <div className="flex justify-between items-end pt-12 text-[10px] print:text-slate-700">
                <div className="text-slate-400 font-mono">
                  * System generated invoice, no manual seal required.<br />
                  * Please clear all outstanding dues before check-out.
                </div>
                <div className="text-center border-t border-dashed border-slate-300 print:border-slate-400 pt-1.5 w-40 font-semibold text-slate-700 print:text-slate-900">
                  Authorized Signatory
                </div>
              </div>

            </div>

            {/* Installments listing in modal footer */}
            <div className="p-5 border-t border-slate-100 bg-slate-50 print:hidden space-y-3 rounded-b-xl">
              <span className="block text-[10px] font-mono uppercase tracking-wider text-slate-500">{t.paymentHistory}</span>
              <div className="space-y-2 max-h-[140px] overflow-y-auto">
                {payments.filter(p => p.invoiceNumber === selectedInvoice.invoiceNumber).length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No payments logged yet.</p>
                ) : (
                  payments.filter(p => p.invoiceNumber === selectedInvoice.invoiceNumber).map(p => (
                    <div key={p.id} className="flex justify-between items-center text-[11px] bg-white border border-slate-200 p-2 rounded-lg">
                      <div className="space-y-0.5">
                        <span className="font-bold text-slate-800">₹{p.amountPaid.toLocaleString()} via {p.paymentMethod}</span>
                        <div className="text-[10px] text-slate-500 font-mono">Txn: {p.transactionId} • {p.paymentDate}</div>
                      </div>
                      <span className="text-[10px] px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded font-semibold">Success</span>
                    </div>
                  ))
                )}
              </div>
              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setShowInvoiceModal(false)}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Close Receipt
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ---------------- MODAL RECORD PAYMENT ---------------- */}
      {showPaymentModal && selectedInvoice && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 w-full max-w-md rounded-xl shadow-xl animate-scaleUp">
            
            <div className="flex justify-between items-center p-5 border-b border-slate-100">
              <h3 className="text-sm font-sans font-bold text-slate-900 flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-blue-600" />
                {t.addPayment}
              </h3>
              <button 
                onClick={() => setShowPaymentModal(false)}
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

            <form onSubmit={handleRecordPayment} className="p-5 space-y-4">
              
              <div>
                <label className="block text-[10px] font-mono text-slate-500 mb-1">Invoice Number</label>
                <input
                  type="text"
                  disabled
                  value={selectedInvoice.invoiceNumber}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono text-slate-500 mb-1">Remaining Balance Due (INR)</label>
                <div className="text-md font-bold font-mono text-rose-600 bg-rose-50 p-2 border border-rose-100 rounded-lg">
                  ₹{selectedInvoice.remainingBalance.toLocaleString()}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-mono text-slate-500 mb-1">{t.amountPaid} *</label>
                <input
                  type="number"
                  required
                  max={selectedInvoice.remainingBalance}
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 font-mono focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-mono text-slate-500 mb-1">{t.paymentMethod} *</label>
                  <select
                    value={payMethod}
                    onChange={(e: any) => setPayMethod(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="UPI">UPI (GPay / PhonePe)</option>
                    <option value="Cash">Cash</option>
                    <option value="Credit Card">Credit Card</option>
                    <option value="Debit Card">Debit Card</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-slate-500 mb-1">{t.transactionId}</label>
                  <input
                    type="text"
                    placeholder="e.g. UPI883490219"
                    value={payTxnId}
                    onChange={(e) => setPayTxnId(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 font-mono focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-mono text-slate-500 mb-1">{t.notes}</label>
                <input
                  type="text"
                  placeholder="Installment notes, deposit..."
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="px-4 py-2 bg-white border border-slate-200 text-slate-600 hover:text-slate-800 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Submit Payment
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ---------------- MODAL EDIT CHARGES / SERVICES ---------------- */}
      {showEditChargesModal && selectedInvoice && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 w-full max-w-sm rounded-xl shadow-xl animate-scaleUp">
            
            <div className="flex justify-between items-center p-5 border-b border-slate-100">
              <h3 className="text-sm font-sans font-bold text-slate-900 flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-blue-600" />
                Add / Edit Additional Charges
              </h3>
              <button 
                onClick={() => setShowEditChargesModal(false)}
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

            <form onSubmit={handleSaveCharges} className="p-5 space-y-4">
              
              <div>
                <label className="block text-[10px] font-mono text-slate-500 mb-1">{t.foodCharges} (₹)</label>
                <input
                  type="number"
                  min="0"
                  value={foodCharges}
                  onChange={(e) => setFoodCharges(Number(e.target.value))}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 font-mono focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono text-slate-500 mb-1">{t.laundryCharges} (₹)</label>
                <input
                  type="number"
                  min="0"
                  value={laundryCharges}
                  onChange={(e) => setLaundryCharges(Number(e.target.value))}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 font-mono focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono text-slate-500 mb-1">{t.extraServices} (₹)</label>
                <input
                  type="number"
                  min="0"
                  value={extraServices}
                  onChange={(e) => setExtraServices(Number(e.target.value))}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 font-mono focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono text-slate-500 mb-1">{t.discount} (₹)</label>
                <input
                  type="number"
                  min="0"
                  value={discount}
                  onChange={(e) => setDiscount(Number(e.target.value))}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 font-mono focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowEditChargesModal(false)}
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
