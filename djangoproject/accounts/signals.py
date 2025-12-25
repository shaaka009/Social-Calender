from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.auth import get_user_model

from .models import Account, Interaction, Notification, Connection

User = get_user_model()


@receiver(post_save, sender=User)
def sync_user_to_person(sender, instance, **kwargs):
    """Keep Person duplicate fields in sync when they are NULL.

    This lets legacy code that still reads person.first_name continue to work
    until we remove those columns, while ensuring the canonical source of
    truth is auth_user.
    """
    if not hasattr(instance, "account"):
        return

    person = instance.account.person
    updated = False
    for attr in ("first_name", "last_name", "email"):
        if getattr(person, attr) is None:
            setattr(person, attr, getattr(instance, attr))
            updated = True
    if updated:
        person.save(update_fields=["first_name", "last_name", "email"])


@receiver(post_save, sender=Interaction)
def check_no_contact_notification_after_interaction(sender, instance, created, **kwargs):
    """
    After an interaction is logged, check if the NO_CONTACT notification
    should be removed (if the threshold is no longer met).
    
    The Interaction.save() method already updates last_contact_date on both
    sides of the connection, so we just need to check if notifications should
    be cleaned up.
    """
    if not created:
        return  # Only process new interactions
    
    # Check both directions (actor -> target and target -> actor)
    from datetime import date
    today = date.today()
    
    for person_a, person_b in ((instance.actor, instance.target), (instance.target, instance.actor)):
        # Get the connection
        conn = Connection.objects.filter(owner=person_a, target=person_b).first()
        if not conn or not hasattr(person_a, 'account'):
            continue
        
        # If threshold is set and we're now under it, remove the notification
        if conn.no_contact_threshold is not None and conn.last_contact_date:
            days_since = (today - conn.last_contact_date).days
            if days_since < conn.no_contact_threshold:
                # Remove the notification since we're back under the threshold
                Notification.objects.filter(
                    user=person_a.account.user,
                    type=Notification.NO_CONTACT,
                    person=person_b
                ).delete()
