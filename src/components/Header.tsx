import React, { useState, useEffect, useRef } from 'react';
import { AppModule } from '../types';
import {
  Store,
  LayoutDashboard,
  BarChart3,
  CalendarDays,
  GraduationCap,
  LineChart,
  Boxes,
  Users,
  Calculator,
  User,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  ArrowRight,
  ShieldAlert,
  ListTodo,
  CheckSquare,
  Square,
  Plus,
  Trash2,
  RotateCcw,
  Settings,
  ChevronRight,
  Flame,
  Check,
  ChevronsUpDown,
} from 'lucide-react';
import { todoService, StoreTask } from '../services/todoService';
import { databaseHealthService } from '../services/databaseHealthService';
import { DatabaseHealthStatus } from '../types';
import { useStore } from '../context/StoreContext';

interface HeaderProps {
  activeModule: AppModule;
  userName?: string;
  selectedYear?: number;
  selectedMonth?: string;
  onPeriodChange?: (year: number, month: string) => void;
  onNavigateModule?: (module: AppModule) => void;
  onOpenNotificationsSettings?: () => void;
  onOpenBackupModal?: () => void;
}

const MODULE_TITLES: Record<AppModule, { title: string; icon: React.ComponentType<{ className?: string }> }> = {
  dashboard: { title: 'Podsumowanie', icon: LayoutDashboard },
  labor_forecast: { title: 'TPLH Forecast & Labor Balancing', icon: BarChart3 },
  managers_schedule: { title: 'Grafik Managerski', icon: CalendarDays },
  trainings: { title: 'Szkolenia & Certyfikacje', icon: GraduationCap },
  col_calculator: { title: 'COL Calculator (Cost of Labor)', icon: Calculator },
  analytics: { title: 'Analiza Biznesowa (BI)', icon: LineChart },
  ibs_ims: { title: 'IBS & IMS (Ideal Structure)', icon: Users },
};

export const Header: React.FC<HeaderProps> = ({
  activeModule,
  userName = 'Store Manager (SM)',
  selectedYear,
  selectedMonth,
  onPeriodChange,
  onNavigateModule,
  onOpenNotificationsSettings,
  onOpenBackupModal,
}) => {
  const currentModuleInfo = MODULE_TITLES[activeModule] || MODULE_TITLES.dashboard;
  const ModuleIcon = currentModuleInfo.icon;

  const { currentStore, openStoreSwitcher } = useStore();

  const [isTodoOpen, setIsTodoOpen] = useState<boolean>(false);
  const [tasks, setTasks] = useState<StoreTask[]>(() => todoService.getTasks());
  const [newTaskTitle, setNewTaskTitle] = useState<string>('');
  const [todoFilter, setTodoFilter] = useState<'ALL' | 'PENDING' | 'HIGH'>('ALL');
  const popoverRef = useRef<HTMLDivElement>(null);

  const [dbHealth, setDbHealth] = useState<DatabaseHealthStatus | null>(() => databaseHealthService.getHealth());

  // Subskrypcja na stan zdrowia bazy SQLite
  useEffect(() => {
    const unsubscribe = databaseHealthService.subscribe(() => {
      setDbHealth(databaseHealthService.getHealth());
    });
    return () => unsubscribe();
  }, []);

  // Subskrypcja na zadania To-Do
  useEffect(() => {
    const unsubscribe = todoService.subscribe(() => {
      setTasks(todoService.getTasks());
    });
    return () => unsubscribe();
  }, []);

  // Zamykanie przy kliknięciu poza popover
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsTodoOpen(false);
      }
    };
    if (isTodoOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isTodoOpen]);

  const pendingCount = todoService.getPendingCount();
  const highPriorityCount = todoService.getHighPriorityCount();

  const handleToggleTask = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    todoService.toggleTask(id);
  };

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTaskTitle.trim()) {
      todoService.addTask(newTaskTitle);
      setNewTaskTitle('');
    }
  };

  const handleDeleteTask = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    todoService.deleteTask(id);
  };

  const filteredTasks = tasks.filter((t) => {
    if (todoFilter === 'PENDING') return !t.completed;
    if (todoFilter === 'HIGH') return t.priority === 'high' && !t.completed;
    return true;
  });

  return (
    <header className="bg-white border-b border-[#E2E8E5] px-6 py-3 flex items-center justify-between shadow-xs select-none shrink-0 gap-4 h-16 relative z-20">
      {/* Lewa strona: Tytuł Aktywnego Modułu */}
      <div className="flex items-center space-x-3 overflow-hidden">
        <div className="w-9 h-9 rounded-xl bg-[#006241]/10 text-[#006241] flex items-center justify-center font-bold shadow-2xs shrink-0">
          <ModuleIcon className="w-5 h-5" />
        </div>

        <div className="truncate">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-black tracking-tight text-[#1E3932] truncate">
              {currentModuleInfo.title}
            </h1>
            {selectedMonth && selectedYear && (
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-[#006241] text-xs font-black">
                <span>{selectedMonth} {selectedYear}</span>
              </span>
            )}
          </div>
          <button
            onClick={openStoreSwitcher}
            title={`Aktywna kawiarnia: ${currentStore.name} (Unit: ${currentStore.unitCode}, MPK: ${currentStore.mpk}). Kliknij, aby przełączyć kawiarnię.`}
            className="flex items-center space-x-1.5 text-[11px] text-[#5C6F68] hover:text-[#006241] bg-stone-100/70 hover:bg-emerald-50 px-2 py-0.5 rounded-lg border border-transparent hover:border-emerald-200 transition-all cursor-pointer group/store"
          >
            <Store className="w-3.5 h-3.5 text-[#CBA258] group-hover/store:scale-110 transition-transform shrink-0" />
            <span className="font-bold text-[#1E3932] group-hover/store:text-[#006241] truncate max-w-[130px] sm:max-w-[180px]">
              {currentStore.shortName}
            </span>
            <span className="text-stone-300">•</span>
            <span className="text-[10px] font-mono font-bold text-stone-600 bg-white px-1 py-0.2 rounded border border-stone-200">
              {currentStore.unitCode}
            </span>
            <ChevronsUpDown className="w-3 h-3 text-stone-400 group-hover/store:text-[#006241] transition-colors ml-0.5 shrink-0" />
          </button>
        </div>
      </div>

      {/* Prawa strona: Ostrzeżenie o kopii bazy & Profil Managera */}
      <div className="flex items-center space-x-2.5" ref={popoverRef}>
        {/* ZNACZEK OSTRZEŻENIA O ZALEGŁEJ KOPII ZAPASOWEJ (> 7 DNI) */}
        {dbHealth?.isBackupOverdue && onOpenBackupModal && (
          <button
            onClick={onOpenBackupModal}
            title={`Zaległa kopia zapasowa bazy SQLite! ${
              dbHealth.daysSinceLastBackup !== undefined
                ? `Od ostatniej minęło ${dbHealth.daysSinceLastBackup} dni (zalecane max 7 dni).`
                : 'Nie wykryto żadnej wykonanej kopii.'
            } Kliknij, aby otworzyć menedżer kopii.`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-amber-50 hover:bg-amber-100/90 text-amber-950 border border-amber-300 text-xs font-bold transition-all shadow-2xs cursor-pointer animate-pulse group"
          >
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 group-hover:scale-110 transition-transform" />
            <span className="hidden sm:inline">Kopia zalecana</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-md bg-amber-200/80 text-amber-900 font-black">
              {dbHealth.daysSinceLastBackup !== undefined ? `+${dbHealth.daysSinceLastBackup}d` : '!'}
            </span>
          </button>
        )}

        {/* INTERAKTYWNY BADGE PROFILU & ZNACZEK TO-DO */}
        <div className="relative">
          <button
            onClick={() => setIsTodoOpen(!isTodoOpen)}
            title="Lista rzeczy do zrobienia na dany moment"
            className={`flex items-center space-x-2.5 px-3 py-1.5 rounded-2xl border transition-all cursor-pointer text-xs shadow-2xs group ${
              isTodoOpen
                ? 'bg-[#1E3932] text-white border-[#1E3932] ring-2 ring-emerald-500/20'
                : 'bg-[#F0F4F2] hover:bg-emerald-50 text-[#1E3932] border-[#D0DCD6]'
            }`}
          >
            {/* Avatar / Ikona */}
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-transform group-hover:scale-105 ${
              isTodoOpen ? 'bg-[#CBA258] text-[#1E3932]' : 'bg-[#006241] text-white'
            }`}>
              <User className="w-3.5 h-3.5" />
            </div>

            {/* Imię i Rola */}
            <div className="flex flex-col text-left leading-tight">
              <span className="font-black truncate max-w-[140px] sm:max-w-[180px]">{userName}</span>
              <span className={`text-[9px] font-bold ${isTodoOpen ? 'text-emerald-200' : 'text-emerald-800'} truncate max-w-[140px]`}>
                {currentStore.shortName}
              </span>
            </div>

            {/* ZNACZEK Z LICZNIKIEM ZADAŃ DO ZROBIENIA */}
            <div className="flex items-center gap-1 pl-1 border-l border-stone-300/60">
              <ListTodo className={`w-4 h-4 ${isTodoOpen ? 'text-[#CBA258]' : 'text-[#006241]'}`} />
              {pendingCount > 0 ? (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black shrink-0 ${
                  highPriorityCount > 0
                    ? 'bg-rose-500 text-white animate-pulse'
                    : 'bg-[#006241] text-white'
                }`}>
                  {pendingCount}
                </span>
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              )}
            </div>
          </button>

          {/* ROZWIJANA LISTA RZECZY DO ZROBIENIA NA DANY MOMENT (POPOVER) */}
          {isTodoOpen && (
            <div className="absolute right-0 mt-2 w-88 sm:w-[420px] bg-white rounded-3xl shadow-2xl border border-stone-200 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-150">
              {/* Nagłówek Popovera */}
              <div className="bg-gradient-to-r from-[#1E3932] via-[#006241] to-[#004d33] text-white p-4.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-white/10 text-[#CBA258]">
                      <ListTodo className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black tracking-tight flex items-center gap-1.5">
                        Rzeczy do zrobienia na teraz
                        {highPriorityCount > 0 && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-rose-500 text-white font-black">
                            {highPriorityCount} pilne
                          </span>
                        )}
                      </h4>
                      <p className="text-[11px] text-emerald-100/80">
                        Zadania operacyjne Store Managera & alerty lokalu
                      </p>
                    </div>
                  </div>

                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-white/10 text-emerald-100 font-bold">
                    {pendingCount} do wykonania
                  </span>
                </div>

                {/* Pigułki filtrów */}
                <div className="flex items-center gap-1.5 mt-3 pt-2 border-t border-white/10 text-[11px] font-bold">
                  <button
                    onClick={() => setTodoFilter('ALL')}
                    className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                      todoFilter === 'ALL' ? 'bg-white text-[#1E3932]' : 'text-emerald-100/80 hover:bg-white/10'
                    }`}
                  >
                    Wszystkie ({tasks.length})
                  </button>
                  <button
                    onClick={() => setTodoFilter('PENDING')}
                    className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                      todoFilter === 'PENDING' ? 'bg-white text-[#1E3932]' : 'text-emerald-100/80 hover:bg-white/10'
                    }`}
                  >
                    Do zrobienia ({pendingCount})
                  </button>
                  <button
                    onClick={() => setTodoFilter('HIGH')}
                    className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
                      todoFilter === 'HIGH' ? 'bg-rose-500 text-white' : 'text-emerald-100/80 hover:bg-white/10'
                    }`}
                  >
                    <Flame className="w-3 h-3 text-amber-300" />
                    <span>Pilne ({highPriorityCount})</span>
                  </button>
                </div>
              </div>

              {/* Formularz szybkiego dodawania zadania */}
              <form onSubmit={handleAddTask} className="p-3 bg-stone-50 border-b border-stone-200 flex items-center gap-2">
                <input
                  type="text"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="Dodaj szybkie zadanie na dziś..."
                  className="flex-1 bg-white border border-stone-300 rounded-xl px-3 py-1.5 text-xs text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-[#006241]"
                />
                <button
                  type="submit"
                  disabled={!newTaskTitle.trim()}
                  className="px-3 py-1.5 bg-[#006241] hover:bg-[#00754A] disabled:opacity-40 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Dodaj</span>
                </button>
              </form>

              {/* Lista Zadań */}
              <div className="max-h-80 overflow-y-auto divide-y divide-stone-100 p-2">
                {filteredTasks.length === 0 ? (
                  <div className="py-8 px-4 text-center space-y-1">
                    <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto opacity-80" />
                    <div className="text-xs font-bold text-stone-800">Wszystkie zadania wykonane! ☕</div>
                    <div className="text-[11px] text-stone-500">
                      Brak zaległych zadań w wybranym filtrze.
                    </div>
                  </div>
                ) : (
                  filteredTasks.map((task) => (
                    <div
                      key={task.id}
                      onClick={(e) => handleToggleTask(task.id, e)}
                      className={`p-3 rounded-2xl transition-all flex items-start justify-between gap-3 text-xs cursor-pointer group ${
                        task.completed ? 'bg-stone-50/70 opacity-60' : 'hover:bg-emerald-50/40'
                      }`}
                    >
                      {/* Checkbox & Treść */}
                      <div className="flex items-start gap-2.5 flex-1">
                        <button
                          type="button"
                          onClick={(e) => handleToggleTask(task.id, e)}
                          className="mt-0.5 text-stone-400 group-hover:text-[#006241] cursor-pointer"
                        >
                          {task.completed ? (
                            <CheckSquare className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <Square className="w-4 h-4 text-stone-400" />
                          )}
                        </button>

                        <div className="space-y-1 flex-1">
                          <div className={`font-bold leading-tight ${
                            task.completed ? 'line-through text-stone-500' : 'text-stone-900'
                          }`}>
                            {task.title}
                          </div>

                          <div className="flex flex-wrap items-center gap-2 text-[10px] text-stone-500">
                            {task.priority === 'high' && (
                              <span className="px-1.5 py-0.2 rounded bg-rose-100 text-rose-800 font-bold">
                                Pilne
                              </span>
                            )}
                            {task.dueDate && (
                              <span className="flex items-center gap-1 text-stone-500">
                                <Clock className="w-2.5 h-2.5" />
                                {task.dueDate}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Akcja przejścia do modułu */}
                      <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                        {task.actionModule && onNavigateModule && !task.completed && (
                          <button
                            type="button"
                            onClick={() => {
                              setIsTodoOpen(false);
                              onNavigateModule(task.actionModule as AppModule);
                            }}
                            className="px-2.5 py-1 bg-[#006241] hover:bg-[#00754A] text-white text-[11px] font-bold rounded-lg shadow-2xs transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <span>{task.actionLabel || 'Otwórz'}</span>
                            <ChevronRight className="w-3 h-3" />
                          </button>
                        )}

                        {task.id === 'task_db_backup_overdue' && onOpenBackupModal && !task.completed && (
                          <button
                            type="button"
                            onClick={() => {
                              setIsTodoOpen(false);
                              onOpenBackupModal();
                            }}
                            className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold rounded-lg shadow-2xs transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <span>Kopia SQLite</span>
                            <ChevronRight className="w-3 h-3" />
                          </button>
                        )}

                        {!task.isAutoGenerated && (
                          <button
                            type="button"
                            onClick={(e) => handleDeleteTask(task.id, e)}
                            className="p-1 text-stone-300 hover:text-rose-600 transition-colors cursor-pointer"
                            title="Usuń zadanie"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Stopka z przyciskiem Konfiguracji Powiadomień */}
              <div className="p-3 bg-stone-50 border-t border-stone-200 flex items-center justify-between gap-2">
                <button
                  onClick={() => {
                    todoService.resetTasks();
                  }}
                  className="text-[11px] font-bold text-stone-500 hover:text-stone-800 flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Zresetuj zadania cyklu</span>
                </button>

                {onOpenNotificationsSettings && (
                  <button
                    onClick={() => {
                      setIsTodoOpen(false);
                      onOpenNotificationsSettings();
                    }}
                    className="px-3 py-1.5 bg-white border border-stone-300 hover:bg-stone-100 text-stone-800 text-[11px] font-bold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <Settings className="w-3.5 h-3.5 text-[#006241]" />
                    <span>Ustawienia Powiadomień</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
