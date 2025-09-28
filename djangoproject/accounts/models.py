from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()


# ---------------------------------------------------
# Event & Notification (legacy, still used by dashboard)
# ---------------------------------------------------
class Event(models.Model):
    BIRTHDAY = "birthday"
    GENERAL = "general"

    EVENT_TYPE_CHOICES = [
        (BIRTHDAY, "Birthday"),
        (GENERAL, "General"),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="events")
    date = models.DateField()
    type = models.CharField(max_length=32, choices=EVENT_TYPE_CHOICES, default=GENERAL)
    title = models.CharField(max_length=255)
    notes = models.TextField(blank=True)
    people = models.ManyToManyField(
        'Person',
        related_name='events_related',
        blank=True,
        help_text='People associated with this event.',
    )

    # Many-to-many tags (share same Tag model as connections)
    tags = models.ManyToManyField(
        'Tag',
        related_name='events',
        blank=True,
        help_text='User-defined tags to group events and connect them to contacts.',
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["date"]

    def __str__(self):
        return f"{self.title} on {self.date}"


class Notification(models.Model):
    UPCOMING_EVENT = "UPCOMING_EVENT"
    NO_CONTACT = "NO_CONTACT"

    NOTIFICATION_TYPE_CHOICES = [
        (UPCOMING_EVENT, "Upcoming Event"),
        (NO_CONTACT, "No Contact"),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="notifications")
    type = models.CharField(max_length=32, choices=NOTIFICATION_TYPE_CHOICES)
    message = models.TextField()
    event = models.ForeignKey(Event, on_delete=models.CASCADE, null=True, blank=True, related_name="notifications")
    person = models.ForeignKey(
        'Person',
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name='notifications_related',
    )  # Replaces contact_id
    date = models.DateField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.type}: {self.message[:30]}"

# ---------------------------------------------------
# Core "Person" model (applies to EVERY individual)
# ---------------------------------------------------
class Person(models.Model):
    # Identity fields are now optional because for app users we defer to the linked
    # auth_user record.  For manual contacts (no account), they behave as before.
    first_name = models.CharField(max_length=100, blank=True, null=True)
    last_name = models.CharField(max_length=100, blank=True, null=True)
    email = models.EmailField(blank=True, null=True)
    phone = models.CharField(max_length=30, blank=True)
    birthday = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)
    # Flexible additional contact methods (e.g. social links)
    # Stored as a list of objects: [{"type": "LinkedIn", "value": "https://…"}, …]
    extra_contacts = models.JSONField(
        default=list,
        blank=True,
        help_text="Additional contact infos beyond phone/email. List of {type, value} objects.",
    )
    profile_picture = models.ImageField(upload_to='profile_pictures/', null=True, blank=True)
    
    # For manual contacts, points to the Person who created this record
    # Null for app users (who have an Account instead)
    owner = models.ForeignKey(
        'self',
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name='manual_contacts',
        help_text='For manual contacts, the Person who created this record. Null for app users.'
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["first_name", "last_name"]

    def __str__(self):
        name = f"{self.first_name} {self.last_name}".strip()
        return name or self.email or f"Person {self.id}"

    # Convenience for UI – do we have a full app account?
    @property
    def is_app_user(self):
        return hasattr(self, "account")


# ---------------------------------------------------
# Tag model – scoped to the owner (Person) so each user maintains
# their own tag namespace.  A tag can be attached to many connections
# for that owner.
# ---------------------------------------------------


class Tag(models.Model):
    owner = models.ForeignKey(
        Person,
        on_delete=models.CASCADE,
        related_name="tags",
        help_text="The user (Person) who created this tag.",
    )
    name = models.CharField(max_length=50)
    color = models.CharField(max_length=7, default="#cccccc", help_text="Hex color like #FF0000")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("owner", "name")
        ordering = ["name"]

    def __str__(self):
        return self.name


# ---------------------------------------------------
# Account wrapper – ties `auth_user` to a `Person`
# ---------------------------------------------------
class Account(models.Model):
    person = models.OneToOneField(
        Person,
        primary_key=True,
        on_delete=models.CASCADE,
        related_name="account",
    )
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="account",
    )

    def __str__(self):
        return str(self.user)


# ---------------------------------------------------
# Connection (replaces old Contact model)
# ---------------------------------------------------
class Connection(models.Model):
    PENDING = "pending"
    ACCEPTED = "accepted"
    DECLINED = "declined"

    STATUS_CHOICES = [
        (PENDING, "Pending"),
        (ACCEPTED, "Accepted"),
        (DECLINED, "Declined"),
    ]

    owner = models.ForeignKey(
        Person,
        on_delete=models.CASCADE,
        related_name="connections",
        help_text="Person who owns this connection entry (the list it appears in).",
    )
    target = models.ForeignKey(
        Person,
        on_delete=models.CASCADE,
        related_name="connected_to",
        help_text="The person this entry points to.",
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=PENDING)
    last_contact_date = models.DateField(null=True, blank=True, help_text="Date of the most recent interaction")
    no_contact_threshold = models.IntegerField(
        null=True,
        blank=True,
        help_text="Number of days after which to generate a no-contact notification for this connection. Null means no notifications."
    )
    # Many-to-many tag assignments (owned by `owner` via Tag.owner)
    tags = models.ManyToManyField(
        "Tag",
        related_name="connections",
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("owner", "target")
        ordering = ["owner__first_name", "owner__last_name", "target__first_name"]

    def __str__(self):
        return f"{self.owner} ➜ {self.target} ({self.status})"

    @property
    def is_mutual(self):
        """Both sides marked as accepted."""
        return (
            self.status == self.ACCEPTED
            and Connection.objects.filter(
                owner=self.target,
                target=self.owner,
                status=self.ACCEPTED,
            ).exists()
        )


# ---------------------------------------------------
# Interaction – now uses Person ↔ Person
# ---------------------------------------------------
class Interaction(models.Model):
    CALL = "call"
    MEETING = "meeting"
    MESSAGE = "message"
    EMAIL = "email"
    VIDEO_CALL = "video_call"
    SOCIAL = "social"
    OTHER = "other"

    INTERACTION_TYPE_CHOICES = [
        (CALL, "Phone Call"),
        (MEETING, "In-person Meeting"),
        (MESSAGE, "Message/Text"),
        (EMAIL, "Email"),
        (VIDEO_CALL, "Video Call"),
        (SOCIAL, "Social Media"),
        (OTHER, "Other"),
    ]

    actor = models.ForeignKey(
        Person, on_delete=models.CASCADE, related_name="interactions_made"
    )
    target = models.ForeignKey(
        Person, on_delete=models.CASCADE, related_name="interactions_received"
    )
    date = models.DateField()
    type = models.CharField(max_length=20, choices=INTERACTION_TYPE_CHOICES)
    notes = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-date", "-created_at"]

    def __str__(self):
        return f"{self.get_type_display()} {self.actor} → {self.target} on {self.date}"

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        # Update last_contact_date on both sides of the connection (if it exists)
        for person_a, person_b in ((self.actor, self.target), (self.target, self.actor)):
            conn = Connection.objects.filter(owner=person_a, target=person_b).order_by("-updated_at").first()
            if conn:
                conn.last_contact_date = self.date
                conn.save(update_fields=['last_contact_date'])