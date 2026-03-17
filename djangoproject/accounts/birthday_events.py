from __future__ import annotations

import calendar
from datetime import date
from typing import Dict, Iterable, List

from .models import Connection, Person


def add_months(value: date, months: int) -> date:
    """Return a date shifted by whole calendar months."""
    month_index = value.month - 1 + months
    year = value.year + month_index // 12
    month = month_index % 12 + 1
    max_day = calendar.monthrange(year, month)[1]
    day = min(value.day, max_day)
    return date(year, month, day)


def _safe_date(year: int, month: int, day: int) -> date:
    """Build date and clamp invalid day-of-month (e.g., Feb 29 in non-leap years)."""
    max_day = calendar.monthrange(year, month)[1]
    return date(year, month, min(day, max_day))


def _birthday_occurrences_around_today(birthday: date, today: date) -> tuple[date, date]:
    this_year = _safe_date(today.year, birthday.month, birthday.day)

    if this_year <= today:
        last_occurrence = this_year
    else:
        last_occurrence = _safe_date(today.year - 1, birthday.month, birthday.day)

    if this_year >= today:
        next_occurrence = this_year
    else:
        next_occurrence = _safe_date(today.year + 1, birthday.month, birthday.day)

    return last_occurrence, next_occurrence


def _person_payload(person: Person) -> Dict:
    return {
        "id": person.id,
        "first_name": person.first_name,
        "last_name": person.last_name,
        "email": person.email,
        "phone": person.phone,
        "organization": person.organization,
        "location": person.location,
        "birthday": person.birthday.isoformat() if person.birthday else None,
        "extra_contacts": person.extra_contacts,
        "is_app_user": person.is_app_user,
        "profile_picture_url": None,
    }


def _display_name(person: Person) -> str:
    full_name = f"{person.first_name or ''} {person.last_name or ''}".strip()
    return full_name or person.email or f"Person {person.id}"


def _birthday_title(person: Person) -> str:
    name = _display_name(person)
    if name.endswith("s"):
        return f"{name}' Birthday"
    return f"{name}'s Birthday"


def _build_virtual_birthday_event(person: Person, occurrence: date, source_today: date) -> Dict:
    turning_age = None
    if person.birthday:
        turning_age = occurrence.year - person.birthday.year

    display_title = _birthday_title(person)
    if turning_age is not None and turning_age > 0:
        display_title = f"{display_title} (turning {turning_age})"

    event_id = f"virtual-birthday-{person.id}-{occurrence.isoformat()}"
    person_data = _person_payload(person)
    return {
        "id": event_id,
        "start_date": occurrence.isoformat(),
        "end_date": None,
        "type": "birthday",
        "title": _birthday_title(person),
        "display_title": display_title,
        "notes": "",
        "people": [person_data],
        "person": person_data,
        "tags": [],
        "created_at": None,
        "updated_at": None,
        "is_virtual": True,
        "source": "person_birthday",
        "person_id": person.id,
        "time_bucket": "upcoming" if occurrence >= source_today else "past",
    }


def birthday_people_for_user(user_person: Person) -> Iterable[Person]:
    """People whose birthdays should be visible for this user."""
    people_by_id: Dict[int, Person] = {user_person.id: user_person}
    accepted_connections = (
        Connection.objects.filter(owner=user_person, status=Connection.ACCEPTED)
        .select_related("target")
    )
    for conn in accepted_connections:
        people_by_id[conn.target.id] = conn.target
    return people_by_id.values()


def build_virtual_birthday_events(user_person: Person, today: date | None = None) -> List[Dict]:
    """Return birthday events that fall within +/- 6 months of today."""
    today = today or date.today()
    window_start = add_months(today, -6)
    window_end = add_months(today, 6)

    result: List[Dict] = []
    for person in birthday_people_for_user(user_person):
        if not person.birthday:
            continue

        last_occurrence, next_occurrence = _birthday_occurrences_around_today(person.birthday, today)
        candidates = [last_occurrence, next_occurrence]

        seen_dates = set()
        for occurrence in candidates:
            if occurrence in seen_dates:
                continue
            seen_dates.add(occurrence)

            if window_start <= occurrence <= window_end:
                result.append(_build_virtual_birthday_event(person, occurrence, today))

    result.sort(key=lambda item: item["start_date"])
    return result
