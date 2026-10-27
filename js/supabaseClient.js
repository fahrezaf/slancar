// ==================================================
// SLANCAR SUPABASE CLIENT & DATA LAYER
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
  async getUser() {
    if (!supabase) return null;
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  },

  async signUp(email, password, fullName) {
    if (!supabase) throw new Error('Supabase belum dikonfigurasi');
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } }
    });
    if (error) throw error;
    return data;
  },

  async signIn(email, password) {
    if (!supabase) throw new Error('Supabase belum dikonfigurasi');
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  },

  async signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
  },

  async getProfile(userId) {
    if (!supabase) {
      return JSON.parse(localStorage.getItem('slancar_local_profile')) || {
        full_name: 'Solo Creator',
        wake_up_time: '06:00',
        sleep_time: '22:00',
        daily_capacity_hours: 8.0,
        buffer_percentage: 0.15,
        office_start_time: '09:00',
        office_end_time: '17:00',
        income_target: 20000000,
        learning_target: 'Study 30m daily'
      };
    }
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (error) {
      console.warn('Profile fetch warning:', error);
      return null;
    }
    return data;
  },

  async updateProfile(userId, profileData) {
    if (!supabase) {
      localStorage.setItem('slancar_local_profile', JSON.stringify(profileData));
      return profileData;
    }
    const { data, error } = await supabase.from('profiles').update(profileData).eq('id', userId).select().single();
    if (error) throw error;
    return data;
  },

  async getGoals(userId) {
    if (!supabase) {
      return JSON.parse(localStorage.getItem('slancar_local_goals')) || [
        {
          id: 'demo-goal-1',
          title: 'Increase income to Rp20,000,000/month',
          target_value: 20000000,
          current_value: 12500000,
          metric: 'IDR',
          progress: 62.5,
          status: 'active',
          milestones: [{ title: 'Close 2 high-ticket clients', done: true }, { title: 'Launch 3D pack', done: false }]
        },
        {
          id: 'demo-goal-2',
          title: 'Build Behance 3D Portfolio',
          target_value: 5,
          current_value: 3,
          metric: 'Projects',
          progress: 60.0,
          status: 'active',
          milestones: [{ title: 'Destroyer Ship Render', done: true }, { title: 'Cyberpunk Mecha', done: false }]
        },
        {
          id: 'demo-goal-3',
          title: 'Gym Workout 4x / week',
          target_value: 4,
          current_value: 2,
          metric: 'sessions',
          progress: 50.0,
          status: 'active',
          milestones: [{ title: 'Session 1 (Mon)', done: true }, { title: 'Session 2 (Wed)', done: true }]
        }
      ];
    }
    const { data, error } = await supabase.from('goals').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async createGoal(goalData) {
    if (!supabase) {
      const goals = await this.getGoals();
      const newGoal = { id: 'goal-' + Date.now(), ...goalData, progress: 0, status: 'active' };
      goals.unshift(newGoal);
      localStorage.setItem('slancar_local_goals', JSON.stringify(goals));
      return newGoal;
    }
    const { data, error } = await supabase.from('goals').insert(goalData).select().single();
    if (error) throw error;
    return data;
  },

  async getProjects(userId) {
    if (!supabase) {
      return JSON.parse(localStorage.getItem('slancar_local_projects')) || [
        { id: 'proj-1', goal_id: 'demo-goal-2', title: 'Destroyer Ship 3D', status: 'active', description: 'Hero portfolio piece' },
        { id: 'proj-2', goal_id: 'demo-goal-1', title: 'Client: FinTech Landing Page', status: 'active', description: 'Freelance client deliverable' }
      ];
    }
    const { data, error } = await supabase.from('projects').select('*, goals(title)').eq('user_id', userId).order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async createProject(projectData) {
    if (!supabase) {
      const projects = await this.getProjects();
      const newProj = { id: 'proj-' + Date.now(), ...projectData, status: 'active' };
      projects.unshift(newProj);
      localStorage.setItem('slancar_local_projects', JSON.stringify(projects));
      return newProj;
    }
    const { data, error } = await supabase.from('projects').insert(projectData).select().single();
    if (error) throw error;
    return data;
  },

  async getTasks(userId) {
    if (!supabase) {
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
          status: 'todo',
          project_id: null
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
          status: 'todo',
          project_id: 'proj-1'
        },
        {
          id: 'task-3',
          title: 'Daily English Speaking MVP (30 min)',
          task_type: 'learning',
          priority_score: 35,
          deadline_type: 'soft',
          deadline_date: new Date().toISOString().split('T')[0],
          estimated_hours: 0.5,
          actual_hours: 0,
          status: 'todo',
          project_id: null
        },
        {
          id: 'task-4',
          title: 'Side Hustle: Digital Asset Gumroad Cover',
          task_type: 'side_hustle',
          priority_score: 80,
          deadline_type: 'soft',
          deadline_date: null,
          estimated_hours: 1.5,
          actual_hours: 0,
          status: 'todo',
          project_id: null
        }
      ];
    }
    const { data, error } = await supabase.from('tasks').select('*, projects(title)').eq('user_id', userId).order('priority_score', { ascending: false });
    if (error) throw error;
    return data;
  },

  async createTask(taskData) {
    if (!supabase) {
      const tasks = await this.getTasks();
      // Calculate local priority score
      const baseScores = { office_work: 100, client_freelance: 90, side_hustle: 80, gym: 60, learning: 30, entertainment: 10 };
      let score = baseScores[taskData.task_type] || 50;
      if (taskData.deadline_type === 'hard') score += 15;
      if (taskData.estimated_hours <= 1.0) score += 5;
      
      const newTask = {
        id: 'task-' + Date.now(),
        ...taskData,
        priority_score: score,
        status: 'todo',
        created_at: new Date().toISOString()
      };
      tasks.unshift(newTask);
      localStorage.setItem('slancar_local_tasks', JSON.stringify(tasks));
      return newTask;
    }
    const { data, error } = await supabase.from('tasks').insert(taskData).select().single();
    if (error) throw error;
    return data;
  },

  async updateTaskStatus(taskId, status) {
    if (!supabase) {
      const tasks = await this.getTasks();
      const task = tasks.find(t => t.id === taskId);
      if (task) task.status = status;
      localStorage.setItem('slancar_local_tasks', JSON.stringify(tasks));
      return task;
    }
    const { data, error } = await supabase.from('tasks').update({ status }).eq('id', taskId).select().single();
    if (error) throw error;
    return data;
  },

  async getDailyPlan(userId, dateStr) {
    if (!supabase) {
      return JSON.parse(localStorage.getItem('slancar_today_plan')) || null;
    }
    const { data } = await supabase.from('daily_plans').select('*').eq('user_id', userId).eq('plan_date', dateStr).maybeSingle();
    return data;
  },

  async saveDailyPlan(planData) {
    if (!supabase) {
      localStorage.setItem('slancar_today_plan', JSON.stringify(planData));
      return planData;
    }
    const { data, error } = await supabase.from('daily_plans').upsert(planData, { onConflict: 'user_id,plan_date' }).select().single();
    if (error) throw error;
    return data;
  },

  async saveDailyReview(reviewData) {
    if (!supabase) {
      localStorage.setItem('slancar_last_review', JSON.stringify(reviewData));
      return reviewData;
    }
    const { data, error } = await supabase.from('daily_reviews').upsert(reviewData, { onConflict: 'user_id,review_date' }).select().single();
    if (error) throw error;
    return data;
  }
};
