import json
from datetime import date, datetime, timedelta
from functools import wraps

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from sqlalchemy import and_, case, func, or_
from sqlalchemy.exc import IntegrityError

from ..extensions import db
from ..models import (
    Backlog,
    FollowUpRecord,
    MentorAssignment,
    MentorFeedback,
    Message,
    Notification,
    PermanentMentorAssignment,
    RoleEnum,
    StudentProgress,
    User,
)

bp = Blueprint("portal", __name__)
BACKLOG_STATUSES = {"Not Started", "Preparing", "Ready for Exam", "Cleared"}
PRIORITIES = {"Low", "Medium", "High"}


@bp.after_request
def prevent_private_response_caching(response):
    response.headers["Cache-Control"] = "no-store"
    response.headers["Vary"] = "Cookie"
    return response


def current_user():
    try:
        user = db.session.get(User, int(get_jwt_identity()))
        return user if user and user.is_active else None
    except (TypeError, ValueError):
        return None


def role_required(*roles):
    def decorate(handler):
        @wraps(handler)
        def guarded(*args, **kwargs):
            user = current_user()
            if not user:
                return jsonify({"error": "User not found"}), 401
            if user.role.value not in roles:
                return jsonify({"error": "You do not have permission to access this resource"}), 403
            if not user.is_active:
                return jsonify({"error": "This account is currently inactive"}), 403
            return handler(*args, **kwargs)
        return guarded
    return decorate


def notify(user_id, title, body, kind, event_key=None):
    db.session.add(Notification(user_id=user_id, title=title, body=body, kind=kind, event_key=event_key))


def active_assignment(student_id):
    return MentorAssignment.query.filter_by(student_id=student_id, active=True).first()


def is_current_pair(first, second):
    if not first.is_active or not second.is_active:
        return False
    assignment = MentorAssignment.query.filter_by(student_id=second.id, mentor_id=first.id, active=True).first()
    if first.role == RoleEnum.STUDENT:
        assignment = MentorAssignment.query.filter_by(student_id=first.id, mentor_id=second.id, active=True).first()
    return assignment is not None


def progress_for(student_id):
    record = db.session.get(StudentProgress, student_id)
    return record.data if record else {}


def create_student_reminders(student):
    snapshot = progress_for(student.id)
    today = date.today()
    pending = []
    for task in snapshot.get("tasks", []):
        deadline = task.get("deadline")
        if not deadline or task.get("done") or task.get("status") == "Submitted":
            continue
        try:
            due_date = date.fromisoformat(deadline)
        except (TypeError, ValueError):
            continue
        if 0 <= (due_date - today).days <= 3:
            event_key = f"assignment:{task.get('id', task.get('title', ''))}:{deadline}"
            pending.append(("Assignment deadline approaching", f"{task.get('title') or 'An assignment'} is due on {deadline}.", "assignment-deadline", event_key))
    for exam in snapshot.get("exams", []):
        exam_date = exam.get("date")
        if not exam_date:
            continue
        try:
            due_date = date.fromisoformat(exam_date)
        except (TypeError, ValueError):
            continue
        if 0 <= (due_date - today).days <= 7:
            event_key = f"exam:{exam.get('id', exam.get('name', ''))}:{exam_date}"
            pending.append(("Examination approaching", f"{exam.get('name') or 'An examination'} is scheduled for {exam_date}.", "exam", event_key))
    for session in snapshot.get("sessions", []):
        if session.get("date") != today.isoformat() or session.get("kind") != "study" or session.get("done"):
            continue
        try:
            start = datetime.strptime(session.get("start", ""), "%H:%M").time()
        except (TypeError, ValueError):
            continue
        start_at = datetime.combine(today, start)
        remaining = (start_at - datetime.now()).total_seconds()
        if 0 <= remaining <= 900:
            event_key = f"timetable:{session.get('id', session.get('title', ''))}:{session['date']}"
            pending.append(("Timetable reminder", f"{session.get('title') or 'A study session'} starts at {session.get('start')}.", "timetable", event_key))
    if not pending:
        return
    event_keys = {item[3] for item in pending}
    existing_keys = {
        row[0] for row in db.session.query(Notification.event_key).filter(
            Notification.user_id == student.id,
            Notification.event_key.in_(event_keys),
        ).all()
    }
    created = False
    for title, body, kind, event_key in pending:
        if event_key not in existing_keys:
            notify(student.id, title, body, kind, event_key)
            existing_keys.add(event_key)
            created = True
    if created:
        db.session.commit()


def backlog_json(backlog):
    return {
        "id": backlog.id,
        "subject_name": backlog.subject_name,
        "subject_code": backlog.subject_code,
        "semester": backlog.semester,
        "exam_date": backlog.exam_date.isoformat() if backlog.exam_date else None,
        "priority": backlog.priority,
        "notes": backlog.notes,
        "progress": backlog.progress,
        "status": backlog.status,
        "created_at": backlog.created_at.isoformat(),
        "updated_at": backlog.updated_at.isoformat(),
    }


def student_json(student, progress_data=None, backlog_counts=None):
    data = progress_data if progress_data is not None else progress_for(student.id)
    if backlog_counts is None:
        total_backlogs, active_backlogs = (
            db.session.query(
                func.count(Backlog.id),
                func.coalesce(func.sum(case((Backlog.status != "Cleared", 1), else_=0)), 0),
            )
            .filter(Backlog.student_id == student.id)
            .one()
        )
    else:
        total_backlogs, active_backlogs = backlog_counts
    completed_sessions = sum(1 for session in data.get("sessions", []) if session.get("kind") == "study" and session.get("done"))
    assignments = data.get("tasks", [])
    exams = sorted(
        [exam for exam in data.get("exams", []) if exam.get("date") and exam["date"] >= date.today().isoformat()],
        key=lambda exam: exam["date"],
    )
    logs = data.get("logs", [])
    today = date.today().isoformat()
    week_start = date.today().fromordinal(date.today().toordinal() - date.today().weekday()).isoformat()
    week_logs = [log for log in logs if week_start <= str(log.get("date", "")) <= today]
    return {
        "id": student.id,
        "full_name": student.full_name,
        "student_id": student.student_id,
        "department": student.department,
        "academic_year": student.academic_year,
        "semester": student.semester,
        "total_subjects": len(data.get("subjects", [])),
        "completed_study_sessions": completed_sessions,
        "active_backlogs": int(active_backlogs),
        "cleared_backlogs": int(total_backlogs) - int(active_backlogs),
        "daily_study_minutes": sum(int(log.get("minutes", 0) or 0) for log in logs if log.get("date") == today),
        "weekly_study_minutes": sum(int(log.get("minutes", 0) or 0) for log in week_logs),
        "completed_assignments": sum(1 for task in assignments if task.get("kind") == "assignment" and (task.get("done") or task.get("status") == "Submitted")),
        "pending_assignments": sum(1 for task in assignments if task.get("kind") == "assignment" and not task.get("done") and task.get("status") != "Submitted"),
        "upcoming_exams": exams[:5],
    }


@bp.route("/admin/assignments", methods=["GET"])
@jwt_required()
@role_required("admin")
def list_assignments():
    students = User.query.filter_by(role=RoleEnum.STUDENT).order_by(User.full_name).all()
    mentors = User.query.filter_by(role=RoleEnum.MENTOR, is_active=True).order_by(User.full_name).all()
    history = (
        db.session.query(MentorAssignment, User.full_name)
        .join(User, User.id == MentorAssignment.mentor_id)
        .order_by(MentorAssignment.assigned_at.desc(), MentorAssignment.id.desc())
        .all()
    )
    assignments = [(item, mentor_name) for item, mentor_name in history if item.active]
    current_mentor_names = {item.student_id: mentor_name for item, mentor_name in assignments}
    actively_assigned_student_ids = set(current_mentor_names)
    student_names = {student.id: student.full_name for student in students}
    return jsonify({
        "students": [
            {
                "id": student.id,
                "full_name": student.full_name,
                "email": student.email,
                "student_id": student.student_id,
                "department": student.department,
                "academic_year": student.academic_year,
                "semester": student.semester,
                "current_mentor": current_mentor_names.get(student.id),
                "assignment_locked": student.id in actively_assigned_student_ids,
            }
            for student in students
        ],
        "mentors": [{"id": mentor.id, "full_name": mentor.full_name, "employee_id": mentor.employee_id, "department": mentor.department, "email": mentor.email} for mentor in mentors],
        "assignments": [{"id": item.id, "mentor_id": item.mentor_id, "student_id": item.student_id, "assigned_at": item.assigned_at.isoformat()} for item, _ in assignments],
        "history": [
            {
                "id": item.id,
                "student_id": item.student_id,
                "student_name": student_names.get(item.student_id, "Unknown student"),
                "mentor_id": item.mentor_id,
                "mentor_name": mentor_name,
                "active": item.active,
                "assigned_at": item.assigned_at.isoformat(),
                "ended_at": item.ended_at.isoformat() if item.ended_at else None,
            }
            for item, mentor_name in history
        ],
    })


@bp.route("/admin/assignments", methods=["POST"])
@jwt_required()
@role_required("admin")
def assign_students():
    data = request.get_json(silent=True)
    student_ids = data.get("student_ids") if isinstance(data, dict) else None
    mentor_id = data.get("mentor_id") if isinstance(data, dict) else None
    if not isinstance(student_ids, list) or not student_ids:
        return jsonify({"error": "Select at least one student"}), 400
    try:
        mentor_id = int(mentor_id)
        student_ids = list(dict.fromkeys(int(student_id) for student_id in student_ids))
    except (TypeError, ValueError):
        return jsonify({"error": "Mentor and student IDs must be valid"}), 400
    mentor = User.query.filter_by(id=mentor_id, role=RoleEnum.MENTOR, is_active=True).first()
    if not mentor:
        return jsonify({"error": "Select an active mentor"}), 400
    students = (
        User.query.filter(
            User.id.in_(student_ids),
            User.role == RoleEnum.STUDENT,
            User.is_active.is_(True),
        )
        .order_by(User.id)
        .with_for_update()
        .all()
    )
    if len(students) != len(student_ids):
        return jsonify({"error": "One or more selected students do not exist or are inactive"}), 404
    active_assignments = MentorAssignment.query.filter(
        MentorAssignment.student_id.in_(student_ids),
        MentorAssignment.active.is_(True),
    ).all()
    if active_assignments:
        return jsonify({"error": "Students with an active mentor assignment cannot be reassigned"}), 409

    existing_claims = {
        claim.student_id: claim
        for claim in PermanentMentorAssignment.query.filter(
        PermanentMentorAssignment.student_id.in_(student_ids)
        ).all()
    }

    admins = User.query.filter_by(role=RoleEnum.ADMIN).all()
    try:
        with db.session.begin_nested():
            for student in students:
                assignment = MentorAssignment(mentor_id=mentor.id, student_id=student.id)
                db.session.add(assignment)
                db.session.flush()
                claim = existing_claims.get(student.id)
                if claim:
                    claim.mentor_id = mentor.id
                    claim.assignment_id = assignment.id
                    claim.assigned_at = assignment.assigned_at
                else:
                    db.session.add(PermanentMentorAssignment(
                        student_id=student.id,
                        mentor_id=mentor.id,
                        assignment_id=assignment.id,
                        assigned_at=assignment.assigned_at,
                    ))
                notify(student.id, "Mentor assigned", f"{mentor.full_name} is your permanently assigned mentor.", "assignment")
                notify(mentor.id, "New mentee assigned", f"{student.full_name} was assigned to you.", "assignment")
                for admin in admins:
                    notify(admin.id, "Mentor assignment updated", f"{student.full_name} was assigned to {mentor.full_name}.", "assignment")
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({"error": "Students with an active mentor assignment cannot be reassigned"}), 409
    return jsonify({"msg": "Assignments saved"}), 200


@bp.route("/admin/assignments/<int:student_id>", methods=["DELETE"])
@jwt_required()
@role_required("admin")
def remove_assignment(student_id):
    return jsonify({"error": "Mentor assignments are permanent and cannot be removed"}), 409


@bp.route("/mentor/students", methods=["GET"])
@jwt_required()
@role_required("mentor")
def mentor_students():
    backlog_summary = (
        db.session.query(
            Backlog.student_id.label("student_id"),
            func.count(Backlog.id).label("total_backlogs"),
            func.coalesce(func.sum(case((Backlog.status != "Cleared", 1), else_=0)), 0).label("active_backlogs"),
        )
        .group_by(Backlog.student_id)
        .subquery()
    )
    rows = (
        db.session.query(
            User,
            StudentProgress.data,
            func.coalesce(backlog_summary.c.total_backlogs, 0),
            func.coalesce(backlog_summary.c.active_backlogs, 0),
        )
        .join(
            MentorAssignment,
            and_(
                MentorAssignment.student_id == User.id,
                MentorAssignment.mentor_id == current_user().id,
                MentorAssignment.active.is_(True),
            ),
        )
        .outerjoin(StudentProgress, StudentProgress.student_id == User.id)
        .outerjoin(backlog_summary, backlog_summary.c.student_id == User.id)
        .filter(User.role == RoleEnum.STUDENT)
        .order_by(User.full_name)
        .all()
    )
    return jsonify([
        student_json(student, progress_data or {}, (total_backlogs, active_backlogs))
        for student, progress_data, total_backlogs, active_backlogs in rows
    ])


@bp.route("/mentor/students/<int:student_id>", methods=["GET"])
@jwt_required()
@role_required("mentor")
def mentor_student_detail(student_id):
    mentor = current_user()
    student = db.session.get(User, student_id)
    if not student or student.role != RoleEnum.STUDENT or not is_current_pair(mentor, student):
        return jsonify({"error": "Student is not currently assigned to you"}), 403
    progress = progress_for(student.id)
    backlogs = Backlog.query.filter_by(student_id=student.id).order_by(Backlog.exam_date.asc()).all()
    feedback = MentorFeedback.query.filter_by(mentor_id=mentor.id, student_id=student.id).order_by(MentorFeedback.created_at.desc()).all()
    followups = FollowUpRecord.query.filter_by(mentor_id=mentor.id, student_id=student.id).order_by(FollowUpRecord.scheduled_for.asc()).all()
    return jsonify({
        "student": student_json(student),
        "progress": progress,
        "backlogs": [backlog_json(item) for item in backlogs],
        "feedback": [{"id": item.id, "content": item.content, "created_at": item.created_at.isoformat()} for item in feedback],
        "follow_ups": [{"id": item.id, "scheduled_for": item.scheduled_for.isoformat(), "notes": item.notes} for item in followups],
    })


@bp.route("/students/me/progress", methods=["GET", "PUT"])
@jwt_required()
@role_required("student")
def student_progress():
    student = current_user()
    record = db.session.get(StudentProgress, student.id)
    if request.method == "GET":
        return jsonify({"data": record.data if record else None})
    data = request.get_json(silent=True)
    if not isinstance(data, dict) or not isinstance(data.get("data"), dict):
        return jsonify({"error": "A progress data object is required"}), 400
    snapshot = data["data"]
    if len(json.dumps(snapshot, separators=(",", ":"))) > 250_000:
        return jsonify({"error": "Progress snapshot is too large"}), 413
    allowed = {"subjects", "sessions", "logs", "tasks", "exams"}
    if any(key in snapshot and not isinstance(snapshot[key], list) for key in allowed):
        return jsonify({"error": "Progress lists must be arrays"}), 400
    snapshot_changed = record is None or record.data != snapshot
    if not record:
        record = StudentProgress(student_id=student.id, data=snapshot)
        db.session.add(record)
    else:
        record.data = snapshot
        record.updated_at = datetime.utcnow()
    assignment = active_assignment(student.id)
    if assignment and snapshot_changed:
        recent = Notification.query.filter(
            Notification.user_id == assignment.mentor_id,
            Notification.kind == "progress",
            Notification.created_at >= datetime.utcnow() - timedelta(hours=1),
        ).first()
        if not recent:
            notify(assignment.mentor_id, "Mentee progress updated", f"{student.full_name} updated their academic progress.", "progress")
    db.session.commit()
    return jsonify({"updated_at": record.updated_at.isoformat()})


@bp.route("/students/me/mentor", methods=["GET"])
@jwt_required()
@role_required("student")
def student_mentor():
    assignment = active_assignment(current_user().id)
    mentor = db.session.get(User, assignment.mentor_id) if assignment else None
    return jsonify({"mentor": {"id": mentor.id, "full_name": mentor.full_name, "email": mentor.email, "department": mentor.department} if mentor else None})


@bp.route("/students/me/dashboard", methods=["GET"])
@jwt_required()
@role_required("student")
def student_dashboard():
    student = current_user()
    assignment = (
        db.session.query(MentorAssignment, User)
        .join(User, User.id == MentorAssignment.mentor_id)
        .filter(MentorAssignment.student_id == student.id, MentorAssignment.active.is_(True))
        .first()
    )
    mentor = assignment[1] if assignment else None
    backlogs = (
        Backlog.query.filter_by(student_id=student.id)
        .order_by(Backlog.exam_date.asc(), Backlog.created_at.desc())
        .all()
    )
    return jsonify({
        "mentor": {
            "id": mentor.id,
            "full_name": mentor.full_name,
            "email": mentor.email,
            "department": mentor.department,
        } if mentor else None,
        "backlogs": [backlog_json(item) for item in backlogs],
    })


def parse_backlog(data, backlog=None):
    if not isinstance(data, dict):
        return None, "A JSON object is required"
    subject_name = str(data.get("subject_name", backlog.subject_name if backlog else "")).strip()
    subject_code = str(data.get("subject_code", backlog.subject_code if backlog else "")).strip()
    semester = str(data.get("semester", backlog.semester if backlog else "")).strip()
    priority = str(data.get("priority", backlog.priority if backlog else "Medium"))
    status = str(data.get("status", backlog.status if backlog else "Not Started"))
    notes = str(data.get("notes", backlog.notes if backlog else "")).strip()
    progress = data.get("progress", backlog.progress if backlog else 0)
    exam_value = data.get("exam_date", backlog.exam_date.isoformat() if backlog and backlog.exam_date else "")
    if not subject_name or len(subject_name) > 160 or len(subject_code) > 40 or not semester or len(semester) > 20:
        return None, "Subject name and semester are required; subject fields must fit their limits"
    if priority not in PRIORITIES or status not in BACKLOG_STATUSES:
        return None, "Choose a valid priority and backlog status"
    if isinstance(progress, bool) or not isinstance(progress, int) or not 0 <= progress <= 100:
        return None, "Preparation progress must be between 0 and 100"
    try:
        exam_date = date.fromisoformat(exam_value) if exam_value else None
    except (TypeError, ValueError):
        return None, "Examination date must be a valid date"
    return {
        "subject_name": subject_name,
        "subject_code": subject_code,
        "semester": semester,
        "exam_date": exam_date,
        "priority": priority,
        "notes": notes[:5000],
        "progress": progress,
        "status": status,
    }, None


@bp.route("/students/me/backlogs", methods=["GET", "POST"])
@jwt_required()
@role_required("student")
def student_backlogs():
    student = current_user()
    if request.method == "GET":
        rows = Backlog.query.filter_by(student_id=student.id).order_by(Backlog.exam_date.asc(), Backlog.created_at.desc()).all()
        return jsonify([backlog_json(item) for item in rows])
    values, error = parse_backlog(request.get_json(silent=True))
    if error:
        return jsonify({"error": error}), 400
    backlog = Backlog(student_id=student.id, **values)
    db.session.add(backlog)
    assignment = active_assignment(student.id)
    if assignment:
        notify(assignment.mentor_id, "Mentee backlog updated", f"{student.full_name} added a backlog: {backlog.subject_name}.", "backlog")
    db.session.commit()
    return jsonify(backlog_json(backlog)), 201


@bp.route("/students/me/backlogs/<int:backlog_id>", methods=["PUT", "DELETE"])
@jwt_required()
@role_required("student")
def update_student_backlog(backlog_id):
    student = current_user()
    backlog = Backlog.query.filter_by(id=backlog_id, student_id=student.id).first()
    if not backlog:
        return jsonify({"error": "Backlog not found"}), 404
    if request.method == "DELETE":
        db.session.delete(backlog)
        db.session.commit()
        return jsonify({"msg": "Backlog deleted"})
    values, error = parse_backlog(request.get_json(silent=True), backlog)
    if error:
        return jsonify({"error": error}), 400
    for key, value in values.items():
        setattr(backlog, key, value)
    assignment = active_assignment(student.id)
    if assignment:
        notify(assignment.mentor_id, "Mentee backlog updated", f"{student.full_name} updated {backlog.subject_name}.", "backlog")
    db.session.commit()
    return jsonify(backlog_json(backlog))


@bp.route("/messages", methods=["GET", "POST"])
@jwt_required()
def messages():
    user = current_user()
    if not user or user.role == RoleEnum.ADMIN:
        return jsonify({"error": "Messaging is available to students and mentors"}), 403
    if request.method == "GET":
        try:
            other_id = int(request.args.get("with_user", ""))
        except ValueError:
            return jsonify({"error": "A valid conversation user is required"}), 400
        other = db.session.get(User, other_id)
        if not other or other.role not in (RoleEnum.STUDENT, RoleEnum.MENTOR) or not is_current_pair(user, other):
            return jsonify({"error": "Messages are limited to your current mentor/mentee assignment"}), 403
        rows = Message.query.filter(
            or_(
                (Message.sender_id == user.id) & (Message.receiver_id == other.id),
                (Message.sender_id == other.id) & (Message.receiver_id == user.id),
            )
        ).order_by(Message.sent_at.asc()).all()
        unread = [row for row in rows if row.receiver_id == user.id and row.read_at is None]
        for row in unread:
            row.read_at = datetime.utcnow()
        if unread:
            db.session.commit()
        return jsonify([{"id": row.id, "sender_id": row.sender_id, "receiver_id": row.receiver_id, "content": row.content, "sent_at": row.sent_at.isoformat(), "read": row.read_at is not None} for row in rows])
    data = request.get_json(silent=True)
    try:
        receiver_id = int(data.get("receiver_id")) if isinstance(data, dict) else 0
    except (TypeError, ValueError):
        receiver_id = 0
    receiver = db.session.get(User, receiver_id)
    content = str(data.get("content") or "").strip() if isinstance(data, dict) else ""
    if not receiver or receiver.role not in (RoleEnum.STUDENT, RoleEnum.MENTOR) or not is_current_pair(user, receiver):
        return jsonify({"error": "You can message only your currently assigned mentor or student"}), 403
    if not content or len(content) > 4000:
        return jsonify({"error": "Message must contain 1 to 4000 characters"}), 400
    message = Message(sender_id=user.id, receiver_id=receiver.id, content=content)
    db.session.add(message)
    notify(receiver.id, f"Message from {user.full_name}", content[:300], "message")
    db.session.commit()
    return jsonify({"id": message.id, "sender_id": message.sender_id, "receiver_id": message.receiver_id, "content": message.content, "sent_at": message.sent_at.isoformat(), "read": False}), 201


@bp.route("/notifications", methods=["GET"])
@jwt_required()
def notifications():
    user = current_user()
    if not user:
        return jsonify({"error": "User not found"}), 401
    if user.role == RoleEnum.STUDENT:
        create_student_reminders(user)
    rows = Notification.query.filter_by(user_id=user.id).order_by(Notification.created_at.desc()).limit(100).all()
    return jsonify([{"id": row.id, "title": row.title, "body": row.body, "kind": row.kind, "created_at": row.created_at.isoformat(), "read": row.read_at is not None} for row in rows])


@bp.route("/notifications/<int:notification_id>/read", methods=["POST"])
@jwt_required()
def mark_notification_read(notification_id):
    user = current_user()
    row = Notification.query.filter_by(id=notification_id, user_id=user.id if user else -1).first()
    if not row:
        return jsonify({"error": "Notification not found"}), 404
    if row.read_at is None:
        row.read_at = datetime.utcnow()
        db.session.commit()
    return jsonify({"msg": "Notification marked as read"})


@bp.route("/mentor/students/<int:student_id>/feedback", methods=["POST"])
@jwt_required()
@role_required("mentor")
def add_feedback(student_id):
    mentor = current_user()
    student = db.session.get(User, student_id)
    data = request.get_json(silent=True)
    content = str(data.get("content") or "").strip() if isinstance(data, dict) else ""
    if not student or not is_current_pair(mentor, student):
        return jsonify({"error": "Student is not currently assigned to you"}), 403
    if not content or len(content) > 4000:
        return jsonify({"error": "Feedback must contain 1 to 4000 characters"}), 400
    record = MentorFeedback(mentor_id=mentor.id, student_id=student.id, content=content)
    db.session.add(record)
    notify(student.id, "New mentor feedback", content[:300], "feedback")
    db.session.commit()
    return jsonify({"id": record.id, "content": record.content, "created_at": record.created_at.isoformat()}), 201


@bp.route("/mentor/students/<int:student_id>/follow-ups", methods=["POST"])
@jwt_required()
@role_required("mentor")
def schedule_follow_up(student_id):
    mentor = current_user()
    student = db.session.get(User, student_id)
    data = request.get_json(silent=True)
    try:
        scheduled_for = date.fromisoformat(data.get("scheduled_for", "")) if isinstance(data, dict) else None
    except ValueError:
        scheduled_for = None
    notes = str(data.get("notes") or "").strip()[:500] if isinstance(data, dict) else ""
    if not student or not is_current_pair(mentor, student):
        return jsonify({"error": "Student is not currently assigned to you"}), 403
    if not scheduled_for:
        return jsonify({"error": "A valid follow-up date is required"}), 400
    record = FollowUpRecord(mentor_id=mentor.id, student_id=student.id, scheduled_for=scheduled_for, notes=notes)
    db.session.add(record)
    notify(student.id, "Follow-up scheduled", f"{mentor.full_name} scheduled a follow-up for {scheduled_for.isoformat()}.", "follow-up")
    db.session.commit()
    return jsonify({"id": record.id, "scheduled_for": record.scheduled_for.isoformat(), "notes": record.notes}), 201
