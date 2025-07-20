from rest_framework import serializers
from django.contrib.auth.models import User
from datetime import date, timedelta

from .models import Event, Notification
from .models import Contact


class EventSerializer(serializers.ModelSerializer):
    class Meta:
        model = Event
        fields = (
            "id",
            "date",
            "type",
            "title",
            "contact_id",
        )


class NotificationSerializer(serializers.ModelSerializer):
    daysSince = serializers.SerializerMethodField()

    def get_daysSince(self, obj):
        if obj.date:
            return (date.today() - obj.date).days
        return None
    class Meta:
        model = Notification
        fields = ("id", "type", "message", "event", "contact_id", "date", "daysSince")


# ---------------- ContactSerializer -----------------


class ContactSerializer(serializers.ModelSerializer):
    class Meta:
        model = Contact
        fields = (
            "id",
            "first_name",
            "last_name",
            "email",
            "phone",
            "birthday",
            "last_contact_date",
            "notes",
            "tags",
        )


class DashboardSerializer(serializers.Serializer):
    user = serializers.SerializerMethodField()
    events = EventSerializer(many=True)
    notifications = NotificationSerializer(many=True)

    def get_user(self, obj):
        user = self.context["request"].user
        return {
            "id": user.id,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "email": user.email,
        }

    class Meta:
        fields = ("user", "events", "notifications") 