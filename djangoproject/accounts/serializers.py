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
    # Allow clients to specify another app user to add as a contact
    contact_user_id = serializers.PrimaryKeyRelatedField(
        source="contact_user",
        queryset=User.objects.all(),
        required=False,
        allow_null=True,
        write_only=True,
    )

    # Expose the contacted user info (read-only) so the client can easily display it
    contact_user = serializers.SerializerMethodField(read_only=True)

    def get_contact_user(self, obj):
        if obj.contact_user:
            return {
                "id": obj.contact_user.id,
                "first_name": obj.contact_user.first_name,
                "last_name": obj.contact_user.last_name,
                "email": obj.contact_user.email,
            }
        return None

    def create(self, validated_data):
        contact_user = validated_data.pop("contact_user", None)
        # If the contact is an in-app user and names/emails not provided, pre-fill
        if contact_user:
            validated_data.setdefault("first_name", contact_user.first_name)
            validated_data.setdefault("last_name", contact_user.last_name)
            validated_data.setdefault("email", contact_user.email)
            validated_data.setdefault("notes", "")
        return Contact.objects.create(**validated_data)

    class Meta:
        model = Contact
        fields = (
            "id",
            "contact_user_id",
            "contact_user",
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