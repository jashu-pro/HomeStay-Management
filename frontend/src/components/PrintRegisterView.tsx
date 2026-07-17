import React from 'react';
import { Guest } from '../types';
import { Printer, ArrowLeft } from 'lucide-react';

interface PrintRegisterViewProps {
  guests: Guest[];
  onBack: () => void;
  lang: 'en' | 'te';
}

export default function PrintRegisterView({ guests, onBack, lang }: PrintRegisterViewProps) {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-8 print:bg-white print:text-black print:p-0">
      
      {/* Back and Print buttons (Hidden during print) */}
      <div className="flex justify-between items-center mb-6 print:hidden bg-white border border-slate-200/80 p-4 rounded-xl shadow-xs">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-all cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Go back to System</span>
        </button>
        <button
          onClick={handlePrint}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all shadow-md shadow-blue-600/10 cursor-pointer"
        >
          <Printer className="w-4 h-4" />
          <span>Print Register (A4 Horizontal)</span>
        </button>
      </div>

      {/* Official Government Book Format */}
      <div className="bg-white border border-slate-200 p-8 rounded-xl shadow-xs print:border-none print:bg-white print:p-0">
        
        {/* Register Header */}
        <div className="text-center space-y-2 mb-8">
          <h2 className="text-xl font-sans font-bold tracking-wider uppercase text-slate-900 print:text-slate-900">
            OFFICIAL HOMESTAY GUEST REGISTER
          </h2>
          <p className="text-[10px] uppercase font-mono tracking-widest text-slate-500 print:text-slate-600">
            Form 'A' • hospitality compliance log • government register of guests
          </p>
          <div className="text-[11px] text-slate-400 print:text-slate-800 font-mono mt-1">
            Homestay Araku • Visakhapatnam District, Andhra Pradesh, India.
          </div>
        </div>

        {/* Register Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-[10px] print:text-black border border-slate-200 print:border-black">
            <thead>
              <tr className="bg-slate-50 print:bg-slate-100 border-b border-slate-200 print:border-black uppercase font-mono tracking-wider text-slate-600 print:text-black font-semibold">
                <th className="py-2.5 px-3 border-r border-slate-200 print:border-black w-8 text-center">S.No</th>
                <th className="py-2.5 px-3 border-r border-slate-200 print:border-black">Full Name of Guest</th>
                <th className="py-2.5 px-3 border-r border-slate-200 print:border-black w-12 text-center">Sex</th>
                <th className="py-2.5 px-3 border-r border-slate-200 print:border-black w-20">DOB</th>
                <th className="py-2.5 px-3 border-r border-slate-200 print:border-black w-24">Mobile No</th>
                <th className="py-2.5 px-3 border-r border-slate-200 print:border-black">Permanent Address</th>
                <th className="py-2.5 px-3 border-r border-slate-200 print:border-black w-28">Aadhaar Card No</th>
                <th className="py-2.5 px-3 border-r border-slate-200 print:border-black w-20">Nationality</th>
                <th className="py-2.5 px-3 w-28">Signature of Guest</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 print:divide-black text-slate-700 print:text-black">
              {guests.map((g, index) => (
                <tr key={g.id} className="hover:bg-slate-50/30 min-h-[44px]">
                  <td className="py-3 px-3 border-r border-slate-200 print:border-black font-mono text-center text-slate-500">{index + 1}</td>
                  <td className="py-3 px-3 border-r border-slate-200 print:border-black font-semibold text-slate-900 print:text-black">{g.fullName}</td>
                  <td className="py-3 px-3 border-r border-slate-200 print:border-black text-center">{g.gender.substring(0,1)}</td>
                  <td className="py-3 px-3 border-r border-slate-200 print:border-black font-mono text-slate-600">{g.dob}</td>
                  <td className="py-3 px-3 border-r border-slate-200 print:border-black font-mono text-slate-600">{g.phone}</td>
                  <td className="py-3 px-3 border-r border-slate-200 print:border-black text-[9px] max-w-[140px] leading-tight text-slate-500">
                    {g.address}, {g.city}, {g.state}
                  </td>
                  <td className="py-3 px-3 border-r border-slate-200 print:border-black font-mono font-bold text-blue-600 print:text-black">{g.aadhaarNumber}</td>
                  <td className="py-3 px-3 border-r border-slate-200 print:border-black font-mono text-slate-600">{g.nationality}</td>
                  <td className="py-3 px-3 min-h-[44px] relative">
                    <span className="absolute bottom-1 right-2 text-[8px] font-mono text-slate-400 select-none print:text-slate-300">Sign here</span>
                  </td>
                </tr>
              ))}
              
              {/* Padding empty rows for printable aesthetics if short list */}
              {guests.length < 8 && Array.from({ length: 8 - guests.length }).map((_, idx) => (
                <tr key={`empty-${idx}`} className="h-10 text-transparent select-none">
                  <td className="py-3 px-3 border-r border-slate-200 print:border-black font-mono text-center">{guests.length + idx + 1}</td>
                  <td className="py-3 px-3 border-r border-slate-200 print:border-black"></td>
                  <td className="py-3 px-3 border-r border-slate-200 print:border-black"></td>
                  <td className="py-3 px-3 border-r border-slate-200 print:border-black"></td>
                  <td className="py-3 px-3 border-r border-slate-200 print:border-black"></td>
                  <td className="py-3 px-3 border-r border-slate-200 print:border-black"></td>
                  <td className="py-3 px-3 border-r border-slate-200 print:border-black"></td>
                  <td className="py-3 px-3 border-r border-slate-200 print:border-black"></td>
                  <td className="py-3 px-3"></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Legal footprint */}
        <div className="mt-8 flex justify-between items-start text-[9px] text-slate-400 print:text-slate-600 font-mono">
          <div>
            * Compiled on: {new Date().toLocaleDateString()}<br />
            * This document serves as the official Form-A register of travelers in lodging.
          </div>
          <div className="text-right border-t border-dashed border-slate-200 print:border-black pt-1 w-48 text-slate-500">
            Signature of Owner / In-charge
          </div>
        </div>

      </div>
    </div>
  );
}
