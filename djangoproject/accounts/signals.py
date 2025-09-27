from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.auth import get_user_model

from .models import Account

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
