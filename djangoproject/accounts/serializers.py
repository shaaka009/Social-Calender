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
    Tag,
)

# -------------------------------------------------------------------
# Person / Account
# -------------------------------------------------------------------
class PersonSerializer(serializers.ModelSerializer):
    is_app_user = serializers.BooleanField(read_only=True)
    profile_picture_url = serializers.SerializerMethodField()

    def get_profile_picture_url(self, obj):
        if obj.profile_picture:
            return self.context['request'].build_absolute_uri(obj.profile_picture.url)
        return None

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
            "profile_picture_url",
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
# Tag
# -------------------------------------------------------------------


class TagSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tag
        fields = ("id", "name", "color")

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
            # Extract tags list (if provided) BEFORE creating Person
            tag_names = validated_data.pop('tags', [])

            target_person = Person.objects.create(
                owner=owner_person,  # Set the owner for manual contacts
                first_name=validated_data.pop('first_name'),
                last_name=validated_data.pop('last_name', ''),
                email=validated_data.pop('email', ''),
                phone=validated_data.pop('phone', ''),
                birthday=validated_data.pop('birthday', None),
                notes=validated_data.pop('notes', ''),
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

        # Handle tag assignments (only if the request included any)
        if 'tag_names' in locals() and tag_names:
            tag_objs = [Tag.objects.get_or_create(owner=owner_person, name=n.strip())[0] for n in tag_names]
            conn.tags.set(tag_objs)
        return conn

    def update(self, instance, validated_data):
        """Handle updates for both manual contacts and app-user connections.

        Manual contact edits (first_name, email, etc.) should modify the linked
        Person record.  For app-user connections these fields are ignored.
        """
        # Keep a reference to target person before popping fields
        target_person = instance.target

        # Fields that belong to the Person model (only editable for manual contacts)
        person_fields = [
            "first_name",
            "last_name",
            "email",
            "phone",
            "birthday",
            "notes",
        ]

        # Determine if this is a manual contact (target.person.owner == connection.owner)
        is_manual = getattr(target_person, "owner", None) == instance.owner

        if is_manual:
            # Apply person field updates and remove them from validated_data so
            # the Connection model isn't affected by unknown attrs.
            for field in person_fields:
                if field in validated_data:
                    setattr(target_person, field, validated_data.pop(field))
            target_person.save()

        # Handle tag updates (owner scoped)
        if "tags" in validated_data:
            tag_names = validated_data.pop("tags")
            owner = instance.owner
            tag_objs = [Tag.objects.get_or_create(owner=owner, name=name.strip())[0] for name in tag_names]
            instance.tags.set(tag_objs)

        return super().update(instance, validated_data)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["tags"] = [tag.name for tag in instance.tags.all()]
        return data

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
        if hasattr(obj, 'get_type_display'):
            return obj.get_type_display()
        # During validation/creation, obj might be a dict
        return dict(Interaction.INTERACTION_TYPE_CHOICES).get(obj.get('type', obj) if isinstance(obj, dict) else obj, '')

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
    tags = TagSerializer(many=True, read_only=True)
    tag_ids = serializers.ListField(
        child=serializers.IntegerField(),
        write_only=True,
        required=False,
        allow_null=True,
    )
    def update(self, instance, validated_data):
        # Update person if person_id is provided
        if 'person_id' in validated_data:
            person_id = validated_data.pop('person_id')
            instance.person = Person.objects.get(id=person_id) if person_id else None

        # Update all other fields
        tag_ids = validated_data.pop('tag_ids', None)
        for field, value in validated_data.items():
            setattr(instance, field, value)

        instance.save()

        if tag_ids is not None:
            instance.tags.set(Tag.objects.filter(id__in=tag_ids))
        return instance

    def create(self, validated_data):
        tag_ids = validated_data.pop('tag_ids', [])
        event = Event.objects.create(**validated_data)
        if tag_ids:
            event.tags.set(Tag.objects.filter(id__in=tag_ids))
        return event

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
            "tags",
            "tag_ids",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at", "tags")


class NotificationSerializer(serializers.ModelSerializer):
    person = PersonSerializer(read_only=True)
    person_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    daysSince = serializers.SerializerMethodField()
    connection_id = serializers.SerializerMethodField()
    daysUntil = serializers.SerializerMethodField()

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

    def get_daysUntil(self, obj):
        """Return days until the event date for UPCOMING_EVENT notifications."""
        if obj.type == Notification.UPCOMING_EVENT:
            # Prefer the event relation, fallback to stored date field
            event_date = None
            if obj.event and obj.event.date:
                event_date = obj.event.date
            elif obj.date:
                event_date = obj.date
            if event_date:
                return (event_date - date.today()).days
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
        # Dynamically adjust UPCOMING_EVENT message so the relative days stay accurate
        if instance.type == Notification.UPCOMING_EVENT:
            days = data.get("daysUntil")
            if days is not None:
                # If the event relation exists, use its title/person to craft message if not already appropriate
                title = instance.event.title if instance.event else "Event"
                if days > 0:
                    data["message"] = f"{title} is in {days} days"
                elif days == 0:
                    data["message"] = f"{title} is today"
                else:
                    data["message"] = f"{title} was {-days} days ago"
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
            "daysUntil",
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


# -------------------------------------------------------------------
# Current user profile
# -------------------------------------------------------------------
class UserProfileSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    first_name = serializers.CharField(required=False, allow_blank=True)
    last_name = serializers.CharField(required=False, allow_blank=True)
    email = serializers.EmailField(required=False, allow_blank=True)
    phone = serializers.CharField(required=False, allow_blank=True)
    birthday = serializers.DateField(required=False, allow_null=True)
    profile_picture = serializers.ImageField(required=False, allow_null=True)

    def to_representation(self, person):
        # The instance is a Person object, get the linked User
        user = getattr(person, "account", None)
        user = getattr(user, "user", None) if user else None

        data = {
            "id": person.id,
            # For account holders (person.account.user exists), the authoritative
            # data lives on auth_user.  For standalone contacts, it lives on Person.
            "first_name": (user.first_name if user and user.first_name else person.first_name) or "",
            "last_name": (user.last_name if user and user.last_name else person.last_name) or "",
            "email": (user.email if user else person.email) or "",
            "phone": person.phone or "",
            "birthday": person.birthday,
        }

        # Add profile picture URL if it exists
        if person.profile_picture:
            request = self.context.get('request')
            if request:
                data['profile_picture'] = request.build_absolute_uri(person.profile_picture.url)
            else:
                data['profile_picture'] = person.profile_picture.url
        else:
            data['profile_picture'] = None

        return data

    def update(self, person, validated_data):
        # Update Person fields
        for attr in ("phone", "birthday", "profile_picture"):
            if attr in validated_data:
                setattr(person, attr, validated_data[attr])
        person.save()

        # Update related User fields if Account & User exist
        if hasattr(person, "account") and hasattr(person.account, "user"):
            user = person.account.user
            for attr in ("first_name", "last_name", "email"):
                if attr in validated_data:
                    setattr(user, attr, validated_data[attr])
                    # Clear duplicates on Person so it behaves like a wrapper
                    setattr(person, attr, None)
            user.save()
            person.save()
        
        return person