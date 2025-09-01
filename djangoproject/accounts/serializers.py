from datetime import date

from django.contrib.auth.models import User
from rest_framework import serializers

from .models import (
    Person,
    Account,
    Connection,
    Interaction,
    Event,  # Existing models left intact for now
    Notification,
)

# -------------------------------------------------------------------
# Person / Account
# -------------------------------------------------------------------
class PersonSerializer(serializers.ModelSerializer):
    is_app_user = serializers.BooleanField(read_only=True)

    class Meta:
        model = Person
        fields = (
            "id",
            "first_name",
            "last_name",
            "email",
            "phone",
            "birthday",
            "is_app_user",
        )
        read_only_fields = ("id", "is_app_user")


# -------------------------------------------------------------------
# User search – expose connection status
# -------------------------------------------------------------------
class UserSearchSerializer(serializers.ModelSerializer):
    connection_status = serializers.SerializerMethodField()

    def get_connection_status(self, user):
        request_user = self.context['request'].user
        try:
            request_person = request_user.account.person
        except Exception:
            return None

        outgoing = Connection.objects.filter(owner=request_person, target__account__user=user).first()
        incoming = Connection.objects.filter(owner__account__user=user, target=request_person).first()

        if not outgoing and not incoming:
            return {'status': 'none'}
        return {
            'status': outgoing.status if outgoing else 'none',
            'incoming_status': incoming.status if incoming else 'none',
            'is_mutual': bool(outgoing and incoming and outgoing.status == Connection.ACCEPTED and incoming.status == Connection.ACCEPTED)
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

# -------------------------------------------------------------------
# Connection (replaces Contact)
# -------------------------------------------------------------------
class ConnectionSerializer(serializers.ModelSerializer):
    # Fields for app user connection
    target_person_id = serializers.IntegerField(write_only=True, required=False)
    
    # Fields for manual contact creation
    first_name = serializers.CharField(write_only=True, required=False)
    last_name = serializers.CharField(write_only=True, required=False, allow_blank=True)
    email = serializers.EmailField(write_only=True, required=False, allow_blank=True)
    phone = serializers.CharField(write_only=True, required=False, allow_blank=True)
    birthday = serializers.DateField(write_only=True, required=False, allow_null=True)
    notes = serializers.CharField(write_only=True, required=False, allow_blank=True)
    tags = serializers.ListField(write_only=True, required=False, child=serializers.CharField())

    # Read-only fields
    target = PersonSerializer(read_only=True)
    owner = serializers.SerializerMethodField(read_only=True)
    is_mutual = serializers.BooleanField(read_only=True)

    def get_owner(self, obj):
        return {
            "id": obj.owner.id,
            "first_name": obj.owner.first_name,
            "last_name": obj.owner.last_name,
            "email": obj.owner.email,
        }

    def validate(self, attrs):
        # For manual contacts, first_name is required
        if 'first_name' in attrs:
            if not attrs['first_name'].strip():
                raise serializers.ValidationError({'first_name': 'First name is required'})
            return attrs

        # For app user connections, ensure target person exists
        if 'target_person_id' in attrs:
            if not Person.objects.filter(id=attrs['target_person_id']).exists():
                raise serializers.ValidationError({'target_person_id': 'Person does not exist'})
        return attrs

    def create(self, validated_data):
        owner_person: Person = self.context["request"].user.account.person

        # Handle manual contact creation
        if 'first_name' in validated_data:
            # Create a new Person record for the manual contact
            target_person = Person.objects.create(
                owner=owner_person,  # Set the owner for manual contacts
                first_name=validated_data.pop('first_name'),
                last_name=validated_data.pop('last_name', ''),
                email=validated_data.pop('email', ''),
                phone=validated_data.pop('phone', ''),
                birthday=validated_data.pop('birthday', None),
                notes=validated_data.pop('notes', ''),
                tags=validated_data.pop('tags', []),
            )
        else:
            # Handle app user connection
            target_id = validated_data.pop("target_person_id")
            target_person = Person.objects.get(id=target_id)

        # If the connection already exists, return it
        conn, _ = Connection.objects.get_or_create(
            owner=owner_person,
            target=target_person,
            defaults={
                **validated_data,
                "status": Connection.PENDING if target_person.is_app_user else Connection.ACCEPTED,
            },
        )
        return conn

    class Meta:
        model = Connection
        fields = (
            "id",
            "target_person_id",
            "first_name",
            "last_name",
            "email",
            "phone",
            "birthday",
            "notes",
            "tags",
            "target",
            "owner",
            "status",
            "is_mutual",
            "created_at",
            "last_contact_date",
            "no_contact_threshold",
        )
        read_only_fields = ("id", "owner", "is_mutual", "created_at")


# -------------------------------------------------------------------
# Interaction
# -------------------------------------------------------------------
class InteractionSerializer(serializers.ModelSerializer):
    actor = PersonSerializer(read_only=True)
    target = PersonSerializer(read_only=True)
    actor_person_id = serializers.IntegerField(write_only=True)
    target_person_id = serializers.IntegerField(write_only=True)
    type_display = serializers.SerializerMethodField(read_only=True)

    def get_type_display(self, obj):
        return obj.get_type_display()

    def validate(self, attrs):
        # Basic validation that actor owns a connection to target (for permission)
        request = self.context.get("request")
        if request:
            actor_person = request.user.account.person
            target_id = attrs.get("target_person_id")
            if not Connection.objects.filter(owner=actor_person, target_id=target_id, status__in=[Connection.ACCEPTED, Connection.PENDING]).exists():
                raise serializers.ValidationError("You need a connection before logging an interaction.")
        return attrs

    def create(self, validated_data):
        actor_id = validated_data.pop("actor_person_id")
        target_id = validated_data.pop("target_person_id")
        actor_person = Person.objects.get(id=actor_id)
        target_person = Person.objects.get(id=target_id)
        return Interaction.objects.create(actor=actor_person, target=target_person, **validated_data)

    class Meta:
        model = Interaction
        fields = (
            "id",
            "actor_person_id",
            "target_person_id",
            "actor",
            "target",
            "date",
            "type",
            "type_display",
            "notes",
            "created_at",
        )
        read_only_fields = ("id", "actor", "target", "created_at", "type_display")


# -------------------------------------------------------------------
# Dashboard bits (existing)
# -------------------------------------------------------------------
class EventSerializer(serializers.ModelSerializer):
    person = PersonSerializer(read_only=True)
    person_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    def update(self, instance, validated_data):
        # Update person if person_id is provided
        if 'person_id' in validated_data:
            person_id = validated_data.pop('person_id')
            instance.person = Person.objects.get(id=person_id) if person_id else None

        # Update all other fields
        for field, value in validated_data.items():
            setattr(instance, field, value)
        
        instance.save()
        return instance

    class Meta:
        model = Event
        fields = (
            "id",
            "date",
            "type",
            "title",
            "notes",
            "person",  # nested read-only data
            "person_id",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")


class NotificationSerializer(serializers.ModelSerializer):
    person = PersonSerializer(read_only=True)
    person_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    daysSince = serializers.SerializerMethodField()
    connection_id = serializers.SerializerMethodField()

    def get_daysSince(self, obj):
        # For NO_CONTACT notifications, base the count on the current connection's last_contact_date
        if obj.type == Notification.NO_CONTACT and obj.person:
            request = self.context.get("request")
            if request and hasattr(request.user, "account"):
                owner_person = request.user.account.person
                conn = Connection.objects.filter(owner=owner_person, target=obj.person).first()
                if conn and conn.last_contact_date:
                    return (date.today() - conn.last_contact_date).days
        # Fallback: use the notification's stored date
        if obj.date:
            return (date.today() - obj.date).days
        return None

    def get_connection_id(self, obj):
        """Return the Connection id between request user and person (if any)"""
        # We need request in context; return None if missing
        request = self.context.get("request")
        if not request or not obj.person:
            return None

        try:
            owner_person = request.user.account.person
        except Exception:
            return None

        conn = Connection.objects.filter(owner=owner_person, target=obj.person).first()
        return conn.id if conn else None

    # Ensure the main message reflects current days-since value for NO_CONTACT
    def to_representation(self, instance):
        data = super().to_representation(instance)
        if instance.type == Notification.NO_CONTACT and instance.person:
            days = data.get("daysSince")
            if days is not None:
                first_name = instance.person.first_name or "them"
                data["message"] = f"You haven't talked to {first_name} in {days} days – reach out!"
        return data

    class Meta:
        model = Notification
        fields = (
            "id",
            "type",
            "message",
            "event",
            "person",
            "person_id",
            "date",
            "daysSince",
            "connection_id",
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
