// ==================================================
// SLANCAR MAIN APPLICATION CONTROLLER
// Handles State, Navigation, and All 7 Screen Renders
// ==================================================

const AppState = {
  currentTab: 'dashboard',
  user: null,
  profile: null,
  goals: [],
  projects: [],
  tasks: [],
  todayPlan: null,
  chatMessages: [
    { sender: 'pm', text: 'Halo! Saya Slancar, AI Project Manager kamu. Saya siap menganalisis prioritas dan menjaga kapasitasmu hari ini.' }
  ]
};

// Initialize App
document.addEventListener('DOMContentLoaded', async () => {
  initSupabase();
  await loadAppData();
  renderApp();
  lucide.createIcons();
});

// Load All Core Data
async function loadAppData() {
  try {
    AppState.user = await SlancarDB.getUser();
    AppState.profile = await SlancarDB.getProfile(AppState.user?.id);
    AppState.goals = await SlancarDB.getGoals(AppState.user?.id);
    AppState.projects = await SlancarDB.getProjects(AppState.user?.id);
    AppState.tasks = await SlancarDB.getTasks(AppState.user?.id);

    const todayStr = new Date().toISOString().split('T')[0];
    AppState.todayPlan = await SlancarDB.getDailyPlan(AppState.user?.id, todayStr);

    // If today's plan doesn't exist yet, run the 06:00 Decision Engine auto-builder!
    if (!AppState.todayPlan) {
      await runMorningPlanning(false);
    }
  } catch (err) {
    console.error('Error loading app data:', err);
  }
}

// 06:00 Daily Planning Execution
async function runMorningPlanning(forceReplan = false) {
  if (AppState.todayPlan && !forceReplan) return;

  const evaluation = SlancarDecisionEngine.evaluateDayPlan(AppState.profile, AppState.tasks);
  const slots = SlancarDecisionEngine.generateScheduleSlots(AppState.profile, evaluation.scheduledTasks);

  // Generate PM Strategic Reason via Gemini 1.5 Flash
  const pmReasoning = await SlancarAI.synthesizeMorningPlan(AppState.profile, evaluation, slots);

  const todayStr = new Date().toISOString().split('T')[0];
  const newPlan = {
    user_id: AppState.user?.id || 'demo-user',
    plan_date: todayStr,
    target_capacity_hours: evaluation.rawCapacity,
    allocated_hours: evaluation.allocatedHours,
    schedule_slots: slots,
    pm_reasoning: pmReasoning,
    status: 'active'
  };

  AppState.todayPlan = await SlancarDB.saveDailyPlan(newPlan);
  renderApp();
}

// Switch Screens
function navigateTo(tabName) {
  AppState.currentTab = tabName;
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.tab === tabName);
  });
  renderScreenContent();
  lucide.createIcons();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Master Render
function renderApp() {
  renderScreenContent();
}

// Render active screen
function renderScreenContent() {
  const container = document.getElementById('screen-content');
  if (!container) return;

  switch (AppState.currentTab) {
    case 'dashboard':
      container.innerHTML = renderDashboardScreen();
      break;
    case 'goals':
      container.innerHTML = renderGoalsScreen();
      break;
    case 'projects':
      container.innerHTML = renderProjectsScreen();
      break;
    case 'tasks':
      container.innerHTML = renderTasksScreen();
      break;
    case 'pm-chat':
      container.innerHTML = renderPMChatScreen();
      break;
    case 'daily-review':
      container.innerHTML = renderDailyReviewScreen();
      break;
    case 'profile':
      container.innerHTML = renderProfileScreen();
      break;
    default:
      container.innerHTML = renderDashboardScreen();
  }
  lucide.createIcons();
}

// ==========================================
// 1. DASHBOARD SCREEN ("What do I do now?")
// ==========================================
function renderDashboardScreen() {
  const slots = AppState.todayPlan?.schedule_slots || [];
  const currentSlot = slots[0] || null;
  const rawCap = parseFloat(AppState.profile?.daily_capacity_hours) || 8.0;
  const alloc = parseFloat(AppState.todayPlan?.allocated_hours) || 0.0;
  const buffer = rawCap - alloc;
  const allocPercent = Math.min(Math.round((alloc / rawCap) * 100), 100);

  // Check Overdue Tasks
  const today = new Date().setHours(0,0,0,0);
  const overdueTasks = AppState.tasks.filter(t => t.status !== 'completed' && t.deadline_date && new Date(t.deadline_date) < today);

  return `
    <div class="p-4 space-y-4">
      <!-- Top Bar -->
      <div class="flex items-center justify-between pt-2">
        <div>
          <p class="text-xs text-gray-400 font-medium">SLANCAR PM • ${new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' })}</p>
          <h1 class="text-xl font-bold text-white tracking-tight">Today's Focus</h1>
        </div>
        <button onclick="navigateTo('profile')" class="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-cyan-400">
          <i data-lucide="user" class="w-4 h-4"></i>
        </button>
      </div>

      <!-- Overdue Alert (if exists) -->
      ${overdueTasks.length > 0 ? `
        <div class="bg-rose-950/40 border border-rose-800/60 rounded-xl p-3 flex items-center gap-3">
          <i data-lucide="alert-triangle" class="w-5 h-5 text-rose-400 shrink-0"></i>
          <div class="flex-1 text-xs">
            <span class="font-bold text-rose-300">${overdueTasks.length} Tugas Overdue!</span>
            <p class="text-rose-200/80">Prioritas telah otomatis dinaikkan ke level maksimal.</p>
          </div>
          <button onclick="navigateTo('tasks')" class="text-xs bg-rose-600 px-2.5 py-1 rounded-lg text-white font-medium">Lihat</button>
        </div>
      ` : ''}

      <!-- HERO: "WHAT SHOULD I DO RIGHT NOW?" -->
      <div class="sl-card hero-glow p-5">
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs font-semibold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span> Sedang Dikerjakan Sekarang
          </span>
          <span class="text-xs text-gray-400 font-mono">${currentSlot ? `${currentSlot.start_time} - ${currentSlot.end_time}` : 'Free'}</span>
        </div>
        
        <h2 class="text-lg font-bold text-white mb-1">
          ${currentSlot ? currentSlot.task_title : 'Semua rencana hari ini selesai! Waktunya istirahat.'}
        </h2>
        
        <p class="text-xs text-gray-400 mb-4">
          ${currentSlot ? `Estimasi: ${currentSlot.estimated_hours} Jam • Tipe: ${currentSlot.task_type.replace('_', ' ').toUpperCase()}` : 'Buffer kapasitas harianmu tetap aman terjaga.'}
        </p>

        ${currentSlot ? `
          <div class="flex gap-2">
            <button onclick="markTaskDone('${currentSlot.task_id}')" class="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-1.5 transition">
              <i data-lucide="check-circle-2" class="w-4 h-4"></i> Tandai Selesai
            </button>
            <button onclick="navigateTo('pm-chat')" class="bg-slate-800 hover:bg-slate-700 text-gray-300 font-medium py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1">
              <i data-lucide="message-square" class="w-4 h-4"></i> Diskusi PM
            </button>
          </div>
        ` : `
          <button onclick="runMorningPlanning(true)" class="w-full bg-slate-800 hover:bg-slate-700 text-cyan-400 font-medium py-2 px-4 rounded-xl text-xs flex items-center justify-center gap-1.5">
            <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i> Re-Calculate Jadwal Hari Ini
          </button>
        `}
      </div>

      <!-- CAPACITY & BUFFER GAUGE -->
      <div class="sl-card">
        <div class="flex justify-between items-center mb-2 text-xs">
          <span class="text-gray-300 font-medium flex items-center gap-1.5">
            <i data-lucide="battery-charging" class="w-4 h-4 text-emerald-400"></i> Kapasitas Produktif
          </span>
          <span class="text-gray-400 font-mono">
            <strong class="text-white">${alloc.toFixed(1)}h</strong> / ${rawCap.toFixed(1)}h
            <span class="text-emerald-400">(${buffer.toFixed(1)}h buffer)</span>
          </span>
        </div>
        <div class="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden flex">
          <div class="bg-indigo-500 h-full transition-all" style="width: ${allocPercent}%"></div>
          <div class="bg-emerald-500/40 h-full" style="width: ${100 - allocPercent}%" title="Safety Buffer"></div>
        </div>
        <p class="text-[11px] text-gray-500 mt-2">Buffer 15% dikunci otomatis untuk mencegah kelelahan & revisi dadakan.</p>
      </div>

      <!-- AI PM STRATEGIC MORNING BRIEF -->
      <div class="sl-card border-indigo-900/40 bg-indigo-950/20">
        <div class="flex items-center justify-between mb-2">
          <div class="flex items-center gap-2">
            <div class="w-6 h-6 rounded-md bg-indigo-600/30 text-indigo-400 flex items-center justify-center">
              <i data-lucide="sparkles" class="w-3.5 h-3.5"></i>
            </div>
            <h3 class="text-xs font-bold text-indigo-300 uppercase tracking-wide">Instruksi PM Pagi Ini</h3>
          </div>
          <button onclick="runMorningPlanning(true)" class="text-gray-400 hover:text-white p-1" title="Analisis Ulang">
            <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i>
          </button>
        </div>
        <p class="text-xs text-gray-300 leading-relaxed font-sans">
          ${AppState.todayPlan?.pm_reasoning || 'Menganalisis prioritas hari ini...'}
        </p>
      </div>

      <!-- TODAY'S HOURLY SCHEDULE -->
      <div>
        <div class="flex justify-between items-center mb-3">
          <h3 class="text-xs font-bold text-gray-400 uppercase tracking-wider">Jadwal Jam demi Jam</h3>
          <span class="text-xs text-gray-500">${slots.length} Tugas Terpilih</span>
        </div>

        <div class="space-y-2.5">
          ${slots.length === 0 ? `
            <div class="text-center py-8 text-gray-500 text-xs">Belum ada tugas terjadwal hari ini.</div>
          ` : slots.map((s, idx) => `
            <div class="sl-card flex items-center gap-3 py-3 px-4 ${idx === 0 ? 'border-cyan-500/50 bg-slate-900/90' : ''}">
              <div class="text-center w-12 shrink-0">
                <span class="text-xs font-mono font-bold text-cyan-400 block">${s.start_time}</span>
                <span class="text-[10px] text-gray-500 font-mono">${s.end_time}</span>
              </div>
              <div class="w-px h-8 bg-slate-800 shrink-0"></div>
              <div class="flex-1 min-w-0">
                <h4 class="text-xs font-medium text-white truncate">${s.task_title}</h4>
                <div class="flex items-center gap-2 mt-0.5">
                  <span class="text-[10px] px-1.5 py-0.5 rounded badge-${s.task_type.split('_')[0]}">${s.task_type.replace('_', ' ')}</span>
                  <span class="text-[10px] text-gray-500">${s.estimated_hours}h</span>
                </div>
              </div>
              <button onclick="markTaskDone('${s.task_id}')" class="text-gray-500 hover:text-emerald-400 p-1.5 transition">
                <i data-lucide="check" class="w-4 h-4"></i>
              </button>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

// ==========================================
// 2. GOALS SCREEN
// ==========================================
function renderGoalsScreen() {
  return `
    <div class="p-4 space-y-4">
      <div class="flex items-center justify-between pt-2">
        <div>
          <p class="text-xs text-gray-400 font-medium">LONG-TERM TARGETS</p>
          <h1 class="text-xl font-bold text-white tracking-tight">Goals & Milestones</h1>
        </div>
        <button onclick="openModal('goal-modal')" class="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium px-3 py-2 rounded-xl flex items-center gap-1.5 shadow-lg shadow-indigo-600/30">
          <i data-lucide="plus" class="w-4 h-4"></i> Tambah Goal
        </button>
      </div>

      <div class="space-y-3">
        ${AppState.goals.map(g => {
          const milestones = Array.isArray(g.milestones) ? g.milestones : [];
          return `
            <div class="sl-card space-y-3">
              <div class="flex justify-between items-start">
                <div>
                  <h3 class="text-sm font-bold text-white">${g.title}</h3>
                  <p class="text-xs text-gray-400 mt-0.5 font-mono">
                    Target: ${typeof g.target_value === 'number' && g.metric === 'IDR' ? 'Rp' + g.target_value.toLocaleString() : `${g.target_value} ${g.metric}`}
                  </p>
                </div>
                <span class="text-xs font-mono font-bold text-cyan-400">${Math.round(g.progress || 0)}%</span>
              </div>

              <!-- Progress bar -->
              <div class="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div class="bg-cyan-400 h-full" style="width: ${g.progress || 0}%"></div>
              </div>

              <!-- Milestones Checklist -->
              ${milestones.length > 0 ? `
                <div class="pt-2 border-t border-slate-800/80 space-y-1.5">
                  <span class="text-[10px] text-gray-400 font-semibold uppercase tracking-wider block">Milestones:</span>
                  ${milestones.map((m, mIdx) => `
                    <div class="flex items-center gap-2 text-xs text-gray-300">
                      <input type="checkbox" ${m.done ? 'checked' : ''} onchange="toggleMilestone('${g.id}', ${mIdx})" class="rounded border-slate-700 bg-slate-900 text-indigo-500 focus:ring-0">
                      <span class="${m.done ? 'line-through text-gray-500' : ''}">${m.title}</span>
                    </div>
                  `).join('')}
                </div>
              ` : ''}
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

// ==========================================
// 3. PROJECTS SCREEN
// ==========================================
function renderProjectsScreen() {
  return `
    <div class="p-4 space-y-4">
      <div class="flex items-center justify-between pt-2">
        <div>
          <p class="text-xs text-gray-400 font-medium">EXECUTION INITIATIVES</p>
          <h1 class="text-xl font-bold text-white tracking-tight">Active Projects</h1>
        </div>
        <button onclick="openModal('project-modal')" class="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium px-3 py-2 rounded-xl flex items-center gap-1.5 shadow-lg shadow-indigo-600/30">
          <i data-lucide="plus" class="w-4 h-4"></i> Tambah Proyek
        </button>
      </div>

      <div class="space-y-3">
        ${AppState.projects.map(p => {
          const projectTasks = AppState.tasks.filter(t => t.project_id === p.id);
          const completedTasks = projectTasks.filter(t => t.status === 'completed');
          const percent = projectTasks.length > 0 ? Math.round((completedTasks.length / projectTasks.length) * 100) : 0;

          return `
            <div class="sl-card space-y-2">
              <div class="flex justify-between items-start">
                <div>
                  <h3 class="text-sm font-bold text-white">${p.title}</h3>
                  <p class="text-xs text-gray-400">${p.description || 'Tidak ada deskripsi'}</p>
                </div>
                <span class="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-gray-300 font-mono">${completedTasks.length}/${projectTasks.length} Tugas</span>
              </div>
              
              <div class="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div class="bg-indigo-500 h-full" style="width: ${percent}%"></div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

// ==========================================
// 4. TASKS SCREEN (Backlog & Priority Scores)
// ==========================================
let currentTaskFilter = 'all';

function renderTasksScreen() {
  const filteredTasks = currentTaskFilter === 'all'
    ? AppState.tasks
    : AppState.tasks.filter(t => t.task_type === currentTaskFilter);

  const filterTabs = [
    { id: 'all', label: 'Semua' },
    { id: 'office_work', label: 'Office' },
    { id: 'client_freelance', label: 'Freelance' },
    { id: 'side_hustle', label: 'Side Hustle' },
    { id: 'gym', label: 'Gym' },
    { id: 'learning', label: 'Learning' }
  ];

  return `
    <div class="p-4 space-y-4">
      <div class="flex items-center justify-between pt-2">
        <div>
          <p class="text-xs text-gray-400 font-medium">PRIORITY ENGINE</p>
          <h1 class="text-xl font-bold text-white tracking-tight">Task Backlog</h1>
        </div>
        <button onclick="openModal('task-modal')" class="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium px-3 py-2 rounded-xl flex items-center gap-1.5 shadow-lg shadow-indigo-600/30">
          <i data-lucide="plus" class="w-4 h-4"></i> Buat Tugas
        </button>
      </div>

      <!-- Filter Chips -->
      <div class="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        ${filterTabs.map(tab => `
          <button onclick="setTaskFilter('${tab.id}')" class="px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${currentTaskFilter === tab.id ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-gray-400 hover:bg-slate-700'}">
            ${tab.label}
          </button>
        `).join('')}
      </div>

      <!-- Task List sorted by Priority Score -->
      <div class="space-y-2.5">
        ${filteredTasks.map(t => {
          const score = t.priority_score || SlancarDecisionEngine.calculateScore(t);
          const isDone = t.status === 'completed';

          return `
            <div class="sl-card flex items-start gap-3 p-3.5 ${isDone ? 'opacity-50' : ''}">
              <input type="checkbox" ${isDone ? 'checked' : ''} onchange="toggleTaskDone('${t.id}')" class="mt-1 rounded border-slate-700 bg-slate-900 text-indigo-500 focus:ring-0">
              
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-1">
                  <span class="text-[10px] font-bold font-mono px-2 py-0.5 rounded ${score >= 100 ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' : 'bg-slate-800 text-gray-300'}">
                    PRIORITY: ${score}
                  </span>
                  ${t.deadline_type === 'hard' ? `
                    <span class="text-[10px] font-semibold text-rose-400 uppercase tracking-wider flex items-center gap-1">
                      <i data-lucide="flame" class="w-3 h-3"></i> Hard Deadline
                    </span>
                  ` : ''}
                </div>

                <h3 class="text-xs font-semibold text-white ${isDone ? 'line-through' : ''}">${t.title}</h3>
                
                <div class="flex items-center gap-3 text-[11px] text-gray-400 mt-1">
                  <span>${t.estimated_hours} Jam</span>
                  <span>•</span>
                  <span>Deadline: ${t.deadline_date || 'Fleksibel'}</span>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function setTaskFilter(type) {
  currentTaskFilter = type;
  renderScreenContent();
}

// ==========================================
// 5. PM CHAT SCREEN (Active Guidance)
// ==========================================
function renderPMChatScreen() {
  const quickChips = [
    "Kerjaan kantor mendadak banyak hari ini",
    "Saya merasa burnout, kurangi beban",
    "Klien freelance minta revisi darurat",
    "Analisis jadwal hari ini"
  ];

  return `
    <div class="p-4 flex flex-col h-[calc(100vh-100px)] justify-between">
      <div>
        <div class="pt-2 mb-3">
          <p class="text-xs text-gray-400 font-medium">STRATEGIC DIALOGUE</p>
          <h1 class="text-xl font-bold text-white tracking-tight">AI Project Manager</h1>
        </div>

        <!-- Quick Action Chips -->
        <div class="flex gap-2 overflow-x-auto pb-2 mb-3 no-scrollbar">
          ${quickChips.map(chip => `
            <button onclick="sendQuickChatMessage('${chip}')" class="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] text-gray-300 whitespace-nowrap border border-slate-700 transition">
              ${chip}
            </button>
          `).join('')}
        </div>

        <!-- Messages Stream -->
        <div id="chat-stream" class="space-y-3 overflow-y-auto max-h-[55vh] pr-1">
          ${AppState.chatMessages.map(msg => `
            <div class="flex gap-2.5 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}">
              ${msg.sender === 'pm' ? `
                <div class="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 text-xs font-bold">
                  PM
                </div>
              ` : ''}
              <div class="max-w-[80%] rounded-2xl p-3 text-xs leading-relaxed ${msg.sender === 'user' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-gray-200 border border-slate-700'}">
                ${msg.text}
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Chat Input -->
      <form onsubmit="handleSendChat(event)" class="flex gap-2 pt-3 border-t border-slate-800">
        <input id="chat-input" type="text" placeholder="Diskusikan prioritas atau beban kerja..." class="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500">
        <button type="submit" class="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl text-xs font-medium transition flex items-center justify-center">
          <i data-lucide="send" class="w-4 h-4"></i>
        </button>
      </form>
    </div>
  `;
}

async function handleSendChat(e) {
  e.preventDefault();
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text) return;

  AppState.chatMessages.push({ sender: 'user', text });
  input.value = '';
  renderScreenContent();

  const pmReply = await SlancarAI.chatWithPM(text, AppState.todayPlan, AppState.tasks);
  AppState.chatMessages.push({ sender: 'pm', text: pmReply });
  renderScreenContent();
}

function sendQuickChatMessage(text) {
  document.getElementById('chat-input').value = text;
  handleSendChat(new Event('submit'));
}

// ==========================================
// 6. DAILY REVIEW SCREEN (21:00 Evening Review)
// ==========================================
function renderDailyReviewScreen() {
  const completed = AppState.tasks.filter(t => t.status === 'completed');
  const failed = AppState.tasks.filter(t => t.status !== 'completed');

  return `
    <div class="p-4 space-y-4">
      <div class="pt-2">
        <p class="text-xs text-indigo-400 font-medium">EVENING ROUTINE (21:00)</p>
        <h1 class="text-xl font-bold text-white tracking-tight">Daily PM Review</h1>
        <p class="text-xs text-gray-400 mt-1">Tanpa rasa bersalah. Evaluasi objektif untuk menjaga konsistensi jangka panjang.</p>
      </div>

      <div class="sl-card space-y-4">
        <!-- Status summary -->
        <div class="grid grid-cols-2 gap-3">
          <div class="bg-slate-900/80 p-3 rounded-xl border border-slate-800 text-center">
            <span class="text-xl font-bold text-emerald-400 font-mono">${completed.length}</span>
            <p class="text-[11px] text-gray-400 mt-0.5">Tugas Selesai</p>
          </div>
          <div class="bg-slate-900/80 p-3 rounded-xl border border-slate-800 text-center">
            <span class="text-xl font-bold text-amber-400 font-mono">${failed.length}</span>
            <p class="text-[11px] text-gray-400 mt-0.5">Tertunda / Gagal</p>
          </div>
        </div>

        <!-- Energy Level Slider -->
        <div>
          <label class="block text-xs font-semibold text-gray-300 mb-1.5">Tingkat Energi Malam Ini (1 - 5):</label>
          <div class="flex items-center gap-3">
            <input id="review-energy" type="range" min="1" max="5" value="3" class="w-full accent-indigo-500" oninput="document.getElementById('energy-val').innerText = this.value">
            <span id="energy-val" class="text-sm font-bold text-cyan-400 font-mono">3</span>
          </div>
        </div>

        <!-- Mood Selection -->
        <div>
          <label class="block text-xs font-semibold text-gray-300 mb-1.5">Suasana Hati (Mood):</label>
          <select id="review-mood" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white">
            <option value="Puas & Fokus">Puas & Fokus</option>
            <option value="Normal">Normal</option>
            <option value="Lelah tapi Produktif">Lelah tapi Produktif</option>
            <option value="Burnout / Kewalahan">Burnout / Kewalahan</option>
          </select>
        </div>

        <!-- Reflection Notes -->
        <div>
          <label class="block text-xs font-semibold text-gray-300 mb-1.5">Apa kendala atau pelajaran utama hari ini?</label>
          <textarea id="review-notes" rows="3" placeholder="Contoh: Terlalu lama di revisi klien, kurang istirahat siang..." class="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-indigo-500"></textarea>
        </div>

        <button onclick="submitDailyReview()" class="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-3 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-600/30">
          <i data-lucide="check" class="w-4 h-4"></i> Submit & Kalibrasi Jadwal Besok
        </button>
      </div>

      <!-- Display PM Feedback result if already submitted -->
      <div id="pm-feedback-box" class="hidden sl-card border-indigo-500/40 bg-indigo-950/30 p-4">
        <h4 class="text-xs font-bold text-indigo-300 uppercase tracking-wide mb-2">Sintesis PM untuk Besok:</h4>
        <p id="pm-feedback-text" class="text-xs text-gray-200 leading-relaxed"></p>
      </div>
    </div>
  `;
}

async function submitDailyReview() {
  const energy = parseInt(document.getElementById('review-energy').value, 10);
  const mood = document.getElementById('review-mood').value;
  const notes = document.getElementById('review-notes').value;

  const completed = AppState.tasks.filter(t => t.status === 'completed');
  const failed = AppState.tasks.filter(t => t.status !== 'completed');

  const pmFeedback = await SlancarAI.synthesizeEveningReview(completed, failed, energy, mood, notes);

  const todayStr = new Date().toISOString().split('T')[0];
  await SlancarDB.saveDailyReview({
    user_id: AppState.user?.id || 'demo-user',
    review_date: todayStr,
    completed_tasks_count: completed.length,
    failed_tasks_count: failed.length,
    reasons: notes,
    energy_level: energy,
    mood: mood,
    productive_hours: parseFloat(AppState.todayPlan?.allocated_hours) || 6.0,
    pm_feedback: pmFeedback
  });

  const feedbackBox = document.getElementById('pm-feedback-box');
  const feedbackText = document.getElementById('pm-feedback-text');
  if (feedbackBox && feedbackText) {
    feedbackText.innerText = pmFeedback;
    feedbackBox.classList.remove('hidden');
  }
}

// ==========================================
// 7. PROFILE & PREFERENCES SCREEN
// ==========================================
function renderProfileScreen() {
  const p = AppState.profile || {};

  return `
    <div class="p-4 space-y-4">
      <div class="pt-2">
        <p class="text-xs text-gray-400 font-medium">CAPACITY & INTEGRATION</p>
        <h1 class="text-xl font-bold text-white tracking-tight">Profile & Preferences</h1>
      </div>

      <!-- Cloud Sync & API Settings -->
      <div class="sl-card space-y-3">
        <h3 class="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
          <i data-lucide="key" class="w-3.5 h-3.5"></i> API & Cloud Sync (Gratis)
        </h3>
        
        <div>
          <label class="block text-[11px] text-gray-400 mb-1">Supabase Project URL:</label>
          <input id="cfg-supa-url" type="text" value="${SlancarConfig.SUPABASE_URL}" placeholder="https://xyz.supabase.co" class="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white">
        </div>

        <div>
          <label class="block text-[11px] text-gray-400 mb-1">Supabase Anon Key:</label>
          <input id="cfg-supa-key" type="password" value="${SlancarConfig.SUPABASE_ANON_KEY}" placeholder="eyJhbGciOi..." class="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white">
        </div>

        <div>
          <label class="block text-[11px] text-gray-400 mb-1">Google Gemini API Key (Untuk PM Brain):</label>
          <input id="cfg-gemini-key" type="password" value="${SlancarConfig.GEMINI_API_KEY}" placeholder="AIzaSy..." class="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white">
          <span class="text-[10px] text-gray-500">Dapatkan gratis dari Google AI Studio (1500 request/hari gratis).</span>
        </div>

        <button onclick="saveApiSettings()" class="w-full bg-slate-800 hover:bg-slate-700 text-cyan-400 font-medium py-2 rounded-lg text-xs">
          Simpan Kunci API
        </button>
      </div>

      <!-- Capacity Parameters -->
      <div class="sl-card space-y-3">
        <h3 class="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
          <i data-lucide="sliders" class="w-3.5 h-3.5"></i> Parameter Kapasitas & Jam Kerja
        </h3>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-[11px] text-gray-400 mb-1">Jam Bangun:</label>
            <input id="prof-wake" type="time" value="${p.wake_up_time || '06:00'}" class="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white">
          </div>
          <div>
            <label class="block text-[11px] text-gray-400 mb-1">Jam Tidur:</label>
            <input id="prof-sleep" type="time" value="${p.sleep_time || '22:00'}" class="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white">
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-[11px] text-gray-400 mb-1">Kantor Mulai:</label>
            <input id="prof-office-start" type="time" value="${p.office_start_time || '09:00'}" class="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white">
          </div>
          <div>
            <label class="block text-[11px] text-gray-400 mb-1">Kantor Selesai:</label>
            <input id="prof-office-end" type="time" value="${p.office_end_time || '17:00'}" class="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white">
          </div>
        </div>

        <div>
          <label class="block text-[11px] text-gray-400 mb-1">Kapasitas Produktif Harian (Jam):</label>
          <input id="prof-capacity" type="number" step="0.5" value="${p.daily_capacity_hours || 8.0}" class="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white">
        </div>

        <div>
          <label class="block text-[11px] text-gray-400 mb-1">Target Penghasilan Bulanan (Rp):</label>
          <input id="prof-income" type="number" value="${p.income_target || 20000000}" class="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white">
        </div>

        <button onclick="saveProfileSettings()" class="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2.5 rounded-xl text-xs shadow-lg shadow-indigo-600/30">
          Simpan Preferensi
        </button>
      </div>
    </div>
  `;
}

function saveApiSettings() {
  const url = document.getElementById('cfg-supa-url').value;
  const supaKey = document.getElementById('cfg-supa-key').value;
  const geminiKey = document.getElementById('cfg-gemini-key').value;

  SlancarConfig.saveConfig(url, supaKey, geminiKey);
  initSupabase();
  alert('Konfigurasi API berhasil disimpan!');
  loadAppData().then(() => renderApp());
}

async function saveProfileSettings() {
  const updated = {
    wake_up_time: document.getElementById('prof-wake').value,
    sleep_time: document.getElementById('prof-sleep').value,
    office_start_time: document.getElementById('prof-office-start').value,
    office_end_time: document.getElementById('prof-office-end').value,
    daily_capacity_hours: parseFloat(document.getElementById('prof-capacity').value) || 8.0,
    income_target: parseFloat(document.getElementById('prof-income').value) || 0
  };

  await SlancarDB.updateProfile(AppState.user?.id || 'demo-user', updated);
  AppState.profile = { ...AppState.profile, ...updated };
  alert('Preferensi kapasitas berhasil diperbarui!');
  renderApp();
}

// Actions
async function markTaskDone(taskId) {
  await SlancarDB.updateTaskStatus(taskId, 'completed');
  const t = AppState.tasks.find(x => x.id === taskId);
  if (t) t.status = 'completed';
  renderApp();
}

async function toggleTaskDone(taskId) {
  const t = AppState.tasks.find(x => x.id === taskId);
  if (!t) return;
  const newStatus = t.status === 'completed' ? 'todo' : 'completed';
  await SlancarDB.updateTaskStatus(taskId, newStatus);
  t.status = newStatus;
  renderApp();
}

// Modal Helpers
function openModal(id) {
  document.getElementById(id).classList.add('active');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('active');
}

// Task Creator
async function handleCreateTask(e) {
  e.preventDefault();
  const title = document.getElementById('new-task-title').value;
  const type = document.getElementById('new-task-type').value;
  const hours = parseFloat(document.getElementById('new-task-hours').value) || 1.0;
  const deadlineType = document.getElementById('new-task-deadline-type').value;
  const deadlineDate = document.getElementById('new-task-deadline-date').value || null;

  const newTask = await SlancarDB.createTask({
    user_id: AppState.user?.id || 'demo-user',
    title,
    task_type: type,
    estimated_hours: hours,
    deadline_type: deadlineType,
    deadline_date: deadlineDate
  });

  AppState.tasks.unshift(newTask);
  closeModal('task-modal');
  renderApp();
}

// Goal Creator
async function handleCreateGoal(e) {
  e.preventDefault();
  const title = document.getElementById('new-goal-title').value;
  const target = parseFloat(document.getElementById('new-goal-target').value) || 100;
  const metric = document.getElementById('new-goal-metric').value;

  const newGoal = await SlancarDB.createGoal({
    user_id: AppState.user?.id || 'demo-user',
    title,
    target_value: target,
    metric,
    current_value: 0
  });

  AppState.goals.unshift(newGoal);
  closeModal('goal-modal');
  renderApp();
}

// Project Creator
async function handleCreateProject(e) {
  e.preventDefault();
  const title = document.getElementById('new-proj-title').value;
  const desc = document.getElementById('new-proj-desc').value;

  const newProj = await SlancarDB.createProject({
    user_id: AppState.user?.id || 'demo-user',
    title,
    description: desc
  });

  AppState.projects.unshift(newProj);
  closeModal('project-modal');
  renderApp();
}
