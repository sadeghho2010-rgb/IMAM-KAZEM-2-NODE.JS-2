import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Layers, 
  Save, 
  RotateCcw, 
  Eye, 
  EyeOff, 
  Edit3, 
  CheckCircle2, 
  AlertTriangle, 
  Search, 
  ChevronDown, 
  ChevronUp, 
  Sliders, 
  Sparkles,
  BookOpen,
  CheckSquare,
  Award,
  Users,
  GraduationCap,
  MessageSquare,
  Coins,
  BookCheck,
  Lock,
  Unlock
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { 
  SECTION_MODULES, 
  ROLE_GROUP_LABELS, 
  TargetRoleGroup, 
  AccessLevel, 
  SectionPermissionsMap, 
  DEFAULT_SECTION_PERMISSIONS, 
  getStoredSectionPermissions, 
  saveSectionPermissions 
} from '../../lib/sectionPermissions';

const ICON_MAP: Record<string, any> = {
  BookOpen,
  CheckSquare,
  Award,
  Users,
  GraduationCap,
  MessageSquare,
  Coins,
  BookCheck
};

export const SectionPermissionsManager: React.FC = () => {
  const [matrix, setMatrix] = useState<SectionPermissionsMap>(DEFAULT_SECTION_PERMISSIONS);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [successToast, setSuccessToast] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    research: true,
    attendance: true,
    discussion: true
  });

  useEffect(() => {
    loadPermissions();
  }, []);

  const loadPermissions = async () => {
    setIsLoading(true);
    const data = await getStoredSectionPermissions();
    setMatrix(data);
    setIsLoading(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    const ok = await saveSectionPermissions(matrix);
    setIsSaving(false);
    if (ok) {
      setSuccessToast('ماتریس دسترسی‌ها با موفقیت ذخیره شد و به صورت سراسری بر تمامی کاربران اعمال گردید.');
      setTimeout(() => setSuccessToast(''), 4000);
    } else {
      alert('خطا در ذخیره‌سازی دسترسی‌ها');
    }
  };

  const handleResetDefaults = () => {
    if (window.confirm('آیا از بازنشانی کلیه دسترسی‌ها به تنظیمات پیش‌فرض کارخانه سامانه اطمینان دارید؟')) {
      setMatrix(DEFAULT_SECTION_PERMISSIONS);
      setSuccessToast('تنظیمات به حالت پیش‌فرض بازگردانده شد. برای اعمال، دکمه ذخیره را بزنید.');
      setTimeout(() => setSuccessToast(''), 4000);
    }
  };

  const toggleSectionExpand = (sectionId: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  // Change overall module access for a role
  const setOverallAccess = (sectionId: string, role: TargetRoleGroup, level: AccessLevel) => {
    setMatrix(prev => {
      const section = prev[sectionId] || { overall: { ...DEFAULT_SECTION_PERMISSIONS[sectionId]?.overall }, subFeatures: {} };
      const updatedOverall = { ...section.overall, [role]: level };
      
      // Also sync subfeatures if setting to 'none'
      const updatedSubFeatures = { ...section.subFeatures };
      if (level === 'none') {
        const modDef = SECTION_MODULES.find(m => m.id === sectionId);
        if (modDef) {
          modDef.subFeatures.forEach(sf => {
            const currentSf = updatedSubFeatures[sf.id] || { ...DEFAULT_SECTION_PERMISSIONS[sectionId]?.subFeatures?.[sf.id] };
            updatedSubFeatures[sf.id] = { ...currentSf, [role]: 'none' };
          });
        }
      }

      return {
        ...prev,
        [sectionId]: {
          overall: updatedOverall,
          subFeatures: updatedSubFeatures
        }
      };
    });
  };

  // Change sub-feature access for a role
  const setSubFeatureAccess = (sectionId: string, subFeatureId: string, role: TargetRoleGroup, level: AccessLevel) => {
    setMatrix(prev => {
      const section = prev[sectionId] || { overall: { ...DEFAULT_SECTION_PERMISSIONS[sectionId]?.overall }, subFeatures: {} };
      const currentSf = section.subFeatures?.[subFeatureId] || { ...DEFAULT_SECTION_PERMISSIONS[sectionId]?.subFeatures?.[subFeatureId] };
      
      return {
        ...prev,
        [sectionId]: {
          ...section,
          subFeatures: {
            ...section.subFeatures,
            [subFeatureId]: {
              ...currentSf,
              [role]: level
            }
          }
        }
      };
    });
  };

  // Quick Batch Actions for a Section
  const handleBatchSectionAction = (sectionId: string, role: TargetRoleGroup, level: AccessLevel) => {
    const modDef = SECTION_MODULES.find(m => m.id === sectionId);
    if (!modDef) return;

    setMatrix(prev => {
      const section = prev[sectionId] || { overall: { ...DEFAULT_SECTION_PERMISSIONS[sectionId]?.overall }, subFeatures: {} };
      const updatedOverall = { ...section.overall, [role]: level };
      const updatedSubFeatures = { ...section.subFeatures };

      modDef.subFeatures.forEach(sf => {
        const currentSf = updatedSubFeatures[sf.id] || { ...DEFAULT_SECTION_PERMISSIONS[sectionId]?.subFeatures?.[sf.id] };
        updatedSubFeatures[sf.id] = { ...currentSf, [role]: level };
      });

      return {
        ...prev,
        [sectionId]: {
          overall: updatedOverall,
          subFeatures: updatedSubFeatures
        }
      };
    });
  };

  const filteredModules = SECTION_MODULES.filter(m => {
    if (selectedCategory !== 'all' && m.category !== selectedCategory) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchTitle = m.title.toLowerCase().includes(q);
      const matchDesc = m.description.toLowerCase().includes(q);
      const matchSub = m.subFeatures.some(sf => sf.title.toLowerCase().includes(q) || sf.description.toLowerCase().includes(q));
      return matchTitle || matchDesc || matchSub;
    }
    return true;
  });

  const renderAccessBadge = (level: AccessLevel, onClick: () => void, isCompact: boolean = false) => {
    if (level === 'full') {
      return (
        <button
          type="button"
          onClick={onClick}
          title="دسترسی کامل و ویرایش - برای تغییر کلیک کنید"
          className={cn(
            "rounded-xl font-black transition-all flex items-center justify-center gap-1 cursor-pointer select-none",
            isCompact ? "px-2 py-1 text-[11px]" : "px-3 py-1.5 text-xs",
            "bg-emerald-600 text-white shadow-xs hover:bg-emerald-700 active:scale-95"
          )}
        >
          <Edit3 size={isCompact ? 11 : 13} />
          <span>کامل / ویرایش</span>
        </button>
      );
    }
    if (level === 'view') {
      return (
        <button
          type="button"
          onClick={onClick}
          title="صرفاً مشاهده (Read-only) - برای تغییر کلیک کنید"
          className={cn(
            "rounded-xl font-black transition-all flex items-center justify-center gap-1 cursor-pointer select-none",
            isCompact ? "px-2 py-1 text-[11px]" : "px-3 py-1.5 text-xs",
            "bg-blue-600 text-white shadow-xs hover:bg-blue-700 active:scale-95"
          )}
        >
          <Eye size={isCompact ? 11 : 13} />
          <span>فقط مشاهده</span>
        </button>
      );
    }
    return (
      <button
        type="button"
        onClick={onClick}
        title="کاملاً مخفی و مسدود - برای تغییر کلیک کنید"
        className={cn(
          "rounded-xl font-black transition-all flex items-center justify-center gap-1 cursor-pointer select-none",
          isCompact ? "px-2 py-1 text-[11px]" : "px-3 py-1.5 text-xs",
          "bg-slate-100 text-slate-500 border border-slate-200 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 active:scale-95"
        )}
      >
        <EyeOff size={isCompact ? 11 : 13} />
        <span>مخفی</span>
      </button>
    );
  };

  const cycleNextLevel = (current: AccessLevel): AccessLevel => {
    if (current === 'none') return 'view';
    if (current === 'view') return 'full';
    return 'none';
  };

  const rolesList: TargetRoleGroup[] = ['student', 'class_representative', 'counseling_teacher', 'grade_supervisor', 'education_officer'];

  return (
    <div className="space-y-6 text-right font-vazir" dir="rtl">
      {/* Top Banner & Title */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-80 h-80 bg-indigo-500/20 rounded-full blur-3xl -translate-x-20 -translate-y-20 pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/30 text-indigo-200 text-xs font-black border border-indigo-400/30 backdrop-blur-md">
              <ShieldCheck size={14} className="text-amber-300" />
              <span>مدیریت دسترسی بر محور بخش‌ها (Section-Centric Matrix)</span>
            </div>
            <h2 className="text-2xl font-black tracking-tight text-white">
              ماتریس جامع کنترل دسترسی بخش‌های سامانه
            </h2>
            <p className="text-xs text-indigo-100/90 leading-relaxed font-medium">
              سوپرادمین می‌تواند با یک دکمه یا به صورت جزئی و تفکیکی، میزان دسترسی هر گروه نقشی (طلاب عادی، اساتید مشاوره، نمایندگان کلاس، مسئولین پایه و آموزش) را برای هر بخش یا زیربخش به صورت «مخفی»، «فقط مشاهده» یا «دسترسی کامل و ویرایش» تنظیم و ذخیره کند.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleResetDefaults}
              className="px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-xs font-black border border-white/20 transition-all flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <RotateCcw size={15} />
              <span>پیش‌فرض کارخانه</span>
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-xs font-black shadow-lg shadow-emerald-500/30 transition-all flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
            >
              <Save size={16} />
              <span>{isSaving ? 'در حال اعمال...' : 'ذخیره و اعمال سراسری'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Success Toast Banner */}
      {successToast && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-900 text-xs font-black flex items-center gap-2.5 animate-fadeIn">
          <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Role Group Legend / Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {rolesList.map(rg => {
          const meta = ROLE_GROUP_LABELS[rg];
          return (
            <div key={rg} className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between space-y-1.5">
              <span className={cn("px-2 py-0.5 rounded-lg text-[10px] font-black border w-fit", meta.badgeColor)}>
                {meta.title}
              </span>
              <p className="text-[11px] text-slate-500 font-medium leading-tight">
                {meta.subtitle}
              </p>
            </div>
          );
        })}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-72">
            <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="جستجوی نام بخش، زیربخش یا قابلیت..."
              className="w-full pr-9 pl-3 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-medium bg-slate-50 focus:bg-white"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <select
            className="px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="all">همه دسته‌بندی‌ها</option>
            <option value="education">آموزشی و کلاس‌ها</option>
            <option value="monitoring">پایش، انضباطی و مباحثه</option>
            <option value="research">پژوهش و مقالات</option>
            <option value="management">امور مدیریتی و مالی</option>
          </select>
        </div>

        <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block" />
            <span>ویرایش</span>
          </span>
          <span className="flex items-center gap-1 mr-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block" />
            <span>مشاهده</span>
          </span>
          <span className="flex items-center gap-1 mr-2">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-300 inline-block" />
            <span>مخفی</span>
          </span>
        </div>
      </div>

      {/* Main Sections List */}
      <div className="space-y-5">
        {filteredModules.map(module => {
          const IconComp = ICON_MAP[module.iconName] || Layers;
          const isExpanded = !!expandedSections[module.id];
          const sectionPerms = matrix[module.id] || { overall: { ...DEFAULT_SECTION_PERMISSIONS[module.id]?.overall }, subFeatures: {} };

          return (
            <div 
              key={module.id} 
              className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden transition-all hover:border-slate-300"
            >
              {/* Module Header Bar */}
              <div className="p-5 bg-gradient-to-r from-slate-50/90 to-white border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-start sm:items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold shrink-0 border border-indigo-100 shadow-2xs">
                    <IconComp size={22} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-black text-slate-900">{module.title}</h3>
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-bold border border-slate-200">
                        {module.subFeatures.length} زیربخش جزئی
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">{module.description}</p>
                  </div>
                </div>

                {/* Overall Section Role Access Pills */}
                <div className="flex items-center gap-2 flex-wrap">
                  {rolesList.map(role => {
                    const currentLevel = sectionPerms.overall[role] || 'none';
                    return (
                      <div key={role} className="flex flex-col items-center gap-1">
                        <span className="text-[10px] font-bold text-slate-400">
                          {ROLE_GROUP_LABELS[role].title.split(' ')[0]}
                        </span>
                        {renderAccessBadge(
                          currentLevel, 
                          () => setOverallAccess(module.id, role, cycleNextLevel(currentLevel))
                        )}
                      </div>
                    );
                  })}

                  <button
                    type="button"
                    onClick={() => toggleSectionExpand(module.id)}
                    className="p-2 mr-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                    title={isExpanded ? 'بستن زیربخش‌ها' : 'مشاهده زیربخش‌های جزئی'}
                  >
                    {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </button>
                </div>
              </div>

              {/* Quick Batch Actions Toolbar for this module */}
              <div className="px-5 py-2.5 bg-slate-50/70 border-b border-slate-100 flex flex-wrap items-center gap-2 text-xs">
                <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1 shrink-0">
                  <Sliders size={13} className="text-indigo-600" />
                  <span>دسترسی‌های سریع با یک کلیک:</span>
                </span>

                <button
                  type="button"
                  onClick={() => handleBatchSectionAction(module.id, 'student', 'none')}
                  className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-800 text-[11px] font-black border border-rose-200 transition-all cursor-pointer"
                >
                  🚫 مخفی‌سازی کامل این بخش برای طلاب
                </button>

                <button
                  type="button"
                  onClick={() => handleBatchSectionAction(module.id, 'student', 'view')}
                  className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-800 text-[11px] font-black border border-blue-200 transition-all cursor-pointer"
                >
                  👁️ فقط مشاهده برای طلاب
                </button>

                <button
                  type="button"
                  onClick={() => handleBatchSectionAction(module.id, 'counseling_teacher', 'full')}
                  className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 text-[11px] font-black border border-amber-200 transition-all cursor-pointer"
                >
                  ✏️ دسترسی کامل به اساتید مشاوره
                </button>

                <button
                  type="button"
                  onClick={() => handleBatchSectionAction(module.id, 'class_representative', 'full')}
                  className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-900 text-[11px] font-black border border-indigo-200 transition-all cursor-pointer"
                >
                  ⚡ دسترسی ثبت برای نماینده کلاس
                </button>
              </div>

              {/* Granular Sub-features List */}
              {isExpanded && (
                <div className="p-5 divide-y divide-slate-100">
                  <div className="text-[11px] font-black text-indigo-900 mb-3 flex items-center gap-1.5">
                    <Sparkles size={14} className="text-indigo-600" />
                    <span>تنظیم دسترسی جزئی زیربخش‌ها (Granular Control):</span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead>
                        <tr className="text-slate-400 font-bold border-b border-slate-100 pb-2">
                          <th className="py-2.5 px-3">عنوان زیربخش</th>
                          {rolesList.map(r => (
                            <th key={r} className="py-2.5 px-3 text-center">
                              {ROLE_GROUP_LABELS[r].title}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {module.subFeatures.map(sf => {
                          const sfPerms = sectionPerms.subFeatures?.[sf.id] || DEFAULT_SECTION_PERMISSIONS[module.id]?.subFeatures?.[sf.id] || {};
                          return (
                            <tr key={sf.id} className="hover:bg-slate-50/80 transition-colors">
                              <td className="py-3 px-3">
                                <div className="font-black text-slate-800">{sf.title}</div>
                                <div className="text-[10px] text-slate-400 font-medium">{sf.description}</div>
                              </td>

                              {rolesList.map(role => {
                                const level = sfPerms[role] || 'none';
                                return (
                                  <td key={role} className="py-3 px-3 text-center">
                                    <div className="flex justify-center">
                                      {renderAccessBadge(
                                        level,
                                        () => setSubFeatureAccess(module.id, sf.id, role, cycleNextLevel(level)),
                                        true
                                      )}
                                    </div>
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
