// ==================================================
// SLANCAR AI PM REASONING ENGINE (GEMINI 1.5 FLASH)
// "Think First, Then Speak" — Executive Partner
// ==================================================

const SlancarAI = {
  // Call Gemini 1.5 Flash REST API
  async callGemini(systemPrompt, userPrompt) {
    const apiKey = SlancarConfig.GEMINI_API_KEY;

    if (!apiKey) {
      console.warn('Gemini API key is not set. Using local PM rule engine reasoning.');
      return null;
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const payload = {
      contents: [
        {
          role: 'user',
          parts: [
            { text: `${systemPrompt}\n\nUSER SITUATION:\n${userPrompt}` }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 800
      }
    };

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error('Gemini API error:', errText);
        return null;
      }

      const result = await response.json();
      return result.candidates?.[0]?.content?.parts?.[0]?.text || null;
    } catch (e) {
      console.error('Failed to communicate with Gemini API:', e);
      return null;
    }
  },

  // 06:00 Morning Planning Strategy Synthesis
  async synthesizeMorningPlan(profile, evaluation, slots) {
    const systemPrompt = `You are Slancar, an elite AI Project Manager for a high-performing solo creator/freelancer.
PHILOSOPHY: "Think first, then speak." Be concise, authoritative, strategic, and supportive.
Never give generic motivational fluff. Give specific PM directives based on the user's workload, capacity, and deadlines.
Respond in Indonesian language.`;

    const scheduledSummary = slots.map(s => `- [${s.start_time} - ${s.end_time}] ${s.task_title} (${s.task_type})`).join('\n');
    const deferredSummary = evaluation.deferredTasks.map(d => `- ${d.task.title} (Tertunda: ${d.reason})`).join('\n');

    const userPrompt = `
KAPASITAS HARI INI:
- Total Kapasitas: ${evaluation.rawCapacity} jam
- Kapasitas Efektif (Dialokasikan): ${evaluation.allocatedHours.toFixed(1)} jam
- Safety Buffer Terjaga: ${evaluation.bufferHours.toFixed(1)} jam
- Tugas Terjadwal:
${scheduledSummary || 'Tidak ada tugas yang dijadwalkan'}

TUGAS DINEGOSIASIKAN / DITUNDA HARI INI (Untuk melindungi buffer):
${deferredSummary || 'Semua tugas tertampung'}

Tugas Overdue: ${evaluation.overdueTasks.length} tugas.

Berikan brief singkat (3-4 kalimat) untuk Dashboard pagi ini:
1. Tegaskan prioritas nomor 1 hari ini dan mengapa itu kritis.
2. Jelaskan mengapa tugas lain ditunda demi menjaga kapasitas tanpa rasa bersalah.
3. Ingatkan batas waktu istirahat / buffer energi.`;

    const aiResponse = await this.callGemini(systemPrompt, userPrompt);
    if (aiResponse) return aiResponse.trim();

    // Heuristic Fallback if Gemini key is empty
    return `Selamat pagi! Kapasitas produktif hari ini diatur ${evaluation.allocatedHours.toFixed(1)} jam dengan perlindungan buffer ${evaluation.bufferHours.toFixed(1)} jam. Prioritas utama kamu adalah menyelesaikan komitmen berbatas waktu tanpa multitasking. Tugas dengan prioritas lebih rendah ditunda ke esok hari agar energimu tetap konsisten. Fokus satu per satu.`;
  },

  // 21:00 Evening Review Reflection & Recovery
  async synthesizeEveningReview(completedTasks, failedTasks, energyLevel, mood, userNote) {
    const systemPrompt = `You are Slancar, an elite AI Project Manager.
PHILOSOPHY: Recovery & Adaptation. If the user failed tasks, NEVER blame them. Analyze workload estimation and protect long-term consistency.
Respond in warm, grounded, constructive Indonesian language.`;

    const userPrompt = `
HASIL KERJA HARI INI:
- Selesai (${completedTasks.length}): ${completedTasks.map(t => t.title).join(', ') || 'Nol'}
- Belum Selesai / Gagal (${failedTasks.length}): ${failedTasks.map(t => t.title).join(', ') || 'Nol'}
- Level Energi (1-5): ${energyLevel}/5
- Suasana Hati (Mood): ${mood}
- Catatan Refleksi User: "${userNote || 'Tidak ada catatan'}"

Berikan evaluasi PM singkat (3-4 kalimat):
1. Apresiasi progres yang berhasil dicapai (sekecil apa pun).
2. Analisis kegagalan secara objektif (apakah estimasi waktu terlalu optimis atau energi drop).
3. Penyesuaian strategi untuk jadwal besok pagi.`;

    const aiResponse = await this.callGemini(systemPrompt, userPrompt);
    if (aiResponse) return aiResponse.trim();

    // Heuristic Fallback
    if (failedTasks.length > 0 && energyLevel <= 2) {
      return `Kerja keras hari ini sudah selesai. Kamu kelelahan (${energyLevel}/5), jadi sangat wajar ada tugas yang tertunda. Ini bukan kegagalan disiplin, melainkan sinyal bahwa kapasitas harus dikurangi besok pagi sebesar 20% agar kamu bisa pulih. Istirahat sekarang, besok kita mulai dengan ritme lebih segar.`;
    }
    return `Evaluasi hari ini tercatat dengan baik. Kamu menyelesaikan ${completedTasks.length} tugas penting. Tugas yang belum tuntas akan otomatis dievaluasi ulang oleh Decision Engine pada pukul 06:00 besok. Istirahat yang cukup malam ini.`;
  },

  // Contextual PM Chat
  async chatWithPM(userMessage, currentPlan, allTasks) {
    const systemPrompt = `You are Slancar, an active AI Project Manager talking with your solo creator user.
You are NOT a passive chat assistant. You actively protect their deadlines, manage their workload, and negotiate trade-offs.
Keep responses concise, clear, and actionable. Speak in Indonesian.`;

    const currentTask = currentPlan?.schedule_slots?.[0]?.task_title || 'Belum ada jadwal aktif';
    const totalTasks = allTasks.length;

    const userPrompt = `
STATUS SAAT INI:
- Tugas Aktif Sekarang: ${currentTask}
- Total Tugas di Backlog: ${totalTasks}
- Pesan User: "${userMessage}"

Berikan tanggapan PM yang cerdas, praktis, dan langsung ke inti tindakan:`;

    const aiResponse = await this.callGemini(systemPrompt, userPrompt);
    if (aiResponse) return aiResponse.trim();

    return `Saya mendengar kendalamu. Sebagai PM kamu, prioritas nomor satu adalah menjaga agar kamu tidak burnout sembari tetap menyelesaikan tugas berbatas waktu terdekat. Apakah kamu ingin saya memotong durasi tugas hari ini atau menegosiasikan jadwal ke besok pagi?`;
  }
};
