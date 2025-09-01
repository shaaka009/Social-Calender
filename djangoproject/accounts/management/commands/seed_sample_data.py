from datetime import date, timedelta, datetime
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from accounts.models import Event, Notification, Person, Connection, Account, Interaction


class Command(BaseCommand):
    """Seeds the database with sample users, their networks, connections, events,
    interactions and notifications. Creates a rich testing environment with varied
    relationships and interaction patterns.
    """

    def handle(self, *args, **options):
        User = get_user_model()
        today = date.today()

        # ------------------------------------------------------------------
        # Create all users and their Person/Account wrappers
        # ------------------------------------------------------------------
        users_data = [
            # Keep existing users
            {
                "username": "akaash@2003@gmail.com",
                "email": "akaash2003@gmail.com",
                "first_name": "Akaash",
                "last_name": "Mahinth",
                "password": "password123",
                "birthday": date(2003, 2, 10),
                "is_superuser": True,
                "is_staff": True,
            },
            {
                "username": "user@example.com",
                "email": "user@example.com",
                "first_name": "Test",
                "last_name": "User",
                "password": "password123",
                "birthday": date(1990, 1, 1),
            },
            # Add new sample users
            {
                "username": "sarah",
                "email": "sarah.j@example.com",
                "first_name": "Sarah",
                "last_name": "Johnson",
                "password": "sarahpass123",
                "birthday": date(1988, 8, 23),
            },
            {
                "username": "robert",
                "email": "robert.smith@example.com",
                "first_name": "Robert",
                "last_name": "Smith",
                "password": "robertpass123",
                "birthday": date(1965, 3, 10),  # Test User's dad
            },
            {
                "username": "emily",
                "email": "emily.chen@example.com",
                "first_name": "Emily",
                "last_name": "Chen",
                "password": "emilypass123",
                "birthday": date(1992, 11, 30),
            },
            {
                "username": "michael",
                "email": "michael.brown@example.com",
                "first_name": "Michael",
                "last_name": "Brown",
                "password": "michaelpass123",
                "birthday": date(1991, 7, 4),
            },
        ]

        # Clear existing sample data but preserve users
        Event.objects.all().delete()
        Notification.objects.all().delete()
        Connection.objects.all().delete()
        Interaction.objects.all().delete()

        # Create users and their Person/Account wrappers
        people = {}
        for user_data in users_data:
            is_superuser = user_data.pop('is_superuser', False)
            is_staff = user_data.pop('is_staff', False)
            
            # Create or update User
            user, created = User.objects.get_or_create(
                username=user_data["username"],
                defaults={
                    "email": user_data["email"],
                    "first_name": user_data["first_name"],
                    "last_name": user_data["last_name"],
                },
            )
            if created:
                if is_superuser:
                    user.is_superuser = True
                    user.is_staff = True
                user.set_password(user_data["password"])
                user.save()
                self.stdout.write(
                    self.style.SUCCESS(
                        f"Created user '{user_data['username']}' / '{user_data['password']}'"
                    )
                )
            
            # Create or update Person
            person, _ = Person.objects.get_or_create(
                email=user_data["email"],
                defaults={
                    "first_name": user_data["first_name"],
                    "last_name": user_data["last_name"],
                    "birthday": user_data["birthday"],
                },
            )
            
            # Create Account wrapper
            Account.objects.get_or_create(user=user, defaults={"person": person})
            people[user_data["username"]] = person

        # ------------------------------------------------------------------
        # Create connections with varied states
        # ------------------------------------------------------------------
        connections_data = [
            # Test User's connections
            ("user@example.com", "sarah", Connection.ACCEPTED, 7),    # Close friend
            ("user@example.com", "robert", Connection.ACCEPTED, 30),  # Dad
            ("user@example.com", "emily", Connection.ACCEPTED, 14),   # Friend
            ("user@example.com", "michael", Connection.PENDING, None),  # Pending
            # Akaash's connections
            ("akaash@2003@gmail.com", "sarah", Connection.ACCEPTED, 10),
            ("akaash@2003@gmail.com", "emily", Connection.ACCEPTED, 14),
            # Sarah's connections
            ("sarah", "emily", Connection.ACCEPTED, 5),   # Close friends
            ("sarah", "michael", Connection.ACCEPTED, 10),
            # Emily's connections
            ("emily", "michael", Connection.ACCEPTED, 20),
            # Robert's connection (only with test user/son)
            # Michael's connections already covered
        ]

        for owner_username, target_username, status, no_contact_days in connections_data:
            # Create bidirectional connection if ACCEPTED
            owner = people[owner_username]
            target = people[target_username]
            
            Connection.objects.create(
                owner=owner,
                target=target,
                status=status,
                no_contact_threshold=no_contact_days,
                last_contact_date=today - timedelta(days=3) if status == Connection.ACCEPTED else None
            )
            
            if status == Connection.ACCEPTED:
                Connection.objects.create(
                    owner=target,
                    target=owner,
                    status=status,
                    no_contact_threshold=no_contact_days,
                    last_contact_date=today - timedelta(days=3)
                )

        # ------------------------------------------------------------------
        # Create interactions (recent history)
        # ------------------------------------------------------------------
        interactions_data = [
            # Test User's interactions
            {
                "actor": "user@example.com",
                "target": "sarah",
                "type": Interaction.MEETING,  # In-person coffee meeting
                "date": today - timedelta(days=3),
                "notes": "Caught up over coffee, discussed her new job",
            },
            {
                "actor": "user@example.com",
                "target": "robert",
                "type": Interaction.CALL,
                "date": today - timedelta(days=5),
                "notes": "Called dad, talked about upcoming birthday plans",
            },
            {
                "actor": "user@example.com",
                "target": "emily",
                "type": Interaction.MESSAGE,
                "date": today - timedelta(days=2),
                "notes": "Quick chat about weekend plans",
            },
            # Akaash's interactions
            {
                "actor": "akaash@2003@gmail.com",
                "target": "sarah",
                "type": Interaction.VIDEO_CALL,
                "date": today - timedelta(days=2),
                "notes": "Discussed project collaboration",
            },
            {
                "actor": "akaash@2003@gmail.com",
                "target": "emily",
                "type": Interaction.MEETING,
                "date": today - timedelta(days=4),
                "notes": "Met for lunch",
            },
            # Sarah's interactions
            {
                "actor": "sarah",
                "target": "emily",
                "type": Interaction.VIDEO_CALL,
                "date": today - timedelta(days=1),
                "notes": "Virtual coffee catch-up",
            },
            {
                "actor": "sarah",
                "target": "michael",
                "type": Interaction.MEETING,
                "date": today - timedelta(days=4),
                "notes": "Met at the park",
            },
            # Emily's interactions
            {
                "actor": "emily",
                "target": "michael",
                "type": Interaction.EMAIL,
                "date": today - timedelta(days=2),
                "notes": "Discussed project collaboration",
            },
        ]

        for interaction_data in interactions_data:
            Interaction.objects.create(
                actor=people[interaction_data["actor"]],
                target=people[interaction_data["target"]],
                type=interaction_data["type"],
                date=interaction_data["date"],
                notes=interaction_data["notes"],
            )

        # ------------------------------------------------------------------
        # Create events (mix of birthdays and general events)
        # ------------------------------------------------------------------
        events_data = [
            # Test User's events
            {
                "user": "user@example.com",
                "date": today + timedelta(days=3),
                "type": Event.BIRTHDAY,
                "title": "Dad's Birthday",
                "person": "robert",
                "notes": "Need to order cake and gift",
            },
            {
                "user": "user@example.com",
                "date": today + timedelta(days=7),
                "type": Event.GENERAL,
                "title": "Coffee with Sarah",
                "person": "sarah",
                "notes": "Try the new café downtown",
            },
            {
                "user": "user@example.com",
                "date": today + timedelta(days=14),
                "type": Event.GENERAL,
                "title": "Emily's House Warming",
                "person": "emily",
                "notes": "Bring a bottle of wine",
            },
            # Akaash's events
            {
                "user": "akaash@2003@gmail.com",
                "date": today + timedelta(days=5),
                "type": Event.GENERAL,
                "title": "Project Meeting with Sarah",
                "person": "sarah",
                "notes": "Review Q2 plans",
            },
            {
                "user": "akaash@2003@gmail.com",
                "date": today + timedelta(days=10),
                "type": Event.GENERAL,
                "title": "Lunch with Emily",
                "person": "emily",
                "notes": "At the Italian place",
            },
            # Sarah's events
            {
                "user": "sarah",
                "date": today + timedelta(days=5),
                "type": Event.GENERAL,
                "title": "Lunch with Emily",
                "person": "emily",
                "notes": "At the Italian place",
            },
            # Emily's events
            {
                "user": "emily",
                "date": today + timedelta(days=10),
                "type": Event.BIRTHDAY,
                "title": "Michael's Birthday",
                "person": "michael",
                "notes": "Group celebration at 7PM",
            },
        ]

        for event_data in events_data:
            user = User.objects.get(username=event_data["user"])
            person = people[event_data["person"]]
            
            event = Event.objects.create(
                user=user,
                date=event_data["date"],
                type=event_data["type"],
                title=event_data["title"],
                person=person,
                notes=event_data["notes"],
            )

            # Create notification for upcoming events
            if (event_data["date"] - today).days <= 7:
                Notification.objects.create(
                    user=user,
                    type=Notification.UPCOMING_EVENT,
                    message=f"{event_data['title']} is in {(event_data['date'] - today).days} days",
                    event=event,
                    person=person,
                    date=event_data["date"],
                )

        # ------------------------------------------------------------------
        # Create no-contact notifications
        # ------------------------------------------------------------------
        no_contact_data = [
            {
                "user": "user@example.com",
                "person": "robert",
                "days": 30,
                "message": "It's been a month since you last contacted your dad",
            },
            {
                "user": "akaash@2003@gmail.com",
                "person": "emily",
                "days": 14,
                "message": "Check in with Emily - it's been two weeks!",
            },
            {
                "user": "sarah",
                "person": "michael",
                "days": 10,
                "message": "Check in with Michael - it's been a while!",
            },
        ]

        for notification_data in no_contact_data:
            user = User.objects.get(username=notification_data["user"])
            person = people[notification_data["person"]]
            
            Notification.objects.create(
                user=user,
                type=Notification.NO_CONTACT,
                message=notification_data["message"],
                person=person,
                date=today - timedelta(days=notification_data["days"]),
            )

        self.stdout.write(self.style.SUCCESS("Enhanced sample data created successfully"))