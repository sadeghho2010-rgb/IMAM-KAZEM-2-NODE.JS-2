import React, { useState, useEffect, useMemo } from 'react';
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
  AlertCircle,
  Repeat,
  Navigation,
  ArrowRight,
  ArrowLeft,
  SlidersHorizontal,
  Home,
  Briefcase
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { cn } from '../../lib/utils';
import { localDb } from '../../lib/localDb';
import { useAuth } from '../../context/AuthContext';
import { getTodayShamsi, compareShamsi, SHAMSI_WEEKDAY_NAMES_SHORT } from '../../lib/jalali';
import { 
  Teacher, 
  DriverInfo, 
  TeacherWeeklyTransportRoutine, 
  TeacherTransportSingleTrip 
} from '../../types';
import { motion, AnimatePresence } from 'motion/react';

const WEEKDAYS = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه'];

export default function TeacherTransportManagement() {
  const { currentUser } = useAuth();
  
  // Data States
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [drivers, setDrivers] = useState<DriverInfo[]>([]);
  const [routines, setRoutines] = useState<TeacherWeeklyTransportRoutine[]>([]);
  const [singleTrips, setSingleTrips] = useState<TeacherTransportSingleTrip[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Active Tab: 'routines' (برنامه روتین هفتگی) | 'single_trips' (ترددهای موردی و تقویمی) | 'drivers' (رانندگان)
  const [activeTab, setActiveTab] = useState<'routines' | 'single_trips' | 'drivers'>('routines');

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedTeacherFilter, setSelectedTeacherFilter] = useState<string>('all');
  const [selectedWeekdayFilter, setSelectedWeekdayFilter] = useState<string>('all');
  const [toastMessage, setToastMessage] = useState<string>('');

  // Weekly Routine Modal State
  const [isRoutineModalOpen, setIsRoutineModalOpen] = useState(false);
  const [editingRoutine, setEditingRoutine] = useState<TeacherWeeklyTransportRoutine | null>(null);
  const [routineTeacherId, setRoutineTeacherId] = useState('');
  const [routineDays, setRoutineDays] = useState<string[]>(['شنبه', 'چهارشنبه']);
  const [routineArrivalEnabled, setRoutineArrivalEnabled] = useState(true);
  const [routineArrivalTime, setRoutineArrivalTime] = useState('15:00');
  const [routineArrivalTitle, setRoutineArrivalTitle] = useState('منزل');
  const [routineArrivalDetails, setRoutineArrivalDetails] = useState('الغدیر ۴۱');
  const [routineDepartureEnabled, setRoutineDepartureEnabled] = useState(true);
  const [routineDepartureTime, setRoutineDepartureTime] = useState('16:00');
  const [routineDepartureTitle, setRoutineDepartureTitle] = useState('منزل');
  const [routineDepartureDetails, setRoutineDepartureDetails] = useState('الغدیر ۴۱');
  const [routineDriverId, setRoutineDriverId] = useState('');
  const [routineCost, setRoutineCost] = useState(150000);
  const [routineNotes, setRoutineNotes] = useState('');

  // Single Trip Modal State
  const [isSingleTripModalOpen, setIsSingleTripModalOpen] = useState(false);
  const [editingSingleTrip, setEditingSingleTrip] = useState<TeacherTransportSingleTrip | null>(null);
  const [tripTeacherId, setTripTeacherId] = useState('');
  const [tripDate, setTripDate] = useState(getTodayShamsi());
  const [tripType, setTripType] = useState<'arrival' | 'departure' | 'round_trip'>('round_trip');
  const [tripArrivalTime, setTripArrivalTime] = useState('15:00');
  const [tripArrivalTitle, setTripArrivalTitle] = useState('منزل');
  const [tripArrivalDetails, setTripArrivalDetails] = useState('الغدیر ۴۱');
  const [tripDepartureTime, setTripDepartureTime] = useState('16:00');
  const [tripDepartureTitle, setTripDepartureTitle] = useState('منزل');
  const [tripDepartureDetails, setTripDepartureDetails] = useState('الغدیر ۴۱');
  const [tripDriverId, setTripDriverId] = useState('');
  const [tripTripsCount, setTripTripsCount] = useState(2);
  const [tripCost, setTripCost] = useState(150000);
  const [tripNotes, setTripNotes] = useState('');

  // Driver Modal State
  const [isDriverModalOpen, setIsDriverModalOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<DriverInfo | null>(null);
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [carModel, setCarModel] = useState('');
  const [plateNumber, setPlateNumber] = useState('');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  // Load Data
  const loadData = async () => {
    try {
      setLoading(true);
      const [storedTeachers, storedDrivers, storedRoutines, storedTrips] = await Promise.all([
        localDb.getDocs<Teacher>('teachers'),
        localDb.getDocs<DriverInfo>('drivers'),
        localDb.getDocs<TeacherWeeklyTransportRoutine>('teacher_transport_routines'),
        localDb.getDocs<TeacherTransportSingleTrip>('teacher_transport_trips')
      ]);

      const validTeachers = storedTeachers || [];
      setTeachers(validTeachers);

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

      // Seed sample weekly routine if empty
      let validRoutines = storedRoutines || [];
      if (validRoutines.length === 0 && validTeachers.length > 0) {
        const seedRoutines: TeacherWeeklyTransportRoutine[] = [
          {
            id: 'rout_1',
            teacherId: validTeachers[0].id,
            teacherName: validTeachers[0].fullName || validTeachers[0].name || 'استاد شاه‌فضل',
            daysOfWeek: ['شنبه', 'چهارشنبه'],
            arrivalEnabled: true,
            arrivalTime: '15:00',
            arrivalAddressTitle: 'منزل',
            arrivalAddressDetails: 'الغدیر ۴۱، پلاک ۱۲',
            departureEnabled: true,
            departureTime: '16:00',
            departureAddressTitle: 'منزل',
            departureAddressDetails: 'الغدیر ۴۱، پلاک ۱۲',
            costPerTrip: 150000,
            driverId: validDrivers[0]?.id,
            driverName: validDrivers[0]?.fullName,
            isActive: true,
            notes: 'سرویس منظم هفتگی در روزهای کلاسی',
            createdAt: new Date().toISOString()
          }
        ];
        for (const r of seedRoutines) {
          await localDb.setDoc('teacher_transport_routines', r.id, r);
        }
        validRoutines = seedRoutines;
      }
      setRoutines(validRoutines);

      // Seed sample single trip if empty
      let validTrips = storedTrips || [];
      if (validTrips.length === 0 && validTeachers.length > 0) {
        const seedTrip: TeacherTransportSingleTrip = {
          id: 'trip_1',
          teacherId: validTeachers[0].id,
          teacherName: validTeachers[0].fullName || validTeachers[0].name || 'استاد شاه‌فضل',
          date: getTodayShamsi(),
          tripType: 'round_trip',
          arrivalTime: '15:00',
          arrivalAddressTitle: 'منزل',
          arrivalAddressDetails: 'الغدیر ۴۱',
          departureTime: '16:00',
          departureAddressTitle: 'منزل',
          departureAddressDetails: 'الغدیر ۴۱',
          driverId: validDrivers[0]?.id,
          driverName: validDrivers[0]?.fullName,
          tripsCount: 2,
          cost: 150000,
          status: 'completed',
          notes: 'استفاده موردی در تاریخ مقرر',
          createdAt: new Date().toISOString()
        };
        await localDb.setDoc('teacher_transport_trips', seedTrip.id, seedTrip);
        validTrips = [seedTrip];
      }
      setSingleTrips(validTrips);

    } catch (e) {
      console.error('Error loading transport data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const unsub = localDb.subscribe(() => {
      loadData();
    });
    return () => unsub();
  }, []);

  // Open Routine Modal
  const handleOpenRoutineModal = (routine?: TeacherWeeklyTransportRoutine) => {
    if (routine) {
      setEditingRoutine(routine);
      setRoutineTeacherId(routine.teacherId);
      setRoutineDays(routine.daysOfWeek || []);
      setRoutineArrivalEnabled(routine.arrivalEnabled !== false);
      setRoutineArrivalTime(routine.arrivalTime || '15:00');
      setRoutineArrivalTitle(routine.arrivalAddressTitle || 'منزل');
      setRoutineArrivalDetails(routine.arrivalAddressDetails || '');
      setRoutineDepartureEnabled(routine.departureEnabled !== false);
      setRoutineDepartureTime(routine.departureTime || '16:00');
      setRoutineDepartureTitle(routine.departureAddressTitle || 'منزل');
      setRoutineDepartureDetails(routine.departureAddressDetails || '');
      setRoutineDriverId(routine.driverId || '');
      setRoutineCost(routine.costPerTrip || 150000);
      setRoutineNotes(routine.notes || '');
    } else {
      setEditingRoutine(null);
      setRoutineTeacherId(teachers[0]?.id || '');
      setRoutineDays(['شنبه', 'چهارشنبه']);
      setRoutineArrivalEnabled(true);
      setRoutineArrivalTime('15:00');
      setRoutineArrivalTitle('منزل');
      setRoutineArrivalDetails('الغدیر ۴۱');
      setRoutineDepartureEnabled(true);
      setRoutineDepartureTime('16:00');
      setRoutineDepartureTitle('منزل');
      setRoutineDepartureDetails('الغدیر ۴۱');
      setRoutineDriverId(drivers[0]?.id || '');
      setRoutineCost(150000);
      setRoutineNotes('');
    }
    setIsRoutineModalOpen(true);
  };

  // Save Routine
  const handleSaveRoutine = async (e: React.FormEvent) => {
    e.preventDefault();
    const matchedTeacher = teachers.find(t => t.id === routineTeacherId);
    const teacherName = matchedTeacher ? (matchedTeacher.fullName || matchedTeacher.name || 'استاد') : 'استاد';
    const matchedDriver = drivers.find(d => d.id === routineDriverId);

    const routineData: TeacherWeeklyTransportRoutine = {
      id: editingRoutine ? editingRoutine.id : `rout_${Date.now()}`,
      teacherId: routineTeacherId,
      teacherName,
      daysOfWeek: routineDays,
      arrivalEnabled: routineArrivalEnabled,
      arrivalTime: routineArrivalTime,
      arrivalAddressTitle: routineArrivalTitle.trim() || 'منزل',
      arrivalAddressDetails: routineArrivalDetails.trim(),
      departureEnabled: routineDepartureEnabled,
      departureTime: routineDepartureTime,
      departureAddressTitle: routineDepartureTitle.trim() || 'منزل',
      departureAddressDetails: routineDepartureDetails.trim(),
      costPerTrip: Number(routineCost) || 0,
      driverId: routineDriverId || undefined,
      driverName: matchedDriver?.fullName || undefined,
      isActive: true,
      notes: routineNotes.trim(),
      createdAt: editingRoutine ? editingRoutine.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await localDb.setDoc('teacher_transport_routines', routineData.id, routineData);
    setIsRoutineModalOpen(false);
    showToast('برنامه سرویس هفتگی استاد با موفقیت ثبت شد.');
  };

  const handleDeleteRoutine = async (id: string) => {
    if (!confirm('آیا از حذف این برنامه سرویس هفتگی اطمینان دارید؟')) return;
    await localDb.deleteDoc('teacher_transport_routines', id);
    showToast('برنامه سرویس هفتگی حذف شد.');
  };

  // Open Single Trip Modal
  const handleOpenSingleTripModal = (trip?: TeacherTransportSingleTrip) => {
    if (trip) {
      setEditingSingleTrip(trip);
      setTripTeacherId(trip.teacherId);
      setTripDate(trip.date);
      setTripType(trip.tripType === 'departure' ? 'departure' : trip.tripType === 'arrival' ? 'arrival' : 'round_trip');
      setTripArrivalTime(trip.arrivalTime || '15:00');
      setTripArrivalTitle(trip.arrivalAddressTitle || 'منزل');
      setTripArrivalDetails(trip.arrivalAddressDetails || '');
      setTripDepartureTime(trip.departureTime || '16:00');
      setTripDepartureTitle(trip.departureAddressTitle || 'منزل');
      setTripDepartureDetails(trip.departureAddressDetails || '');
      setTripDriverId(trip.driverId || '');
      setTripTripsCount(trip.tripsCount || 1);
      setTripCost(trip.cost || 150000);
      setTripNotes(trip.notes || '');
    } else {
      setEditingSingleTrip(null);
      setTripTeacherId(teachers[0]?.id || '');
      setTripDate(getTodayShamsi());
      setTripType('round_trip');
      setTripArrivalTime('15:00');
      setTripArrivalTitle('منزل');
      setTripArrivalDetails('الغدیر ۴۱');
      setTripDepartureTime('16:00');
      setTripDepartureTitle('منزل');
      setTripDepartureDetails('الغدیر ۴۱');
      setTripDriverId(drivers[0]?.id || '');
      setTripTripsCount(2);
      setTripCost(150000);
      setTripNotes('');
    }
    setIsSingleTripModalOpen(true);
  };

  // Save Single Trip
  const handleSaveSingleTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    const matchedTeacher = teachers.find(t => t.id === tripTeacherId);
    const teacherName = matchedTeacher ? (matchedTeacher.fullName || matchedTeacher.name || 'استاد') : 'استاد';
    const matchedDriver = drivers.find(d => d.id === tripDriverId);

    const tripData: TeacherTransportSingleTrip = {
      id: editingSingleTrip ? editingSingleTrip.id : `trip_${Date.now()}`,
      teacherId: tripTeacherId,
      teacherName,
      date: tripDate,
      tripType,
      arrivalTime: tripType !== 'departure' ? tripArrivalTime : undefined,
      arrivalAddressTitle: tripType !== 'departure' ? (tripArrivalTitle.trim() || 'منزل') : undefined,
      arrivalAddressDetails: tripType !== 'departure' ? tripArrivalDetails.trim() : undefined,
      departureTime: tripType !== 'arrival' ? tripDepartureTime : undefined,
      departureAddressTitle: tripType !== 'arrival' ? (tripDepartureTitle.trim() || 'منزل') : undefined,
      departureAddressDetails: tripType !== 'arrival' ? tripDepartureDetails.trim() : undefined,
      driverId: tripDriverId || undefined,
      driverName: matchedDriver?.fullName || undefined,
      tripsCount: tripType === 'round_trip' ? 2 : 1,
      cost: Number(tripCost) || 0,
      status: 'completed',
      notes: tripNotes.trim(),
      createdAt: editingSingleTrip ? editingSingleTrip.createdAt : new Date().toISOString()
    };

    await localDb.setDoc('teacher_transport_trips', tripData.id, tripData);
    setIsSingleTripModalOpen(false);
    showToast('تردد موردی استاد با موفقیت ذخیره گردید.');
  };

  const handleDeleteSingleTrip = async (id: string) => {
    if (!confirm('آیا از حذف این تردد موردی اطمینان دارید؟')) return;
    await localDb.deleteDoc('teacher_transport_trips', id);
    showToast('تردد موردی حذف شد.');
  };

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
    showToast('اطلاعات راننده ذخیره شد.');
  };

  const handleDeleteDriver = async (id: string) => {
    if (!confirm('آیا از حذف این راننده اطمینان دارید؟')) return;
    await localDb.deleteDoc('drivers', id);
    showToast('راننده حذف شد.');
  };

  // Filtered lists
  const filteredRoutines = useMemo(() => {
    return routines.filter(r => {
      const matchSearch = searchQuery ? (r.teacherName.includes(searchQuery) || r.arrivalAddressDetails.includes(searchQuery) || r.departureAddressDetails.includes(searchQuery)) : true;
      const matchTeacher = selectedTeacherFilter === 'all' || r.teacherId === selectedTeacherFilter;
      const matchDay = selectedWeekdayFilter === 'all' || r.daysOfWeek.includes(selectedWeekdayFilter);
      return matchSearch && matchTeacher && matchDay;
    });
  }, [routines, searchQuery, selectedTeacherFilter, selectedWeekdayFilter]);

  const filteredSingleTrips = useMemo(() => {
    return singleTrips.filter(t => {
      const matchSearch = searchQuery ? (t.teacherName.includes(searchQuery) || (t.arrivalAddressDetails && t.arrivalAddressDetails.includes(searchQuery)) || (t.departureAddressDetails && t.departureAddressDetails.includes(searchQuery))) : true;
      const matchTeacher = selectedTeacherFilter === 'all' || t.teacherId === selectedTeacherFilter;
      return matchSearch && matchTeacher;
    });
  }, [singleTrips, searchQuery, selectedTeacherFilter]);

  // Export Excel
  const handleExportExcel = () => {
    try {
      if (activeTab === 'routines') {
        const rows = filteredRoutines.map((r, i) => ({
          'ردیف': i + 1,
          'نام و نام خانوادگی استاد': r.teacherName,
          'روزهای هفته سرویس': r.daysOfWeek.join('، '),
          'ساعت آمدن به موسسه': r.arrivalEnabled ? r.arrivalTime : 'ندارد',
          'عنوان نشانی مبدا': r.arrivalAddressTitle,
          'آدرس دقیق مبدا': r.arrivalAddressDetails,
          'ساعت رفتن از موسسه': r.departureEnabled ? r.departureTime : 'ندارد',
          'عنوان نشانی مقصد': r.departureAddressTitle,
          'آدرس دقیق مقصد': r.departureAddressDetails,
          'هزینه هر نوبت (تومان)': r.costPerTrip?.toLocaleString('fa-IR') || '۰',
          'راننده سرویس': r.driverName || 'نامشخص',
          'توضیحات': r.notes || ''
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'برنامه هفتگی سرویس اساتید');
        XLSX.writeFile(wb, `برنامه_هفتگی_سرویس_اساتید_${getTodayShamsi().replace(/\//g, '-')}.xlsx`);
      } else {
        const rows = filteredSingleTrips.map((t, i) => ({
          'ردیف': i + 1,
          'نام و نام خانوادگی استاد': t.teacherName,
          'تاریخ تردد': t.date,
          'نوع تردد': t.tripType === 'round_trip' ? 'رفت و برگشت (۲ نوبت)' : t.tripType === 'arrival' ? 'آمدن به موسسه (۱ نوبت)' : 'رفتن از موسسه (۱ نوبت)',
          'ساعت آمدن': t.arrivalTime || '-',
          'نشانی مبدا': t.arrivalAddressTitle ? `${t.arrivalAddressTitle}: ${t.arrivalAddressDetails || ''}` : '-',
          'ساعت رفتن': t.departureTime || '-',
          'نشانی مقصد': t.departureAddressTitle ? `${t.departureAddressTitle}: ${t.departureAddressDetails || ''}` : '-',
          'تعداد نوبت': t.tripsCount,
          'هزینه سرویس (تومان)': t.cost.toLocaleString('fa-IR'),
          'راننده': t.driverName || 'نامشخص',
          'توضیحات': t.notes || ''
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'ترددهای موردی اساتید');
        XLSX.writeFile(wb, `ترددهای_موردی_اساتید_${getTodayShamsi().replace(/\//g, '-')}.xlsx`);
      }
      showToast('خروجی اکسل با موفقیت دانلود شد.');
    } catch (e) {
      console.error(e);
      alert('خطا در دریافت فایل اکسل.');
    }
  };

  return (
    <div className="space-y-6 pb-12 font-sans" dir="rtl">
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-5 py-2.5 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-bold border border-slate-700"
          >
            <CheckCircle2 size={16} className="text-emerald-400" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Banner */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/85 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-sky-500 to-blue-600 text-white flex items-center justify-center shadow-lg shadow-sky-100">
            <Car size={28} />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              سرویس ایاب و ذهاب اساتید
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
              مدیریت برنامه هفتگی سرویس (روزها، ساعات و آدرس‌های رفت‌وآمد)، ثبت ترددهای موردی و ارتباط با محاسبه مالی
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={handleExportExcel}
            className="px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <FileSpreadsheet size={16} className="text-emerald-600" />
            <span>خروجی اکسل</span>
          </button>

          {activeTab === 'routines' && (
            <button
              type="button"
              onClick={() => handleOpenRoutineModal()}
              className="px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-md shadow-sky-100 cursor-pointer"
            >
              <Plus size={16} />
              <span>تعریف برنامه هفتگی سرویس استاد</span>
            </button>
          )}

          {activeTab === 'single_trips' && (
            <button
              type="button"
              onClick={() => handleOpenSingleTripModal()}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-md shadow-indigo-100 cursor-pointer"
            >
              <Plus size={16} />
              <span>ثبت تردد موردی در تاریخ مشخص</span>
            </button>
          )}

          {activeTab === 'drivers' && (
            <button
              type="button"
              onClick={() => {
                setEditingDriver(null);
                setDriverName('');
                setDriverPhone('');
                setCarModel('');
                setPlateNumber('');
                setIsDriverModalOpen(true);
              }}
              className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-md cursor-pointer"
            >
              <Plus size={16} />
              <span>افزودن راننده جدید</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200/80 pb-3 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('routines')}
          className={cn(
            "px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer",
            activeTab === 'routines'
              ? "bg-sky-600 text-white shadow-md shadow-sky-100 ring-2 ring-sky-600/10"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/70"
          )}
        >
          <Repeat size={15} />
          <span>برنامه هفتگی و روتین سرویس اساتید ({routines.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('single_trips')}
          className={cn(
            "px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer",
            activeTab === 'single_trips'
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-100 ring-2 ring-indigo-600/10"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/70"
          )}
        >
          <Calendar size={15} />
          <span>ثبت و گزارش ترددهای موردی ({singleTrips.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('drivers')}
          className={cn(
            "px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer",
            activeTab === 'drivers'
              ? "bg-slate-900 text-white shadow-sm"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/70"
          )}
        >
          <Car size={15} />
          <span>رانندگان و خودروها ({drivers.length})</span>
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="جستجو در نام استاد، عنوان نشانی یا آدرس..."
            className="w-full pl-3 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500 transition-all"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
          {/* Teacher Filter */}
          <select
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none"
            value={selectedTeacherFilter}
            onChange={(e) => setSelectedTeacherFilter(e.target.value)}
          >
            <option value="all">همه اساتید</option>
            {teachers.map(t => (
              <option key={t.id} value={t.id}>{t.fullName || t.name}</option>
            ))}
          </select>

          {/* Weekday Filter for Routines */}
          {activeTab === 'routines' && (
            <select
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none"
              value={selectedWeekdayFilter}
              onChange={(e) => setSelectedWeekdayFilter(e.target.value)}
            >
              <option value="all">همه روزهای هفته</option>
              {WEEKDAYS.map(day => (
                <option key={day} value={day}>{day}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* TAB 1: ROUTINES (برنامه هفتگی) */}
      {activeTab === 'routines' && (
        <div className="space-y-4">
          {filteredRoutines.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 space-y-3 shadow-xs">
              <Car size={40} className="text-slate-300 mx-auto" />
              <h3 className="text-sm font-black text-slate-800">هیچ برنامه هفتگی سرویسی تعریف نشده است</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto font-medium">
                می‌توانید روزهای هفته (مثل شنبه‌ها و چهارشنبه‌ها)، ساعت آمدن از نشانی مبدا و ساعت رفتن به نشانی مقصد را برای اساتید ثبت کنید.
              </p>
              <button
                type="button"
                onClick={() => handleOpenRoutineModal()}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-black transition-all shadow-md shadow-sky-100 inline-flex items-center gap-1.5 cursor-pointer mt-2"
              >
                <Plus size={15} />
                <span>تعریف اولین برنامه هفتگی سرویس</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredRoutines.map((routine) => (
                <div 
                  key={routine.id}
                  className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs hover:shadow-md hover:border-sky-300/60 transition-all space-y-4 relative overflow-hidden group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl bg-sky-50 text-sky-700 font-black flex items-center justify-center border border-sky-100 shadow-xs">
                        <Car size={20} />
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-slate-900">{routine.teacherName}</h3>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          {routine.daysOfWeek.map(day => (
                            <span key={day} className="px-2 py-0.5 bg-sky-100/80 text-sky-950 border border-sky-200/40 rounded-md text-[10px] font-black">
                              {day}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleOpenRoutineModal(routine)}
                        className="p-1.5 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors cursor-pointer"
                        title="ویرایش"
                      >
                        <Edit3 size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteRoutine(routine.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="حذف"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  {/* Route & Times Box */}
                  <div className="bg-slate-50/90 rounded-xl p-3.5 border border-slate-200/80 space-y-3">
                    {/* Coming to institute */}
                    {routine.arrivalEnabled !== false && (
                      <div className="flex items-start gap-2.5 text-xs">
                        <div className="p-1 bg-emerald-100 text-emerald-800 rounded-md shrink-0 mt-0.5 font-bold text-[10px] flex items-center gap-1 border border-emerald-200/40">
                          <ArrowLeft size={12} />
                          <span>آمدن به موسسه</span>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-slate-800">{routine.arrivalTime}</span>
                            <span className="px-1.5 py-0.2 bg-white text-slate-600 rounded text-[10px] font-bold border border-slate-200">
                              {routine.arrivalAddressTitle}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600 mt-0.5 flex items-center gap-1 font-medium">
                            <MapPin size={11} className="text-slate-400 shrink-0" />
                            <span>{routine.arrivalAddressDetails || 'آدرس ثبت نشده'}</span>
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Leaving institute */}
                    {routine.departureEnabled !== false && (
                      <div className="flex items-start gap-2.5 text-xs border-t border-slate-200/60 pt-2.5">
                        <div className="p-1 bg-rose-100 text-rose-800 rounded-md shrink-0 mt-0.5 font-bold text-[10px] flex items-center gap-1 border border-rose-200/40">
                          <ArrowRight size={12} />
                          <span>رفتن از موسسه</span>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-slate-800">{routine.departureTime}</span>
                            <span className="px-1.5 py-0.2 bg-white text-slate-600 rounded text-[10px] font-bold border border-slate-200">
                              {routine.departureAddressTitle}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600 mt-0.5 flex items-center gap-1 font-medium">
                            <MapPin size={11} className="text-slate-400 shrink-0" />
                            <span>{routine.departureAddressDetails || 'آدرس ثبت نشده'}</span>
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Footer details */}
                  <div className="flex items-center justify-between gap-2 text-xs pt-1 border-t border-slate-100">
                    <div className="text-slate-500 font-medium flex items-center gap-1">
                      <span>هزینه هر نوبت:</span>
                      <span className="font-mono font-black text-sky-700">{routine.costPerTrip?.toLocaleString('fa-IR')} تومان</span>
                    </div>

                    {routine.driverName && (
                      <div className="text-[11px] text-sky-800 font-bold bg-sky-50 px-2 py-0.5 rounded-md border border-sky-100">
                        راننده: {routine.driverName}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: SINGLE TRIPS (ترددهای موردی) */}
      {activeTab === 'single_trips' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/90 flex items-center justify-between gap-3">
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <Calendar className="text-indigo-600" size={18} />
              <span>لیست ترددهای موردی و ثبت‌شده ({filteredSingleTrips.length} مورد)</span>
            </h3>
            <span className="text-xs text-slate-500 font-medium">
              استفاده موردی در تاریخ‌های خاص برای محاسبه در حق‌الزحمه
            </span>
          </div>

          {filteredSingleTrips.length === 0 ? (
            <div className="p-12 text-center space-y-2">
              <Calendar size={36} className="text-slate-300 mx-auto" />
              <p className="text-xs font-bold text-slate-600">هیچ تردد موردی در این بازه ثبت نشده است.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="bg-slate-100/80 text-slate-700 font-black border-b border-slate-200">
                    <th className="p-3 w-12 text-center">ردیف</th>
                    <th className="p-3">نام و نام خانوادگی استاد</th>
                    <th className="p-3">تاریخ تردد</th>
                    <th className="p-3">نوع تردد</th>
                    <th className="p-3">جزئیات ساعت و نشانی</th>
                    <th className="p-3">تعداد نوبت</th>
                    <th className="p-3">هزینه (تومان)</th>
                    <th className="p-3">راننده</th>
                    <th className="p-3 w-20 text-center">عملیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredSingleTrips.map((trip, idx) => (
                    <tr key={trip.id} className="hover:bg-slate-50/90 transition-colors">
                      <td className="p-3 text-center font-mono text-slate-400 font-bold">{idx + 1}</td>
                      <td className="p-3 font-black text-slate-900">{trip.teacherName}</td>
                      <td className="p-3 font-mono font-bold text-indigo-700">{trip.date}</td>
                      <td className="p-3">
                        <span className={cn(
                          "px-2.5 py-1 rounded-md text-[10px] font-black border",
                          trip.tripType === 'round_trip' ? "bg-sky-50 text-sky-950 border-sky-200/50" :
                          trip.tripType === 'arrival' ? "bg-emerald-50 text-emerald-950 border-emerald-200/50" : "bg-rose-50 text-rose-950 border-rose-200/50"
                        )}>
                          {trip.tripType === 'round_trip' ? 'رفت و برگشت' : trip.tripType === 'arrival' ? 'آمدن به موسسه' : 'رفتن از موسسه'}
                        </span>
                      </td>
                      <td className="p-3 text-[11px] text-slate-600 space-y-0.5">
                        {trip.arrivalTime && (
                          <div>
                            <span className="font-bold text-emerald-700">آمدن ({trip.arrivalTime}): </span>
                            <span>{trip.arrivalAddressTitle} ({trip.arrivalAddressDetails})</span>
                          </div>
                        )}
                        {trip.departureTime && (
                          <div>
                            <span className="font-bold text-rose-700">رفتن ({trip.departureTime}): </span>
                            <span>{trip.departureAddressTitle} ({trip.departureAddressDetails})</span>
                          </div>
                        )}
                      </td>
                      <td className="p-3 font-mono font-bold text-center">{trip.tripsCount}</td>
                      <td className="p-3 font-mono font-black text-slate-800">{trip.cost.toLocaleString('fa-IR')}</td>
                      <td className="p-3 text-slate-600">{trip.driverName || '-'}</td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenSingleTripModal(trip)}
                            className="p-1 text-slate-400 hover:text-indigo-600 rounded transition-colors"
                          >
                            <Edit3 size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteSingleTrip(trip.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: DRIVERS (رانندگان) */}
      {activeTab === 'drivers' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/90 flex items-center justify-between gap-3">
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <Car className="text-slate-800" size={18} />
              <span>بانک رانندگان طرف قرارداد سرویس ({drivers.length} نفر)</span>
            </h3>
          </div>

          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {drivers.map(drv => (
              <div key={drv.id} className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/80 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-xs">
                      {drv.fullName.slice(0, 2)}
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-slate-900">{drv.fullName}</h4>
                      <p className="text-[11px] font-mono text-slate-500 font-bold">{drv.phoneNumber || 'بدون شماره'}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingDriver(drv);
                        setDriverName(drv.fullName);
                        setDriverPhone(drv.phoneNumber || '');
                        setCarModel(drv.carModel || '');
                        setPlateNumber(drv.plateNumber || '');
                        setIsDriverModalOpen(true);
                      }}
                      className="p-1 text-slate-400 hover:text-slate-800"
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteDriver(drv.id)}
                      className="p-1 text-slate-400 hover:text-rose-600"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <div className="bg-white rounded-xl p-2.5 border border-slate-200 text-xs space-y-1">
                  <div className="flex justify-between text-slate-600">
                    <span className="text-[11px] text-slate-400">خودرو:</span>
                    <span className="font-bold">{drv.carModel || 'نامشخص'}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span className="text-[11px] text-slate-400">پلاک:</span>
                    <span className="font-mono font-bold">{drv.plateNumber || 'ثبت نشده'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL: CREATE / EDIT WEEKLY ROUTINE */}
      {isRoutineModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-100 space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Car className="text-amber-600" size={20} />
                <span>{editingRoutine ? 'ویرایش برنامه هفتگی سرویس استاد' : 'تعریف برنامه هفتگی سرویس استاد'}</span>
              </h3>
              <button 
                type="button"
                onClick={() => setIsRoutineModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <XCircle size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveRoutine} className="space-y-4">
              {/* Select Teacher */}
              <div className="space-y-1">
                <label className="text-xs font-black text-slate-700">انتخاب استاد:</label>
                <select
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none"
                  value={routineTeacherId}
                  onChange={(e) => setRoutineTeacherId(e.target.value)}
                >
                  {teachers.map(t => (
                    <option key={t.id} value={t.id}>{t.fullName || t.name}</option>
                  ))}
                </select>
              </div>

              {/* Select Days of Week */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-700">روزهای هفته نیاز به سرویس:</label>
                <div className="flex items-center gap-2 flex-wrap">
                  {WEEKDAYS.map(day => {
                    const isSelected = routineDays.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setRoutineDays(routineDays.filter(d => d !== day));
                          } else {
                            setRoutineDays([...routineDays, day]);
                          }
                        }}
                        className={cn(
                          "px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
                          isSelected 
                            ? "bg-amber-600 text-white shadow-2xs font-black" 
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        )}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Arrival Section */}
              <div className="bg-emerald-50/60 rounded-2xl p-4 border border-emerald-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-emerald-950 flex items-center gap-1.5">
                    <ArrowLeft size={14} className="text-emerald-600" />
                    <span>آمدن به موسسه (رفت)</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-xs font-bold text-emerald-900 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={routineArrivalEnabled}
                      onChange={(e) => setRoutineArrivalEnabled(e.target.checked)}
                      className="accent-emerald-600 rounded"
                    />
                    <span>فعال</span>
                  </label>
                </div>

                {routineArrivalEnabled && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-600">ساعت آمدن:</label>
                      <input
                        type="text"
                        placeholder="مثلاً 15:00"
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold outline-none"
                        value={routineArrivalTime}
                        onChange={(e) => setRoutineArrivalTime(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-600">عنوان نشانی مبدا:</label>
                      <input
                        type="text"
                        placeholder="مثلاً منزل / دانشگاه"
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none"
                        value={routineArrivalTitle}
                        onChange={(e) => setRoutineArrivalTitle(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1 sm:col-span-3">
                      <label className="text-[11px] font-bold text-slate-600">آدرس دقیق مبدا:</label>
                      <input
                        type="text"
                        placeholder="مثلاً الغدیر ۴۱، پلاک ۱۲"
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium outline-none"
                        value={routineArrivalDetails}
                        onChange={(e) => setRoutineArrivalDetails(e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Departure Section */}
              <div className="bg-rose-50/60 rounded-2xl p-4 border border-rose-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-rose-950 flex items-center gap-1.5">
                    <ArrowRight size={14} className="text-rose-600" />
                    <span>رفتن از موسسه (برگشت)</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-xs font-bold text-rose-900 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={routineDepartureEnabled}
                      onChange={(e) => setRoutineDepartureEnabled(e.target.checked)}
                      className="accent-rose-600 rounded"
                    />
                    <span>فعال</span>
                  </label>
                </div>

                {routineDepartureEnabled && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-600">ساعت رفتن:</label>
                      <input
                        type="text"
                        placeholder="مثلاً 16:00"
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold outline-none"
                        value={routineDepartureTime}
                        onChange={(e) => setRoutineDepartureTime(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-600">عنوان نشانی مقصد:</label>
                      <input
                        type="text"
                        placeholder="مثلاً منزل / پژوهشگاه"
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none"
                        value={routineDepartureTitle}
                        onChange={(e) => setRoutineDepartureTitle(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1 sm:col-span-3">
                      <label className="text-[11px] font-bold text-slate-600">آدرس دقیق مقصد:</label>
                      <input
                        type="text"
                        placeholder="مثلاً الغدیر ۴۱"
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium outline-none"
                        value={routineDepartureDetails}
                        onChange={(e) => setRoutineDepartureDetails(e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Driver and Cost */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">راننده سرویس:</label>
                  <select
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none"
                    value={routineDriverId}
                    onChange={(e) => setRoutineDriverId(e.target.value)}
                  >
                    <option value="">انتخاب راننده (اختیاری)</option>
                    {drivers.map(d => (
                      <option key={d.id} value={d.id}>{d.fullName} ({d.carModel || 'خودرو'})</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">هزینه هر نوبت (تومان):</label>
                  <input
                    type="number"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 outline-none"
                    value={routineCost}
                    onChange={(e) => setRoutineCost(Number(e.target.value))}
                  />
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">توضیحات و ملاحظات:</label>
                <input
                  type="text"
                  placeholder="یادداشت در خصوص مسیر یا هماهنگی..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none"
                  value={routineNotes}
                  onChange={(e) => setRoutineNotes(e.target.value)}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsRoutineModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-bold"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black shadow-md shadow-amber-200"
                >
                  ذخیره برنامه هفتگی
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREATE / EDIT SINGLE TRIP */}
      {isSingleTripModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-100 space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Calendar className="text-indigo-600" size={20} />
                <span>{editingSingleTrip ? 'ویرایش تردد موردی استاد' : 'ثبت تردد موردی استاد'}</span>
              </h3>
              <button 
                type="button"
                onClick={() => setIsSingleTripModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <XCircle size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveSingleTrip} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-black text-slate-700">انتخاب استاد:</label>
                  <select
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none"
                    value={tripTeacherId}
                    onChange={(e) => setTripTeacherId(e.target.value)}
                  >
                    {teachers.map(t => (
                      <option key={t.id} value={t.id}>{t.fullName || t.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-black text-slate-700">تاریخ تردد (شمسی):</label>
                  <input
                    type="text"
                    required
                    placeholder="مثلاً 1403/07/10"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 outline-none"
                    value={tripDate}
                    onChange={(e) => setTripDate(e.target.value)}
                  />
                </div>
              </div>

              {/* Trip Type */}
              <div className="space-y-1">
                <label className="text-xs font-black text-slate-700">نوع تردد:</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setTripType('round_trip')}
                    className={cn(
                      "py-2 rounded-xl text-xs font-black transition-all",
                      tripType === 'round_trip' ? "bg-amber-600 text-white shadow-2xs" : "bg-slate-100 text-slate-600"
                    )}
                  >
                    رفت و برگشت (۲ نوبت)
                  </button>
                  <button
                    type="button"
                    onClick={() => setTripType('arrival')}
                    className={cn(
                      "py-2 rounded-xl text-xs font-black transition-all",
                      tripType === 'arrival' ? "bg-emerald-600 text-white shadow-2xs" : "bg-slate-100 text-slate-600"
                    )}
                  >
                    فقط آمدن (۱ نوبت)
                  </button>
                  <button
                    type="button"
                    onClick={() => setTripType('departure')}
                    className={cn(
                      "py-2 rounded-xl text-xs font-black transition-all",
                      tripType === 'departure' ? "bg-rose-600 text-white shadow-2xs" : "bg-slate-100 text-slate-600"
                    )}
                  >
                    فقط رفتن (۱ نوبت)
                  </button>
                </div>
              </div>

              {/* Arrival address */}
              {tripType !== 'departure' && (
                <div className="bg-emerald-50/50 p-3.5 rounded-2xl border border-emerald-200 space-y-2">
                  <div className="text-xs font-black text-emerald-900">مشخصات آمدن به موسسه:</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="ساعت آمدن (مثلاً 15:00)"
                      className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold outline-none"
                      value={tripArrivalTime}
                      onChange={(e) => setTripArrivalTime(e.target.value)}
                    />
                    <input
                      type="text"
                      placeholder="عنوان نشانی (مثلاً منزل)"
                      className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none"
                      value={tripArrivalTitle}
                      onChange={(e) => setTripArrivalTitle(e.target.value)}
                    />
                  </div>
                  <input
                    type="text"
                    placeholder="آدرس دقیق نشانی مبدا (مثلاً الغدیر ۴۱)"
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium outline-none"
                    value={tripArrivalDetails}
                    onChange={(e) => setTripArrivalDetails(e.target.value)}
                  />
                </div>
              )}

              {/* Departure address */}
              {tripType !== 'arrival' && (
                <div className="bg-rose-50/50 p-3.5 rounded-2xl border border-rose-200 space-y-2">
                  <div className="text-xs font-black text-rose-900">مشخصات رفتن از موسسه:</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="ساعت رفتن (مثلاً 16:00)"
                      className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold outline-none"
                      value={tripDepartureTime}
                      onChange={(e) => setTripDepartureTime(e.target.value)}
                    />
                    <input
                      type="text"
                      placeholder="عنوان نشانی (مثلاً منزل)"
                      className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none"
                      value={tripDepartureTitle}
                      onChange={(e) => setTripDepartureTitle(e.target.value)}
                    />
                  </div>
                  <input
                    type="text"
                    placeholder="آدرس دقیق نشانی مقصد (مثلاً الغدیر ۴۱)"
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium outline-none"
                    value={tripDepartureDetails}
                    onChange={(e) => setTripDepartureDetails(e.target.value)}
                  />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">راننده:</label>
                  <select
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none"
                    value={tripDriverId}
                    onChange={(e) => setTripDriverId(e.target.value)}
                  >
                    <option value="">انتخاب راننده</option>
                    {drivers.map(d => (
                      <option key={d.id} value={d.id}>{d.fullName}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">مبلغ تردد (تومان):</label>
                  <input
                    type="number"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 outline-none"
                    value={tripCost}
                    onChange={(e) => setTripCost(Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsSingleTripModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-bold"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-md shadow-indigo-200"
                >
                  ذخیره تردد موردی
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREATE / EDIT DRIVER */}
      {isDriverModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Car className="text-slate-800" size={20} />
                <span>{editingDriver ? 'ویرایش راننده' : 'افزودن راننده جدید'}</span>
              </h3>
              <button 
                type="button"
                onClick={() => setIsDriverModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <XCircle size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveDriver} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">نام و نام خانوادگی:</label>
                <input
                  type="text"
                  required
                  placeholder="نام راننده..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none"
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">شماره تماس:</label>
                <input
                  type="text"
                  placeholder="0912..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold outline-none"
                  value={driverPhone}
                  onChange={(e) => setDriverPhone(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">مدل خودرو:</label>
                  <input
                    type="text"
                    placeholder="پژو ۴۰۵، سمند..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none"
                    value={carModel}
                    onChange={(e) => setCarModel(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">شماره پلاک:</label>
                  <input
                    type="text"
                    placeholder="۲۲ ج ۳۴۵ ایران ۱۶"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-medium outline-none"
                    value={plateNumber}
                    onChange={(e) => setPlateNumber(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsDriverModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-bold"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black shadow-md"
                >
                  ذخیره راننده
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
