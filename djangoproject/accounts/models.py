from django.db import models
from django.contrib.auth.models import User


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
    contact_id = models.PositiveIntegerField(null=True, blank=True)

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
    contact_id = models.PositiveIntegerField(null=True, blank=True)
    date = models.DateField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.type}: {self.message[:30]}"
