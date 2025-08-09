from datetime import date, timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from accounts.models import Event, Notification, Person, Connection, Account


class Command(BaseCommand):
    """Seeds the database with a demo user, a couple of people in their network, 
    sample connections, events and notifications – fully aligned with the new
    Person / Connection schema. Existing sample data is cleared first so the
    command is idempotent.
    """

    def handle(self, *args, **options):
        User = get_user_model()

        # ------------------------------------------------------------------
        # Create demo app User + Person + Account wrapper
        # ------------------------------------------------------------------
        demo_user, created = User.objects.get_or_create(
            username="demo",
            defaults={
                "email": "demo@example.com",
                "first_name": "Demo",
                "last_name": "User",
            },
        )
        if created:
            demo_user.set_password("password123")
            demo_user.save()
            self.stdout.write(self.style.SUCCESS("Created demo user 'demo' / 'password123'"))
        else:
            self.stdout.write("Demo user already exists – updating details")
            demo_user.email = "demo@example.com"
            demo_user.first_name = "Demo"
            demo_user.last_name = "User"
            demo_user.save()

        # Ensure the person/account wrapper exists
        demo_person, _ = Person.objects.get_or_create(
            email=demo_user.email,
            defaults={
                "first_name": demo_user.first_name,
                "last_name": demo_user.last_name,
            },
        )
        Account.objects.get_or_create(user=demo_user, defaults={"person": demo_person})

        # ------------------------------------------------------------------
        # Clear old sample objects
        # ------------------------------------------------------------------
        Event.objects.filter(user=demo_user).delete()
        Notification.objects.filter(user=demo_user).delete()
        Connection.objects.filter(owner=demo_person).delete()
        Connection.objects.filter(target=demo_person).delete()

        today = date.today()

        # ------------------------------------------------------------------
        # Create a couple of extra people & connections
        # ------------------------------------------------------------------
        sarah, _ = Person.objects.get_or_create(
            email="sarah.j@example.com",
            defaults={"first_name": "Sarah", "last_name": "Johnson"},
        )
        robert, _ = Person.objects.get_or_create(
            email="robert.smith@example.com",
            defaults={"first_name": "Robert", "last_name": "Smith"},
        )

        # Connections: Demo ➜ Sarah (accepted) & Demo ➜ Robert (accepted)
        for target in (sarah, robert):
            Connection.objects.update_or_create(
                owner=demo_person,
                target=target,
                defaults={"status": Connection.ACCEPTED},
            )
            Connection.objects.update_or_create(
                owner=target,
                target=demo_person,
                defaults={"status": Connection.ACCEPTED},
            )

        # ------------------------------------------------------------------
        # Sample events (linked to people)
        # ------------------------------------------------------------------
        event1 = Event.objects.create(
            user=demo_user,
            date=today + timedelta(days=3),
            type=Event.BIRTHDAY,
            title="Dad's Birthday",
            person=robert,  # Let's assume Robert is dad
        )
        event2 = Event.objects.create(
            user=demo_user,
            date=today + timedelta(days=7),
            type=Event.GENERAL,
            title="Coffee with Sarah",
            person=sarah,
        )

        # ------------------------------------------------------------------
        # Notifications
        # ------------------------------------------------------------------
        Notification.objects.create(
            user=demo_user,
            type=Notification.UPCOMING_EVENT,
            message="Dad's birthday is in 3 days",
            event=event1,
            person=robert,
            date=event1.date,
        )

        Notification.objects.create(
            user=demo_user,
            type=Notification.NO_CONTACT,
            message="You haven't talked to Sarah in a while – reach out!",
            person=sarah,
            date=today - timedelta(days=45),
        )

        self.stdout.write(self.style.SUCCESS("Sample data created / refreshed successfully"))
