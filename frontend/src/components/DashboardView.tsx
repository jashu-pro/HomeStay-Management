import React, { useState, useEffect } from 'react';
import { translations, Language } from '../lib/translations';
import { DashboardStats, SystemNotification } from '../types';
import { 
  Users, Calendar, LogIn, LogOut, CheckCircle, IndianRupee, AlertCircle, Bookmark, Bell, Check
} from 'lucide-react';
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts';
import { safeFetch } from '../lib/api';

interface DashboardViewProps {
  lang: Language;
  token: string;
}

export default function DashboardView({ lang, token }: DashboardViewProps) {
  const t = translations[lang];
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [charts, setCharts] = useState<any>(null);
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      
      const [statsData, chartsData, notifData] = await Promise.all([
        safeFetch('/api/dashboard/stats', { headers }),
        safeFetch('/api/dashboard/charts', { headers }),
        safeFetch('/api/notifications', { headers })
      ]);

      setStats(statsData);
      setCharts(chartsData);
      setNotifications(notifData);
    } catch (err) {
      console.error('Error fetching dashboard details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    // Poll every 30 seconds for live notification/occupancy updates
    const timer = setInterval(fetchDashboardData, 30000);
    return () => clearInterval(timer);
  }, [token]);

  const handleMarkAsRead = async (id: string) => {
    try {
      const res = await fetch(`/api/notifications/${id}/read`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleClearAllNotifs = async () => {
    try {
      const res = await fetch('/api/notifications/clear', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setNotifications([]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  // Cards layout configurations
  const cardItems = [
    {
      id: 'stat-total-guests',
      title: t.totalGuests,
      value: stats?.totalGuests ?? 0,
      icon: Users,
      color: 'text-blue-600 bg-blue-50 border-blue-100'
    },
    {
      id: 'stat-today-checkins',
      title: t.todayCheckIns,
      value: stats?.todayCheckIns ?? 0,
      icon: LogIn,
      color: 'text-emerald-600 bg-emerald-50 border-emerald-100'
    },
    {
      id: 'stat-today-checkouts',
      title: t.todayCheckOuts,
      value: stats?.todayCheckOuts ?? 0,
      icon: LogOut,
      color: 'text-rose-600 bg-rose-50 border-rose-100'
    },
    {
      id: 'stat-occupied-rooms',
      title: t.occupiedRooms,
      value: stats?.occupiedRooms ?? 0,
      icon: CheckCircle,
      color: 'text-amber-600 bg-amber-50 border-amber-100'
    },
    {
      id: 'stat-available-rooms',
      title: t.availableRooms,
      value: stats?.availableRooms ?? 0,
      icon: Calendar,
      color: 'text-indigo-600 bg-indigo-50 border-indigo-100'
    },
    {
      id: 'stat-monthly-revenue',
      title: t.monthlyRevenue,
      value: `${t.revenueUnit}${stats?.monthlyRevenue.toLocaleString() ?? '0'}`,
      icon: IndianRupee,
      color: 'text-teal-600 bg-teal-50 border-teal-100'
    },
    {
      id: 'stat-pending-payments',
      title: t.pendingPayments,
      value: `${t.revenueUnit}${stats?.pendingPayments.toLocaleString() ?? '0'}`,
      icon: AlertCircle,
      color: 'text-orange-600 bg-orange-50 border-orange-100'
    },
    {
      id: 'stat-total-bookings',
      title: t.totalBookings,
      value: stats?.totalBookings ?? 0,
      icon: Bookmark,
      color: 'text-violet-600 bg-violet-50 border-violet-100'
    }
  ];

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Welcome Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="text-xl font-sans font-bold text-slate-900">{t.dashboard}</h2>
          <p className="text-slate-500 text-xs mt-1">
            {lang === 'en' 
              ? 'Complete overview of room status, reservations, financials, and live visitors.' 
              : 'గదుల స్థితి, బుకింగ్‌లు, లావాదేవీలు మరియు సందర్శకుల పూర్తి వివరణ.'}
          </p>
        </div>
        <div className="flex items-center gap-2 self-start md:self-auto bg-slate-50 p-1.5 rounded-lg border border-slate-200">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse ml-2"></span>
          <span className="text-[11px] font-mono font-medium text-slate-600 pr-2">
            {lang === 'en' ? 'Live System Connected' : 'వ్యవస్థ అనుసంధానించబడింది'}
          </span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cardItems.map((item) => {
          const IconComponent = item.icon;
          return (
            <div 
              key={item.id} 
              id={item.id}
              className="bg-white border border-slate-200/80 p-4 rounded-xl flex flex-col justify-between hover:border-slate-300 transition-all group shadow-xs"
            >
              <div className="flex justify-between items-start gap-2">
                <span className="text-xs text-slate-500 font-sans group-hover:text-slate-700 transition-colors">
                  {item.title}
                </span>
                <span className={`p-2 rounded-lg border ${item.color} shrink-0`}>
                  <IconComponent className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-4">
                <span className="text-lg md:text-2xl font-serif font-bold text-slate-900 tracking-tight">
                  {item.value}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Content split charts and notifications */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Left Side Charts Area (2/3 width) */}
        <div className="xl:col-span-2 space-y-6">
          
          {/* Revenue and Booking trends charts side by side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Revenue Trend Area Chart */}
            <div className="bg-white border border-slate-200/80 p-5 rounded-xl space-y-4 shadow-xs">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">{t.monthlyRevenueChart}</h3>
              <div className="h-64 text-xs">
                {charts?.revenueChart && (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={charts.revenueChart}>
                      <defs>
                        <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="month" stroke="#64748b" fontSize={10} />
                      <YAxis stroke="#64748b" fontSize={10} />
                      <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderColor: '#cbd5e1', color: '#0f172a' }} />
                      <Area type="monotone" dataKey="revenue" name="Revenue (₹)" stroke="#3b82f6" fillOpacity={1} fill="url(#colorRev)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Booking Trends Line Chart */}
            <div className="bg-white border border-slate-200/80 p-5 rounded-xl space-y-4 shadow-xs">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">{t.bookingTrendsChart}</h3>
              <div className="h-64 text-xs">
                {charts?.bookingTrends && (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={charts.bookingTrends}>
                      <XAxis dataKey="date" stroke="#64748b" fontSize={10} />
                      <YAxis stroke="#64748b" fontSize={10} precision={0} />
                      <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderColor: '#cbd5e1', color: '#0f172a' }} />
                      <Line type="monotone" dataKey="bookings" name="Bookings" stroke="#4f46e5" strokeWidth={2} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

          </div>

          {/* Occupancy and Payment status charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Room Occupancy Pie Chart */}
            <div className="bg-white border border-slate-200/80 p-5 rounded-xl space-y-4 shadow-xs">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">{t.occupancyRateChart}</h3>
              <div className="h-64 flex items-center justify-center text-xs">
                {charts?.occupancyChart && (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={charts.occupancyChart}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {charts.occupancyChart.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderColor: '#cbd5e1', color: '#0f172a' }} />
                      <Legend verticalAlign="bottom" height={36} formatter={(value, entry: any) => (
                        <span className="text-slate-600 font-sans text-xs ml-1">
                          {value} ({entry.payload.value})
                        </span>
                      )} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Billing status bar chart */}
            <div className="bg-white border border-slate-200/80 p-5 rounded-xl space-y-4 shadow-xs">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">{t.paymentStatusChart}</h3>
              <div className="h-64 text-xs">
                {charts?.paymentChart && (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={charts.paymentChart}>
                      <XAxis dataKey="name" stroke="#64748b" fontSize={10} />
                      <YAxis stroke="#64748b" fontSize={10} />
                      <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderColor: '#cbd5e1', color: '#0f172a' }} />
                      <Bar dataKey="value" name="Invoices Count" fill="#f59e0b" radius={[4, 4, 0, 0]}>
                        <Cell fill="#10b981" />
                        <Cell fill="#f59e0b" />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

          </div>

        </div>

        {/* Right Side Live Notification Feed Panel (1/3 width) */}
        <div className="space-y-6">
          <div className="bg-white border border-slate-200/80 p-5 rounded-xl h-full flex flex-col justify-between shadow-xs">
            <div>
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-blue-600" />
                  <h3 className="text-sm font-sans font-bold text-slate-900">
                    {lang === 'en' ? 'System Alerts & Actions' : 'వ్యవస్థ నోటిఫికేషన్లు'}
                  </h3>
                </div>
                {notifications.length > 0 && (
                  <button 
                    id="clear-all-notifs"
                    onClick={handleClearAllNotifs}
                    className="text-[10px] uppercase font-mono tracking-wider font-semibold hover:text-rose-600 text-slate-400 transition-colors cursor-pointer"
                  >
                    {lang === 'en' ? 'Clear All' : 'అన్నీ తీసివేయి'}
                  </button>
                )}
              </div>

              {/* Alerts List */}
              <div className="space-y-3.5 max-h-[500px] overflow-y-auto pr-1">
                {notifications.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 space-y-2">
                    <Bell className="w-8 h-8 mx-auto stroke-1" />
                    <p className="text-xs font-mono">
                      {lang === 'en' ? 'No active alerts.' : 'నోటిఫికేషన్లు లేవు.'}
                    </p>
                  </div>
                ) : (
                  notifications.map((notif) => (
                    <div 
                      key={notif.id} 
                      className={`p-3.5 rounded-xl border transition-all flex justify-between gap-3 ${
                        notif.read 
                          ? 'bg-slate-50 border-slate-100 text-slate-400' 
                          : 'bg-white border-slate-200 text-slate-900 hover:border-slate-300 shadow-xs'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            notif.type === 'check-in' ? 'bg-blue-500' :
                            notif.type === 'check-out' ? 'bg-rose-500' :
                            notif.type === 'payment' ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}></span>
                          <span className="font-sans font-semibold text-xs text-slate-800">{notif.title}</span>
                        </div>
                        <p className="text-[11px] text-slate-500 leading-normal pr-2">
                          {notif.message}
                        </p>
                        <span className="block text-[10px] text-slate-400 font-mono">
                          {new Date(notif.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      {!notif.read && (
                        <button
                          onClick={() => handleMarkAsRead(notif.id)}
                          className="self-start p-1 bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-emerald-600 border border-slate-200 rounded transition-all shrink-0 cursor-pointer"
                          title="Mark as read"
                        >
                          <Check className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 text-center">
              <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider">
                {lang === 'en' ? 'Auto Refresh Enabled' : 'ఆటో-రిఫ్రెష్ ఆన్‌లో ఉంది'}
              </span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
