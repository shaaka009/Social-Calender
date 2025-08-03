"""test_api: Comprehensive backend test-suite for the Person / Connection schema.

This replaces the old Contact-based tests that were removed during the
refactor.  It covers:

1.  Person / Account linkage helper.
2.  Authentication helper views (signin / signout / get_user).
3.  ConnectionViewSet – create / accept / decline / unique constraint.
4.  InteractionViewSet – creation & permissions.
5.  Dashboard API – events & notifications within 30 days.
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
        self.assertEqual(dup_resp.status_code, status.HTTP_200_OK)  # get_or_create returns existing
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
        self.assertTrue(resp_user.data["success"])  # logged in
        # sign out
        self.client.post(self.signout_url)
        resp_after_logout = self.client.get(self.get_user_url)
        self.assertFalse(resp_after_logout.data["success"])