"""test_api: Comprehensive backend test-suite for the Person / Connection schema.

This replaces the old Contact-based tests that were removed during the
refactor.  It covers:

1.  Person / Account linkage helper.
2.  Authentication helper views (signin / signout / get_user).
3.  ConnectionViewSet – create / accept / decline / unique constraint.
4.  InteractionViewSet – creation & permissions.
5.  Dashboard API – events & notifications within 30 days.
6.  User Profile API – retrieve and update user profile data.
"""

from datetime import date, timedelta

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase, APIClient

from .models import (
    Person,
    Account,
    Connection,
    Interaction,
    Event,
    Notification,
)
from .birthday_events import add_months

User = get_user_model()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def create_user_with_person(email: str, password: str = "password", **person_kwargs):
    """Utility – create a django User + linked Person/Account in one go."""
    user = User.objects.create_user(username=email, email=email, password=password)

    person_defaults = {
        "first_name": email.split("@")[0].title(),
        "last_name": "Test",
    }
    person_defaults.update(person_kwargs)

    person = Person.objects.create(**person_defaults)
    Account.objects.create(user=user, person=person)
    return user, person


# ---------------------------------------------------------------------------
# Test cases
# ---------------------------------------------------------------------------

class UserProfileAPITests(APITestCase):
    """Tests for the user profile endpoints."""

    def setUp(self):
        self.user, self.person = create_user_with_person(
            "profile@example.com",
            first_name="John",
            last_name="Doe",
            phone="123-456-7890",
            birthday=date(1990, 1, 1),
            contact_email="john.contact@example.com",
        )
        self.client.force_authenticate(self.user)
        self.profile_url = reverse("user_profile")

    def test_get_profile(self):
        """GET /profile should return user and linked person data."""
        response = self.client.get(self.profile_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["first_name"], "John")
        self.assertEqual(response.data["last_name"], "Doe")
        self.assertEqual(response.data["login_email"], "profile@example.com")
        self.assertEqual(response.data["email"], "profile@example.com")
        self.assertEqual(response.data["contact_email"], "john.contact@example.com")
        self.assertEqual(response.data["phone"], "123-456-7890")
        self.assertEqual(response.data["birthday"], date(1990, 1, 1))
        first_name = response.data["first_name"]
        # Ensure first_name fallback worked
        self.assertEqual(first_name, "John")

    def test_update_profile_contact_email_does_not_change_login_email(self):
        """PATCH /profile should update contact email only."""
        payload = {
            "first_name": "Johnny",
            "last_name": "Smith",
            "contact_email": "new-contact@example.com",
        }
        response = self.client.patch(self.profile_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Verify User model first/last were updated, login email unchanged
        self.user.refresh_from_db()
        self.person.refresh_from_db()
        self.assertEqual(self.user.first_name, "Johnny")
        self.assertEqual(self.user.last_name, "Smith")
        self.assertEqual(self.user.email, "profile@example.com")
        self.assertEqual(self.person.contact_email, "new-contact@example.com")

    def test_update_profile_person_fields(self):
        """PATCH /profile should update Person model fields."""
        payload = {
            "phone": "098-765-4321",
            "birthday": "1991-02-02"
        }
        response = self.client.patch(self.profile_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Verify Person model was updated
        self.person.refresh_from_db()
        self.assertEqual(self.person.phone, "098-765-4321")
        self.assertEqual(self.person.birthday.isoformat(), "1991-02-02")

    def test_update_profile_mixed_fields(self):
        """PATCH /profile should handle both User and Person fields together."""
        payload = {
            "first_name": "Jane",  # User field
            "phone": "555-0123"    # Person field
        }
        response = self.client.patch(self.profile_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Verify both models were updated
        self.user.refresh_from_db()
        self.person.refresh_from_db()
        self.assertEqual(self.user.first_name, "Jane")
        self.assertEqual(self.person.phone, "555-0123")

    def test_profile_requires_auth(self):
        """Profile endpoints should require authentication."""
        self.client.force_authenticate(user=None)  # logout
        get_response = self.client.get(self.profile_url)
        patch_response = self.client.patch(self.profile_url, {"first_name": "Test"})
        self.assertEqual(get_response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(patch_response.status_code, status.HTTP_401_UNAUTHORIZED)


class ConnectionAPITests(APITestCase):
    """End-to-end tests for the ConnectionViewSet endpoints."""

    def setUp(self):
        self.alice_user, self.alice_person = create_user_with_person("alice@example.com")
        self.bob_user, self.bob_person = create_user_with_person("bob@example.com")
        # A manual-only person (non-app user)
        self.charlie_person = Person.objects.create(first_name="Charlie", email="charlie@manual.com")

        self.client: APIClient = self.client  # type hint
        self.connection_list_url = reverse("connection-list")

    # ------------------------------------------------------------------
    # Creation
    # ------------------------------------------------------------------
    def test_create_connection_to_app_user_is_pending(self):
        """POST /connections should yield a *pending* row when the target is an app user."""
        self.client.force_authenticate(self.alice_user)
        payload = {"target_person_id": self.bob_person.id}
        response = self.client.post(self.connection_list_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        conn = Connection.objects.get()
        self.assertEqual(conn.owner, self.alice_person)
        self.assertEqual(conn.target, self.bob_person)
        self.assertEqual(conn.status, Connection.PENDING)

    def test_create_connection_to_manual_person_is_accepted(self):
        """If target person has no linked app account, row should be *accepted*."""
        self.client.force_authenticate(self.alice_user)
        payload = {"target_person_id": self.charlie_person.id}
        response = self.client.post(self.connection_list_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        conn = Connection.objects.get()
        self.assertEqual(conn.status, Connection.ACCEPTED)

    def test_unique_owner_target_enforced(self):
        self.client.force_authenticate(self.alice_user)
        payload = {"target_person_id": self.bob_person.id}
        self.client.post(self.connection_list_url, payload, format="json")
        dup_resp = self.client.post(self.connection_list_url, payload, format="json")
        self.assertEqual(dup_resp.status_code, status.HTTP_201_CREATED)  # view always returns 201
        self.assertEqual(Connection.objects.count(), 1)

    def test_create_manual_contact_persists_connection_notes(self):
        """Manual-contact create should store owner notes on Connection, not Person."""
        self.client.force_authenticate(self.alice_user)
        payload = {
            "first_name": "Manny",
            "email": "manny@example.com",
            "notes": "Met at conference",
        }
        response = self.client.post(self.connection_list_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        conn = Connection.objects.get(owner=self.alice_person, target__first_name="Manny")
        self.assertEqual(conn.notes, "Met at conference")
        self.assertEqual(conn.target.notes, "")
        self.assertEqual(response.data["notes"], "Met at conference")

    def test_update_connection_notes_for_app_user(self):
        """PATCH on an app-user connection should persist owner-scoped notes."""
        conn = Connection.objects.create(
            owner=self.alice_person,
            target=self.bob_person,
            status=Connection.ACCEPTED,
        )
        self.client.force_authenticate(self.alice_user)
        detail_url = reverse("connection-detail", args=[conn.id])
        resp = self.client.patch(detail_url, {"notes": "Follow up next week"}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

        conn.refresh_from_db()
        self.assertEqual(conn.notes, "Follow up next week")
        self.assertEqual(resp.data["notes"], "Follow up next week")

    def test_connection_notes_representation_falls_back_to_legacy_person_notes(self):
        """If connection.notes is empty, serializer should fall back to target.notes."""
        legacy_person = Person.objects.create(first_name="Legacy", notes="Legacy note source")
        conn = Connection.objects.create(
            owner=self.alice_person,
            target=legacy_person,
            status=Connection.ACCEPTED,
            notes="",
        )
        self.client.force_authenticate(self.alice_user)
        detail_url = reverse("connection-detail", args=[conn.id])
        resp = self.client.get(detail_url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["notes"], "Legacy note source")

    # ------------------------------------------------------------------
    # Accept / decline
    # ------------------------------------------------------------------
    def test_accept_connection(self):
        # Alice ➜ Bob pending
        conn = Connection.objects.create(owner=self.alice_person, target=self.bob_person, status=Connection.PENDING)

        self.client.force_authenticate(self.bob_user)
        url = reverse("connection-accept", args=[conn.id])
        resp = self.client.post(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        conn.refresh_from_db()
        self.assertEqual(conn.status, Connection.ACCEPTED)
        # Bob should now have reciprocal row
        self.assertTrue(Connection.objects.filter(owner=self.bob_person, target=self.alice_person, status=Connection.ACCEPTED).exists())

    def test_decline_connection(self):
        conn = Connection.objects.create(owner=self.alice_person, target=self.bob_person, status=Connection.PENDING)
        self.client.force_authenticate(self.bob_user)
        url = reverse("connection-decline", args=[conn.id])
        resp = self.client.post(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        conn.refresh_from_db()
        self.assertEqual(conn.status, Connection.DECLINED)


class InteractionAPITests(APITestCase):
    """Tests for logging interactions between people."""

    def setUp(self):
        self.alice_user, self.alice_person = create_user_with_person("alice@example.com")
        self.bob_user, self.bob_person = create_user_with_person("bob@example.com")
        # Mutual accepted connection
        Connection.objects.create(owner=self.alice_person, target=self.bob_person, status=Connection.ACCEPTED)
        Connection.objects.create(owner=self.bob_person, target=self.alice_person, status=Connection.ACCEPTED)

        self.interaction_list_url = reverse("interaction-list")
        self.client: APIClient = self.client

    def test_create_interaction_success(self):
        self.client.force_authenticate(self.alice_user)
        payload = {
            "actor_person_id": self.alice_person.id,
            "target_person_id": self.bob_person.id,
            "date": date.today().isoformat(),
            "type": Interaction.CALL,
            "notes": "Catch-up call",
        }
        resp = self.client.post(self.interaction_list_url, payload, format="json")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Interaction.objects.count(), 1)

    def test_interaction_requires_connection(self):
        charlie_user, charlie_person = create_user_with_person("charlie@example.com")
        self.client.force_authenticate(self.alice_user)
        payload = {
            "actor_person_id": self.alice_person.id,
            "target_person_id": charlie_person.id,
            "date": date.today().isoformat(),
            "type": Interaction.CALL,
        }
        resp = self.client.post(self.interaction_list_url, payload, format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("connection", str(resp.data).lower())

    def test_interactions_filtered_by_user(self):
        """Test that interactions are properly filtered per user."""
        # Create a third user with connection to bob
        charlie_user, charlie_person = create_user_with_person("charlie@example.com")
        Connection.objects.create(owner=self.bob_person, target=charlie_person, status=Connection.ACCEPTED)
        Connection.objects.create(owner=charlie_person, target=self.bob_person, status=Connection.ACCEPTED)
        
        # Create interactions:
        # 1. Alice -> Bob
        # 2. Bob -> Charlie  
        # 3. Charlie -> Bob
        interaction1 = Interaction.objects.create(
            actor=self.alice_person,
            target=self.bob_person,
            date=date.today(),
            type=Interaction.CALL,
            notes="Alice to Bob"
        )
        interaction2 = Interaction.objects.create(
            actor=self.bob_person,
            target=charlie_person,
            date=date.today(),
            type=Interaction.MESSAGE,
            notes="Bob to Charlie"
        )
        interaction3 = Interaction.objects.create(
            actor=charlie_person,
            target=self.bob_person,
            date=date.today(),
            type=Interaction.EMAIL,
            notes="Charlie to Bob"
        )
        
        # Test Alice's view - should see only interaction1 (Alice->Bob)
        self.client.force_authenticate(self.alice_user)
        resp = self.client.get(self.interaction_list_url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        alice_interactions = resp.data
        self.assertEqual(len(alice_interactions), 1)
        self.assertEqual(alice_interactions[0]["id"], interaction1.id)
        
        # Test Bob's view - should see interaction1 (Alice->Bob) and interactions 2,3 (Bob<->Charlie)
        self.client.force_authenticate(self.bob_user)
        resp = self.client.get(self.interaction_list_url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        bob_interactions = resp.data
        self.assertEqual(len(bob_interactions), 3)
        bob_interaction_ids = {i["id"] for i in bob_interactions}
        self.assertEqual(bob_interaction_ids, {interaction1.id, interaction2.id, interaction3.id})
        
        # Test Charlie's view - should see only interactions 2,3 (Bob<->Charlie)
        self.client.force_authenticate(charlie_user)
        resp = self.client.get(self.interaction_list_url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        charlie_interactions = resp.data
        self.assertEqual(len(charlie_interactions), 2)
        charlie_interaction_ids = {i["id"] for i in charlie_interactions}
        self.assertEqual(charlie_interaction_ids, {interaction2.id, interaction3.id})

    def test_interactions_filtered_by_target_parameter(self):
        """Test that interactions can be filtered by target query parameter."""
        # Create a third user with connection to both alice and bob
        charlie_user, charlie_person = create_user_with_person("charlie@example.com")
        Connection.objects.create(owner=self.alice_person, target=charlie_person, status=Connection.ACCEPTED)
        Connection.objects.create(owner=charlie_person, target=self.alice_person, status=Connection.ACCEPTED)
        
        # Create interactions:
        # 1. Alice -> Bob
        # 2. Alice -> Charlie
        # 3. Bob -> Alice
        interaction1 = Interaction.objects.create(
            actor=self.alice_person,
            target=self.bob_person,
            date=date.today(),
            type=Interaction.CALL,
            notes="Alice to Bob"
        )
        interaction2 = Interaction.objects.create(
            actor=self.alice_person,
            target=charlie_person,
            date=date.today(),
            type=Interaction.MESSAGE,
            notes="Alice to Charlie"
        )
        interaction3 = Interaction.objects.create(
            actor=self.bob_person,
            target=self.alice_person,
            date=date.today(),
            type=Interaction.EMAIL,
            notes="Bob to Alice"
        )
        
        # Test Alice filtering by Bob - should see interactions 1,3 (Alice<->Bob)
        self.client.force_authenticate(self.alice_user)
        resp = self.client.get(f"{self.interaction_list_url}?target={self.bob_person.id}")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        alice_bob_interactions = resp.data
        self.assertEqual(len(alice_bob_interactions), 2)
        alice_bob_ids = {i["id"] for i in alice_bob_interactions}
        self.assertEqual(alice_bob_ids, {interaction1.id, interaction3.id})
        
        # Test Alice filtering by Charlie - should see only interaction2 (Alice->Charlie)
        resp = self.client.get(f"{self.interaction_list_url}?target={charlie_person.id}")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        alice_charlie_interactions = resp.data
        self.assertEqual(len(alice_charlie_interactions), 1)
        self.assertEqual(alice_charlie_interactions[0]["id"], interaction2.id)


class DashboardAPITests(APITestCase):
    """Verify upcoming events & notifications logic for /dashboard/ endpoint."""

    def setUp(self):
        self.user, self.person = create_user_with_person("demo@example.com")
        self.client.force_authenticate(self.user)
        self.dashboard_url = reverse("dashboard")

    def test_dashboard_returns_one_year_range_events(self):
        today = date.today()
        events = Event.objects.bulk_create([
            Event(user=self.user, start_date=today - timedelta(days=364), type=Event.GENERAL, title="Inside Past Year"),
            Event(user=self.user, start_date=today + timedelta(days=364), type=Event.GENERAL, title="Inside Future Year"),
            Event(user=self.user, start_date=today - timedelta(days=366), type=Event.GENERAL, title="Outside Past Year"),
            Event(user=self.user, start_date=today + timedelta(days=366), type=Event.GENERAL, title="Outside Future Year"),
        ])
        
        # Add people to events after bulk creation
        for event in events:
            event.people.add(self.person)
        resp = self.client.get(self.dashboard_url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        returned_titles = {e["title"] for e in resp.data["events"]}
        self.assertIn("Inside Past Year", returned_titles)
        self.assertIn("Inside Future Year", returned_titles)
        self.assertNotIn("Outside Past Year", returned_titles)
        self.assertNotIn("Outside Future Year", returned_titles)

    def test_dashboard_notifications_order(self):
        Notification.objects.create(
            user=self.user,
            type=Notification.NO_CONTACT,
            message="First",
            person=self.person,
            date=date.today(),
        )
        Notification.objects.create(
            user=self.user,
            type=Notification.NO_CONTACT,
            message="Second",
            person=self.person,
            date=date.today(),
        )
        resp = self.client.get(self.dashboard_url)
        self.assertEqual(len(resp.data["notifications"]), 2)


# ---------------------------------------------------------------------------
# Basic auth flow sanity (signin / signout / get_user)
# ---------------------------------------------------------------------------

class AuthViewTests(APITestCase):
    def setUp(self):
        self.user, _ = create_user_with_person("signin@example.com", password="strongpass")
        self.signin_url = reverse("signin")
        self.signout_url = reverse("signout")
        self.get_user_url = reverse("get_user")

    def test_signin_and_signout_cycle(self):
        resp = self.client.post(self.signin_url, {"email": self.user.email, "password": "strongpass"}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertTrue(resp.json().get("success"))
        access = resp.json()["tokens"]["access"]

        # JWT flow: include bearer token when calling authenticated endpoints
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        resp_user = self.client.get(self.get_user_url)
        self.assertEqual(resp_user.status_code, status.HTTP_200_OK)
        self.assertTrue(resp_user.json()["success"])

        # Signout endpoint is a no-op server-side for JWT; client discards token
        self.assertEqual(self.client.post(self.signout_url).status_code, status.HTTP_200_OK)
        self.client.credentials()
        resp_after_logout = self.client.get(self.get_user_url)
        self.assertEqual(resp_after_logout.status_code, status.HTTP_401_UNAUTHORIZED)

# ---------------------------------------------------------------------------
# Event CRUD & permissions
# ---------------------------------------------------------------------------

class EventAPITests(APITestCase):
    """CRUD tests for the Event endpoints."""

    def setUp(self):
        self.user, self.person = create_user_with_person("eventer@example.com")
        self.other_user, _ = create_user_with_person("other@example.com")
        self.client.force_authenticate(self.user)
        self.event_list_url = reverse("event-list")

    def test_create_event(self):
        payload = {
            "start_date": date.today().isoformat(),
            "type": "general",
            "title": "Lunch with Bob",
            "people_ids": [self.person.id],
        }
        resp = self.client.post(self.event_list_url, payload, format="json")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Event.objects.count(), 1)

    def test_list_events_only_for_current_user(self):
        # Create event for other user
        Event.objects.create(user=self.other_user, start_date=date.today(), type="general", title="Other user")
        Event.objects.create(user=self.user, start_date=date.today(), type="general", title="Mine")
        resp = self.client.get(self.event_list_url)
        titles = {e["title"] for e in resp.data}
        self.assertEqual(titles, {"Mine"})

    def test_update_event(self):
        ev = Event.objects.create(user=self.user, start_date=date.today(), type="general", title="Old Title")
        url = reverse("event-detail", args=[ev.id])
        resp = self.client.patch(url, {"title": "New Title"}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        ev.refresh_from_db()
        self.assertEqual(ev.title, "New Title")

    def test_user_cannot_edit_others_event(self):
        ev = Event.objects.create(user=self.other_user, start_date=date.today(), type="general", title="Not Yours")
        url = reverse("event-detail", args=[ev.id])
        resp = self.client.patch(url, {"title": "Hack"}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)

    def test_delete_event(self):
        ev = Event.objects.create(user=self.user, start_date=date.today(), type="general", title="Delete Me")
        url = reverse("event-detail", args=[ev.id])
        resp = self.client.delete(url)
        self.assertEqual(resp.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Event.objects.filter(id=ev.id).exists())

    def test_event_list_includes_virtual_birthdays_within_six_month_window(self):
        today = date.today()
        past_day = add_months(today, -3)
        upcoming_day = add_months(today, 2)

        _, past_person = create_user_with_person(
            "past-bday@example.com",
            first_name="Past",
            birthday=date(1993, past_day.month, past_day.day),
        )
        _, upcoming_person = create_user_with_person(
            "upcoming-bday@example.com",
            first_name="Upcoming",
            birthday=date(1995, upcoming_day.month, upcoming_day.day),
        )

        Connection.objects.create(owner=self.person, target=past_person, status=Connection.ACCEPTED)
        Connection.objects.create(owner=self.person, target=upcoming_person, status=Connection.ACCEPTED)

        resp = self.client.get(self.event_list_url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

        virtual_birthdays = [e for e in resp.data if e.get("is_virtual") and e.get("source") == "person_birthday"]
        ids = {e["id"] for e in virtual_birthdays}
        self.assertIn(f"virtual-birthday-{past_person.id}-{date(today.year, past_day.month, past_day.day).isoformat()}", ids)
        self.assertIn(f"virtual-birthday-{upcoming_person.id}-{date(today.year, upcoming_day.month, upcoming_day.day).isoformat()}", ids)

        # Ensure they are clearly birthday events and include metadata required by UI.
        for event in virtual_birthdays:
            self.assertEqual(event["type"], Event.BIRTHDAY)
            self.assertTrue(event["is_virtual"])
            self.assertEqual(event["source"], "person_birthday")
            self.assertIn("time_bucket", event)

    def test_six_month_boundary_birthdays_are_included(self):
        today = date.today()
        six_months_past = add_months(today, -6)
        six_months_upcoming = add_months(today, 6)

        _, past_boundary_person = create_user_with_person(
            "past-boundary@example.com",
            first_name="PastBoundary",
            birthday=date(1988, six_months_past.month, six_months_past.day),
        )
        _, upcoming_boundary_person = create_user_with_person(
            "upcoming-boundary@example.com",
            first_name="UpcomingBoundary",
            birthday=date(1989, six_months_upcoming.month, six_months_upcoming.day),
        )

        Connection.objects.create(owner=self.person, target=past_boundary_person, status=Connection.ACCEPTED)
        Connection.objects.create(owner=self.person, target=upcoming_boundary_person, status=Connection.ACCEPTED)

        resp = self.client.get(self.event_list_url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        virtual_birthdays = [e for e in resp.data if e.get("is_virtual")]

        expected_past_id = f"virtual-birthday-{past_boundary_person.id}-{date(today.year, six_months_past.month, six_months_past.day).isoformat()}"
        expected_upcoming_id = f"virtual-birthday-{upcoming_boundary_person.id}-{date(today.year, six_months_upcoming.month, six_months_upcoming.day).isoformat()}"
        returned_ids = {e["id"] for e in virtual_birthdays}

        self.assertIn(expected_past_id, returned_ids)
        self.assertIn(expected_upcoming_id, returned_ids)

    def test_virtual_birthday_events_are_immutable_via_event_detail_endpoints(self):
        today = date.today()
        target_day = add_months(today, 1)

        _, birthday_person = create_user_with_person(
            "readonly-bday@example.com",
            first_name="ReadOnly",
            birthday=date(1992, target_day.month, target_day.day),
        )
        Connection.objects.create(owner=self.person, target=birthday_person, status=Connection.ACCEPTED)

        list_resp = self.client.get(self.event_list_url)
        self.assertEqual(list_resp.status_code, status.HTTP_200_OK)
        virtual_event = next(
            e
            for e in list_resp.data
            if e.get("is_virtual") and e.get("person_id") == birthday_person.id
        )

        detail_url = reverse("event-detail", args=[virtual_event["id"]])
        patch_resp = self.client.patch(detail_url, {"title": "Mutate"}, format="json")
        delete_resp = self.client.delete(detail_url)

        self.assertEqual(patch_resp.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(delete_resp.status_code, status.HTTP_404_NOT_FOUND)

# ---------------------------------------------------------------------------
# Notification serializer logic
# ---------------------------------------------------------------------------

class NotificationLogicTests(APITestCase):
    """Verify daysSince and message formatting for NO_CONTACT notifications."""

    def setUp(self):
        self.user, self.person = create_user_with_person("notify@example.com")
        self.client.force_authenticate(self.user)

    def test_days_since_uses_connection_last_contact(self):
        # Create a different person to avoid self-connection issues
        other_user, other_person = create_user_with_person("other@example.com")
        conn = Connection.objects.create(
            owner=self.person, 
            target=other_person, 
            status=Connection.ACCEPTED, 
            last_contact_date=date.today()-timedelta(days=10),
            no_contact_threshold=5  # Set threshold so notification won't be auto-removed
        )
        notif = Notification.objects.create(
            user=self.user, 
            type=Notification.NO_CONTACT, 
            message="placeholder", 
            person=other_person
        )
        dashboard_url = reverse("dashboard")
        resp = self.client.get(dashboard_url)
        self.assertGreater(len(resp.data["notifications"]), 0, "Expected at least one notification")
        first_notif = resp.data["notifications"][0]
        self.assertEqual(first_notif["daysSince"], 10)
        self.assertIn("10", first_notif["message"])

# ---------------------------------------------------------------------------
# Connection reciprocal delete cascade
# ---------------------------------------------------------------------------

class ConnectionReciprocityTests(APITestCase):
    def setUp(self):
        self.a_user, self.a_person = create_user_with_person("a@example.com")
        self.b_user, self.b_person = create_user_with_person("b@example.com")
        self.client.force_authenticate(self.a_user)
        self.conn_url = reverse("connection-list")

    def test_reciprocal_created_on_accept_and_removed_on_delete(self):
        # A creates pending request to B
        self.client.post(self.conn_url, {"target_person_id": self.b_person.id}, format="json")
        conn = Connection.objects.get(owner=self.a_person, target=self.b_person)
        # B accepts
        self.client.force_authenticate(self.b_user)
        accept_url = reverse("connection-accept", args=[conn.id])
        self.client.post(accept_url)
        self.assertTrue(Connection.objects.filter(owner=self.b_person, target=self.a_person, status=Connection.ACCEPTED).exists())
        # B deletes their connection, reciprocal should also go
        recip = Connection.objects.get(owner=self.b_person, target=self.a_person)
        delete_url = reverse("connection-detail", args=[recip.id])
        self.client.force_authenticate(self.b_user)
        self.client.delete(delete_url)
        self.assertEqual(Connection.objects.count(), 0)

# ---------------------------------------------------------------------------
# Auth edge cases: signup & password reset
# ---------------------------------------------------------------------------

class SignupPasswordResetTests(APITestCase):
    def setUp(self):
        self.signup_url = reverse("signup")
        self.reset_url = reverse("password_reset")
        self.signin_url = reverse("signin")

    def test_signup_creates_user_and_person(self):
        payload = {"email": "new@example.com", "first_name": "New", "last_name": "User", "password1": "Passw0rd!", "password2": "Passw0rd!"}
        resp = self.client.post(self.signup_url, payload, format="json")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertTrue(User.objects.filter(email="new@example.com").exists())
        self.assertTrue(Person.objects.filter(email="new@example.com").exists())
        created_user = User.objects.get(email="new@example.com")
        self.assertFalse(created_user.is_active)
        self.assertTrue(resp.json().get("requires_verification"))

    def test_signup_existing_email_returns_validation_error(self):
        create_user_with_person("existing@example.com", password="Passw0rd!")
        payload = {
            "email": "existing@example.com",
            "first_name": "Existing",
            "last_name": "User",
            "password1": "Passw0rd!",
            "password2": "Passw0rd!",
        }
        resp = self.client.post(self.signup_url, payload, format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("email", resp.json().get("errors", {}))

    def test_password_reset_request_nonexistent_email_still_200(self):
        resp = self.client.post(self.reset_url, {"email": "ghost@example.com"}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    def test_signin_blocks_unverified_user(self):
        signup_payload = {
            "email": "pending@example.com",
            "first_name": "Pending",
            "last_name": "User",
            "password1": "Passw0rd!",
            "password2": "Passw0rd!",
        }
        signup_resp = self.client.post(self.signup_url, signup_payload, format="json")
        self.assertEqual(signup_resp.status_code, status.HTTP_201_CREATED)

        signin_resp = self.client.post(
            self.signin_url,
            {"email": "pending@example.com", "password": "Passw0rd!"},
            format="json",
        )
        self.assertEqual(signin_resp.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(signin_resp.json().get("requires_verification"))


class LoginEmailChangeFlowTests(APITestCase):
    def setUp(self):
        self.user, self.person = create_user_with_person("loginchange@example.com", password="Passw0rd!")
        self.client.force_authenticate(self.user)
        self.request_url = reverse("request_login_email_change")
        self.verify_url = reverse("verify_login_email_change")

    def test_request_requires_correct_current_password(self):
        resp = self.client.post(
            self.request_url,
            {"current_password": "wrong-password", "new_email": "newlogin@example.com"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("incorrect", resp.data["message"].lower())

    def test_request_and_verify_login_email_change(self):
        request_resp = self.client.post(
            self.request_url,
            {"current_password": "Passw0rd!", "new_email": "newlogin@example.com"},
            format="json",
        )
        self.assertEqual(request_resp.status_code, status.HTTP_200_OK)

        self.user.refresh_from_db()
        account = self.user.account
        self.assertEqual(account.pending_login_email, "newlogin@example.com")
        self.assertTrue(account.login_email_change_code)

        verify_resp = self.client.post(
            self.verify_url,
            {"code": account.login_email_change_code},
            format="json",
        )
        self.assertEqual(verify_resp.status_code, status.HTTP_200_OK)

        self.user.refresh_from_db()
        self.assertEqual(self.user.email, "newlogin@example.com")
        self.assertEqual(self.user.username, "newlogin@example.com")
        account.refresh_from_db()
        self.assertEqual(account.login_email_change_code, "")
        self.assertIsNone(account.pending_login_email)

    def test_old_login_email_works_until_verification(self):
        self.client.post(
            self.request_url,
            {"current_password": "Passw0rd!", "new_email": "pendinglogin@example.com"},
            format="json",
        )

        self.client.force_authenticate(user=None)
        signin_resp = self.client.post(
            reverse("signin"),
            {"email": "loginchange@example.com", "password": "Passw0rd!"},
            format="json",
        )
        self.assertEqual(signin_resp.status_code, status.HTTP_200_OK)


class DeleteAccountAPITests(APITestCase):
    def setUp(self):
        self.user, self.person = create_user_with_person("deleteme@example.com", password="Passw0rd!")
        self.url = reverse("delete_account")
        self.client.force_authenticate(self.user)

    def test_delete_account_requires_password(self):
        response = self.client.delete(self.url, {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("password", response.json().get("message", "").lower())

    def test_delete_account_fails_with_wrong_password(self):
        response = self.client.delete(self.url, {"password": "wrong"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("incorrect", response.json().get("message", "").lower())

    def test_delete_account_succeeds_with_correct_password(self):
        response = self.client.delete(self.url, {"password": "Passw0rd!"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(User.objects.filter(id=self.user.id).exists())


# ---------------------------------------------------------------------------
# Additional coverage – Tags, User Search, Password Reset confirm, etc.
# ---------------------------------------------------------------------------

from django.utils.http import urlsafe_base64_encode
from django.utils.encoding import force_bytes
from django.contrib.auth.tokens import default_token_generator
from .models import Tag  # noqa: E402 – placed after original imports for clarity


class TagAPITests(APITestCase):
    """Tests for TagViewSet behavior."""
    def setUp(self):
        self.user, self.person = create_user_with_person("tagger@example.com")
        self.client.force_authenticate(self.user)
        self.tag_list_url = reverse("tag-list")

    def test_create_tag(self):
        payload = {"name": "Friends", "color": "#ff0000"}
        resp = self.client.post(self.tag_list_url, payload, format="json")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertTrue(Tag.objects.filter(owner=self.person, name="Friends", color="#ff0000").exists())

    def test_create_duplicate_tag_returns_200_and_updates_color(self):
        Tag.objects.create(owner=self.person, name="Work", color="#000000")
        payload = {"name": "Work", "color": "#123456"}
        resp = self.client.post(self.tag_list_url, payload, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)  # Existing tag updated, per view logic
        tag = Tag.objects.get(owner=self.person, name="Work")
        self.assertEqual(tag.color, "#123456")

    def test_get_tag_detail(self):
        tag = Tag.objects.create(owner=self.person, name="Alpha", color="#111111")
        detail_url = reverse("tag-detail", kwargs={"pk": tag.pk})
        resp = self.client.get(detail_url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["name"], "Alpha")
        self.assertEqual(resp.data["color"], "#111111")

    def test_patch_tag(self):
        tag = Tag.objects.create(owner=self.person, name="Old", color="#000000")
        detail_url = reverse("tag-detail", kwargs={"pk": tag.pk})
        resp = self.client.patch(detail_url, {"name": "Renamed", "color": "#abcdef"}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        tag.refresh_from_db()
        self.assertEqual(tag.name, "Renamed")
        self.assertEqual(tag.color, "#abcdef")

    def test_patch_tag_duplicate_name_returns_400(self):
        Tag.objects.create(owner=self.person, name="First", color="#111111")
        second = Tag.objects.create(owner=self.person, name="Second", color="#222222")
        detail_url = reverse("tag-detail", kwargs={"pk": second.pk})
        resp = self.client.patch(detail_url, {"name": "First"}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_delete_tag_returns_204(self):
        tag = Tag.objects.create(owner=self.person, name="Gone", color="#333333")
        detail_url = reverse("tag-detail", kwargs={"pk": tag.pk})
        resp = self.client.delete(detail_url)
        self.assertEqual(resp.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Tag.objects.filter(pk=tag.pk).exists())

    def test_delete_other_users_tag_returns_404(self):
        other_user, other_person = create_user_with_person("other@example.com")
        foreign_tag = Tag.objects.create(owner=other_person, name="Theirs", color="#444444")
        detail_url = reverse("tag-detail", kwargs={"pk": foreign_tag.pk})
        resp = self.client.delete(detail_url)
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)


class UserSearchAPITests(APITestCase):
    """Verify that connection status metadata is returned correctly during user search."""
    def setUp(self):
        self.bob_user, self.bob_person = create_user_with_person("bobsearch@example.com")
        self.alice_user, self.alice_person = create_user_with_person("alicesearch@example.com")
        self.client.force_authenticate(self.bob_user)
        self.search_url = reverse("user-search-list")

    def _search_for(self, term: str):
        return self.client.get(f"{self.search_url}?q={term}")

    def test_no_connection_status_none(self):
        resp = self._search_for("alice")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data[0]["connection_status"]["status"], "none")
        self.assertEqual(resp.data[0]["person_id"], self.alice_person.id)

    def test_pending_connection_status(self):
        # Bob sends request to Alice – pending
        Connection.objects.create(owner=self.bob_person, target=self.alice_person, status=Connection.PENDING)
        resp = self._search_for("alice")
        self.assertEqual(resp.data[0]["connection_status"]["status"], Connection.PENDING)
        self.assertEqual(resp.data[0]["connection_status"]["is_mutual"], False)

    def test_mutual_accepted_connection_status(self):
        Connection.objects.create(owner=self.bob_person, target=self.alice_person, status=Connection.ACCEPTED)
        Connection.objects.create(owner=self.alice_person, target=self.bob_person, status=Connection.ACCEPTED)
        resp = self._search_for("alice")
        self.assertTrue(resp.data[0]["connection_status"]["is_mutual"])
        self.assertEqual(resp.data[0]["connection_status"]["status"], Connection.ACCEPTED)


class PasswordResetFlowTests(APITestCase):
    """Ensure password reset confirm endpoint resets the password successfully."""
    def setUp(self):
        self.user, _ = create_user_with_person("resetme@example.com", password="OldPass123!")
        self.reset_confirm_base = reverse("password_reset_confirm", args=["dummy", "dummy"]).rsplit("/", 2)[0]  # get base path up to /password-reset/

    def test_password_reset_confirm_success(self):
        uid = urlsafe_base64_encode(force_bytes(self.user.pk))
        token = default_token_generator.make_token(self.user)
        url = reverse("password_reset_confirm", args=[uid, token])
        resp = self.client.post(url, {"password": "NewPass123!"}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        # Authenticate with new password to confirm
        login_resp = self.client.post(reverse("signin"), {"email": self.user.email, "password": "NewPass123!"}, format="json")
        self.assertTrue(login_resp.json().get("success"))


class EmailVerificationFlowTests(APITestCase):
    def setUp(self):
        self.signup_url = reverse("signup")
        self.verify_url = reverse("verify_email")

    def test_verify_email_activates_user_and_allows_signin(self):
        payload = {
            "email": "verifyme@example.com",
            "first_name": "Verify",
            "last_name": "Me",
            "password1": "Passw0rd!",
            "password2": "Passw0rd!",
        }
        signup_resp = self.client.post(self.signup_url, payload, format="json")
        self.assertEqual(signup_resp.status_code, status.HTTP_201_CREATED)

        user = User.objects.get(email="verifyme@example.com")
        self.assertFalse(user.is_active)

        verification_code = user.account.verification_code
        verify_resp = self.client.post(
            self.verify_url,
            {"email": "verifyme@example.com", "code": verification_code},
            format="json",
        )
        self.assertEqual(verify_resp.status_code, status.HTTP_200_OK)
        self.assertIn("tokens", verify_resp.json())

        user.refresh_from_db()
        self.assertTrue(user.is_active)

        signin_resp = self.client.post(
            reverse("signin"),
            {"email": "verifyme@example.com", "password": "Passw0rd!"},
            format="json",
        )
        self.assertEqual(signin_resp.status_code, status.HTTP_200_OK)
        self.assertTrue(signin_resp.json().get("success"))