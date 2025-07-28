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


class UserSearchSerializer(serializers.ModelSerializer):
    """Serializer for user search results."""
    connection_status = serializers.SerializerMethodField()

    def get_connection_status(self, user):
        request_user = self.context['request'].user
        if user == request_user:
            return None

        # Check both directions of the relationship
        outgoing = Contact.objects.filter(
            user=request_user,
            contact_user=user
        ).first()
        incoming = Contact.objects.filter(
            user=user,
            contact_user=request_user
        ).first()

        if not outgoing and not incoming:
            return {'status': 'none'}
        
        return {
            'status': outgoing.status if outgoing else 'none',
            'incoming_status': incoming.status if incoming else 'none',
            'is_mutual': bool(outgoing and incoming and 
                            outgoing.status == Contact.ACCEPTED and 
                            incoming.status == Contact.ACCEPTED)
        }

    class Meta:
        model = User
        fields = (
            'id',
            'first_name',
            'last_name',
            'email',
            'connection_status',
        )
        read_only_fields = fields

class ContactSerializer(serializers.ModelSerializer):
    # Allow clients to specify another app user to add as a contact
    contact_user_id = serializers.IntegerField(
        write_only=True, 
        required=False,
        allow_null=True
    )

    # Expose the contacted user info (read-only) so the client can easily display it
    contact_user = serializers.SerializerMethodField(read_only=True)
    user = serializers.SerializerMethodField(read_only=True)
    is_mutual = serializers.BooleanField(read_only=True)

    # Make first_name not required at the field level
    first_name = serializers.CharField(max_length=100, required=False)
    last_name = serializers.CharField(max_length=100, required=False, allow_blank=True)
    email = serializers.EmailField(required=False, allow_blank=True)

    def get_user(self, obj):
        """Return info about the user who created this contact."""
        return {
            "id": obj.user.id,
            "first_name": obj.user.first_name,
            "last_name": obj.user.last_name,
            "email": obj.user.email,
        }

    def get_contact_user(self, obj):
        if obj.contact_user:
            return {
                "id": obj.contact_user.id,
                "first_name": obj.contact_user.first_name,
                "last_name": obj.contact_user.last_name,
                "email": obj.contact_user.email,
            }
        return None

    def validate(self, data):
        # If this is an app user contact, first_name is not required
        contact_user_id = data.get('contact_user_id')
        if contact_user_id:
            try:
                User.objects.get(id=contact_user_id)
                return data
            except User.DoesNotExist:
                raise serializers.ValidationError({
                    'contact_user_id': 'User does not exist.'
                })
        
        # For manual contacts, first_name is required
        if not data.get('first_name'):
            raise serializers.ValidationError({
                'first_name': 'This field is required for manual contacts.'
            })
        return data

    def create(self, validated_data):
        contact_user_id = validated_data.pop("contact_user_id", None)
        try:
            contact_user = User.objects.get(id=contact_user_id) if contact_user_id else None
        except User.DoesNotExist:
            raise serializers.ValidationError({
                'contact_user_id': 'User does not exist.'
            })
        
        # If the contact is an in-app user and names/emails not provided, pre-fill
        if contact_user:
            validated_data["contact_user"] = contact_user
            validated_data["first_name"] = contact_user.first_name
            validated_data["last_name"] = contact_user.last_name
            validated_data["email"] = contact_user.email
            validated_data.setdefault("notes", "")
            # For app users, always start as pending
            validated_data["status"] = Contact.PENDING

        else:
            # For non-app contacts, mark as accepted immediately
            validated_data["status"] = Contact.ACCEPTED
        return Contact.objects.create(**validated_data)

    class Meta:
        model = Contact
        fields = (
            "id",
            "contact_user_id",
            "contact_user",
            "user",
            "first_name",
            "last_name",
            "email",
            "phone",
            "birthday",
            "last_contact_date",
            "notes",
            "tags",
            "status",
            "is_mutual",
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