export type TrainingProgram = 
  | 'first_30' 
  | 'barista_90' 
  | 'barista_180' 
  | 'barista_trainer' 
  | 'coffee_master';

export type PartnerTrainingStatus = 
  | 'in_progress' 
  | 'certified' 
  | 'paused' 
  | 'completed';

export type ShiftTrainingStatus = 
  | 'planned' 
  | 'completed' 
  | 'cancelled';

export interface TrainingPartner {
  id: number;
  name: string;
  hire_date: string; // YYYY-MM-DD
  current_program: TrainingProgram;
  assigned_trainer_id?: number | null;
  assigned_trainer_name?: string | null;
  store_manager_name: string;
  sanepid_valid_until?: string | null; // YYYY-MM-DD
  bhp_completed_date?: string | null;  // YYYY-MM-DD
  status: PartnerTrainingStatus;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface TrainingShift {
  id?: number;
  partner_id: number;
  shift_code: string; // T1, T2, ..., T10, B90, B180, BT1...
  title: string;
  scheduled_date: string; // YYYY-MM-DD
  start_time: string; // HH:mm
  end_time: string;   // HH:mm
  barista_hours_t: number;
  trainer_hours_t: number;
  sm_hours_t: number;
  status: ShiftTrainingStatus;
  trainer_name?: string | null;
  station?: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export type SkillCheckType = 
  | 'milk_steaming' 
  | 'espresso_bar' 
  | 'cold_beverage' 
  | 'teaching_model' 
  | 'completion_check';

export interface SkillCheckCriterion {
  id: string;
  category: string;
  label: string;
  description: string;
  isPassed: boolean;
  notes?: string;
}

export interface TrainingSkillCheck {
  id?: number;
  partner_id: number;
  check_type: SkillCheckType;
  exam_date: string; // YYYY-MM-DD
  examiner_name: string;
  examiner_role: 'SM' | 'BT' | 'ASM';
  is_passed: boolean;
  score_pct: number;
  criteria_results: SkillCheckCriterion[];
  notes?: string | null;
  created_at?: string;
}

export interface StandardShiftTemplate {
  shift_code: string;
  day_offset: number; // 0 for start day, 1 for next day, etc.
  title: string;
  default_start_time: string;
  default_end_time: string;
  barista_hours_t: number;
  trainer_hours_t: number;
  sm_hours_t: number;
  station: string;
  program: TrainingProgram;
  description: string;
  learning_topics: string[];
}
