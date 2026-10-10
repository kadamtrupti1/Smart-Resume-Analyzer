import os
import json
import sys

from flask import Flask, render_template, request, jsonify
from werkzeug.utils import secure_filename

# Project root
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Project modules
from parser.resume_parser import parse_resume
from analyzer.keyword_matcher import match_resume_with_jd
from analyzer.resume_scorer import calculate_score
from analyzer.skill_analyzer import (
    compute_radar_scores,
    get_strong_and_weak_areas
)
from utils.helpers import allowed_file, file_size_ok
from database import get_db_connection


# ============================================================
# FLASK CONFIGURATION
# ============================================================

app = Flask(__name__)

UPLOAD_FOLDER = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "uploads"
)

os.makedirs(UPLOAD_FOLDER, exist_ok=True)

app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
app.config["MAX_CONTENT_LENGTH"] = 5 * 1024 * 1024


# ============================================================
# HOME
# ============================================================

@app.route("/")
def index():
    return render_template("index.html")


# ============================================================
# ANALYZE RESUME
# ============================================================

@app.route("/analyze", methods=["POST"])
def analyze():

    if "resume" not in request.files:
        return jsonify({
            "error": "No resume file uploaded."
        }), 400

    file = request.files["resume"]

    jd_text = request.form.get(
        "job_description",
        ""
    ).strip()

    if file.filename == "":
        return jsonify({
            "error": "No file selected."
        }), 400

    # Validate extension
    if not allowed_file(file.filename):
        return jsonify({
            "error": "Invalid file type. Please upload PDF or DOCX."
        }), 400

    # Secure filename
    filename = secure_filename(file.filename)

    file_path = os.path.join(
        app.config["UPLOAD_FOLDER"],
        filename
    )

    # Save uploaded resume
    file.save(file_path)

    # Check file size
    if not file_size_ok(file_path):

        os.remove(file_path)

        return jsonify({
            "error": "File size exceeds 5MB limit."
        }), 400

    db = None
    cursor = None

    try:

        # ====================================================
        # STEP 1 - PARSE RESUME
        # ====================================================

        parsed = parse_resume(file_path)

        if "error" in parsed:

            if os.path.exists(file_path):
                os.remove(file_path)

            return jsonify({
                "error": parsed["error"]
            }), 400


        # ====================================================
     
        # STEP 2 - JOB DESCRIPTION MATCHING
        # ====================================================

        jd_match = match_resume_with_jd(
            parsed["raw_text"],
            jd_text
        )
        
        print("DEBUG - JD provided:", jd_match.get("jd_provided"))
        print("DEBUG - Resume text length:", len(parsed["raw_text"]))
        print("DEBUG - Resume skills:", jd_match.get("resume_skills"))
        print("DEBUG - JD text length:", len(jd_text or ""))
        print("DEBUG - JD skills:", jd_match.get("jd_skills"))
        print("DEBUG - Matched skills:", jd_match.get("matched_skills"))
        print("DEBUG - Missing skills:", jd_match.get("missing_skills"))

        # ====================================================
        # STEP 3 - RESUME SCORE
        # ====================================================

        scores = calculate_score(
            parsed,
            jd_match
        )


        # ====================================================
        # STEP 4 - SKILL RADAR
        # ====================================================

        resume_skills_set = set(
            jd_match.get("resume_skills", [])
        )

        jd_skills_set = set(
            jd_match.get("jd_skills", [])
        )

        radar_data = compute_radar_scores(
            resume_skills_set,
            jd_skills_set
            if jd_match.get("jd_provided")
            else None
        )


        # ====================================================
        # STEP 5 - STRONG / WEAK AREAS
        # ====================================================

        strong_areas, weak_areas = get_strong_and_weak_areas(
            radar_data["candidate_scores"],
            radar_data["labels"]
        )


        # ====================================================
        # STEP 6 - SAVE DATA INTO MYSQL
        # ====================================================

        db = get_db_connection()

        cursor = db.cursor()

        # -------------------------------
        # Save resume information
        # -------------------------------

        cursor.execute(
            """
            INSERT INTO resumes
            (
                file_name,
                candidate_name,
                email,
                phone
            )
            VALUES (%s, %s, %s, %s)
            """,
            (
                filename,
                parsed.get("name", ""),
                parsed.get("email", ""),
                parsed.get("phone", "")
            )
        )

        resume_id = cursor.lastrowid


        # -------------------------------
        # Save analysis result
        # -------------------------------

        cursor.execute(
            """
            INSERT INTO analysis_results
            (
                resume_id,
                resume_score,
                job_match_percentage,
                matched_skills,
                missing_skills,
                strong_areas,
                weak_areas
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            """,
            (
                resume_id,

                scores.get(
                    "total_score",
                    0
                ),

                jd_match.get(
                    "match_percentage",
                    0
                ),

                json.dumps(
                    jd_match.get(
                        "matched_skills",
                        []
                    )
                ),

                json.dumps(
                    jd_match.get(
                        "missing_skills",
                        []
                    )
                ),

                json.dumps(
                    strong_areas
                ),

                json.dumps(
                    weak_areas
                )
            )
        )


        # Save changes
        db.commit()


        # ====================================================
        # STEP 7 - RESPONSE TO FRONTEND
        # ====================================================

        response = {

            "success": True,

            "database_id": resume_id,

            "candidate": {

                "name": parsed.get(
                    "name",
                    ""
                ),

                "email": parsed.get(
                    "email",
                    ""
                ),

                "phone": parsed.get(
                    "phone",
                    ""
                )
            },

            "sections_found": parsed.get(
                "sections_found",
                []
            ),

            "word_count": parsed.get(
                "word_count",
                0
            ),

            "scores": scores,

            "jd_match": jd_match,

            "radar": radar_data,

            "strong_areas": strong_areas,

            "weak_areas": weak_areas,

            "sections_preview": {

                section:
                text[:200] +
                ("..." if len(text) > 200 else "")

                for section, text
                in parsed.get(
                    "sections",
                    {}
                ).items()

                if text.strip()
            }
        }


        return jsonify(response)


    except Exception as e:

        print(
            f"[ERROR] Analysis failed: {e}"
        )

        import traceback

        traceback.print_exc()

        if db:
            try:
                db.rollback()
            except:
                pass

        return jsonify({
            "error": f"Analysis failed: {str(e)}"
        }), 500


    finally:

        if cursor:
            cursor.close()

        if db:
            db.close()


# ============================================================
# HISTORY
# ============================================================

@app.route("/history", methods=["GET"])
def history():

    db = None
    cursor = None

    try:

        db = get_db_connection()

        cursor = db.cursor(
            dictionary=True
        )

        cursor.execute(
            """
            SELECT
                r.id,
                r.file_name,
                r.candidate_name,
                r.email,
                r.phone,
                r.upload_date,

                a.resume_score,
                a.job_match_percentage,
                a.matched_skills,
                a.missing_skills,
                a.strong_areas,
                a.weak_areas

            FROM resumes r

            LEFT JOIN analysis_results a
                ON r.id = a.resume_id

            ORDER BY r.upload_date DESC
            """
        )

        results = cursor.fetchall()

        return jsonify({

            "success": True,

            "count": len(results),

            "history": results
        })


    except Exception as e:

        print(
            f"[ERROR] History failed: {e}"
        )

        return jsonify({

            "success": False,

            "error": str(e)

        }), 500


    finally:

        if cursor:
            cursor.close()

        if db:
            db.close()


# ============================================================
# HISTORY DETAIL
# ============================================================

@app.route(
    "/history/<int:resume_id>",
    methods=["GET"]
)
def history_detail(resume_id):

    db = None
    cursor = None

    try:

        db = get_db_connection()

        cursor = db.cursor(
            dictionary=True
        )

        cursor.execute(
            """
            SELECT
                r.id,
                r.file_name,
                r.candidate_name,
                r.email,
                r.phone,
                r.upload_date,

                a.resume_score,
                a.job_match_percentage,
                a.matched_skills,
                a.missing_skills,
                a.strong_areas,
                a.weak_areas

            FROM resumes r

            LEFT JOIN analysis_results a
                ON r.id = a.resume_id

            WHERE r.id = %s
            """,
            (resume_id,)
        )

        result = cursor.fetchone()

        if not result:

            return jsonify({

                "success": False,

                "error": "Resume not found"

            }), 404


        return jsonify({

            "success": True,

            "data": result

        })


    except Exception as e:

        print(
            f"[ERROR] History detail failed: {e}"
        )

        return jsonify({

            "success": False,

            "error": str(e)

        }), 500


    finally:

        if cursor:
            cursor.close()

        if db:
            db.close()


# ============================================================
# DATABASE HEALTH CHECK
# ============================================================

@app.route(
    "/health",
    methods=["GET"]
)
def health():

    db = None

    try:

        db = get_db_connection()

        db.close()

        db = None

        return jsonify({

            "status": "OK",

            "database": "Connected",

            "message":
                "Smart Resume Analyzer backend is running"
        })


    except Exception as e:

        if db:
            db.close()

        return jsonify({

            "status": "ERROR",

            "database": "Disconnected",

            "message": str(e)

        }), 500


# ============================================================
# DEMO
# ============================================================

@app.route(
    "/demo",
    methods=["GET"]
)
def demo():

    demo_response = {

        "success": True,

        "is_demo": True,

        "candidate": {

            "name":
                "Priya Sharma",

            "email":
                "priya.sharma@example.com",

            "phone":
                "+91-98765-43210"
        },

        "sections_found": [
            "education",
            "skills",
            "projects",
            "certifications"
        ],

        "word_count": 420,

        "scores": {

            "total_score": 68,

            "max_score": 100,

            "health_level": "Silver",

            "health_emoji": "🥈",

            "health_message":
                "Good resume with room for improvement."
        },

        "jd_match": {

            "jd_provided": True,

            "match_percentage": 55,

            "matched_skills": [
                "python",
                "sql",
                "excel",
                "statistics",
                "pandas",
                "numpy"
            ],

            "missing_skills": [
                "power bi",
                "tableau",
                "data visualization",
                "machine learning"
            ],

            "jd_skills": [
                "python",
                "sql",
                "excel",
                "power bi",
                "tableau",
                "data visualization",
                "machine learning",
                "pandas",
                "numpy",
                "statistics"
            ]
        },

        "radar": {

            "labels": [
                "Python",
                "SQL & Databases",
                "Machine Learning",
                "Data Visualization",
                "Statistics",
                "Tools & DevOps"
            ],

            "candidate_scores": [
                8, 6, 2, 2, 5, 6
            ],

            "required_scores": [
                9, 7, 6, 7, 6, 5
            ]
        },

        "strong_areas": [
            "Python",
            "SQL & Databases",
            "Tools & DevOps"
        ],

        "weak_areas": [
            "Machine Learning",
            "Data Visualization",
            "Statistics"
        ]
    }

    return jsonify(demo_response)


# ============================================================
# RUN APPLICATION
# ============================================================

if __name__ == "__main__":

    print("=" * 55)

    print(
        "  Smart Resume Analyzer - Flask Backend"
    )

    print(
        "  2nd Year B.Tech CSE-DS Academic Project"
    )

    print("=" * 55)

    print(
        f"  Upload folder: {UPLOAD_FOLDER}"
    )

    print(
        "  Open http://127.0.0.1:5000 in your browser"
    )

    print("=" * 55)

    app.run(
        debug=True,
        host="127.0.0.1",
        port=5000
    )