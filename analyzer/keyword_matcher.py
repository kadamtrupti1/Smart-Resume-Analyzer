# analyzer/keyword_matcher.py
# Compares resume content with Job Description (JD) keywords.
# Uses simple keyword/skill matching — no machine learning needed.
# This is easy to understand and explain during a viva.

import re

# ---------------------------------------------------------------------------
# TECH SKILL DICTIONARY
# A comprehensive list of common technical skills organized by category.
# We use this to identify skills in both the resume and JD.
# ---------------------------------------------------------------------------

TECH_SKILLS = {
    # Programming Languages
    'python', 'java', 'javascript', 'c++', 'c', 'r', 'scala', 'kotlin',
    'swift', 'go', 'ruby', 'php', 'typescript', 'matlab', 'julia',

    # Web Development
    'html', 'css', 'react', 'angular', 'vue', 'node.js', 'nodejs', 'express',
    'django', 'flask', 'fastapi', 'bootstrap', 'jquery', 'rest api', 'restful',
    'graphql', 'spring', 'spring boot',

    # Data Science & ML
    'machine learning', 'deep learning', 'neural network', 'nlp',
    'natural language processing', 'computer vision', 'data science',
    'data analysis', 'data analytics', 'pandas', 'numpy', 'scikit-learn',
    'sklearn', 'tensorflow', 'keras', 'pytorch', 'xgboost', 'random forest',
    'linear regression', 'logistic regression', 'decision tree',

    # Data Visualization
    'matplotlib', 'seaborn', 'plotly', 'tableau', 'power bi', 'powerbi',
    'data visualization', 'looker', 'qlik', 'excel charts',

    # Databases
    'sql', 'mysql', 'postgresql', 'sqlite', 'mongodb', 'redis', 'cassandra',
    'oracle', 'nosql', 'database', 'db2',

    # Cloud & DevOps
    'aws', 'azure', 'google cloud', 'gcp', 'docker', 'kubernetes',
    'jenkins', 'ci/cd', 'linux', 'git', 'github', 'gitlab', 'bitbucket',

    # Data Engineering
    'hadoop', 'spark', 'kafka', 'airflow', 'etl', 'data pipeline',
    'data warehouse', 'snowflake', 'dbt',

    # Statistics & Math
    'statistics', 'statistical analysis', 'probability', 'hypothesis testing',
    'regression', 'classification', 'clustering', 'a/b testing',

    # Productivity & Tools
    'excel', 'microsoft office', 'jupyter', 'jupyter notebook', 'google colab',
    'vs code', 'pycharm', 'postman', 'jira', 'confluence', 'slack',

    # Soft Skills (for general matching)
    'communication', 'teamwork', 'leadership', 'problem solving',
    'project management', 'agile', 'scrum', 'critical thinking',
}


# ---------------------------------------------------------------------------
# HELPER: Extract skills from text
# ---------------------------------------------------------------------------

def extract_skills_from_text(text):
    """
    Find which skills from our TECH_SKILLS dictionary appear in the given text.

    Approach:
    1. Lowercase the text
    2. Check for each known skill as a substring
    3. Return the set of found skills

    Returns: set of skill strings found in text
    """
    text_lower = text.lower()
    found = set()

    for skill in TECH_SKILLS:
        # Use word-boundary-like check: skill should appear as a standalone word
        # We use a simple pattern: skill surrounded by non-alphanumeric or start/end
        pattern = r'(?<![a-z0-9])' + re.escape(skill) + r'(?![a-z0-9])'
        if re.search(pattern, text_lower):
            found.add(skill)

    return found


# ---------------------------------------------------------------------------
# HELPER: Tokenize text for general keyword matching (beyond skill dict)
# ---------------------------------------------------------------------------

# Common English stop words to ignore
STOP_WORDS = {
    'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'is', 'was', 'are', 'were', 'be', 'been',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'shall', 'can', 'not', 'no', 'nor', 'so',
    'as', 'if', 'then', 'than', 'that', 'this', 'these', 'those', 'we',
    'you', 'he', 'she', 'it', 'they', 'their', 'our', 'your', 'its',
    'use', 'using', 'used', 'work', 'working', 'good', 'well', 'able',
    'need', 'require', 'required', 'must', 'also', 'strong', 'experience',
    'knowledge', 'understanding', 'background', 'year', 'years',
}


def extract_keywords_from_jd(jd_text):
    """
    Extract important keywords from the Job Description text.

    Approach:
    1. First extract known tech skills
    2. Also extract other important words (remove stop words, short words)

    Returns: dict with:
      - 'skills': set of tech skills found
      - 'keywords': set of general important keywords
    """
    # Extract tech skills
    skills = extract_skills_from_text(jd_text)

    # General keyword extraction (for words not in our skill dict)
    jd_lower = jd_text.lower()
    # Remove punctuation
    jd_clean = re.sub(r'[^a-z0-9\s\-]', ' ', jd_lower)
    tokens = jd_clean.split()

    # Filter: keep tokens that are meaningful
    keywords = set()
    for token in tokens:
        token = token.strip('-').strip()
        if len(token) >= 3 and token not in STOP_WORDS:
            keywords.add(token)

    return {
        'skills':   skills,
        'keywords': keywords,
    }


# ---------------------------------------------------------------------------
# MAIN MATCHING FUNCTION
# ---------------------------------------------------------------------------

def match_resume_with_jd(resume_text, jd_text):
    """
    Compare the resume text with the Job Description text.

    Steps:
    1. Extract skills from resume
    2. Extract skills required in JD
    3. Find matched and missing skills
    4. Calculate match percentage

    Formula for match percentage:
        match% = (matched_skills / total_jd_skills) * 100

    Returns: dict with full match analysis
    """
    if not jd_text or not jd_text.strip():
        # No JD provided — return empty analysis
        return {
            'jd_provided': False,
            'match_percentage': 0,
            'matched_skills': [],
            'missing_skills': [],
            'jd_skills': [],
            'resume_skills': [],
            'priority_missing': [],
        }

    # Step 1: Extract skills from both texts
    resume_skills = extract_skills_from_text(resume_text)
    jd_extracted  = extract_keywords_from_jd(jd_text)
    jd_skills     = jd_extracted['skills']

    # Step 2: Find matches and gaps
    matched_skills = sorted(list(resume_skills & jd_skills))  # Intersection
    missing_skills = sorted(list(jd_skills - resume_skills))  # In JD but not resume

    # Step 3: Calculate match percentage
    if len(jd_skills) > 0:
        match_pct = int((len(matched_skills) / len(jd_skills)) * 100)
        match_pct = min(100, match_pct)  # Cap at 100
    else:
        match_pct = 50  # If JD has no recognized skills, give neutral score

    # Step 4: Prioritize missing skills
    # HIGH priority: core programming / data skills
    high_priority_skills = {
        'python', 'sql', 'machine learning', 'deep learning', 'data analysis',
        'java', 'r', 'tableau', 'power bi', 'excel', 'tensorflow', 'pytorch',
    }
    medium_priority_skills = {
        'pandas', 'numpy', 'scikit-learn', 'matplotlib', 'statistics',
        'mysql', 'postgresql', 'mongodb', 'git', 'github', 'docker',
    }

    priority_missing = []
    for skill in missing_skills:
        if skill in high_priority_skills:
            priority = 'HIGH'
        elif skill in medium_priority_skills:
            priority = 'MEDIUM'
        else:
            priority = 'LOW'
        priority_missing.append({'skill': skill, 'priority': priority})

    # Sort: HIGH first, then MEDIUM, then LOW
    priority_order = {'HIGH': 0, 'MEDIUM': 1, 'LOW': 2}
    priority_missing.sort(key=lambda x: priority_order[x['priority']])

    return {
        'jd_provided':       True,
        'match_percentage':  match_pct,
        'matched_skills':    matched_skills,
        'missing_skills':    missing_skills,
        'jd_skills':         sorted(list(jd_skills)),
        'resume_skills':     sorted(list(resume_skills)),
        'priority_missing':  priority_missing,
    }
