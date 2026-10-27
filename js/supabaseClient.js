// ==================================================
// SLANCAR SUPABASE CLIENT & DATA LAYER
// Resilient Cloud + Local Storage Sync
// ==================================================

let supabase = null;

function initSupabase() {
  if (SlancarConfig.isConfigured() && window.supabase) {
    try {
      supabase = window.supabase.createClient(SlancarConfig.SUPABASE_URL, SlancarConfig.SUPABASE_ANON_KEY);
      console.log('✅ Supabase initialized successfully');
      return true;
    } catch (e) {
      console.error('Failed to init Supabase:', e);
      return false;
    }
  }
  return false;
}

const SlancarDB = {
  isCloudReady() {
    return Boolean(supabase && AppState.user && AppState.user.id);
  },

  async getUser() {
    if (!supabase) return null;
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) return null;
      return user;
    } catch (e) {
      return null;
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
    return data.user;
  },

  async signIn(email, password) {
    if (!supabase) throw new Error('Supabase URL & Anon Key belum diatur di menu Profile');
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data.user;
  },

  async signOut() {
    if (supabase) {
      await supabase.auth.signOut();
    }
    AppState.user = null;
    localStorage.removeItem('slancar_user_cached');
  },

  async getProfile(userId) {
    if (this.isCloudReady() && userId) {
      try {
        const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
        if (data) return data;
      } catch (e) {
        console.warn('Could not fetch cloud profile, using local fallback:', e);
      }
    }
    return JSON.parse(localStorage.getItem('slancar_local_profile')) || {
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
  },

  async updateProfile(userId, profileData) {
    localStorage.setItem('slancar_local_profile', JSON.stringify(profileData));
    if (this.isCloudReady() && userId) {
      try {
        const { data, error } = await supabase.from('profiles').update(profileData).eq('id', userId).select().single();
        if (data) return data;
      } catch (e) {
        console.warn('Cloud profile update failed, saved locally:', e);
      }
    }
    return profileData;
  },

  async getGoals(userId) {
    if (this.isCloudReady() && userId) {
      try {
        const { data, error } = await supabase.from('goals').select('*').eq('user_id', userId).order('created_at', { ascending: false });
        if (data && data.length > 0) return data;
      } catch (e) {
        console.warn('Could not fetch cloud goals, using local:', e);
      }
    }
    return JSON.parse(localStorage.getItem('slancar_local_goals')) || [
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

    if (this.isCloudReady() && AppState.user?.id) {
      try {
        const { data, error } = await supabase.from('goals').insert({
          ...goalData,
          user_id: AppState.user.id
        }).select().single();
        if (data) {
          goals.unshift(data);
          localStorage.setItem('slancar_local_goals', JSON.stringify(goals));
          return data;
        }
      } catch (e) {
        console.warn('Could not save goal to cloud, saving locally:', e);
      }
    }

    goals.unshift(newGoal);
    localStorage.setItem('slancar_local_goals', JSON.stringify(goals));
    return newGoal;
  },

  async getTasks(userId) {
    if (this.isCloudReady() && userId) {
      try {
        const { data, error } = await supabase.from('tasks').select('*').eq('user_id', userId).order('priority_score', { ascending: false });
        if (data && data.length > 0) return data;
      } catch (e) {
        console.warn('Could not fetch cloud tasks, using local:', e);
      }
    }
    return JSON.parse(localStorage.getItem('slancar_local_tasks')) || [
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
  },

  async createTask(taskData) {
    const tasks = await this.getTasks();
    const newTask = {
      id: 'task-' + Date.now(),
      ...taskData,
      status: 'todo',
      created_at: new Date().toISOString()
    };

    if (this.isCloudReady() && AppState.user?.id) {
      try {
        const { data, error } = await supabase.from('tasks').insert({
          ...taskData,
          user_id: AppState.user.id
        }).select().single();
        if (data) {
          tasks.unshift(data);
          localStorage.setItem('slancar_local_tasks', JSON.stringify(tasks));
          return data;
        }
      } catch (e) {
        console.warn('Could not save task to cloud, saving locally:', e);
      }
    }

    tasks.unshift(newTask);
    localStorage.setItem('slancar_local_tasks', JSON.stringify(tasks));
    return newTask;
  },

  async updateTaskStatus(taskId, status) {
    const tasks = await this.getTasks();
    const task = tasks.find(t => t.id === taskId);
    if (task) task.status = status;
    localStorage.setItem('slancar_local_tasks', JSON.stringify(tasks));

    if (this.isCloudReady() && AppState.user?.id) {
      try {
        await supabase.from('tasks').update({ status }).eq('id', taskId);
      } catch (e) {
        console.warn('Cloud task status update failed:', e);
      }
    }
    return task;
  },

  async getDailyPlan(userId, dateStr) {
    if (this.isCloudReady() && userId) {
      try {
        const { data } = await supabase.from('daily_plans').select('*').eq('user_id', userId).eq('plan_date', dateStr).maybeSingle();
        if (data) return data;
      } catch (e) {
        console.warn('Could not fetch cloud plan:', e);
      }
    }
    return JSON.parse(localStorage.getItem('slancar_today_plan')) || null;
  },

  async saveDailyPlan(planData) {
    localStorage.setItem('slancar_today_plan', JSON.stringify(planData));

    if (this.isCloudReady() && AppState.user?.id) {
      try {
        const { data } = await supabase.from('daily_plans').upsert({
          ...planData,
          user_id: AppState.user.id
        }, { onConflict: 'user_id,plan_date' }).select().single();
        if (data) return data;
      } catch (e) {
        console.warn('Could not save plan to cloud, saved locally:', e);
      }
    }
    return planData;
  },

  async saveDailyReview(reviewData) {
    localStorage.setItem('slancar_last_review', JSON.stringify(reviewData));

    if (this.isCloudReady() && AppState.user?.id) {
      try {
        const { data } = await supabase.from('daily_reviews').upsert({
          ...reviewData,
          user_id: AppState.user.id
        }, { onConflict: 'user_id,review_date' }).select().single();
        if (data) return data;
      } catch (e) {
        console.warn('Could not save review to cloud, saved locally:', e);
      }
    }
    return reviewData;
  }
};
