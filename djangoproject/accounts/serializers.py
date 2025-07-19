from rest_framework import serializers
from django.contrib.auth.models import User

from .models import Event, Notification


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
    class Meta:
        model = Notification
        fields = (
            "id",
            "type",
            "message",
            "event",
            "contact_id",
            "date",
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