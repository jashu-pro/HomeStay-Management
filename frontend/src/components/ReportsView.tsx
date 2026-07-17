import React, { useState, useEffect } from 'react';
import { translations, Language } from '../lib/translations';
import { Booking, Payment, Invoice, Guest } from '../types';
import { 
  FileSpreadsheet, FileText, BarChart3, Download, RefreshCw, Calendar, TrendingUp, DollarSign, Users, ShieldAlert
} from 'lucide-react';

interface ReportsViewProps {
  lang: Language;
  token: string;
}

export default function ReportsView({ lang, token }: ReportsViewProps) {
  const t = translations[lang];
  const [reportType, setReportType] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('monthly');
  const [loading, setLoading] = useState(false);
  
  const [guests, setGuests] = useState<Guest[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  const fetchRawData = async () => {
    try {
      setLoading(true);
      const headers = { Authorization: `Bearer ${token}` };
      const [gRes, bRes, pRes, iRes] = await Promise.all([
        fetch('/api/guests', { headers }),
        fetch('/api/bookings', { headers }),
        fetch('/api/payments', { headers }),
        fetch('/api/invoices', { headers })
      ]);

      if (gRes.ok && bRes.ok && pRes.ok && iRes.ok) {
        setGuests(await gRes.json());
        setBookings(await bRes.json());
        setPayments(await pRes.json());
        setInvoices(await iRes.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRawData();
  }, [token]);

  // Dynamic filter lists based on reportType
  const getFilteredPayments = () => {
    const today = new Date().toISOString().split('T')[0];
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const oneWeekAgoStr = oneWeekAgo.toISOString().split('T')[0];
    
    const oneMonthAgo = new Date();
    oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);
    const oneMonthAgoStr = oneMonthAgo.toISOString().split('T')[0];

    const currentYear = new Date().getFullYear().toString();

    if (reportType === 'daily') {
      return payments.filter(p => p.paymentDate === today);
    } else if (reportType === 'weekly') {
      return payments.filter(p => p.paymentDate >= oneWeekAgoStr);
    } else if (reportType === 'monthly') {
      return payments.filter(p => p.paymentDate >= oneMonthAgoStr);
    } else {
      return payments.filter(p => p.paymentDate.startsWith(currentYear));
    }
  };

  const getFilteredBookings = () => {
    const today = new Date().toISOString().split('T')[0];
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const oneWeekAgoStr = oneWeekAgo.toISOString().split('T')[0];

    const oneMonthAgo = new Date();
    oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);
    const oneMonthAgoStr = oneMonthAgo.toISOString().split('T')[0];

    const currentYear = new Date().getFullYear().toString();

    if (reportType === 'daily') {
      return bookings.filter(b => b.bookingDate === today);
    } else if (reportType === 'weekly') {
      return bookings.filter(b => b.bookingDate >= oneWeekAgoStr);
    } else if (reportType === 'monthly') {
      return bookings.filter(b => b.bookingDate >= oneMonthAgoStr);
    } else {
      return bookings.filter(b => b.bookingDate.startsWith(currentYear));
    }
  };

  const activePayments = getFilteredPayments();
  const activeBookings = getFilteredBookings();

  const totalRev = activePayments.reduce((sum, p) => sum + p.amountPaid, 0);
  const avgPaid = activePayments.length > 0 ? Math.round(totalRev / activePayments.length) : 0;

  // Export CSV Helper (opens directly in Excel / Sheets)
  const exportToExcel = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    
    // Excel headers
    csvContent += "Payment ID,Invoice Reference,Payment Date,Amount Collected (INR),Method,Transaction Reference,Status,Notes\n";

    activePayments.forEach((p) => {
      const row = [
        p.id,
        p.invoiceNumber,
        p.paymentDate,
        p.amountPaid,
        p.paymentMethod,
        p.transactionId,
        p.status,
        `"${p.notes || ''}"`
      ].join(",");
      csvContent += row + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `homestay_${reportType}_financial_report.csv`);
    document.body.appendChild(link);
    link.click();
    link.parentNode?.removeChild(link);
  };

  const exportToPdf = () => {
    window.print();
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-xl border border-slate-200/80 print:hidden shadow-xs">
        <div>
          <h2 className="text-xl font-sans font-bold text-slate-900">{t.reports}</h2>
          <p className="text-xs text-slate-500 mt-1">
            {lang === 'en' ? 'Audit ledger statements, track occupancy indexes, and export structured sheets.' : 'ఆదాయ నివేదికలు, గదుల బుకింగ్‌ల విశ్లేషణలు మరియు లావాదేవీల పత్రాలను డౌన్‌లోడ్ చేయండి.'}
          </p>
        </div>
        <button
          onClick={fetchRawData}
          className="p-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 hover:text-slate-800 rounded-lg transition-all flex items-center gap-1.5 text-xs font-semibold self-stretch sm:self-auto justify-center cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Sync Data</span>
        </button>
      </div>

      {/* Interval select segment */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 flex flex-wrap gap-2 items-center justify-between print:hidden shadow-xs">
        <div className="flex gap-2">
          {(['daily', 'weekly', 'monthly', 'yearly'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setReportType(type)}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                reportType === type 
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/10' 
                  : 'bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-slate-800'
              }`}
            >
              {type === 'daily' ? t.dailyReport :
               type === 'weekly' ? t.weeklyReport :
               type === 'monthly' ? t.monthlyReport : t.yearlyReport}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <button
            onClick={exportToExcel}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 hover:text-slate-800 rounded-lg text-xs font-semibold flex items-center gap-2 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>{t.exportExcel}</span>
          </button>
          <button
            onClick={exportToPdf}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 hover:text-slate-800 rounded-lg text-xs font-semibold flex items-center gap-2 cursor-pointer"
          >
            <FileText className="w-4 h-4 text-blue-600" />
            <span>{t.exportPdf}</span>
          </button>
        </div>
      </div>

      {/* Numerical Stats overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white border border-slate-200/80 p-5 rounded-xl flex items-center gap-4 shadow-xs">
          <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-blue-600">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-mono text-slate-400">Total Income (Segment)</span>
            <div className="text-xl font-sans font-bold text-slate-900 mt-0.5">₹{totalRev.toLocaleString()}</div>
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 p-5 rounded-xl flex items-center gap-4 shadow-xs">
          <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-lg text-indigo-600">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-mono text-slate-400">Avg instalment collection</span>
            <div className="text-xl font-sans font-bold text-slate-900 mt-0.5">₹{avgPaid.toLocaleString()}</div>
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 p-5 rounded-xl flex items-center gap-4 shadow-xs">
          <div className="p-3 bg-violet-50 border border-violet-100 rounded-lg text-violet-600">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-mono text-slate-400">Bookings Count (Segment)</span>
            <div className="text-xl font-sans font-bold text-slate-900 mt-0.5">{activeBookings.length}</div>
          </div>
        </div>
      </div>

      {/* Main ledger list in Report layout */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-6 space-y-6 shadow-xs print:bg-white print:text-slate-900 print:border-none print:p-0">
        <div className="flex justify-between items-center pb-4 border-b border-slate-100 print:border-slate-300">
          <div>
            <h3 className="text-sm font-sans font-bold text-slate-900 print:text-slate-900 capitalize">{reportType} Ledger Receipts</h3>
            <span className="text-[10px] text-slate-400 font-mono mt-1 block">Compiled on: {new Date().toLocaleDateString()}</span>
          </div>
          <span className="text-xs font-mono text-slate-500 print:text-slate-700 font-bold uppercase shrink-0">Form B • Financial logs</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 print:bg-slate-100 print:border-slate-300 text-[10px] font-mono uppercase text-slate-500 print:text-slate-700">
                <th className="py-3 px-4">Payment ID</th>
                <th className="py-3 px-4">Invoice #</th>
                <th className="py-3 px-4">Receipt Date</th>
                <th className="py-3 px-4">Method</th>
                <th className="py-3 px-4">Transaction ID</th>
                <th className="py-3 px-4 text-right">Amount (INR)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 print:divide-slate-200 text-slate-700 print:text-slate-800">
              {activePayments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 italic">No transaction ledger recorded in this interval.</td>
                </tr>
              ) : (
                activePayments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/50">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900 print:text-slate-900">{p.id}</td>
                    <td className="py-3 px-4 font-mono text-blue-600 print:text-blue-700 font-semibold">{p.invoiceNumber}</td>
                    <td className="py-3 px-4 font-mono text-slate-500">{p.paymentDate}</td>
                    <td className="py-3 px-4 font-semibold text-slate-800">{p.paymentMethod}</td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-500">{p.transactionId}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 print:text-slate-900">₹{p.amountPaid.toLocaleString()}</td>
                  </tr>
                ))
              )}
              <tr className="bg-slate-50 print:bg-slate-50 font-bold text-slate-900 print:text-slate-900 text-xs border-t border-slate-200 print:border-slate-300">
                <td colSpan={5} className="py-3 px-4 text-right uppercase font-mono text-slate-600">Segment Total Collected</td>
                <td className="py-3 px-4 text-right font-mono text-blue-600 print:text-blue-700">₹{totalRev.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Print only footnote signatures */}
        <div className="hidden print:flex justify-between items-end pt-12 text-[10px] text-slate-700 mt-12">
          <div>
            * Certified complete and correct ledger compiled on Araku Server.<br />
            * Internal audit check reference: TS-HOMESTAY-{Date.now().toString().substring(6)}
          </div>
          <div className="text-center border-t border-dashed border-slate-400 pt-2 w-40 font-bold">
            Authorized Signatory
          </div>
        </div>

      </div>
    </div>
  );
}
