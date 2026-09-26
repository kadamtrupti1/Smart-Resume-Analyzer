# Smart Resume Analyzer
### 2nd Year B.Tech Computer Science & Engineering (Data Science) — Academic Project

---

## Project Objective

Smart Resume Analyzer is a web application that helps students and job seekers:

- Understand **how strong** their resume is
- Know **how well** their resume matches a specific Job Description
- Identify **missing skills** and keyword gaps
- Understand **why** their resume received a particular score
- Fix resume problems using the **Resume Doctor**
- Watch their score **improve in real time**
- Compare **Before vs After** improvement

---

## Why Our Project Is Different

Most resume analyzers only give you a score and stop there.

**Our project combines:**

| Feature | Description |
|---|---|
| Resume Analysis | Parse PDF/DOCX, detect sections, extract skills |
| Score Explanation | Click any category to see exactly why you got that score |
| Skill Gap Radar | Interactive radar chart comparing your skills vs job requirements |
| Gamified Health | Bronze / Silver / Gold resume level with animated progress bars |
| Resume Doctor | Step-by-step interactive fix flow with Before/After improvement |
| Score Animation | Watch your score increase in real time as you accept fixes |
| Demo Mode | Complete demo without uploading any file |
| History Tracking | Track score improvements over multiple analyses |

This combination is designed specifically for **students** preparing for internships and placements.

---

## Features

1. **Resume Upload** — PDF and DOCX, max 5 MB
2. **Text Extraction** — Using pdfplumber (PDF) and python-docx (DOCX)
3. **Section Detection** — Skills, Education, Experience, Projects, Certifications
4. **Job Description Matching** — Paste JD to get keyword match analysis
5. **Resume Score (out of 100)** — 6 weighted categories
6. **Explain My Score** — Click any category for detailed explanation
7. **Skill Gap Radar** — Chart.js radar comparing candidate vs required skills
8. **Resume Health** — 🥉 Bronze / 🥈 Silver / 🥇 Gold levels
9. **Resume Doctor** — Fix top 3 problems with Before/After cards
10. **Score Improvement** — Watch score increase after accepting fixes
11. **Before vs After Comparison** — Side-by-side comparison card
12. **Demo Mode** — Full demo with sample data, no file upload needed
13. **Analysis History** — Track progress over time (localStorage)
14. **Settings Page** — Profile, target role, experience level, preferences

---

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | HTML5, CSS3, JavaScript (Vanilla) |
| Backend | Python 3, Flask |
| PDF Parsing | pdfplumber, PyPDF2 (fallback) |
| DOCX Parsing | python-docx |
| NLP | Rule-based keyword matching (no ML needed) |
| Charts | Chart.js (Radar Chart, Line Chart) |
| Storage | localStorage (History, Settings) |

---

## Folder Structure

```
smart-resume-analyzer/
│
├── app.py                    # Flask main application (routes + API)
├── requirements.txt          # Python dependencies
├── README.md                 # This file
│
├── templates/
│   └── index.html            # Single-Page Application (SPA) — all pages
│
├── static/
│   ├── css/
│   │   └── style.css         # Design system + all styles
│   └── js/
│       └── app.js            # All frontend logic + Chart.js
│
├── uploads/                  # Temporary uploaded resume storage
│
├── parser/
│   └── resume_parser.py      # PDF + DOCX extraction + section detection
│
├── analyzer/
│   ├── keyword_matcher.py    # JD vs Resume keyword comparison
│   ├── resume_scorer.py      # Weighted scoring (6 categories)
│   └── skill_analyzer.py     # Skill radar chart data computation
│
└── utils/
    └── helpers.py            # File validation, text cleaning utilities
```

---

## How Resume Parsing Works

**Step 1:** Detect file type (PDF or DOCX)

**Step 2:** Extract text
- PDF → `pdfplumber` (or `PyPDF2` fallback)
- DOCX → `python-docx` paragraph extraction

**Step 3:** Clean text (remove extra spaces, normalize)

**Step 4:** Detect sections using heading keyword matching
```python
SECTION_KEYWORDS = {
    'skills':    ['skills', 'technical skills', 'core skills'],
    'education': ['education', 'academic background'],
    'projects':  ['projects', 'academic projects'],
    ...
}
```
No AI — just simple string matching on each line.

**Step 5:** Extract name, email, phone using regex patterns

---

## How Keyword Matching Works

We use a predefined dictionary of **70+ tech skills** (Python, SQL, Tableau, etc.)

**Step 1:** Check which skills from the dictionary appear in the resume text

**Step 2:** Check which skills from the dictionary appear in the JD text

**Step 3:** Intersection = Matched Skills

**Step 4:** JD skills minus Resume skills = Missing Skills

**Match Formula:**
```
Match % = (Matched Skills / Total JD Skills) × 100
```

Simple, understandable, easy to explain.

---

## How Scoring Works

We use a **weighted scoring system** with 6 categories:

| Category | Weight | Max Points | What is checked |
|---|---|---|---|
| Formatting | 20% | 20 | Word count, bullet points, structure |
| Keywords | 25% | 25 | Tech skills detected, JD match |
| Readability | 15% | 15 | Action verbs, sentence length |
| Structure | 15% | 15 | Sections present (Skills, Education, Projects) |
| Completeness | 15% | 15 | Email, phone, content depth |
| Job Relevance | 10% | 10 | JD match percentage |
| **TOTAL** | **100%** | **100** | |

All checks are rule-based — no machine learning.

---

## How Skill Gap Radar Works

We define **6 radar axes** (categories):
- Python
- SQL & Databases
- Machine Learning
- Data Visualization
- Statistics
- Tools & DevOps

For each axis:
- **Candidate Score (0-10):** Based on skills from that category found in the resume
- **Required Score (0-10):** Based on skills from that category found in the JD

Chart.js renders a radar chart with two datasets.

The gap between the lines shows where improvement is needed.

---

## How Resume Health Works

After scoring, we assign a level:

| Score | Level | Badge |
|---|---|---|
| 80–100 | Gold | 🥇 |
| 50–79 | Silver | 🥈 |
| 0–49 | Bronze | 🥉 |

Each category also shows a short friendly tip.

---

## How "Explain My Score" Works

Each scoring category generates:
- **Positive points** — what was done well
- **Warning points** — what is lacking
- **Recommendation tip** — a single actionable suggestion

In the UI, clicking a category opens a panel showing all of this.

---

## How Resume Doctor Works

1. Backend identifies top 3 problem areas (sorted by score impact)
2. Frontend shows 3 problem cards
3. User clicks "Fix This" → Before/After card slides open
4. User clicks "Accept" → Score animates upward, problem marked solved
5. Before vs After comparison updates

**Important:** No fake information is ever generated.
The suggestions only improve wording based on existing content.
A note always says: *"Only add information that is true about your experience."*

---

## Installation Steps

### Prerequisites
- Python 3.8 or higher
- pip

### Step 1: Clone or download the project

```bash
cd "d:\resume analyzer(adv)"
```

### Step 2: Install dependencies

```bash
pip install -r requirements.txt
```

### Step 3: Run the Flask application

```bash
python app.py
```

### Step 4: Open in browser

```
http://127.0.0.1:5000
```

---

## Running the Application

```
python app.py
```

Expected output:
```
=======================================================
  Smart Resume Analyzer - Flask Backend
  2nd Year B.Tech CSE-DS Academic Project
=======================================================
  Upload folder: D:\resume analyzer(adv)\uploads
  Open http://127.0.0.1:5000 in your browser
=======================================================
 * Running on http://127.0.0.1:5000
```

---

## Demo Mode

Click "Try Demo" button on the landing page.

The demo:
- Uses a pre-built sample resume (Priya Sharma, B.Tech CSE-DS)
- Applies for a Data Analyst role
- Shows a score of 68/100
- Demonstrates all 5 result tabs
- Resume Doctor has 3 fixable problems
- Accepting fixes raises score to ~80/100
- Before vs After comparison is shown

**No file upload needed for the demo.**

---

## Future Improvements

1. User authentication and persistent database storage
2. ATS (Applicant Tracking System) compatibility check
3. Resume template generator based on suggestions
4. Support for more file formats (ODT, TXT)
5. LinkedIn profile import
6. Industry-specific skill dictionaries
7. Cover letter analyzer
8. Multiple JD comparison (apply to multiple roles)

---

## Important Note on Accuracy

This system **never** generates fake information.

It does not:
- Invent achievements or percentages
- Add fake companies or certifications
- Create fake work experience

Suggestions are limited to wording improvements based on content already in the resume.

---

## Project Team

- **Project Type:** Academic Project
- **Course:** B.Tech CSE (Data Science), 2nd Year
- **Subject:** Data Analytics / Web Application Development
- **Technologies:** Python, Flask, HTML, CSS, JavaScript, Chart.js
