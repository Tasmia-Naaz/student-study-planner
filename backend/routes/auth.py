# type: ignore[arg-type]

"""Authentication routes for the Student Study Planner backend.
Provides registration for students and mentors, login, user info (me), and logout.
All endpoints return JSON responses. JWT access token is set in an httpOnly cookie.
"""

import re
from flask import Blueprint, request, jsonify
from flask_jwt_extended import (
    create_access_token,
    set_access_cookies,
    jwt_required,
    get_jwt_identity,
    unset_jwt_cookies,
)
from werkzeug.security import generate_password_hash, check_password_hash

from ..models import db, MentorAssignment, Notification, User, RoleEnum

bp = Blueprint('auth', __name__)

# Helper regex for student ID validation
STUDENT_ID_REGEX = re.compile(r"^2451-\d{2}-\d{3}-\d{3}$")
EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
DEPARTMENT_OPTIONS = {
    "CSE",
    "IT",
    "CSE (AI & ML)",
    "CSE (AI)",
    "CSE (DS)",
    "ECE",
    "EEE",
    "Mechanical Engineering",
    "Civil Engineering",
    "CSIT",
    "Cyber Security",
    "CSE (IoT)",
    "Other",
}
MAX_PASSWORD_LENGTH = 128

@bp.route('/register/student', methods=['POST'])
def register_student():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"error": "A JSON object is required"}), 400
    required = ["full_name", "student_id", "email", "password", "department", "academic_year", "semester"]
    missing = [f for f in required if f not in data]
    if missing:
        return jsonify({"error": f"Missing fields: {', '.join(missing)}"}), 400

    selected_department = str(data.get("department") or "").strip()
    if selected_department not in DEPARTMENT_OPTIONS:
        return jsonify({"error": "Department / Branch is required"}), 400
    if selected_department == "Other":
        department = str(data.get("other_department") or "").strip()
        if not department:
            return jsonify({"error": "Enter your Department / Branch"}), 400
    else:
        department = selected_department
    if len(department) > 80:
        return jsonify({"error": "Department / Branch must be 80 characters or fewer"}), 400

    student_id = str(data["student_id"]).strip()
    if not STUDENT_ID_REGEX.fullmatch(student_id):
        return jsonify({"error": "Invalid student_id format. Expected 2451-XX-XXX-XXX"}), 400

    email = str(data["email"]).strip()
    full_name = str(data["full_name"]).strip()
    password = data["password"]
    academic_year = str(data["academic_year"]).strip()
    semester = str(data["semester"]).strip()
    phone = str(data.get("phone") or "").strip()
    if not email or not EMAIL_REGEX.fullmatch(email) or not full_name or len(full_name) > 120 or len(email) > 120:
        return jsonify({"error": "A valid name and email are required"}), 400
    if not isinstance(password, str):
        return jsonify({"error": "Password must be text"}), 400
    if len(password) < 8 or len(password) > MAX_PASSWORD_LENGTH:
        return jsonify({"error": "Password must be between 8 and 128 characters"}), 400
    if not academic_year or len(academic_year) > 10 or not semester or len(semester) > 10:
        return jsonify({"error": "Academic year and semester are required"}), 400
    if not phone or len(phone) > 20:
        return jsonify({"error": "A phone number of 20 characters or fewer is required"}), 400
    if User.query.filter_by(email=email).first():
        return jsonify({"error": "Email already registered"}), 409
    if User.query.filter_by(student_id=student_id).first():
        return jsonify({"error": "Student ID already registered"}), 409

    user = User(
        role=RoleEnum.STUDENT,
        full_name=full_name,
        email=email,
        password_hash=generate_password_hash(password),
        student_id=student_id,
        department=department,
        academic_year=academic_year,
        semester=semester,
        phone=phone,
    )
    db.session.add(user)
    for admin in User.query.filter_by(role=RoleEnum.ADMIN).all():
        db.session.add(Notification(
            user_id=admin.id,
            title="New student registration",
            body=f"{full_name} registered as a student.",
            kind="registration",
        ))
    db.session.commit()
    return jsonify({"msg": "Student registered successfully"}), 201

@bp.route('/register/mentor', methods=['POST'])
def register_mentor():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"error": "A JSON object is required"}), 400
    required = ["full_name", "employee_id", "email", "password", "department"]
    missing = [f for f in required if f not in data]
    if missing:
        return jsonify({"error": f"Missing fields: {', '.join(missing)}"}), 400

    full_name = str(data["full_name"]).strip()
    employee_id = str(data["employee_id"]).strip()
    email = str(data["email"]).strip()
    password = data["password"]
    department = str(data["department"]).strip()
    phone = str(data.get("phone") or "").strip()
    if not full_name or len(full_name) > 120 or not email or not EMAIL_REGEX.fullmatch(email) or len(email) > 120:
        return jsonify({"error": "A valid name and email are required"}), 400
    if not isinstance(password, str):
        return jsonify({"error": "Password must be text"}), 400
    if not employee_id or len(employee_id) > 20 or not department or len(department) > 80:
        return jsonify({"error": "A valid Employee ID and Department are required"}), 400
    if len(password) < 8 or len(password) > MAX_PASSWORD_LENGTH:
        return jsonify({"error": "Password must be between 8 and 128 characters"}), 400
    if not phone or len(phone) > 20:
        return jsonify({"error": "A phone number of 20 characters or fewer is required"}), 400
    if User.query.filter_by(email=email).first():
        return jsonify({"error": "Email already registered"}), 409
    if User.query.filter_by(employee_id=employee_id).first():
        return jsonify({"error": "Employee ID already registered"}), 409

    # Mentor accounts are created with role MENTOR but marked inactive until admin approval.
    user = User(
        role=RoleEnum.MENTOR,
        full_name=full_name,
        email=email,
        password_hash=generate_password_hash(password),
        employee_id=employee_id,
        department=department,
        phone=phone,
        mentor_approved=False,
    )
    db.session.add(user)
    for admin in User.query.filter_by(role=RoleEnum.ADMIN).all():
        db.session.add(Notification(
            user_id=admin.id,
            title="Mentor approval required",
            body=f"{full_name} registered as a mentor and is awaiting approval.",
            kind="registration",
        ))
    db.session.commit()
    return jsonify({"msg": "Mentor registered successfully. Await admin approval."}), 201

@bp.route('/login', methods=['POST'])
def login():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"error": "A JSON object is required"}), 400
    email = str(data.get('email') or '').strip()
    password = data.get('password')
    requested_role = data.get('role')
    if not email or not isinstance(password, str) or not password:
        return jsonify({"error": "Email and password required"}), 400

    user = User.query.filter_by(email=email).first()
    if not user or not check_password_hash(user.password_hash, password):
        return jsonify({"error": "Invalid credentials"}), 401
    if requested_role and requested_role != user.role.value:
        return jsonify({"error": f"This account is not registered as {requested_role}"}), 403
    if not user.is_active:
        return jsonify({"error": "This account is currently inactive"}), 403
    if user.role == RoleEnum.MENTOR and not user.mentor_approved:
        return jsonify({"error": "Your mentor account is awaiting Admin approval"}), 403

    # Create JWT token with identity = user.id
    access_token = create_access_token(identity=str(user.id))
    resp = jsonify({"msg": "Login successful", "role": user.role.value, "user_id": user.id})
    set_access_cookies(resp, access_token)
    return resp, 200

@bp.route('/me', methods=['GET'])
@jwt_required()
def me():
    user_id = get_jwt_identity()
    try:
        user = db.session.get(User, int(user_id))
    except (TypeError, ValueError):
        user = None
    if not user:
        return jsonify({"error": "User not found"}), 404
    if not user.is_active or (user.role == RoleEnum.MENTOR and not user.mentor_approved):
        return jsonify({"error": "Your mentor account is awaiting Admin approval"}), 403
    # Return minimal profile info
    profile = {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "role": user.role.value,
        "department": user.department,
        "phone": user.phone,
        "mentor_approved": user.mentor_approved if user.role == RoleEnum.MENTOR else None,
    }
    if user.role == RoleEnum.STUDENT:
        profile.update({
            "student_id": user.student_id,
            "academic_year": user.academic_year,
            "semester": user.semester,
        })
    elif user.role == RoleEnum.MENTOR:
        profile.update({"employee_id": user.employee_id})
    return jsonify(profile), 200

@bp.route('/session', methods=['GET'])
@jwt_required(optional=True)
def session():
    user = get_current_user()
    csrf_token = request.cookies.get("csrf_access_token")
    if not user or not user.is_active or (user.role == RoleEnum.MENTOR and not user.mentor_approved):
        return jsonify({"user": None, "csrf_token": csrf_token}), 200
    return jsonify({"user": serialize_user(user), "csrf_token": csrf_token}), 200

@bp.route('/me', methods=['PUT'])
@jwt_required()
def update_me():
    user_id = get_jwt_identity()
    try:
        user = db.session.get(User, int(user_id))
    except (TypeError, ValueError):
        user = None
    if not user:
        return jsonify({"error": "User not found"}), 404

    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"error": "A JSON object is required"}), 400

    full_name = str(data.get("full_name") or "").strip()
    email = str(data.get("email") or "").strip()
    phone = str(data.get("phone") or "").strip() or None
    department = str(data.get("department") or "").strip()
    if not full_name or len(full_name) > 120:
        return jsonify({"error": "Full name is required and must be 120 characters or fewer"}), 400
    if not email or len(email) > 120 or not EMAIL_REGEX.fullmatch(email):
        return jsonify({"error": "A valid email is required"}), 400
    if phone and len(phone) > 20:
        return jsonify({"error": "Phone number must be 20 characters or fewer"}), 400
    existing_email = User.query.filter(User.email == email, User.id != user.id).first()
    if existing_email:
        return jsonify({"error": "Email already registered"}), 409

    academic_year = None
    semester = None
    if user.role == RoleEnum.STUDENT:
        if department not in DEPARTMENT_OPTIONS:
            return jsonify({"error": "Department / Branch is required"}), 400
        if department == "Other":
            department = str(data.get("other_department") or "").strip()
        academic_year = str(data.get("academic_year") or "").strip()
        semester = str(data.get("semester") or "").strip()
        if not department or len(department) > 80:
            return jsonify({"error": "Enter a valid Department / Branch"}), 400
        if not academic_year or len(academic_year) > 10 or not semester or len(semester) > 10:
            return jsonify({"error": "Academic year and semester are required"}), 400
    elif user.role == RoleEnum.MENTOR:
        if not department or len(department) > 80:
            return jsonify({"error": "Department is required"}), 400

    user.full_name = full_name
    user.email = email
    user.phone = phone
    if user.role == RoleEnum.STUDENT:
        user.department = department
        user.academic_year = academic_year
        user.semester = semester
    elif user.role == RoleEnum.MENTOR:
        user.department = department

    db.session.commit()
    return jsonify(serialize_user(user)), 200

@bp.route('/password', methods=['PUT'])
@jwt_required()
def update_password():
    user_id = get_jwt_identity()
    try:
        user = db.session.get(User, int(user_id))
    except (TypeError, ValueError):
        user = None
    if not user:
        return jsonify({"error": "User not found"}), 404

    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"error": "A JSON object is required"}), 400
    current_password = data.get("current_password")
    new_password = data.get("new_password")
    if not isinstance(current_password, str) or not isinstance(new_password, str):
        return jsonify({"error": "Current and new passwords are required"}), 400
    if not check_password_hash(user.password_hash, current_password):
        return jsonify({"error": "Current password is incorrect"}), 400
    if len(new_password) < 8 or len(new_password) > MAX_PASSWORD_LENGTH:
        return jsonify({"error": "New password must be between 8 and 128 characters"}), 400
    user.password_hash = generate_password_hash(new_password)
    db.session.commit()
    return jsonify({"msg": "Password updated successfully"}), 200

@bp.route('/admin/students', methods=['GET'])
@jwt_required()
def admin_students():
    user_id = get_jwt_identity()
    try:
        user = db.session.get(User, int(user_id))
    except (TypeError, ValueError):
        user = None
    if not user or user.role != RoleEnum.ADMIN:
        return jsonify({"error": "Admin access required"}), 403

    query = User.query.filter_by(role=RoleEnum.STUDENT)
    department = request.args.get("department", "").strip()
    if department:
        query = query.filter_by(department=department)
    students = query.order_by(User.full_name).all()
    current_mentors = dict(
        db.session.query(MentorAssignment.student_id, User.full_name)
        .join(User, User.id == MentorAssignment.mentor_id)
        .filter(MentorAssignment.active.is_(True))
        .all()
    )
    return jsonify([
        {
            "id": student.id,
            "full_name": student.full_name,
            "email": student.email,
            "student_id": student.student_id,
            "department": student.department,
            "academic_year": student.academic_year,
            "semester": student.semester,
            "current_mentor": current_mentors.get(student.id),
        }
        for student in students
    ]), 200

@bp.route('/admin/mentors', methods=['GET'])
@jwt_required()
def admin_mentors():
    admin = get_current_user()
    if not admin or admin.role != RoleEnum.ADMIN:
        return jsonify({"error": "Admin access required"}), 403
    mentors = User.query.filter_by(role=RoleEnum.MENTOR).order_by(User.full_name).all()
    return jsonify([
        {
            "id": mentor.id,
            "full_name": mentor.full_name,
            "email": mentor.email,
            "employee_id": mentor.employee_id,
            "department": mentor.department,
            "approved": mentor.mentor_approved,
            "active": mentor.is_active,
        }
        for mentor in mentors
    ]), 200

@bp.route('/admin/mentors/<int:mentor_id>/approve', methods=['POST'])
@jwt_required()
def approve_mentor(mentor_id):
    admin = get_current_user()
    if not admin or admin.role != RoleEnum.ADMIN:
        return jsonify({"error": "Admin access required"}), 403
    mentor = User.query.filter_by(id=mentor_id, role=RoleEnum.MENTOR).first()
    if not mentor:
        return jsonify({"error": "Mentor not found"}), 404
    mentor.mentor_approved = True
    db.session.commit()
    return jsonify({"msg": "Mentor approved successfully"}), 200

@bp.route('/mentor/students', methods=['GET'])
@jwt_required()
def mentor_students():
    user_id = get_jwt_identity()
    try:
        user = db.session.get(User, int(user_id))
    except (TypeError, ValueError):
        user = None
    if not user or user.role != RoleEnum.MENTOR:
        return jsonify({"error": "Mentor access required"}), 403
    if not user.mentor_approved or not user.is_active:
        return jsonify({"error": "Mentor account is awaiting Admin approval"}), 403

    students = (
        User.query.join(MentorAssignment, MentorAssignment.student_id == User.id)
        .filter(
            MentorAssignment.mentor_id == user.id,
            MentorAssignment.active.is_(True),
            User.role == RoleEnum.STUDENT,
        )
        .order_by(User.full_name)
        .all()
    )
    return jsonify([
        {
            "id": student.id,
            "full_name": student.full_name,
            "student_id": student.student_id,
            "department": student.department,
            "academic_year": student.academic_year,
            "semester": student.semester,
        }
        for student in students
    ]), 200

@bp.route('/logout', methods=['POST'])
def logout():
    resp = jsonify({"msg": "Logged out"})
    unset_jwt_cookies(resp)
    return resp, 200

def get_current_user():
    user_id = get_jwt_identity()
    try:
        return db.session.get(User, int(user_id))
    except (TypeError, ValueError):
        return None

def serialize_user(user):
    profile = {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "role": user.role.value,
        "department": user.department,
        "phone": user.phone,
        "is_active": user.is_active,
    }
    if user.role == RoleEnum.STUDENT:
        profile.update({
            "student_id": user.student_id,
            "academic_year": user.academic_year,
            "semester": user.semester,
        })
    elif user.role == RoleEnum.MENTOR:
        profile.update({
            "employee_id": user.employee_id,
            "mentor_approved": user.mentor_approved,
        })
    return profile
