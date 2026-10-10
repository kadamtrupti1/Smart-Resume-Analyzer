/**
 * Smart Resume Analyzer — Frontend JavaScript
 * 2nd Year B.Tech CSE-DS Academic Project
 *
 * Handles:
 *   - Single-page navigation between all pages
 *   - Resume upload and form submission
 *   - Loading animation
 *   - Rendering all results (tabs, charts, doctor, etc.)
 *   - Demo mode
 *   - History (localStorage)
 *   - Settings (localStorage)
 *   - Resume Doctor interactive flow
 *   - Score animation
 *   - Before/After comparison
 */

// ============================================================
// GLOBAL STATE
// ============================================================
let currentAnalysis = null;   // Stores the latest analysis result
let radarChart      = null;   // Chart.js radar chart instance
let historyChart    = null;   // Chart.js history line chart
let currentScore    = 0;      // Current displayed score (can change after fixes)
let acceptedFixes   = [];     // Tracks which Resume Doctor fixes were accepted
let scoreGained     = 0;      // Points gained from fixes

// ============================================================
// PAGE NAVIGATION
// ============================================================

/**
 * Show a page by its ID, hide all others.
 * Also updates the active nav link.
 */
function showPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const target = document.getElementById('page-' + pageId);
  if (target) target.classList.add('active');

  // Update nav links
  document.querySelectorAll('.nav-links a').forEach(a => {
    a.classList.toggle('active', a.dataset.page === pageId);
  });

  // Special case: initialize history/settings when navigating there
  if (pageId === 'history')  renderHistory();
  if (pageId === 'settings') loadSettings();

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ============================================================
// UPLOAD PAGE LOGIC
// ============================================================

let selectedFile = null;

function initUploadPage() {
  const dropZone  = document.getElementById('dropZone');
  const fileInput = document.getElementById('resumeInput');
  const fileLabel = document.getElementById('fileLabel');

  // File input change
  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) {
      selectedFile = fileInput.files[0];
      fileLabel.textContent = `✓ ${selectedFile.name}`;
      fileLabel.style.display = 'block';
    }
  });

  // Drag & Drop
  dropZone.addEventListener('dragover', e => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
  });

  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) {
      selectedFile = file;
      fileInput.files = e.dataTransfer.files;
      fileLabel.textContent = `✓ ${file.name}`;
      fileLabel.style.display = 'block';
    }
  });
}

/**
 * Called when user clicks "Analyze Resume".
 * Validates inputs, shows loading screen, submits to backend.
 */
async function analyzeResume() {
  if (!selectedFile) {
    showToast('Please select a resume file first.', 'error');
    return;
  }

  const jdText = document.getElementById('jdInput').value.trim();

  // Show loading screen
  showPage('loading');
  startLoadingAnimation();

  const formData = new FormData();
  formData.append('resume', selectedFile);
  formData.append('job_description', jdText);

  try {
    const response = await fetch('/analyze', {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();

    if (data.error) {
      showToast(data.error, 'error');
      showPage('upload');
      return;
    }

    // Store result and show results page
    currentAnalysis = data;
    currentScore    = data.scores.total_score;
    scoreGained     = 0;
    acceptedFixes   = [];

    await finishLoadingAnimation();
    renderResults(data);
    showPage('results');
    saveToHistory(data);

  } catch (err) {
    console.error('Analysis error:', err);
    showToast('Connection error. Make sure Flask server is running.', 'error');
    showPage('upload');
  }
}

/**
 * Demo Mode: Load pre-built analysis data without uploading a file.
 */
async function loadDemo() {
  showPage('loading');
  startLoadingAnimation();

  try {
    const response = await fetch('/demo');
    const data = await response.json();

    currentAnalysis = data;
    currentScore    = data.scores.total_score;
    scoreGained     = 0;
    acceptedFixes   = [];

    await finishLoadingAnimation();
    renderResults(data);
    showPage('results');

  } catch (err) {
    console.error('Demo error:', err);
    showToast('Could not load demo. Make sure Flask server is running.', 'error');
    showPage('landing');
  }
}

// ============================================================
// LOADING ANIMATION
// ============================================================

const LOADING_STEPS = [
  'Extracting resume text...',
  'Detecting resume sections...',
  'Checking keywords & skills...',
  'Checking readability...',
  'Comparing with Job Description...',
  'Finding skill gaps...',
  'Preparing recommendations...',
];

let loadingResolve = null;

function startLoadingAnimation() {
  const container = document.getElementById('loadingSteps');
  container.innerHTML = '';

  LOADING_STEPS.forEach((text, i) => {
    const div = document.createElement('div');
    div.className = 'loading-step';
    div.id = `lstep-${i}`;
    div.innerHTML = `
      <div class="step-status" id="lstep-status-${i}"></div>
      <span>${text}</span>
    `;
    container.appendChild(div);
  });

  // Animate steps with delays
  LOADING_STEPS.forEach((_, i) => {
    setTimeout(() => {
      // Mark previous as done
      if (i > 0) {
        const prev = document.getElementById(`lstep-${i - 1}`);
        const prevStatus = document.getElementById(`lstep-status-${i - 1}`);
        if (prev) { prev.classList.add('done'); prev.classList.remove('active'); }
        if (prevStatus) prevStatus.textContent = '✓';
      }
      // Mark current as active
      const curr = document.getElementById(`lstep-${i}`);
      if (curr) curr.classList.add('active');
    }, i * 400);
  });
}

function finishLoadingAnimation() {
  return new Promise(resolve => {
    const total = LOADING_STEPS.length;
    setTimeout(() => {
      // Mark last step as done
      const last = document.getElementById(`lstep-${total - 1}`);
      const lastStatus = document.getElementById(`lstep-status-${total - 1}`);
      if (last) { last.classList.add('done'); last.classList.remove('active'); }
      if (lastStatus) lastStatus.textContent = '✓';
      setTimeout(resolve, 300);
    }, total * 400 + 200);
  });
}

// ============================================================
// RENDER ALL RESULTS
// ============================================================

function renderResults(data) {
  const s = data.scores;
  const jd = data.jd_match;

  // --- Update header ---
  document.getElementById('resCandidateName').textContent  = data.candidate.name || 'Candidate';
  document.getElementById('resCandidateEmail').textContent = data.candidate.email
    ? `${data.candidate.email} | ${data.candidate.phone || ''}` : '';

  // --- Mini score cards in header ---
  document.getElementById('headerTotalScore').textContent  = s.total_score;
  document.getElementById('headerHealthBadge').textContent = `${s.health_emoji} ${s.health_level}`;
  document.getElementById('headerJobMatch').textContent    = jd.jd_provided ? `${jd.match_percentage}%` : 'N/A';
  document.getElementById('headerWordCount').textContent   = data.word_count;

  // --- Tab 1: Overview ---
  renderOverview(data);

  // --- Tab 2: Skill Match ---
  renderSkillMatch(data);

  // --- Tab 3: Suggestions ---
  renderSuggestions(data);

  // --- Tab 4: Score Breakdown (Explain My Score) ---
  renderScoreBreakdown(data);

  // --- Tab 5: Resume Doctor ---
  renderResumeDoctor(data);

  // Activate first tab
  switchTab('overview');

  // Animate progress bars after short delay
  setTimeout(animateProgressBars, 200);
}

// ============================================================
// TAB 1: OVERVIEW
// ============================================================

function renderOverview(data) {
  const s = data.scores;
  const jd = data.jd_match;

  // Big score circle
  const pct = s.total_score;
  const circle = document.getElementById('scoreCircle');
  circle.style.setProperty('--pct', pct);
  document.getElementById('scoreValue').textContent = s.total_score;

  // Animate score number
  animateCounter('scoreValue', 0, s.total_score, 1200);

  // Health badge
  const healthBadge = document.getElementById('healthBadge');
  healthBadge.textContent = `${s.health_emoji} ${s.health_level} RESUME`;
  healthBadge.className = 'health-badge health-' + s.health_level.toLowerCase();

  document.getElementById('healthMessage').textContent = s.health_message;

  // Resume Quality vs Job Fit
  document.getElementById('resumeQualityScore').textContent = s.resume_quality_score + '/100';
  document.getElementById('jobFitScore').textContent = s.job_fit_score + '/100';

  // Category progress bars in overview
  const cats = s.categories;
  renderProgressBar('ovFmt',  cats.formatting.percentage,  cats.formatting.label);
  renderProgressBar('ovKw',   cats.keywords.percentage,    cats.keywords.label);
  renderProgressBar('ovRead', cats.readability.percentage, cats.readability.label);
  renderProgressBar('ovStr',  cats.structure.percentage,   cats.structure.label);
  renderProgressBar('ovComp', cats.completeness.percentage,cats.completeness.label);
  renderProgressBar('ovRel',  cats.job_relevance.percentage, cats.job_relevance.label);

  // Resume preview sections
  renderResumePreview(data);

  // Top improvement tip
  const problems = s.top_problems;
  if (problems && problems.length > 0) {
    document.getElementById('topImprovement').textContent = problems[0].tip;
  }
}

function renderProgressBar(id, percentage, label) {
  const el = document.getElementById(id);
  if (!el) return;

  // Determine color
  let colorClass = 'green';
  if (percentage < 60) colorClass = 'red';
  else if (percentage < 75) colorClass = 'yellow';

  // Determine tip
  const tips = {
    'Formatting':    percentage >= 75 ? 'Good! Keep headings consistent.' : 'Improve formatting with consistent bullet points.',
    'Keywords':      percentage >= 75 ? 'Great skill coverage!' : 'Try adding relevant skills from the JD.',
    'Readability':   percentage >= 75 ? 'Good readability.' : 'Use shorter bullet points.',
    'Structure':     percentage >= 75 ? 'Well-organized sections.' : 'Add missing sections.',
    'Completeness':  percentage >= 75 ? 'Resume looks complete.' : 'Add more content to key sections.',
    'Job Relevance': percentage >= 75 ? 'Good job match!' : 'Tailor resume more to the JD.',
  };

  el.innerHTML = `
    <div class="progress-header">
      <span class="progress-label">${label}</span>
      <span class="progress-value">${percentage}%</span>
    </div>
    <div class="progress-bar">
      <div class="progress-fill ${colorClass}" data-width="${percentage}" style="width:0%"></div>
    </div>
    <div class="progress-tip">${tips[label] || ''}</div>
  `;
}

// ============================================================
// TAB 2: SKILL MATCH
// ============================================================

function renderSkillMatch(data) {
  const jd = data.jd_match;
  const radar = data.radar;

  // Match percentage ring
  const matchPct = jd.jd_provided ? jd.match_percentage : 0;
  document.getElementById('matchPct').textContent = jd.jd_provided ? matchPct + '%' : 'N/A';

  // Animate ring
  setTimeout(() => {
    const fill = document.querySelector('.match-ring .fill');
    if (fill) {
      const dashOffset = 314 - (314 * matchPct / 100);
      fill.style.strokeDashoffset = dashOffset;

      // Color based on percentage
      if (matchPct >= 70) fill.style.stroke = '#10b981';
      else if (matchPct >= 50) fill.style.stroke = '#f59e0b';
      else fill.style.stroke = '#ef4444';
    }
  }, 300);

  // Matched skills
  const matchedEl = document.getElementById('matchedSkillsList');
  if (jd.matched_skills && jd.matched_skills.length > 0) {
    matchedEl.innerHTML = jd.matched_skills.map(s =>
      `<span class="skill-pill matched">✓ ${s}</span>`
    ).join('');
  } else {
    matchedEl.innerHTML = '<p class="text-muted">Paste a Job Description to see matched skills.</p>';
  }

  // Priority missing skills
  const missingEl = document.getElementById('priorityMissingList');
  if (jd.priority_missing && jd.priority_missing.length > 0) {
    missingEl.innerHTML = `
      <ul class="priority-list">
        ${jd.priority_missing.map(item => `
          <li class="priority-item">
            <span>⚠ <strong>${item.skill}</strong></span>
            <span class="badge badge-${item.priority.toLowerCase()}">${item.priority}</span>
          </li>
        `).join('')}
      </ul>
    `;
  } else {
    missingEl.innerHTML = '<p class="text-muted">No missing skills found — great match!</p>';
  }

  // Radar chart
  renderRadarChart(radar);

  // Strong & weak areas
  const strongEl = document.getElementById('strongAreas');
  const weakEl   = document.getElementById('weakAreas');

  strongEl.innerHTML = (data.strong_areas || []).map(a =>
    `<li>✓ ${a}</li>`).join('') || '<li class="text-muted">Upload resume to see areas.</li>';

  weakEl.innerHTML = (data.weak_areas || []).map(a =>
    `<li>⚠ ${a}</li>`).join('') || '<li class="text-muted">No weak areas detected.</li>';
}

function renderRadarChart(radar) {
  const ctx = document.getElementById('radarChart').getContext('2d');

  // Destroy old chart if exists
  if (radarChart) {
    radarChart.destroy();
    radarChart = null;
  }

  radarChart = new Chart(ctx, {
    type: 'radar',
    data: {
      labels: radar.labels,
      datasets: [
        {
          label: 'Your Skills',
          data: radar.candidate_scores,
          backgroundColor: 'rgba(99, 102, 241, 0.2)',
          borderColor: 'rgba(99, 102, 241, 0.9)',
          borderWidth: 2.5,
          pointBackgroundColor: '#6366f1',
          pointRadius: 4,
        },
        {
          label: 'Required Skills',
          data: radar.required_scores,
          backgroundColor: 'rgba(245, 158, 11, 0.15)',
          borderColor: 'rgba(245, 158, 11, 0.9)',
          borderWidth: 2,
          borderDash: [5, 4],
          pointBackgroundColor: '#f59e0b',
          pointRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      scales: {
        r: {
          beginAtZero: true,
          max: 10,
          ticks: {
            stepSize: 2,
            font: { size: 11 },
            color: '#94a3b8',
          },
          grid: { color: '#e2e8f0' },
          angleLines: { color: '#e2e8f0' },
          pointLabels: {
            font: { size: 12, weight: '600' },
            color: '#0f172a',
          },
        },
      },
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            font: { size: 12, weight: '600' },
            usePointStyle: true,
            pointStyle: 'circle',
          },
        },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: ${ctx.raw}/10`,
          },
        },
      },
      animation: { duration: 1200, easing: 'easeInOutQuart' },
    },
  });
}

// ============================================================
// TAB 3: SUGGESTIONS
// ============================================================

function renderSuggestions(data) {
  const cats = data.scores.categories;
  const container = document.getElementById('suggestionsContainer');
  container.innerHTML = '';

  // Collect all tips from all categories
  let allTips = [];
  for (const [key, cat] of Object.entries(cats)) {
    if (cat.tips && cat.tips.length > 0) {
      cat.tips.forEach(tip => {
        allTips.push({ category: cat.label, tip });
      });
    }
  }

  if (allTips.length === 0) {
    container.innerHTML = '<p class="text-muted text-center mt-4">Your resume is looking great! No major suggestions.</p>';
    return;
  }

  // Render each suggestion
  allTips.forEach((item, i) => {
    const div = document.createElement('div');
    div.className = 'card mb-4';
    div.style.borderLeft = '4px solid var(--primary)';
    div.innerHTML = `
      <div style="display:flex; align-items:flex-start; gap:12px;">
        <span style="font-size:1.4rem; flex-shrink:0;">💡</span>
        <div>
          <div style="font-size:11px; font-weight:700; text-transform:uppercase;
                      letter-spacing:.05em; color:var(--text-muted); margin-bottom:4px;">
            ${item.category}
          </div>
          <p style="font-size:14px; color:var(--text-primary);">${item.tip}</p>
        </div>
      </div>
    `;
    container.appendChild(div);
  });

  // Add the "what to improve first" note
  const noteDiv = document.createElement('div');
  noteDiv.className = 'info-box mt-6';
  noteDiv.innerHTML = `
    <strong>💡 What should I improve first?</strong><br>
    Focus on the first 1-2 suggestions. Small, targeted improvements give the biggest score gains.
    Use the <strong>Resume Doctor</strong> tab to fix problems step-by-step.
  `;
  container.appendChild(noteDiv);
}

// ============================================================
// TAB 4: SCORE BREAKDOWN (Explain My Score)
// ============================================================

function renderScoreBreakdown(data) {
  const cats = data.scores.categories;
  const container = document.getElementById('scoreBreakdownContainer');
  container.innerHTML = '';

  const icons = {
    formatting:   { emoji: '📐', bg: '#eef2ff' },
    keywords:     { emoji: '🔑', bg: '#fef3c7' },
    readability:  { emoji: '📖', bg: '#d1fae5' },
    structure:    { emoji: '🏗️', bg: '#dbeafe' },
    completeness: { emoji: '✅', bg: '#fce7f3' },
    job_relevance:{ emoji: '🎯', bg: '#f3f4f6' },
  };

  for (const [key, cat] of Object.entries(cats)) {
    const icon = icons[key] || { emoji: '📊', bg: '#f3f4f6' };

    const card = document.createElement('div');
    card.className = 'category-explain-card';

    const scoreColor = cat.percentage >= 75 ? '#10b981' : cat.percentage >= 60 ? '#f59e0b' : '#ef4444';

    card.innerHTML = `
      <div class="explain-header" onclick="toggleExplainCard(this)">
        <div class="explain-left">
          <div class="explain-icon" style="background:${icon.bg}; font-size:1.1rem;">
            ${icon.emoji}
          </div>
          <div>
            <div class="explain-title">${cat.label}</div>
            <div class="explain-subtitle">Weight: ${getWeight(key)} | Click to see why</div>
          </div>
        </div>
        <div style="display:flex; align-items:center; gap:12px;">
          <div class="progress-bar" style="width:100px;">
            <div class="progress-fill" style="background:${scoreColor}; width:${cat.percentage}%;"></div>
          </div>
          <span class="explain-score-badge">${cat.score}/${cat.max_score}</span>
          <span style="color:var(--text-muted); font-size:18px;">▾</span>
        </div>
      </div>
      <div class="explain-body">
        <ul class="explain-points">
          ${(cat.positive || []).map(p =>
            `<li><span class="icon-good">✓</span> ${p}</li>`).join('')}
          ${(cat.warnings || []).map(w =>
            `<li><span class="icon-warn">⚠</span> ${w}</li>`).join('')}
        </ul>
        ${(cat.tips && cat.tips.length > 0) ? `
          <div class="explain-recommendation">
            💡 ${cat.tips[0]}
          </div>
        ` : ''}
      </div>
    `;

    container.appendChild(card);
  }

  // Scoring formula info box
  const formula = document.createElement('div');
  formula.className = 'info-box mt-6';
  formula.innerHTML = `
    <strong>How is the score calculated?</strong><br>
    The total score is out of 100 points across 6 categories:<br>
    Formatting (20) + Keywords (25) + Readability (15) + Structure (15) + Completeness (15) + Job Relevance (10).
    <br>Each category uses simple rule-based checks — no AI or machine learning.
  `;
  container.appendChild(formula);
}

function getWeight(key) {
  const weights = {
    formatting:    '20%',
    keywords:      '25%',
    readability:   '15%',
    structure:     '15%',
    completeness:  '15%',
    job_relevance: '10%',
  };
  return weights[key] || '?';
}

function toggleExplainCard(header) {
  const body = header.nextElementSibling;
  body.classList.toggle('open');
}

// ============================================================
// TAB 5: RESUME DOCTOR
// ============================================================

const DOCTOR_FIXES = [
  {
    id: 'fix1',
    problem: 'Project description is too generic and lacks technical details.',
    before: '"Created a student management website."',
    after:  '"Developed a student management web application using Python (Flask) and MySQL to manage student records, attendance, and grades for 200+ students."',
    note:   'Only use this suggestion if it accurately describes your project. Do not add tools you did not use.',
    points: 5,
    breakdown: ['+2 Content clarity', '+2 Technical keywords', '+1 Job relevance'],
  },
  {
    id: 'fix2',
    problem: 'Resume is missing important data visualization skills (Power BI, Tableau).',
    before: 'Skills section only lists: Python, SQL, Excel.',
    after:  'Add to skills section: "Data Visualization (Matplotlib, Seaborn)" if you have used these tools in your projects.',
    note:   'Only add skills you genuinely have. Never add a skill you have not used.',
    points: 4,
    breakdown: ['+2 Keywords score', '+2 Job relevance'],
  },
  {
    id: 'fix3',
    problem: 'Bullet points lack strong action verbs.',
    before: '"Made a sales data analysis project using Python."',
    after:  '"Analyzed 5,000+ sales records using Python (Pandas, Matplotlib) to identify top-performing regions and visualize monthly trends."',
    note:   'Replace generic descriptions with specific outcomes. Only mention actual numbers from your own project.',
    points: 3,
    breakdown: ['+1 Readability', '+1 Content clarity', '+1 Job relevance'],
  },
];

function renderResumeDoctor(data) {
  const problems = data.scores.top_problems;
  const container = document.getElementById('problemListContainer');
  container.innerHTML = '';

  // Combine backend problems with our sample fix cards
  DOCTOR_FIXES.forEach((fix, i) => {
    const problemText = (problems && problems[i]) ? problems[i].tip : fix.problem;
    const priority = (i === 0) ? 'HIGH' : 'MEDIUM';

    const div = document.createElement('div');
    div.className = 'problem-card';
    div.id = `problem-card-${i}`;
    div.innerHTML = `
      <div class="problem-num">${i + 1}</div>
      <div class="problem-body">
        <div class="problem-category">${fix.id.toUpperCase()} • ${priority} PRIORITY</div>
        <div class="problem-text">${problemText}</div>
      </div>
      <div style="flex-shrink:0;">
        <button class="btn btn-sm btn-primary" onclick="openFixCard(${i})">
          🩺 Fix This
        </button>
      </div>
    `;
    container.appendChild(div);
  });

  // Fix cards (hidden initially)
  const fixContainer = document.getElementById('fixCardContainer');
  fixContainer.innerHTML = '';

  DOCTOR_FIXES.forEach((fix, i) => {
    const div = document.createElement('div');
    div.className = 'fix-card';
    div.id = `fix-card-${i}`;
    div.innerHTML = `
      <div class="fix-card-header">
        <span style="font-size:1.5rem;">🩺</span>
        <h4>Resume Doctor — Fix ${i + 1}</h4>
      </div>
      <p style="font-size:13px; color:var(--text-secondary); margin-bottom:16px;">
        <strong>Problem:</strong> "${fix.problem}"
      </p>
      <div class="before-after">
        <div class="before-box">
          <div class="box-label">BEFORE</div>
          <div class="box-content">${fix.before}</div>
        </div>
        <div class="after-box">
          <div class="box-label">SUGGESTED IMPROVEMENT</div>
          <div class="box-content">${fix.after}</div>
        </div>
      </div>
      <div class="fix-note">
        ⚠️ <strong>Important:</strong> ${fix.note}
      </div>
      <div class="fix-actions mt-4">
        <button class="btn btn-success btn-sm" onclick="acceptFix(${i})">✓ Accept</button>
        <button class="btn btn-secondary btn-sm" onclick="skipFix(${i})">Skip</button>
        <button class="btn btn-secondary btn-sm" onclick="closeFixCard(${i})">✕ Close</button>
      </div>
    `;
    fixContainer.appendChild(div);
  });

  // Before/After comparison section
  renderBeforeAfter();
}

function openFixCard(index) {
  // Close all fix cards first
  document.querySelectorAll('.fix-card').forEach(c => c.classList.remove('visible'));

  const card = document.getElementById(`fix-card-${index}`);
  if (card) {
    card.classList.add('visible');
    card.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function closeFixCard(index) {
  const card = document.getElementById(`fix-card-${index}`);
  if (card) card.classList.remove('visible');
}

/**
 * Accept a fix: update score, mark problem as solved, show before/after.
 */
function acceptFix(index) {
  const fix = DOCTOR_FIXES[index];

  if (acceptedFixes.includes(index)) {
    showToast('This fix has already been accepted!', 'error');
    return;
  }

  acceptedFixes.push(index);
  scoreGained += fix.points;

  // Update current score
  const newScore = Math.min(100, currentScore + fix.points);
  const oldScore = currentScore;
  currentScore = newScore;

  // Mark problem card as solved
  const problemCard = document.getElementById(`problem-card-${index}`);
  if (problemCard) {
    problemCard.classList.add('solved');
    problemCard.querySelector('.problem-text').innerHTML +=
      ' <span class="badge badge-success" style="margin-left:8px;">✓ Fixed</span>';
  }

  // Close fix card
  closeFixCard(index);

  // Animate score update
  animateScoreUpdate(oldScore, newScore, fix.points, fix.breakdown);

  // Update before/after comparison
  renderBeforeAfter();

  // Update header scores too
  document.getElementById('headerTotalScore').textContent = newScore;
  document.getElementById('scoreValue').textContent = newScore;
  const circle = document.getElementById('scoreCircle');
  if (circle) circle.style.setProperty('--pct', newScore);

  showToast(`+${fix.points} points! Score improved to ${newScore}/100 🎉`, 'success');
}

function skipFix(index) {
  closeFixCard(index);
  showToast('Fix skipped. You can come back to it anytime.', '');
}

function animateScoreUpdate(oldScore, newScore, points, breakdown) {
  const container = document.getElementById('scoreImprovement');
  if (!container) return;

  container.classList.remove('hidden');
  container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  const numEl = container.querySelector('.improvement-num');
  const labelEl = container.querySelector('.improvement-label');
  const breakdownEl = container.querySelector('.improvement-breakdown');

  // Animate number
  numEl.textContent = `+${scoreGained}`;
  numEl.style.animation = 'none';
  void numEl.offsetWidth; // Trigger reflow
  numEl.style.animation = 'countUp 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)';

  labelEl.textContent = `points gained — Score: ${oldScore} → ${newScore}`;

  breakdownEl.innerHTML = breakdown.map(item =>
    `<span class="improvement-item">${item}</span>`
  ).join('');
}

// Before/After comparison
function renderBeforeAfter() {
  const beforeList = document.getElementById('beforeList');
  const afterList  = document.getElementById('afterList');
  const beforeScore = document.getElementById('beforeScore');
  const afterScore  = document.getElementById('afterScore');
  const improveTxt  = document.getElementById('improvementText');

  const originalScore = currentAnalysis ? currentAnalysis.scores.total_score : 68;
  const afterScoreVal = currentScore;

  if (beforeScore) beforeScore.textContent = originalScore + '/100';
  if (afterScore)  afterScore.textContent  = afterScoreVal + '/100';

  if (beforeList) beforeList.innerHTML = `
    <li>❌ Generic project descriptions</li>
    <li>❌ Missing important keywords</li>
    <li>❌ Weak action verbs</li>
    <li>❌ Skills section could be stronger</li>
  `;

  if (afterList) {
    if (acceptedFixes.length === 0) {
      afterList.innerHTML = `<li class="text-muted">Accept fixes in Resume Doctor to see improvements.</li>`;
    } else {
      const improvements = [
        acceptedFixes.includes(0) ? '✓ Clearer project descriptions with technical tools' : null,
        acceptedFixes.includes(1) ? '✓ Better keyword coverage & skill relevance' : null,
        acceptedFixes.includes(2) ? '✓ Stronger action verbs and specific outcomes' : null,
      ].filter(Boolean);

      afterList.innerHTML = improvements.map(i => `<li>${i}</li>`).join('');

      if (improvements.length === 0) {
        afterList.innerHTML = `<li class="text-muted">Accept fixes to see improvements here.</li>`;
      }
    }
  }

  if (improveTxt && scoreGained > 0) {
    improveTxt.textContent = `Your resume improved by ${scoreGained} points! 🎉`;
    improveTxt.style.color = 'var(--success)';
  } else if (improveTxt) {
    improveTxt.textContent = 'Accept Resume Doctor fixes to see your score improve.';
  }
}

// ============================================================
// RESUME PREVIEW (in Overview tab)
// ============================================================

function renderResumePreview(data) {
  const preview = document.getElementById('resumePreviewBody');
  if (!preview) return;

  const sections = [
    { key: 'header',         label: 'Name & Contact',  icon: '👤' },
    { key: 'summary',        label: 'Summary',          icon: '📝' },
    { key: 'education',      label: 'Education',        icon: '🎓' },
    { key: 'skills',         label: 'Skills',           icon: '💡' },
    { key: 'projects',       label: 'Projects',         icon: '🔨' },
    { key: 'experience',     label: 'Experience',       icon: '💼' },
    { key: 'certifications', label: 'Certifications',   icon: '🏅' },
  ];

  const found   = data.sections_found || [];
  const preview_data = data.sections_preview || {};

  preview.innerHTML = sections.map(section => {
    const present = found.includes(section.key) || preview_data[section.key];
    const content = preview_data[section.key];

    // Determine status
    let statusClass = 'status-missing';
    let statusText  = '✕ Not Found';
    let statusIcon  = '❌';

    if (section.key === 'header' && preview_data.header) {
      statusClass = 'status-good';
      statusText  = '✓ Good';
      statusIcon  = '✓';
    } else if (present) {
      // Check if content is short (potential issue)
      const wordCount = content ? content.split(' ').length : 0;
      if (wordCount < 10) {
        statusClass = 'status-warning';
        statusText  = '⚠ Needs Improvement';
        statusIcon  = '⚠';
      } else {
        statusClass = 'status-good';
        statusText  = '✓ Good';
        statusIcon  = '✓';
      }
    }

    return `
      <div class="preview-section" title="${content || 'Section not found'}">
        <div class="preview-section-name">${section.icon} ${section.label}</div>
        <span class="preview-status ${statusClass}">${statusText}</span>
      </div>
    `;
  }).join('');
}

// ============================================================
// ============================================================
// HISTORY PAGE - DATABASE VERSION
// ============================================================

async function saveToHistory(data) {
  // Analysis is already saved by Flask/MySQL.
  // Just refresh the frontend history.
  try {
    await renderHistory();
  } catch (err) {
    console.error('History refresh error:', err);
  }
}


// Load history directly from MySQL through Flask API
async function renderHistory() {

  const container = document.getElementById('historyItems');
  const loading = document.getElementById('historyLoading');
  const stats = document.getElementById('historyStats');

  if (!container) return;

  if (loading) loading.style.display = 'flex';

  try {

    const response = await fetch('/history');
    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Unable to load history');
    }

    const history = result.history || [];

    if (loading) loading.style.display = 'none';

    // ------------------------------------------------------------
    // NO HISTORY
    // ------------------------------------------------------------

    if (history.length === 0) {

      container.innerHTML = `
        <div class="card text-center" style="padding:48px 24px;">

          <span style="font-size:3rem; display:block; margin-bottom:16px;">
            📋
          </span>

          <h3 style="font-weight:700; margin-bottom:8px;">
            No Analysis History Yet
          </h3>

          <p class="text-muted">
            Analyze a resume to start building your history.
          </p>

          <br>

          <button class="btn btn-primary"
                  onclick="showPage('upload')">
            📄 Analyze a Resume
          </button>

        </div>
      `;

      if (stats) stats.style.display = 'none';

      return;
    }


    // ------------------------------------------------------------
    // STATISTICS
    // ------------------------------------------------------------

    const scores = history
      .map(item => Number(item.resume_score))
      .filter(score => !isNaN(score));

    const total = history.length;

    const bestScore = scores.length
      ? Math.max(...scores)
      : 0;

    const avgScore = scores.length
      ? Math.round(
          scores.reduce((sum, score) => sum + score, 0)
          / scores.length
        )
      : 0;


    const totalEl = document.getElementById('historyTotal');
    const bestEl = document.getElementById('historyBestScore');
    const avgEl = document.getElementById('historyAvgScore');

    if (totalEl) totalEl.textContent = total;
    if (bestEl) bestEl.textContent = bestScore + '/100';
    if (avgEl) avgEl.textContent = avgScore + '/100';

    if (stats) stats.style.display = 'grid';


    // ------------------------------------------------------------
    // HISTORY CARDS
    // ------------------------------------------------------------

    container.innerHTML = history.map((entry) => {

      const score = Number(entry.resume_score || 0);
      const match = Number(entry.job_match_percentage || 0);

      let scoreClass = 'history-score-low';

      if (score >= 80) {
        scoreClass = 'history-score-high';
      } else if (score >= 60) {
        scoreClass = 'history-score-medium';
      }

      const health = entry.resume_score >= 80
        ? 'Excellent'
        : entry.resume_score >= 60
          ? 'Good'
          : 'Needs Improvement';

      const uploadDate = entry.upload_date
        ? new Date(entry.upload_date).toLocaleString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })
        : 'N/A';


      return `
        <div class="history-db-card">

          <div class="history-db-main">

            <div class="history-file-icon">
              📄
            </div>

            <div class="history-db-info">

              <h3>
                ${escapeHtml(entry.file_name || 'Resume')}
              </h3>

              <p class="history-candidate">
                👤 ${escapeHtml(entry.candidate_name || 'Candidate')}
              </p>

              <p class="history-date">
                📅 ${uploadDate}
              </p>

            </div>

          </div>


          <div class="history-db-scores">

            <div class="history-score-box">
              <span class="score-label">
                Resume Score
              </span>

              <span class="history-score ${scoreClass}">
                ${score}/100
              </span>
            </div>


            <div class="history-score-box">
              <span class="score-label">
                JD Match
              </span>

              <span class="history-match">
                ${match}%
              </span>
            </div>


            <span class="badge badge-primary">
              ${health}
            </span>


            <button
              class="btn btn-primary btn-sm"
              onclick="viewHistoryDetails(${entry.id})">

              👁 View Details

            </button>

          </div>

        </div>
      `;

    }).join('');


  } catch (error) {

    console.error('History loading error:', error);

    if (loading) loading.style.display = 'none';

    container.innerHTML = `
      <div class="card text-center"
           style="padding:48px 24px;">

        <span style="font-size:3rem;">
          ⚠️
        </span>

        <h3 style="margin:16px 0 8px;">
          Could Not Load History
        </h3>

        <p class="text-muted">
          ${escapeHtml(error.message)}
        </p>

        <br>

        <button
          class="btn btn-primary"
          onclick="renderHistory()">

          🔄 Try Again

        </button>

      </div>
    `;

    if (stats) stats.style.display = 'none';
  }
}


// ============================================================
// VIEW SINGLE HISTORY RECORD
// ============================================================

async function viewHistoryDetails(resumeId) {

  const modal = document.getElementById('historyDetailModal');
  const body = document.getElementById('historyDetailBody');

  if (!modal || !body) return;

  modal.classList.add('show');

  body.innerHTML = `
    <div class="history-detail-loading">
      <div class="loading-spinner"></div>
      <p>Loading analysis details...</p>
    </div>
  `;


  try {

    const response = await fetch(`/history/${resumeId}`);
    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Unable to load details');
    }

    const data = result.data;

    document.getElementById('detailFileName').textContent =
      data.file_name || 'Resume';


    const matchedSkills = parseHistoryArray(data.matched_skills);
    const missingSkills = parseHistoryArray(data.missing_skills);
    const strongAreas = parseHistoryArray(data.strong_areas);
    const weakAreas = parseHistoryArray(data.weak_areas);


    body.innerHTML = `

      <div class="history-detail-grid">

        <div class="history-detail-card">
          <span class="detail-icon">🏆</span>
          <span class="detail-label">Resume Score</span>
          <strong class="detail-value">
            ${data.resume_score || 0}/100
          </strong>
        </div>

        <div class="history-detail-card">
          <span class="detail-icon">📊</span>
          <span class="detail-label">JD Match</span>
          <strong class="detail-value">
            ${data.job_match_percentage || 0}%
          </strong>
        </div>

        <div class="history-detail-card">
          <span class="detail-icon">👤</span>
          <span class="detail-label">Candidate</span>
          <strong class="detail-value small">
            ${escapeHtml(data.candidate_name || 'N/A')}
          </strong>
        </div>

        <div class="history-detail-card">
          <span class="detail-icon">📅</span>
          <span class="detail-label">Uploaded</span>
          <strong class="detail-value small">
            ${data.upload_date
              ? new Date(data.upload_date).toLocaleString('en-IN')
              : 'N/A'}
          </strong>
        </div>

      </div>


      <div class="history-detail-section">

        <h4>📧 Contact Information</h4>

        <p>
          <strong>Email:</strong>
          ${escapeHtml(data.email || 'Not available')}
        </p>

        <p>
          <strong>Phone:</strong>
          ${escapeHtml(data.phone || 'Not available')}
        </p>

      </div>


      <div class="history-detail-section">

        <h4>✅ Matched Skills</h4>

        <div class="history-skill-list">
          ${
            matchedSkills.length
              ? matchedSkills.map(skill =>
                  `<span class="skill-pill matched">✓ ${escapeHtml(skill)}</span>`
                ).join('')
              : '<span class="text-muted">No matched skills stored.</span>'
          }
        </div>

      </div>


      <div class="history-detail-section">

        <h4>⚠️ Missing Skills</h4>

        <div class="history-skill-list">
          ${
            missingSkills.length
              ? missingSkills.map(skill =>
                  `<span class="skill-pill missing">⚠ ${escapeHtml(skill)}</span>`
                ).join('')
              : '<span class="text-muted">No missing skills stored.</span>'
          }
        </div>

      </div>


      <div class="history-detail-two-column">

        <div class="history-detail-section">
          <h4>💪 Strong Areas</h4>

          <ul>
            ${
              strongAreas.length
                ? strongAreas.map(area =>
                    `<li>✓ ${escapeHtml(area)}</li>`
                  ).join('')
                : '<li class="text-muted">None stored</li>'
            }
          </ul>
        </div>


        <div class="history-detail-section">
          <h4>🔧 Weak Areas</h4>

          <ul>
            ${
              weakAreas.length
                ? weakAreas.map(area =>
                    `<li>⚠ ${escapeHtml(area)}</li>`
                  ).join('')
                : '<li class="text-muted">None stored</li>'
            }
          </ul>
        </div>

      </div>

    `;

  } catch (error) {

    console.error('History detail error:', error);

    body.innerHTML = `
      <div class="card text-center">
        <h3>⚠️ Unable to Load Details</h3>
        <p class="text-muted">
          ${escapeHtml(error.message)}
        </p>
      </div>
    `;
  }
}


// ============================================================
// CLOSE HISTORY DETAIL MODAL
// ============================================================

function closeHistoryDetails() {

  const modal = document.getElementById('historyDetailModal');

  if (modal) {
    modal.classList.remove('show');
  }
}


// Close modal when clicking outside
document.addEventListener('click', function(event) {

  const modal = document.getElementById('historyDetailModal');

  if (event.target === modal) {
    closeHistoryDetails();
  }

});


// ============================================================
// HELPER FUNCTIONS
// ============================================================

function parseHistoryArray(value) {

  if (!value) return [];

  if (Array.isArray(value)) {
    return value;
  }

  try {

    const parsed = JSON.parse(value);

    if (Array.isArray(parsed)) {
      return parsed;
    }

    return [String(parsed)];

  } catch (error) {

    return String(value)
      .split(',')
      .map(item => item.trim())
      .filter(Boolean);

  }
}


function escapeHtml(value) {

  const div = document.createElement('div');

  div.textContent = value == null ? '' : String(value);

  return div.innerHTML;
}

// ============================================================
// SETTINGS PAGE
// ============================================================

function loadSettings() {
  const settings = JSON.parse(localStorage.getItem('resumeSettings') || '{}');

  const nameEl   = document.getElementById('settingName');
  const emailEl  = document.getElementById('settingEmail');
  const roleEl   = document.getElementById('settingRole');
  const levelEl  = document.getElementById('settingLevel');

  if (nameEl)  nameEl.value  = settings.name  || '';
  if (emailEl) emailEl.value = settings.email || '';
  if (roleEl)  roleEl.value  = settings.role  || 'Data Analyst';
  if (levelEl) levelEl.value = settings.level || 'Student/Fresher';

  const checks = ['showExplanations', 'showSkillGap', 'showSuggestions'];
  checks.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.checked = settings[id] !== false; // Default true
  });
}

function saveSettings() {
  const settings = {
    name:             document.getElementById('settingName')?.value || '',
    email:            document.getElementById('settingEmail')?.value || '',
    role:             document.getElementById('settingRole')?.value || '',
    level:            document.getElementById('settingLevel')?.value || '',
    showExplanations: document.getElementById('showExplanations')?.checked ?? true,
    showSkillGap:     document.getElementById('showSkillGap')?.checked ?? true,
    showSuggestions:  document.getElementById('showSuggestions')?.checked ?? true,
  };

  localStorage.setItem('resumeSettings', JSON.stringify(settings));
  showToast('Settings saved successfully!', 'success');
}

function clearHistory() {
  if (confirm('Are you sure you want to clear all history?')) {
    localStorage.removeItem('resumeHistory');
    renderHistory();
    showToast('History cleared.', '');
  }
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/** Switch between result tabs */
function switchTab(tabId) {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });
  document.querySelectorAll('.tab-panel').forEach(panel => {
    panel.classList.toggle('active', panel.id === 'tab-' + tabId);
  });

  // Re-render radar chart when skill match tab opens (fixes canvas sizing issue)
  if (tabId === 'skill-match' && currentAnalysis) {
    setTimeout(() => renderRadarChart(currentAnalysis.radar), 100);
  }
}

/** Animate progress bars by setting width from data-width attribute */
function animateProgressBars() {
  document.querySelectorAll('.progress-fill[data-width]').forEach(el => {
    const width = el.getAttribute('data-width');
    el.style.width = width + '%';
  });
}

/** Animate a number counter from start to end */
function animateCounter(elementId, start, end, duration) {
  const el = document.getElementById(elementId);
  if (!el) return;

  const startTime = performance.now();

  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    // Ease out
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(start + (end - start) * eased);
    el.textContent = current;

    if (progress < 1) requestAnimationFrame(update);
  }

  requestAnimationFrame(update);
}

/** Show a toast notification */
function showToast(message, type = '') {
  let toast = document.getElementById('globalToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'globalToast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }

  toast.className = `toast ${type}`;
  toast.innerHTML = `${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'} ${message}`;
  toast.classList.add('show');

  setTimeout(() => toast.classList.remove('show'), 3500);
}

// ============================================================
// INITIALIZATION
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  // Set up navigation links
  document.querySelectorAll('[data-page]').forEach(el => {
    el.addEventListener('click', e => {
      e.preventDefault();
      showPage(el.dataset.page);
    });
  });

  // Initialize the upload page drag/drop
  initUploadPage();

  // Show landing page by default
  showPage('landing');

  // Load settings if available
  loadSettings();
});
