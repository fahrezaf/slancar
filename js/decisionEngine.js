// ==================================================
// SLANCAR DECISION ENGINE (BUSINESS RULES & MATH)
// "Think First, Then Speak" — Pure Deterministic Logic
// ==================================================

const SlancarDecisionEngine = {
  // Base task weights
  BASE_PRIORITIES: {
    office_work: 100,
    client_freelance: 90,
    side_hustle: 80,
    gym: 60,
    learning: 30,
    entertainment: 10
  },

  // Calculate Priority Score deterministically
  calculateScore(task) {
    let score = this.BASE_PRIORITIES[task.task_type] || 50;

    if (task.deadline_date) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const deadline = new Date(task.deadline_date);
      deadline.setHours(0, 0, 0, 0);
      const diffDays = Math.round((deadline - today) / (1000 * 60 * 60 * 24));

      if (diffDays < 0) {
        score += 100; // Overdue: Max emergency weight
      } else if (diffDays === 0) {
        score += 60; // Due today
      } else if (diffDays <= 2) {
        score += 30; // Due within 2 days
      } else if (diffDays <= 5) {
        score += 15;
      }

      if (task.deadline_type === 'hard') {
        score += 15; // Hard deadline bonus
      }
    }

    // Quick Win bonus for momentum
    if (parseFloat(task.estimated_hours) <= 1.0) {
      score += 5;
    }

    return score;
  },

  // Analyze Capacity & Filter Tasks for the 06:00 Plan
  evaluateDayPlan(profile, tasks) {
    const rawCapacity = parseFloat(profile.daily_capacity_hours) || 8.0;
    const bufferPct = parseFloat(profile.buffer_percentage) || 0.15;
    const effectiveCapacity = rawCapacity * (1 - bufferPct); // Preserves 15% safety buffer
    const bufferHours = rawCapacity * bufferPct;

    // Filter only active/todo tasks
    const candidateTasks = tasks
      .filter(t => t.status === 'todo' || t.status === 'in_progress')
      .map(t => ({
        ...t,
        calculated_priority: this.calculateScore(t),
        estimated_hours: parseFloat(t.estimated_hours) || 1.0
      }))
      .sort((a, b) => b.calculated_priority - a.calculated_priority);

    const scheduledTasks = [];
    const deferredTasks = [];
    let currentAllocatedHours = 0;

    for (const task of candidateTasks) {
      if (currentAllocatedHours + task.estimated_hours <= effectiveCapacity) {
        scheduledTasks.push(task);
        currentAllocatedHours += task.estimated_hours;
      } else {
        deferredTasks.push({
          task,
          reason: `Kapasitas efektif (${effectiveCapacity.toFixed(1)} jam) sudah penuh. Tugas diprioritaskan untuk besok guna menjaga buffer ${bufferHours.toFixed(1)} jam.`
        });
      }
    }

    return {
      rawCapacity,
      bufferHours,
      effectiveCapacity,
      allocatedHours: currentAllocatedHours,
      scheduledTasks,
      deferredTasks,
      overdueTasks: candidateTasks.filter(t => {
        if (!t.deadline_date) return false;
        return new Date(t.deadline_date) < new Date().setHours(0,0,0,0);
      })
    };
  },

  // Generate Hourly Time Slots based on working hours
  generateScheduleSlots(profile, scheduledTasks) {
    const slots = [];
    let currentHour = 9; // Default office or workday start
    let currentMinute = 0;

    if (profile.office_start_time) {
      const parts = profile.office_start_time.split(':');
      currentHour = parseInt(parts[0], 10) || 9;
    }

    for (const task of scheduledTasks) {
      const durationHours = task.estimated_hours;
      const durationMinutes = Math.round(durationHours * 60);

      const startTimeStr = `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`;
      
      // Add duration
      let endTotalMin = (currentHour * 60 + currentMinute) + durationMinutes;
      let endHour = Math.floor(endTotalMin / 60);
      let endMin = endTotalMin % 60;
      const endTimeStr = `${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`;

      slots.push({
        task_id: task.id,
        task_title: task.title,
        task_type: task.task_type,
        start_time: startTimeStr,
        end_time: endTimeStr,
        estimated_hours: durationHours
      });

      // Advance time with a 15 min mental buffer between tasks
      endTotalMin += 15;
      currentHour = Math.floor(endTotalMin / 60);
      currentMinute = endTotalMin % 60;
    }

    return slots;
  }
};
