from datetime import date, timedelta
from django.core.management.base import BaseCommand
from django.db.models import Q
from accounts.models import Connection, Notification, Person

class Command(BaseCommand):
    help = 'Generate notifications for contacts that have not been interacted with recently'

    def handle(self, *args, **options):
        today = date.today()
        notifications_created = 0

        # Get all accepted connections that have a last contact date
        connections = Connection.objects.filter(
            status=Connection.ACCEPTED,
            last_contact_date__isnull=False
        ).select_related('owner__account__user', 'target')

        for conn in connections:
            # Skip if the owner doesn't have an account (shouldn't happen, but let's be safe)
            if not hasattr(conn.owner, 'account'):
                continue

            days_since_contact = (today - conn.last_contact_date).days
            threshold = conn.no_contact_threshold

            # Skip contacts with no threshold set (no limit)
            if threshold is None:
                continue

            # If we've exceeded the threshold and there's no existing notification
            if days_since_contact >= threshold:
                # Check if we already have a recent no-contact notification
                existing_notification = Notification.objects.filter(
                    user=conn.owner.account.user,
                    type=Notification.NO_CONTACT,
                    person=conn.target,
                    created_at__gte=today - timedelta(days=threshold)
                ).exists()

                if not existing_notification:
                    # Create a new notification
                    Notification.objects.create(
                        user=conn.owner.account.user,
                        type=Notification.NO_CONTACT,
                        message=f"It's been {days_since_contact} days since you last contacted {conn.target}",
                        person=conn.target,
                        date=conn.last_contact_date
                    )
                    notifications_created += 1
                    self.stdout.write(
                        f"Created notification for {conn.owner} about {conn.target} "
                        f"({days_since_contact} days since last contact)"
                    )

        self.stdout.write(
            self.style.SUCCESS(
                f'Successfully generated {notifications_created} no-contact notifications'
            )
        )
