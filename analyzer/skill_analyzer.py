# analyzer/skill_analyzer.py
# Maps detected resume skills to radar chart categories.
# The radar chart ("Skill Gap Radar") needs 6 axes.
# This module assigns a score (0-10) for each axis based on skills found.

# ---------------------------------------------------------------------------
# RADAR CHART CATEGORIES
# Each category has a list of skills that contribute to it.
# We check how many skills in each category are in the resume.
# ---------------------------------------------------------------------------

RADAR_CATEGORIES = {
    'Python': [
        'python', 'django', 'flask', 'fastapi', 'pandas', 'numpy', 'scipy',
    ],
    'SQL & Databases': [
        'sql', 'mysql', 'postgresql', 'sqlite', 'mongodb', 'database', 'oracle',
    ],
    'Machine Learning': [
        'machine learning', 'scikit-learn', 'sklearn', 'xgboost', 'random forest',
        'deep learning', 'neural network', 'tensorflow', 'keras', 'pytorch',
        'linear regression', 'logistic regression', 'decision tree',
    ],
    'Data Visualization': [
        'matplotlib', 'seaborn', 'plotly', 'tableau', 'power bi', 'powerbi',
        'data visualization', 'looker', 'qlik', 'excel charts',
    ],
    'Statistics': [
        'statistics', 'statistical analysis', 'probability', 'hypothesis testing',
        'regression', 'a/b testing', 'descriptive statistics', 'r',
    ],
    'Tools & DevOps': [
        'git', 'github', 'docker', 'linux', 'aws', 'azure', 'google cloud',
        'jupyter', 'jupyter notebook', 'vs code', 'jira', 'excel',
    ],
}


def compute_radar_scores(resume_skills_set, jd_skills_set=None):
    """
    For each radar category, compute:
    - candidate_score (0-10): based on how many skills in that category are in the resume
    - required_score (0-10): based on how many skills in that category are in the JD

    If no JD is provided, required_score defaults to 8 for all categories
    (representing a generic "expected level" for a data science role).

    Parameters:
    - resume_skills_set: set of skills found in the resume
    - jd_skills_set:     set of skills found in the JD (can be None)

    Returns: dict with category scores for Chart.js
    """
    labels = []
    candidate_scores = []
    required_scores = []

    for category, skills_in_category in RADAR_CATEGORIES.items():
        labels.append(category)

        # Count how many skills in this category appear in the resume
        resume_count = sum(1 for s in skills_in_category if s in resume_skills_set)
        # Normalize to 0-10 scale
        candidate_score = min(10, int((resume_count / max(len(skills_in_category), 1)) * 10 * 2.5))

        # Required score from JD (if provided)
        if jd_skills_set:
            jd_count = sum(1 for s in skills_in_category if s in jd_skills_set)
            required_score = min(10, int((jd_count / max(len(skills_in_category), 1)) * 10 * 2.5))
            # Minimum required score is 5 if JD has any skills in this category
            if jd_count > 0 and required_score < 5:
                required_score = 5
        else:
            # Default: all categories expected at 7/10 for a data science role
            required_score = 7

        candidate_scores.append(candidate_score)
        required_scores.append(required_score)

    return {
        'labels':           labels,
        'candidate_scores': candidate_scores,
        'required_scores':  required_scores,
    }


def get_strong_and_weak_areas(candidate_scores, labels):
    """
    Based on the radar scores, identify strong and weak areas.

    Strong: candidate_score >= 6
    Weak:   candidate_score < 6

    Returns:
    - strong_areas: list of label strings
    - weak_areas:   list of label strings
    """
    strong_areas = []
    weak_areas   = []

    for label, score in zip(labels, candidate_scores):
        if score >= 6:
            strong_areas.append(label)
        else:
            weak_areas.append(label)

    return strong_areas, weak_areas
