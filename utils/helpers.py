# utils/helpers.py
# Utility functions for Smart Resume Analyzer
# These are small helper functions used by other modules.

import os
import re

# ---------------------------------------------------------------------------
# ALLOWED FILE EXTENSIONS
# ---------------------------------------------------------------------------
ALLOWED_EXTENSIONS = {'pdf', 'docx'}
MAX_FILE_SIZE_MB = 5


def allowed_file(filename):
    """
    Check if the uploaded file has an allowed extension.
    Returns True if allowed, False otherwise.
    """
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def file_size_ok(file_path):
    """
    Check if the file is within the 5MB size limit.
    Returns True if size is acceptable.
    """
    size_bytes = os.path.getsize(file_path)
    size_mb = size_bytes / (1024 * 1024)
    return size_mb <= MAX_FILE_SIZE_MB


def clean_text(text):
    """
    Clean extracted resume text:
    - Remove extra whitespace
    - Remove special characters that are not useful
    - Normalize newlines
    """
    if not text:
        return ""

    # Replace multiple newlines with a single newline
    text = re.sub(r'\n{3,}', '\n\n', text)

    # Replace multiple spaces with a single space
    text = re.sub(r' {2,}', ' ', text)

    # Strip leading/trailing whitespace
    text = text.strip()

    return text


def extract_email(text):
    """
    Extract email address from resume text using a simple regex pattern.
    Returns the first email found, or empty string if none.
    """
    # Basic email pattern
    pattern = r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'
    matches = re.findall(pattern, text)
    return matches[0] if matches else ""


def extract_phone(text):
    """
    Extract phone number from resume text.
    Handles common Indian phone number formats.
    Returns the first number found, or empty string if none.
    """
    # Pattern for Indian and international phone numbers
    pattern = r'[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}'
    matches = re.findall(pattern, text)
    return matches[0] if matches else ""


def extract_name_from_text(text):
    """
    Attempt to extract the candidate's name from the beginning of the resume.
    Simple approach: take the first non-empty line that looks like a name
    (contains only letters and spaces, and is not a common section heading).
    """
    # Section headings to skip
    skip_words = {
        'resume', 'curriculum', 'vitae', 'cv', 'profile', 'summary',
        'objective', 'education', 'experience', 'skills', 'projects'
    }

    lines = text.strip().split('\n')
    for line in lines[:10]:  # Check first 10 lines only
        line = line.strip()
        if not line:
            continue
        # Name should be 2-5 words, only letters and spaces
        if re.match(r'^[A-Za-z][A-Za-z\s]{2,50}$', line):
            words = line.split()
            if 2 <= len(words) <= 5:
                # Make sure it doesn't look like a section heading
                if line.lower() not in skip_words:
                    return line
    return "Candidate"


def tokenize_simple(text):
    """
    Simple tokenizer: lowercase, remove punctuation, split by spaces.
    Used for keyword matching.
    Returns a list of word tokens.
    """
    # Lowercase
    text = text.lower()
    # Remove punctuation except hyphens (useful for skill names like 'scikit-learn')
    text = re.sub(r'[^a-z0-9\s\-]', ' ', text)
    # Split and filter short tokens
    tokens = [word.strip() for word in text.split() if len(word.strip()) > 2]
    return tokens


def calculate_percentage(achieved, total):
    """
    Safe percentage calculation.
    Returns integer percentage between 0 and 100.
    """
    if total == 0:
        return 0
    return min(100, int((achieved / total) * 100))
