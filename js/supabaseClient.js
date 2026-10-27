// ==================================================
// SLANCAR SUPABASE CLIENT & DATA LAYER
// Resilient, Self-Contained, Zero-Dependency Data Layer
// ==================================================

let supabase = null;
let currentUser = null;

// Safe Local Storage Helpers (Never Crash)
function safeGetJSON(key, defaultVal) {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultVal;
  } catch (e) {
    return defaultVal;
  }
}

function safeSetJSON(key, val) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch (e) {
    console.warn('Storage write warning:', e);
  }
}

function initSupabase() {
  if (SlancarConfig.isConfigured() && window.supabase) {
    try {
      supabase = window.supabase.createClient(SlancarConfig.SUPABASE_URL, SlancarConfig.SUPABASE_ANON_KEY);
      
      // Auto-listen to auth state changes
      supabase.auth.getSession().then(({ data: { session } }) => {
        currentUser = session?.user || null;
        if (window.AppState) window.AppState.user = currentUser;
      }).catch(() => {});

      supabase.auth.onAuthStateChange((_event, session) => {
        currentUser = session?.user || null;
        if (window.AppState) window.AppState.user = currentUser;
      });

      console.log('✅ Supabase client initialized');
      return true;
    } catch (e) {
      console.warn('Supabase init warning:', e);
      return false;
    }
  }
  return false;
}

const SlancarDB = {
  isCloudReady() {
    return Boolean(supabase && currentUser && currentUser.id);
  },

  getCurrentUser() {
    return currentUser;
  },

  async getUser() {
    if (!supabase) return currentUser;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      currentUser = user || null;
      return currentUser;
    } catch (e) {
      return currentUser;
    }
  },

  async signUp(email, password, fullName = 'Solo Creator') {
    if (!supabase) throw new Error('Supabase URL & Anon Key belum diatur di menu Profile');
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } }
    });
    if (error) throw error;
    currentUser = data.user;
    return currentUser;
  },

  async signIn(email, password) {
    if (!supabase) throw new Error('Supabase URL & Anon Key belum diatur di menu Profile');
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    currentUser = data.user;
    return currentUser;
  },

  async signOut() {
    if (supabase) {
      try { await supabase.auth.signOut(); } catch (e) {}
    }
    currentUser = null;
    if (window.AppState) window.AppState.user = null;
  },

  async getProfile(userId) {
    const defaultProfile = {
      full_name: 'Solo Creator',
      wake_up_time: '06:00',
      sleep_time: '22:00',
      daily_capacity_hours: 8.0,
      buffer_percentage: 0.15,
      office_start_time: '09:00',
      office_end_time: '17:00',
      income_target: 20000000,
      learning_target: 'Belajar 30m tiap hari'
    };

    if (this.isCloudReady() && userId) {
      try {
        const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
        if (data) return data;
      } catch (e) {
        console.warn('Cloud profile fetch warning:', e);
      }
    }
    return safeGetJSON('slancar_local_profile', defaultProfile);
  },

  async updateProfile(userId, profileData) {
    safeSetJSON('slancar_local_profile', profileData);
    if (this.isCloudReady() && userId) {
      try {
        const { data } = await supabase.from('profiles').update(profileData).eq('id', userId).select().single();
        if (data) return data;
      } catch (e) {}
    }
    return profileData;
  },

  async getGoals(userId) {
    const defaultGoals = [
      {
        id: 'goal-1',
        title: 'Target Penghasilan Rp20,000,000/bulan',
        target_value: 20000000,
        current_value: 12500000,
        metric: 'IDR',
        progress: 62.5,
        status: 'active',
        milestones: [{ title: 'Dapatkan 2 klien bernilai tinggi', done: true }, { title: 'Luncurkan produk digital', done: false }]
      },
      {
        id: 'goal-2',
        title: 'Bangun Portofolio Behance 3D',
        target_value: 5,
        current_value: 3,
        metric: 'Project',
        progress: 60.0,
        status: 'active',
        milestones: [{ title: 'Destroyer Ship 3D Render', done: true }, { title: 'Mecha Robot Rigging', done: false }]
      },
      {
        id: 'goal-3',
        title: 'Gym & Fitness 4x Seminggu',
        target_value: 4,
        current_value: 2,
        metric: 'Sesi',
        progress: 50.0,
        status: 'active',
        milestones: [{ title: 'Sesi Senin (Chest & Triceps)', done: true }, { title: 'Sesi Rabu (Back & Biceps)', done: true }]
      }
    ];

    if (this.isCloudReady() && userId) {
      try {
        const { data, error } = await supabase.from('goals').select('*').eq('user_id', userId).order('created_at', { ascending: false });
        if (data && data.length > 0) return data;
      } catch (e) {}
    }
    return safeGetJSON('slancar_local_goals', defaultGoals);
  },

  async createGoal(goalData) {
    const goals = await this.getGoals();
    const newGoal = {
      id: 'goal-' + Date.now(),
      ...goalData,
      progress: 0,
      status: 'active',
      milestones: [],
      created_at: new Date().toISOString()
    };

    if (this.isCloudReady() && currentUser?.id) {
      try {
        const { data } = await supabase.from('goals').insert({
          ...goalData,
          user_id: currentUser.id
        }).select().single();
        if (data) {
          goals.unshift(data);
          safeSetJSON('slancar_local_goals', goals);
          return data;
        }
      } catch (e) {
        console.warn('Cloud save goal failed, saved locally:', e);
      }
    }

    goals.unshift(newGoal);
    safeSetJSON('slancar_local_goals', goals);
    return newGoal;
  },

  async getTasks(userId) {
    const defaultTasks = [
      {
        id: 'task-1',
        title: 'Office: Q4 Sprint Review Slides',
        task_type: 'office_work',
        priority_score: 115,
        deadline_type: 'hard',
        deadline_date: new Date().toISOString().split('T')[0],
        estimated_hours: 2.5,
        actual_hours: 0,
        status: 'todo'
      },
      {
        id: 'task-2',
        title: 'Freelance: Destroyer Ship Texturing',
        task_type: 'client_freelance',
        priority_score: 120,
        deadline_type: 'hard',
        deadline_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
        estimated_hours: 2.0,
        actual_hours: 0,
        status: 'todo'
      },
      {
        id: 'task-3',
        title: 'Belajar Bahasa Inggris MVP (30 Menit)',
        task_type: 'learning',
        priority_score: 35,
        deadline_type: 'soft',
        deadline_date: new Date().toISOString().split('T')[0],
        estimated_hours: 0.5,
        actual_hours: 0,
        status: 'todo'
      },
      {
        id: 'task-4',
        title: 'Side Hustle: Desain Cover Produk Digital',
        task_type: 'side_hustle',
        priority_score: 80,
        deadline_type: 'soft',
        deadline_date: null,
        estimated_hours: 1.5,
        actual_hours: 0,
        status: 'todo'
      }
    ];

    if (this.isCloudReady() && userId) {
      try {
        const { data } = await supabase.from('tasks').select('*').eq('user_id', userId).order('priority_score', { ascending: false });
        if (data && data.length > 0) return data;
      } catch (e) {}
    }
    return safeGetJSON('slancar_local_tasks', defaultTasks);
  },

  async createTask(taskData) {
    const tasks = await this.getTasks();
    const newTask = {
      id: 'task-' + Date.now(),
      ...taskData,
      status: 'todo',
      created_at: new Date().toISOString()
    };

    if (this.isCloudReady() && currentUser?.id) {
      try {
        const { data } = await supabase.from('tasks').insert({
          ...taskData,
          user_id: currentUser.id
        }).select().single();
        if (data) {
          tasks.unshift(data);
          safeSetJSON('slancar_local_tasks', tasks);
          return data;
        }
      } catch (e) {
        console.warn('Cloud save task failed, saved locally:', e);
      }
    }

    tasks.unshift(newTask);
    safeSetJSON('slancar_local_tasks', tasks);
    return newTask;
  },

  async updateTaskStatus(taskId, status) {
    const tasks = await this.getTasks();
    const task = tasks.find(t => t.id === taskId);
    if (task) task.status = status;
    safeSetJSON('slancar_local_tasks', tasks);

    if (this.isCloudReady() && currentUser?.id) {
      try {
        await supabase.from('tasks').update({ status }).eq('id', taskId);
      } catch (e) {}
    }
    return task;
  },

  async getDailyPlan(userId, dateStr) {
    if (this.isCloudReady() && userId) {
      try {
        const { data } = await supabase.from('daily_plans').select('*').eq('user_id', userId).eq('plan_date', dateStr).maybeSingle();
        if (data) return data;
      } catch (e) {}
    }
    return safeGetJSON('slancar_today_plan', null);
  },

  async saveDailyPlan(planData) {
    safeSetJSON('slancar_today_plan', planData);

    if (this.isCloudReady() && currentUser?.id) {
      try {
        const { data } = await supabase.from('daily_plans').upsert({
          ...planData,
          user_id: currentUser.id
        }, { onConflict: 'user_id,plan_date' }).select().single();
        if (data) return data;
      } catch (e) {}
    }
    return planData;
  },

  async saveDailyReview(reviewData) {
    safeSetJSON('slancar_last_review', reviewData);

    if (this.isCloudReady() && currentUser?.id) {
      try {
        const { data } = await supabase.from('daily_reviews').upsert({
          ...reviewData,
          user_id: currentUser.id
        }, { onConflict: 'user_id,review_date' }).select().single();
        if (data) return data;
      } catch (e) {}
    }
    return reviewData;
  }
};
