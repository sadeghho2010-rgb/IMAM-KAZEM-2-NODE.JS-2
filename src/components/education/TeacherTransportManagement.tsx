import React, { useState, useEffect } from 'react';
import { 
  Car, 
  UserCheck, 
  Plus, 
  Calendar, 
  Clock, 
  MapPin, 
  CheckCircle2, 
  XCircle, 
  FileSpreadsheet, 
  Search, 
  Trash2, 
  Edit3, 
  DollarSign, 
  Building2, 
  Phone, 
  Check, 
  AlertCircle 
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { cn } from '../../lib/utils';
import { localDb } from '../../lib/localDb';
import { useAuth } from '../../context/AuthContext';
import { getTodayShamsi, compareShamsi, SHAMSI_MONTH_NAMES, SHAMSI_WEEKDAY_NAMES_SHORT, getDaysInShamsiMonth, getShamsiDayOfWeek, formatShamsiDate } from '../../lib/jalali';
import { Teacher, DriverInfo, TeacherTransportSchedule } from '../../types';

export default function TeacherTransportManagement() {
  const { currentUser } = useAuth();
  
  // Data State
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [drivers, setDrivers] = useState<DriverInfo[]>([]);
  const [schedules, setSchedules] = useState<TeacherTransportSchedule[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Active View Tab: 'schedules' or 'drivers'
  const [activeSubTab, setActiveSubTab] = useState<'schedules' | 'drivers'>('schedules');

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedTeacherFilter, setSelectedTeacherFilter] = useState<string>('all');
  const [selectedDriverFilter, setSelectedDriverFilter] = useState<string>('all');
  const [selectedApprovalFilter, setSelectedApprovalFilter] = useState<'all' | 'approved' | 'pending'>('all');

  // Driver Modal State
  const [isDriverModalOpen, setIsDriverModalOpen] = useState<boolean>(false);
  const [editingDriver, setEditingDriver] = useState<DriverInfo | null>(null);
  const [driverName, setDriverName] = useState<string>('');
  const [driverPhone, setDriverPhone] = useState<string>('');
  const [carModel, setCarModel] = useState<string>('');
  const [plateNumber, setPlateNumber] = useState<string>('');

  // Schedule Modal State
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState<boolean>(false);
  const [editingSchedule, setEditingSchedule] = useState<TeacherTransportSchedule | null>(null);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');
  const [scheduleDate, setScheduleDate] = useState<string>(getTodayShamsi());
  const [pickupTime, setPickupTime] = useState<string>('07:30');
  const [returnTime, setReturnTime] = useState<string>('12:00');
  const [routeDescription, setRouteDescription] = useState<string>('قم - منزل تا موسسه');
  const [selectedDriverId, setSelectedDriverId] = useState<string>('');
  const [cost, setCost] = useState<number>(150000);
  const [notes, setNotes] = useState<string>('');

  // Calendar Picker State inside Schedule Modal
  const [calYear, setCalYear] = useState<number>(1403);
  const [calMonth, setCalMonth] = useState<number>(7);

  // Load Data
  const loadData = async () => {
    try {
      setLoading(true);
      const [storedTeachers, storedDrivers, storedSchedules] = await Promise.all([
        localDb.getDocs<Teacher>('teachers'),
        localDb.getDocs<DriverInfo>('drivers'),
        localDb.getDocs<TeacherTransportSchedule>('teacher_transports')
      ]);

      setTeachers(storedTeachers || []);

      // Seed initial drivers if empty
      let validDrivers = storedDrivers || [];
      if (validDrivers.length === 0) {
        const seedDrivers: DriverInfo[] = [
          { id: 'drv_1', fullName: 'آقای مجید رضایی', phoneNumber: '09121112233', carModel: 'پژو ۴۰۵', plateNumber: '۲۲ ج ۳۴۵ ایران ۱۶', isActive: true, createdAt: new Date().toISOString() },
          { id: 'drv_2', fullName: 'آقای علی اصغری', phoneNumber: '09123334455', carModel: 'سمند EF7', plateNumber: '۴۵ ب ۱۱۲ ایران ۱۶', isActive: true, createdAt: new Date().toISOString() }
        ];
        for (const d of seedDrivers) {
          await localDb.setDoc('drivers', d.id, d);
        }
        validDrivers = seedDrivers;
      }
      setDrivers(validDrivers);

      // Seed initial transport schedules if empty
      let validSchedules = storedSchedules || [];
      if (validSchedules.length === 0 && storedTeachers && storedTeachers.length > 0) {
        const seedSchedules: TeacherTransportSchedule[] = [
          {
            id: 'trans_1',
            teacherId: storedTeachers[0]?.id || 't1',
            teacherName: storedTeachers[0]?.fullName || 'استاد سید علی حسینی',
            date: getTodayShamsi(),
            dayOfWeek: 'شنبه',
            pickupTime: '07:30',
            returnTime: '12:30',
            routeDescription: 'منزل تا موسسه و بالعکس',
            driverId: validDrivers[0]?.id || '',
            driverName: validDrivers[0]?.fullName || 'آقای مجید رضایی',
            cost: 150000,
            isEducationApproved: true,
            approvedBy: currentUser?.fullName || 'مسئول آموزش',
            approvedAt: new Date().toISOString(),
            createdAt: new Date().toISOString()
          }
        ];
        for (const s of seedSchedules) {
          await localDb.setDoc('teacher_transports', s.id, s);
        }
        validSchedules = seedSchedules;
      }

      validSchedules.sort((a, b) => compareShamsi(b.date, a.date));
      setSchedules(validSchedules);

    } catch (err) {
      console.error('Error loading transport data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Save Driver
  const handleSaveDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!driverName.trim()) return;

    const driverData: DriverInfo = {
      id: editingDriver ? editingDriver.id : `drv_${Date.now()}`,
      fullName: driverName.trim(),
      phoneNumber: driverPhone.trim(),
      carModel: carModel.trim(),
      plateNumber: plateNumber.trim(),
      isActive: true,
      createdAt: editingDriver ? editingDriver.createdAt : new Date().toISOString()
    };

    await localDb.setDoc('drivers', driverData.id, driverData);
    setIsDriverModalOpen(false);
    loadData();
  };

  const handleDeleteDriver = async (id: string) => {
    if (window.confirm('آیا از حذف این راننده اطمینان دارید؟')) {
      await localDb.deleteDoc('drivers', id);
      loadData();
    }
  };

  // Save Schedule
  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeacherId) return;

    const teacher = teachers.find(t => t.id === selectedTeacherId);
    const driver = drivers.find(d => d.id === selectedDriverId);

    const scheduleData: TeacherTransportSchedule = {
      id: editingSchedule ? editingSchedule.id : `trans_${Date.now()}`,
      teacherId: selectedTeacherId,
      teacherName: teacher?.fullName || 'استاد',
      date: scheduleDate,
      dayOfWeek: 'شنبه', // dynamically formatted
      pickupTime,
      returnTime,
      routeDescription,
      driverId: selectedDriverId,
      driverName: driver?.fullName || '',
      cost: Number(cost) || 0,
      notes,
      isEducationApproved: editingSchedule ? editingSchedule.isEducationApproved : false,
      createdAt: editingSchedule ? editingSchedule.createdAt : new Date().toISOString()
    };

    await localDb.setDoc('teacher_transports', scheduleData.id, scheduleData);
    setIsScheduleModalOpen(false);
    loadData();
  };

  const handleDeleteSchedule = async (id: string) => {
    if (window.confirm('آیا از حذف این رکورد ایاب و ذهاب مطمئن هستید؟')) {
      await localDb.deleteDoc('teacher_transports', id);
      loadData();
    }
  };

  // Final Approval Toggle by Education Manager
  const handleToggleApproval = async (schedule: TeacherTransportSchedule) => {
    const newStatus = !schedule.isEducationApproved;
    const updated: TeacherTransportSchedule = {
      ...schedule,
      isEducationApproved: newStatus,
      approvedBy: newStatus ? (currentUser?.fullName || 'مسئول آموزش') : undefined,
      approvedAt: newStatus ? new Date().toISOString() : undefined
    };

    await localDb.setDoc('teacher_transports', schedule.id, updated);
    loadData();
  };

  // Filtered Schedules
  const filteredSchedules = schedules.filter(s => {
    const matchesSearch = s.teacherName.includes(searchQuery) || (s.driverName && s.driverName.includes(searchQuery));
    const matchesTeacher = selectedTeacherFilter === 'all' || s.teacherId === selectedTeacherFilter;
    const matchesDriver = selectedDriverFilter === 'all' || s.driverId === selectedDriverFilter;
    const matchesApproval = selectedApprovalFilter === 'all' || 
      (selectedApprovalFilter === 'approved' && s.isEducationApproved) ||
      (selectedApprovalFilter === 'pending' && !s.isEducationApproved);

    return matchesSearch && matchesTeacher && matchesDriver && matchesApproval;
  });

  // Export to Excel
  const exportToExcel = () => {
    const dataToExport = filteredSchedules.map((s, index) => ({
      'ردیف': index + 1,
      'نام استاد': s.teacherName,
      'تاریخ شمسی': s.date,
      'ساعت رفت': s.pickupTime,
      'ساعت برگشت': s.returnTime,
      'مسیر': s.routeDescription,
      'نام راننده': s.driverName || '-',
      'هزینه (تومان)': s.cost,
      'وضعیت تایید نهایی آموزش': s.isEducationApproved ? 'تایید شده' : 'در انتظار تایید',
      'تایید کننده': s.approvedBy || '-'
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'ایاب و ذهاب اساتید');
    XLSX.writeFile(workbook, `گزارش_ایاب_و_ذهاب_اساتید_${getTodayShamsi().replace(/\//g, '-')}.xlsx`);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="p-2 bg-indigo-500/20 text-indigo-300 rounded-xl border border-indigo-400/30">
                <Car size={22} />
              </span>
              <h1 className="text-xl font-black">مدیریت سرویس و ایاب و ذهاب اساتید</h1>
            </div>
            <p className="text-xs text-indigo-200 font-medium">
              تعریف رانندگان سرویس، زمان‌بندی رفت و آمد اساتید و تایید نهایی صورت‌حساب جهت پرداخت مالی
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                setEditingDriver(null);
                setDriverName('');
                setDriverPhone('');
                setCarModel('');
                setPlateNumber('');
                setIsDriverModalOpen(true);
              }}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all border border-white/20 flex items-center gap-1.5 cursor-pointer"
            >
              <UserCheck size={15} />
              <span>تعریف راننده جدید</span>
            </button>

            <button
              onClick={() => {
                setEditingSchedule(null);
                setSelectedTeacherId(teachers[0]?.id || '');
                setScheduleDate(getTodayShamsi());
                setPickupTime('07:30');
                setReturnTime('12:00');
                setRouteDescription('منزل تا موسسه');
                setSelectedDriverId(drivers[0]?.id || '');
                setCost(150000);
                setNotes('');
                setIsScheduleModalOpen(true);
              }}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
            >
              <Plus size={15} />
              <span>ثبت سرویس ایاب و ذهاب جدید</span>
            </button>

            <button
              onClick={exportToExcel}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <FileSpreadsheet size={15} />
              <span>خروجی اکسل</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl w-fit border border-slate-200">
        <button
          onClick={() => setActiveSubTab('schedules')}
          className={cn(
            "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer",
            activeSubTab === 'schedules'
              ? "bg-white text-indigo-900 shadow-xs"
              : "text-slate-600 hover:text-slate-900"
          )}
        >
          <Car size={15} />
          <span>جدول ایاب و ذهاب و تایید نهایی ({schedules.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('drivers')}
          className={cn(
            "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer",
            activeSubTab === 'drivers'
              ? "bg-white text-indigo-900 shadow-xs"
              : "text-slate-600 hover:text-slate-900"
          )}
        >
          <UserCheck size={15} />
          <span>بانک رانندگان سرویس ({drivers.length})</span>
        </button>
      </div>

      {/* TAB 1: SCHEDULES TABLE */}
      {activeSubTab === 'schedules' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
          {/* Filters Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <div className="relative">
              <Search size={14} className="absolute right-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="جستجوی استاد یا راننده..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl pr-9 pl-3 py-2 outline-none focus:border-indigo-500 font-bold"
              />
            </div>

            <select
              value={selectedTeacherFilter}
              onChange={(e) => setSelectedTeacherFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-xs rounded-xl px-3 py-2 outline-none font-bold"
            >
              <option value="all">همه اساتید</option>
              {teachers.map(t => (
                <option key={t.id} value={t.id}>{t.fullName}</option>
              ))}
            </select>

            <select
              value={selectedDriverFilter}
              onChange={(e) => setSelectedDriverFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-xs rounded-xl px-3 py-2 outline-none font-bold"
            >
              <option value="all">همه رانندگان</option>
              {drivers.map(d => (
                <option key={d.id} value={d.id}>{d.fullName}</option>
              ))}
            </select>

            <select
              value={selectedApprovalFilter}
              onChange={(e) => setSelectedApprovalFilter(e.target.value as any)}
              className="bg-slate-50 border border-slate-200 text-xs rounded-xl px-3 py-2 outline-none font-bold"
            >
              <option value="all">همه وضعیت‌های تایید</option>
              <option value="approved">فقط تایید شده‌های آموزش</option>
              <option value="pending">در انتظار تایید آموزش</option>
            </select>
          </div>

          {/* Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-2xl">
            <table className="w-full text-right border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-800 border-b border-slate-200 font-black">
                  <th className="py-3 px-3">ردیف</th>
                  <th className="py-3 px-3">نام استاد</th>
                  <th className="py-3 px-3">تاریخ سرویس</th>
                  <th className="py-3 px-3">ساعت رفت / برگشت</th>
                  <th className="py-3 px-3">مسیر و مبدا/مقصد</th>
                  <th className="py-3 px-3">راننده تخصیص‌یافته</th>
                  <th className="py-3 px-3 text-center">هزینه ایاب و ذهاب</th>
                  <th className="py-3 px-3 text-center">تایید نهایی مسئول آموزش</th>
                  <th className="py-3 px-3 text-center">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSchedules.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400 font-bold">
                      هیچ سرویس ایاب و ذهابی ثبت نشده است.
                    </td>
                  </tr>
                ) : (
                  filteredSchedules.map((s, idx) => (
                    <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-3 font-mono text-slate-500">{idx + 1}</td>
                      <td className="py-3 px-3 font-black text-slate-900">{s.teacherName}</td>
                      <td className="py-3 px-3 font-mono font-bold text-slate-700">{s.date}</td>
                      <td className="py-3 px-3 font-mono text-slate-600">
                        {s.pickupTime} تا {s.returnTime}
                      </td>
                      <td className="py-3 px-3 text-slate-600 max-w-[180px] truncate">{s.routeDescription}</td>
                      <td className="py-3 px-3 font-bold text-slate-800">{s.driverName || '-'}</td>
                      <td className="py-3 px-3 text-center font-mono font-bold text-emerald-700">
                        {s.cost ? s.cost.toLocaleString('fa-IR') + ' تومان' : 'رایگان / توافقی'}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={() => handleToggleApproval(s)}
                          className={cn(
                            "px-3 py-1 rounded-xl text-xs font-bold transition-all border flex items-center gap-1 mx-auto cursor-pointer",
                            s.isEducationApproved
                              ? "bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100"
                              : "bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100"
                          )}
                        >
                          {s.isEducationApproved ? (
                            <>
                              <CheckCircle2 size={13} className="text-emerald-600" />
                              <span>تایید شده ({s.approvedBy || 'آموزش'})</span>
                            </>
                          ) : (
                            <>
                              <Clock size={13} className="text-amber-600" />
                              <span>کلیک جهت تایید نهایی</span>
                            </>
                          )}
                        </button>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => {
                              setEditingSchedule(s);
                              setSelectedTeacherId(s.teacherId);
                              setScheduleDate(s.date);
                              setPickupTime(s.pickupTime);
                              setReturnTime(s.returnTime);
                              setRouteDescription(s.routeDescription);
                              setSelectedDriverId(s.driverId || '');
                              setCost(s.cost || 0);
                              setNotes(s.notes || '');
                              setIsScheduleModalOpen(true);
                            }}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg"
                            title="ویرایش"
                          >
                            <Edit3 size={13} />
                          </button>
                          <button
                            onClick={() => handleDeleteSchedule(s.id)}
                            className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg"
                            title="حذف"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: DRIVERS LIST */}
      {activeSubTab === 'drivers' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {drivers.map(driver => (
              <div key={driver.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3 relative">
                <div className="flex items-center justify-between border-b border-slate-200/80 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="p-2 bg-indigo-100 text-indigo-700 rounded-xl">
                      <Car size={18} />
                    </span>
                    <div>
                      <h4 className="font-black text-slate-900 text-xs">{driver.fullName}</h4>
                      <span className="text-[10px] font-mono text-slate-400 block">{driver.phoneNumber}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setEditingDriver(driver);
                        setDriverName(driver.fullName);
                        setDriverPhone(driver.phoneNumber);
                        setCarModel(driver.carModel || '');
                        setPlateNumber(driver.plateNumber || '');
                        setIsDriverModalOpen(true);
                      }}
                      className="p-1.5 bg-white hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-200"
                    >
                      <Edit3 size={13} />
                    </button>
                    <button
                      onClick={() => handleDeleteDriver(driver.id)}
                      className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg border border-rose-200"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between text-slate-600">
                    <span>مدل خودرو:</span>
                    <span className="font-bold text-slate-800">{driver.carModel || 'تعریف نشده'}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span>شماره پلاک:</span>
                    <span className="font-mono font-bold text-slate-800 bg-white px-2 py-0.5 rounded-lg border border-slate-200">{driver.plateNumber || 'تعریف نشده'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL 1: Driver Form Modal */}
      {isDriverModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Car size={18} className="text-indigo-600" />
                <span>{editingDriver ? 'ویرایش مشخصات راننده' : 'تعریف راننده جدید سرویس'}</span>
              </h3>
              <button onClick={() => setIsDriverModalOpen(false)} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400">
                <XCircle size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveDriver} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">نام و نام خانوادگی راننده:</label>
                <input
                  type="text"
                  required
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                  placeholder="مثلا: آقای مجید رضایی"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 outline-none font-bold"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">شماره تماس:</label>
                <input
                  type="text"
                  value={driverPhone}
                  onChange={(e) => setDriverPhone(e.target.value)}
                  placeholder="0912..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 outline-none font-mono font-bold"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">مدل و نوع خودرو:</label>
                <input
                  type="text"
                  value={carModel}
                  onChange={(e) => setCarModel(e.target.value)}
                  placeholder="مثلا: پژو پارس سفید"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 outline-none font-bold"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">شماره پلاک:</label>
                <input
                  type="text"
                  value={plateNumber}
                  onChange={(e) => setPlateNumber(e.target.value)}
                  placeholder="۲۲ ج ۳۴۵ ایران ۱۶"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 outline-none font-bold"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsDriverModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black"
                >
                  ذخیره راننده
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Schedule Form Modal */}
      {isScheduleModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Car size={18} className="text-indigo-600" />
                <span>{editingSchedule ? 'ویرایش سرویس ایاب و ذهاب' : 'ثبت سرویس ایاب و ذهاب استاد'}</span>
              </h3>
              <button onClick={() => setIsScheduleModalOpen(false)} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400">
                <XCircle size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveSchedule} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">انتخاب استاد:</label>
                <select
                  value={selectedTeacherId}
                  onChange={(e) => setSelectedTeacherId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 outline-none font-bold"
                >
                  <option value="">انتخاب کنید...</option>
                  {teachers.map(t => (
                    <option key={t.id} value={t.id}>{t.fullName}</option>
                  ))}
                </select>
              </div>

              {/* Interactive Shamsi Calendar for Schedule Date */}
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-800">تاریخ سرویس (شمسی):</label>
                  <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-200">
                    {scheduleDate}
                  </span>
                </div>

                <div className="flex items-center justify-between bg-white p-1.5 rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setCalMonth(m => m === 1 ? 12 : m - 1)}
                    className="px-2 py-1 bg-slate-100 rounded text-[11px] font-bold"
                  >
                    قبلی
                  </button>
                  <span className="font-bold text-slate-800 text-[11px]">
                    {SHAMSI_MONTH_NAMES[calMonth - 1]} {calYear}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCalMonth(m => m === 12 ? 1 : m + 1)}
                    className="px-2 py-1 bg-slate-100 rounded text-[11px] font-bold"
                  >
                    بعدی
                  </button>
                </div>

                <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold">
                  {Array.from({ length: getDaysInShamsiMonth(calYear, calMonth) }, (_, i) => i + 1).map(d => {
                    const dStr = formatShamsiDate(calYear, calMonth, d);
                    const isSelected = scheduleDate === dStr;
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setScheduleDate(dStr)}
                        className={cn(
                          "py-1 rounded font-mono font-bold border",
                          isSelected ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-800 border-slate-200"
                        )}
                      >
                        {d}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">ساعت رفت:</label>
                  <input
                    type="text"
                    value={pickupTime}
                    onChange={(e) => setPickupTime(e.target.value)}
                    placeholder="07:30"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 outline-none font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">ساعت برگشت:</label>
                  <input
                    type="text"
                    value={returnTime}
                    onChange={(e) => setReturnTime(e.target.value)}
                    placeholder="12:30"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 outline-none font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">مسیر / مبدا و مقصد:</label>
                <input
                  type="text"
                  value={routeDescription}
                  onChange={(e) => setRouteDescription(e.target.value)}
                  placeholder="منزل استاد تا موسسه"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 outline-none font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">تخصیص راننده:</label>
                  <select
                    value={selectedDriverId}
                    onChange={(e) => setSelectedDriverId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 outline-none font-bold"
                  >
                    <option value="">انتخاب راننده...</option>
                    {drivers.map(d => (
                      <option key={d.id} value={d.id}>{d.fullName}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">هزینه ایاب و ذهاب (تومان):</label>
                  <input
                    type="number"
                    value={cost}
                    onChange={(e) => setCost(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 outline-none font-mono font-bold"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsScheduleModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black"
                >
                  ذخیره سرویس
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
