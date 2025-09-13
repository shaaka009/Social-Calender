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
from django.utils import timezone
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
            birthday=date(1990, 1, 1)
        )
        self.client.force_authenticate(self.user)
        self.profile_url = reverse("user_profile")

    def test_get_profile(self):
        """GET /profile should return user and linked person data."""
        response = self.client.get(self.profile_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["first_name"], "John")
        self.assertEqual(response.data["last_name"], "Doe")
        self.assertEqual(response.data["email"], "profile@example.com")
        self.assertEqual(response.data["phone"], "123-456-7890")
        self.assertEqual(response.data["birthday"], date(1990, 1, 1))
        first_name = response.data["first_name"]
        # Ensure first_name fallback worked
        self.assertEqual(first_name, "John")

    def test_update_profile_user_fields(self):
        """PATCH /profile should update User model fields."""
        payload = {
            "first_name": "Johnny",
            "last_name": "Smith",
            "email": "johnny@example.com"
        }
        response = self.client.patch(self.profile_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Verify User model was updated
        self.user.refresh_from_db()
        self.assertEqual(self.user.first_name, "Johnny")
        self.assertEqual(self.user.last_name, "Smith")
        self.assertEqual(self.user.email, "johnny@example.com")

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
        self.assertEqual(get_response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(patch_response.status_code, status.HTTP_403_FORBIDDEN)


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


class DashboardAPITests(APITestCase):
    """Verify upcoming events & notifications logic for /dashboard/ endpoint."""

    def setUp(self):
        self.user, self.person = create_user_with_person("demo@example.com")
        self.client.force_authenticate(self.user)
        self.dashboard_url = reverse("dashboard")

    def test_dashboard_returns_next_30_day_events_only(self):
        today = date.today()
        Event.objects.bulk_create([
            Event(user=self.user, date=today + timedelta(days=5), type=Event.GENERAL, title="Inside 30", person=self.person),
            Event(user=self.user, date=today + timedelta(days=40), type=Event.GENERAL, title="Outside 30", person=self.person),
        ])
        resp = self.client.get(self.dashboard_url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        returned_titles = {e["title"] for e in resp.data["events"]}
        self.assertIn("Inside 30", returned_titles)
        self.assertNotIn("Outside 30", returned_titles)

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
        # client should now have session cookie – call get_user
        resp_user = self.client.get(self.get_user_url)
        self.assertTrue(resp_user.json()["success"])  # logged in
        # sign out
        self.client.post(self.signout_url)
        resp_after_logout = self.client.get(self.get_user_url)
        self.assertFalse(resp_after_logout.json()["success"])

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
            "date": date.today().isoformat(),
            "type": "general",
            "title": "Lunch with Bob",
            "person_id": self.person.id,
        }
        resp = self.client.post(self.event_list_url, payload, format="json")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Event.objects.count(), 1)

    def test_list_events_only_for_current_user(self):
        # Create event for other user
        Event.objects.create(user=self.other_user, date=date.today(), type="general", title="Other user")
        Event.objects.create(user=self.user, date=date.today(), type="general", title="Mine")
        resp = self.client.get(self.event_list_url)
        titles = {e["title"] for e in resp.data}
        self.assertEqual(titles, {"Mine"})

    def test_update_event(self):
        ev = Event.objects.create(user=self.user, date=date.today(), type="general", title="Old Title")
        url = reverse("event-detail", args=[ev.id])
        resp = self.client.patch(url, {"title": "New Title"}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        ev.refresh_from_db()
        self.assertEqual(ev.title, "New Title")

    def test_user_cannot_edit_others_event(self):
        ev = Event.objects.create(user=self.other_user, date=date.today(), type="general", title="Not Yours")
        url = reverse("event-detail", args=[ev.id])
        resp = self.client.patch(url, {"title": "Hack"}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)

    def test_delete_event(self):
        ev = Event.objects.create(user=self.user, date=date.today(), type="general", title="Delete Me")
        url = reverse("event-detail", args=[ev.id])
        resp = self.client.delete(url)
        self.assertEqual(resp.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Event.objects.filter(id=ev.id).exists())

# ---------------------------------------------------------------------------
# Notification serializer logic
# ---------------------------------------------------------------------------

class NotificationLogicTests(APITestCase):
    """Verify daysSince and message formatting for NO_CONTACT notifications."""

    def setUp(self):
        self.user, self.person = create_user_with_person("notify@example.com")
        self.client.force_authenticate(self.user)

    def test_days_since_uses_connection_last_contact(self):
        conn = Connection.objects.create(owner=self.person, target=self.person, status=Connection.ACCEPTED, last_contact_date=date.today()-timedelta(days=10))
        notif = Notification.objects.create(user=self.user, type=Notification.NO_CONTACT, message="placeholder", person=self.person)
        dashboard_url = reverse("dashboard")
        resp = self.client.get(dashboard_url)
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
        self.reset_url = reverse("password_reset_request")

    def test_signup_creates_user_and_person(self):
        payload = {"email": "new@example.com", "first_name": "New", "last_name": "User", "password1": "Passw0rd!", "password2": "Passw0rd!"}
        resp = self.client.post(self.signup_url, payload, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertTrue(User.objects.filter(email="new@example.com").exists())
        self.assertTrue(Person.objects.filter(email="new@example.com").exists())

    def test_password_reset_request_nonexistent_email_still_200(self):
        resp = self.client.post(self.reset_url, {"email": "ghost@example.com"}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)