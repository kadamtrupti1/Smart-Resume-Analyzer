# analyzer/resume_scorer.py
# Calculates the overall resume score using a weighted system.
#
# SCORING FORMULA (total = 100 points):
# -----------------------------------------------
# Category          Weight   Max Points
# -----------------------------------------------
# Formatting          20%       20
# Keywords            25%       25
# Readability         15%       15
# Structure           15%       15
# Completeness        15%       15
# Job Relevance       10%       10
# -----------------------------------------------
# TOTAL              100%      100
# -----------------------------------------------
#
# Each category is scored by checking simple rule-based conditions.
# This is easy to understand, explain, and modify.

import re

# ---------------------------------------------------------------------------
# SCORING FUNCTIONS — one function per category
# ---------------------------------------------------------------------------

def score_formatting(raw_text, word_count):
    """
    FORMATTING SCORE (max 20 points)

    Checks:
    - Appropriate word count (300-800 words for fresher resume)
    - No very long lines (sign of bad formatting)
    - Consistent use of bullet points or structured lines
    - Not too short (less than 150 words is a red flag)

    Returns: (score, explanation_list, tips_list)
    """
    score = 20
    explanations = []
    tips = []

    # Check 1: Word count
    if word_count < 150:
        score -= 8
        explanations.append("Resume is too short (under 150 words). Needs more content.")
        tips.append("Add more details to your experience, projects and skills sections.")
    elif word_count < 300:
        score -= 4
        explanations.append("Resume is a bit short. Consider adding more project or experience details.")
        tips.append("Try to reach at least 300 words for a stronger resume.")
    elif word_count > 1000:
        score -= 3
        explanations.append("Resume may be too long. Aim for 1 page (500-700 words) as a fresher.")
        tips.append("Keep your resume concise. Remove irrelevant content.")
    else:
        explanations.append("Good resume length for a fresher-level resume.")

    # Check 2: Presence of bullet points or structured lines (hyphens, dashes)
    bullet_count = len(re.findall(r'[\-•▪▸►●*]\s+\w', raw_text))
    if bullet_count >= 5:
        explanations.append("Good use of bullet points for structured presentation.")
    else:
        score -= 4
        tips.append("Use bullet points to organize your experience and projects clearly.")
        explanations.append("Very few bullet points detected. Resume may lack structure.")

    # Check 3: No excessive uppercase lines (sign of shouting/poor formatting)
    uppercase_lines = len([l for l in raw_text.split('\n') if l.strip().isupper() and len(l.strip()) > 5])
    if uppercase_lines > 5:
        score -= 3
        explanations.append("Too many fully capitalized lines. Use title case for headings.")
        tips.append("Use Title Case for section headings instead of ALL CAPS.")

    score = max(0, min(20, score))

    positive = [e for e in explanations if 'Good' in e or 'good' in e]
    warnings  = [e for e in explanations if 'Good' not in e and 'good' not in e]

    return {
        'score':      score,
        'max_score':  20,
        'percentage': int((score / 20) * 100),
        'positive':   positive,
        'warnings':   warnings,
        'tips':       tips,
        'label':      'Formatting',
    }


def score_keywords(resume_text, resume_skills, jd_match_data):
    """
    KEYWORDS SCORE (max 25 points)

    Checks:
    - How many technical skills found in resume
    - How well the resume matches the JD keywords

    Returns: (score, explanation_list, tips_list)
    """
    explanations = []
    tips = []

    # Base score from number of skills detected
    skill_count = len(resume_skills)
    if skill_count >= 10:
        base_score = 18
        explanations.append(f"Excellent! {skill_count} technical skills detected in your resume.")
    elif skill_count >= 6:
        base_score = 14
        explanations.append(f"Good. {skill_count} technical skills found in your resume.")
    elif skill_count >= 3:
        base_score = 10
        explanations.append(f"{skill_count} technical skills found. Consider adding more relevant skills.")
        tips.append("Add more relevant technical skills you actually know.")
    else:
        base_score = 5
        explanations.append("Very few technical skills detected. This is a critical area to improve.")
        tips.append("Add a dedicated Skills section listing technologies you know.")

    # Bonus from JD match (if JD provided)
    jd_bonus = 0
    if jd_match_data.get('jd_provided', False):
        match_pct = jd_match_data.get('match_percentage', 0)
        matched   = jd_match_data.get('matched_skills', [])
        missing   = jd_match_data.get('missing_skills', [])

        if match_pct >= 70:
            jd_bonus = 7
            explanations.append(f"Great job match! {match_pct}% of JD keywords found in your resume.")
        elif match_pct >= 50:
            jd_bonus = 4
            explanations.append(f"Decent job match. {match_pct}% of JD keywords found.")
            if missing:
                tips.append(f"Consider adding: {', '.join(missing[:3])} if you know these.")
        else:
            jd_bonus = 1
            explanations.append(f"Low job match ({match_pct}%). Many JD skills are missing from your resume.")
            if missing:
                tips.append(f"High priority skills to add: {', '.join(missing[:3])}")

        if matched:
            explanations.append(f"Matched skills: {', '.join(matched[:5])}")
    else:
        jd_bonus = 3  # Neutral bonus when no JD provided
        tips.append("Paste a Job Description for a more accurate keyword analysis.")

    score = min(25, base_score + jd_bonus)

    return {
        'score':      score,
        'max_score':  25,
        'percentage': int((score / 25) * 100),
        'positive':   [e for e in explanations if any(w in e for w in ['Great', 'Good', 'Excellent', 'Matched'])],
        'warnings':   [e for e in explanations if not any(w in e for w in ['Great', 'Good', 'Excellent', 'Matched'])],
        'tips':       tips,
        'label':      'Keywords',
    }


def score_readability(raw_text, word_count):
    """
    READABILITY SCORE (max 15 points)

    Checks:
    - Average sentence/line length
    - Presence of action verbs (built, developed, designed, etc.)
    - Avoidance of very long blocks of text

    Returns: dict with score and explanations
    """
    score = 15
    explanations = []
    tips = []

    # Action verbs that make a resume stronger
    action_verbs = [
        'developed', 'built', 'designed', 'implemented', 'created', 'managed',
        'led', 'analyzed', 'optimized', 'deployed', 'improved', 'automated',
        'collaborated', 'researched', 'achieved', 'delivered', 'established',
        'launched', 'maintained', 'reduced', 'increased', 'contributed',
    ]

    text_lower = raw_text.lower()
    found_verbs = [v for v in action_verbs if v in text_lower]

    if len(found_verbs) >= 5:
        explanations.append(f"Good use of action verbs: {', '.join(found_verbs[:4])}, etc.")
    elif len(found_verbs) >= 2:
        score -= 3
        explanations.append(f"Some action verbs found, but could use more.")
        tips.append("Use stronger action verbs like: built, developed, analyzed, optimized.")
    else:
        score -= 6
        explanations.append("Very few action verbs found. Resume bullet points may be too passive.")
        tips.append("Start bullet points with action verbs: 'Developed a web app...', 'Analyzed data...'")

    # Check for very long paragraphs (sign of wall-of-text)
    paragraphs = [p.strip() for p in raw_text.split('\n') if len(p.strip()) > 200]
    if len(paragraphs) > 3:
        score -= 4
        explanations.append("Some sections have very long blocks of text.")
        tips.append("Break long paragraphs into shorter bullet points for better scannability.")

    # Check average line length
    lines = [l for l in raw_text.split('\n') if l.strip()]
    if lines:
        avg_length = sum(len(l) for l in lines) / len(lines)
        if avg_length > 150:
            score -= 3
            tips.append("Keep each line/bullet concise (under 120 characters is ideal).")

    score = max(0, min(15, score))

    return {
        'score':      score,
        'max_score':  15,
        'percentage': int((score / 15) * 100),
        'positive':   [e for e in explanations if 'Good' in e or 'good' in e],
        'warnings':   [e for e in explanations if 'Good' not in e and 'good' not in e],
        'tips':       tips,
        'label':      'Readability',
    }


def score_structure(sections_found):
    """
    STRUCTURE SCORE (max 15 points)

    Checks presence of key resume sections.

    Important sections and their points:
    - Skills / Technical Skills: 3 points
    - Education: 3 points
    - Projects: 3 points
    - Experience / Internship: 3 points
    - Summary/Objective: 2 points
    - Certifications: 1 point

    Returns: dict with score and explanations
    """
    explanations = []
    tips = []
    score = 0

    section_points = {
        'skills':          3,
        'education':       3,
        'projects':        3,
        'experience':      3,
        'summary':         2,
        'objective':       2,
        'certifications':  1,
    }

    for section, points in section_points.items():
        if section in sections_found:
            score += points
            if section in ['skills', 'education', 'projects', 'experience']:
                explanations.append(f"✓ '{section.capitalize()}' section found.")
        else:
            if section in ['skills', 'education']:
                tips.append(f"Add a '{section.capitalize()}' section — it is essential.")
            elif section in ['projects', 'experience']:
                tips.append(f"Add a '{section.capitalize()}' section to strengthen your resume.")

    # Cap at 15 (experience and objective both give 2+3 = could exceed)
    score = min(15, score)

    if score >= 12:
        explanations.insert(0, "Your resume has a clear and well-organized structure.")
    elif score >= 8:
        explanations.insert(0, "Good structure. A few sections could be added or improved.")
    else:
        explanations.insert(0, "Resume structure needs work. Several key sections are missing.")

    return {
        'score':      score,
        'max_score':  15,
        'percentage': int((score / 15) * 100),
        'positive':   [e for e in explanations if '✓' in e or 'clear' in e or 'Good' in e],
        'warnings':   [e for e in explanations if '✓' not in e and 'clear' not in e and 'Good' not in e],
        'tips':       tips,
        'label':      'Structure',
    }


def score_completeness(sections, email, phone, name, word_count):
    """
    COMPLETENESS SCORE (max 15 points)

    Checks:
    - Contact info present (email, phone)
    - Name present
    - Skills section has content
    - Education section has content
    - At least one project or experience described

    Returns: dict with score and explanations
    """
    score = 0
    explanations = []
    tips = []

    # Contact info
    if email:
        score += 3
        explanations.append("✓ Email address found.")
    else:
        tips.append("Add your email address in the contact section.")

    if phone:
        score += 2
        explanations.append("✓ Phone number found.")
    else:
        tips.append("Add your phone number.")

    # Name
    if name and name != "Candidate":
        score += 1
        explanations.append("✓ Candidate name identified.")

    # Skills content
    skills_text = sections.get('skills', '')
    if len(skills_text.split()) >= 5:
        score += 3
        explanations.append("✓ Skills section has good content.")
    elif skills_text:
        score += 1
        tips.append("Expand your skills section with more specific technologies.")
    else:
        tips.append("Add a detailed Skills section.")

    # Education content
    edu_text = sections.get('education', '')
    if len(edu_text.split()) >= 10:
        score += 3
        explanations.append("✓ Education section has detailed content.")
    elif edu_text:
        score += 1
        tips.append("Add more details to your Education section (e.g., CGPA, relevant courses).")
    else:
        tips.append("Add an Education section with your degree, institution and year.")

    # Projects or Experience
    proj_text = sections.get('projects', '')
    exp_text  = sections.get('experience', '')
    if len(proj_text.split()) >= 20 or len(exp_text.split()) >= 20:
        score += 3
        explanations.append("✓ Projects/Experience section has good content.")
    elif proj_text or exp_text:
        score += 1
        tips.append("Add more detail to your projects or experience (what you built, tools used).")
    else:
        tips.append("Add at least 2-3 projects with descriptions, tools, and outcomes.")

    score = min(15, score)

    return {
        'score':      score,
        'max_score':  15,
        'percentage': int((score / 15) * 100),
        'positive':   [e for e in explanations if '✓' in e],
        'warnings':   [e for e in explanations if '✓' not in e],
        'tips':       tips,
        'label':      'Completeness',
    }


def score_job_relevance(jd_match_data):
    """
    JOB RELEVANCE SCORE (max 10 points)

    Based on the JD match percentage.
    If no JD provided, gives a neutral score of 5/10.

    Returns: dict with score and explanations
    """
    explanations = []
    tips = []

    if not jd_match_data.get('jd_provided', False):
        score = 5
        explanations.append("No Job Description provided. Score is neutral.")
        tips.append("Paste a Job Description to get an accurate Job Relevance score.")
    else:
        match_pct = jd_match_data.get('match_percentage', 0)

        if match_pct >= 75:
            score = 10
            explanations.append(f"Excellent job relevance! {match_pct}% match with the JD.")
        elif match_pct >= 60:
            score = 8
            explanations.append(f"Good job relevance. {match_pct}% match with the JD.")
        elif match_pct >= 45:
            score = 6
            explanations.append(f"Moderate job relevance ({match_pct}%). Some important skills are missing.")
            tips.append("Focus on adding high-priority missing skills to improve job match.")
        elif match_pct >= 30:
            score = 4
            explanations.append(f"Low job relevance ({match_pct}%). The resume needs more JD-aligned content.")
            tips.append("Review the JD carefully and add skills you genuinely possess.")
        else:
            score = 2
            explanations.append(f"Very low job relevance ({match_pct}%). Resume is not well-aligned with this JD.")
            tips.append("Consider tailoring your resume specifically for this type of role.")

    return {
        'score':      score,
        'max_score':  10,
        'percentage': int((score / 10) * 100),
        'positive':   [e for e in explanations if 'Excellent' in e or 'Good' in e],
        'warnings':   [e for e in explanations if 'Excellent' not in e and 'Good' not in e],
        'tips':       tips,
        'label':      'Job Relevance',
    }


# ---------------------------------------------------------------------------
# MAIN SCORING FUNCTION
# ---------------------------------------------------------------------------

def calculate_score(parsed_resume, jd_match_data):
    """
    Calculate the complete resume score.

    Calls all 6 category scorers and combines the results.
    Returns a comprehensive scoring dict ready to send to the frontend.
    """
    raw_text       = parsed_resume.get('raw_text', '')
    sections       = parsed_resume.get('sections', {})
    sections_found = parsed_resume.get('sections_found', [])
    word_count     = parsed_resume.get('word_count', 0)
    email          = parsed_resume.get('email', '')
    phone          = parsed_resume.get('phone', '')
    name           = parsed_resume.get('name', 'Candidate')
    resume_skills  = set(jd_match_data.get('resume_skills', []))

    # Score each category
    fmt_score   = score_formatting(raw_text, word_count)
    kw_score    = score_keywords(raw_text, resume_skills, jd_match_data)
    read_score  = score_readability(raw_text, word_count)
    struct_score = score_structure(sections_found)
    comp_score  = score_completeness(sections, email, phone, name, word_count)
    rel_score   = score_job_relevance(jd_match_data)

    # Total score
    total = (
        fmt_score['score'] +
        kw_score['score'] +
        read_score['score'] +
        struct_score['score'] +
        comp_score['score'] +
        rel_score['score']
    )

    # Resume health level
    if total >= 80:
        health_level = 'Gold'
        health_emoji = '🥇'
        health_message = "Excellent resume! You are well-prepared."
    elif total >= 50:
        health_level = 'Silver'
        health_emoji = '🥈'
        health_message = "Good resume with room for improvement."
    else:
        health_level = 'Bronze'
        health_emoji = '🥉'
        health_message = "Your resume needs significant work. Use the Resume Doctor!"

    # Identify top 3 problems for Resume Doctor
    all_tips = []
    for cat_score in [comp_score, kw_score, fmt_score, read_score, struct_score, rel_score]:
        for tip in cat_score['tips']:
            all_tips.append({
                'category': cat_score['label'],
                'tip': tip,
                'impact': cat_score['max_score'] - cat_score['score'],
            })

    # Sort tips by impact (highest impact first) and take top 3
    all_tips.sort(key=lambda x: x['impact'], reverse=True)
    top_problems = all_tips[:3]

    return {
        'total_score':    total,
        'max_score':      100,
        'health_level':   health_level,
        'health_emoji':   health_emoji,
        'health_message': health_message,
        'categories': {
            'formatting':    fmt_score,
            'keywords':      kw_score,
            'readability':   read_score,
            'structure':     struct_score,
            'completeness':  comp_score,
            'job_relevance': rel_score,
        },
        'top_problems': top_problems,
        'resume_quality_score': int((
            fmt_score['score'] + read_score['score'] + struct_score['score'] + comp_score['score']
        ) / 65 * 100),
        'job_fit_score': jd_match_data.get('match_percentage', 0) if jd_match_data.get('jd_provided') else 50,
    }
