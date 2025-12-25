from datetime import date, timedelta
from django.core.management.base import BaseCommand
from django.db.models import Q
from accounts.models import Connection, Notification, Person

class Command(BaseCommand):
    help = 'Generate notifications for contacts that have not been interacted with recently'

    def handle(self, *args, **options):
        today = date.today()
        notifications_created = 0
        notifications_removed = 0

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
                # Remove any existing notifications for this connection if threshold is now None
                deleted_count, _ = Notification.objects.filter(
                    user=conn.owner.account.user,
                    type=Notification.NO_CONTACT,
                    person=conn.target
                ).delete()
                notifications_removed += deleted_count
                continue

            # If we've exceeded the threshold, ensure there's exactly one notification
            if days_since_contact >= threshold:
                # First check if any notifications exist for this user-person pair
                existing_notifications = Notification.objects.filter(
                    user=conn.owner.account.user,
                    type=Notification.NO_CONTACT,
                    person=conn.target
                )
                
                existing_count = existing_notifications.count()
                
                if existing_count == 0:
                    # Create a new notification
                    Notification.objects.create(
                        user=conn.owner.account.user,
                        type=Notification.NO_CONTACT,
                        person=conn.target,
                        message=f"You haven't talked to {conn.target.first_name or 'them'} in {days_since_contact} days – reach out!",
                        date=conn.last_contact_date
                    )
                    notifications_created += 1
                    self.stdout.write(
                        f"Created notification for {conn.owner} about {conn.target} "
                        f"({days_since_contact} days since last contact)"
                    )
                elif existing_count > 1:
                    # Remove duplicates, keep the most recent one
                    notifications_to_keep = existing_notifications.order_by('-created_at').first()
                    existing_notifications.exclude(id=notifications_to_keep.id).delete()
                    deleted_count = existing_count - 1
                    notifications_removed += deleted_count
                    self.stdout.write(
                        f"Removed {deleted_count} duplicate notifications for {conn.owner} about {conn.target}"
                    )
                # If existing_count == 1, the notification already exists and will dynamically show the current days
            else:
                # If threshold is no longer exceeded, remove any existing notification
                deleted_count, _ = Notification.objects.filter(
                    user=conn.owner.account.user,
                    type=Notification.NO_CONTACT,
                    person=conn.target
                ).delete()
                notifications_removed += deleted_count

        self.stdout.write(
            self.style.SUCCESS(
                f'Successfully processed no-contact notifications: {notifications_created} created, {notifications_removed} removed'
            )
        )
