from datetime import date, timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from accounts.models import Event, Notification
from accounts.models import Contact


class Command(BaseCommand):
    help = "Seeds the database with a demo user, sample events, and notifications."

    def handle(self, *args, **options):
        User = get_user_model()
        user, created = User.objects.get_or_create(
            username="demo",
            defaults={
                "email": "demo@example.com",
                "first_name": "Demo",
                "last_name": "User",
            },
        )
        if created:
            user.set_password("password123")
            user.save()
            self.stdout.write(self.style.SUCCESS("Created demo user 'demo' / 'password123'"))
        else:
            self.stdout.write("Demo user already exists")

        # clear old sample objects to avoid duplication
        Event.objects.filter(user=user).delete()
        Notification.objects.filter(user=user).delete()

        today = date.today()
        event1 = Event.objects.create(
            user=user,
            date=today + timedelta(days=3),
            type=Event.BIRTHDAY,
            title="Dad's Birthday",
            contact_id=2,
        )
        event2 = Event.objects.create(
            user=user,
            date=today + timedelta(days=7),
            type=Event.GENERAL,
            title="Coffee with Sarah",
            contact_id=3,
        )

        Notification.objects.create(
            user=user,
            type=Notification.UPCOMING_EVENT,
            message="Dad's birthday is in 3 days",
            event=event1,
            date=event1.date,
        )
        Notification.objects.create(
            user=user,
            type=Notification.NO_CONTACT,
            message="Check in with Sarah",
            contact_id=3,
            date=today - timedelta(days=45),
        )

        # -------- Sample Contacts ---------

        Contact.objects.filter(user=user).delete()

        Contact.objects.create(
            user=user,
            first_name="Sarah",
            last_name="Johnson",
            birthday=date(1990, 5, 15),
            last_contact_date=today - timedelta(days=45),
            email="sarah.j@example.com",
            phone="+1234567890",
            notes="Loves photography, prefers texts over calls",
            tags=["friend", "photography"],
        )

        Contact.objects.create(
            user=user,
            first_name="Robert",
            last_name="Smith",
            birthday=date(1965, 3, 25),
            last_contact_date=today - timedelta(days=10),
            phone="+1987654321",
            notes="Weekly Sunday calls",
            tags=["family"],
        )

        self.stdout.write(self.style.SUCCESS("Sample contacts created"))

        self.stdout.write(self.style.SUCCESS("Sample data created successfully")) 