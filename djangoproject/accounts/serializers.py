import json
from datetime import date

from django.contrib.auth.models import User
from django.db.models import Q
from django.utils import timezone
from rest_framework import serializers
from .models import (
    Person,
    Account,
    Connection,
    Interaction,
    Event,
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
            "organization",
            "location",
            "birthday",
            "extra_contacts",
            "is_app_user",
            "profile_picture_url",
        )
        read_only_fields = ("id", "is_app_user")


# -------------------------------------------------------------------
# User search – expose connection status
# -------------------------------------------------------------------
class UserSearchSerializer(serializers.ModelSerializer):
    connection_status = serializers.SerializerMethodField()
    person_id = serializers.SerializerMethodField()

    def get_person_id(self, user):
        """Person pk for Connection.target_person_id (differs from User.pk)."""
        account = getattr(user, "account", None)
        if account is None:
            return None
        return account.person_id

    def get_connection_status(self, user):
        request_user = self.context['request'].user
        try:
            request_person = request_user.account.person
        except Exception:
            return None

        if not hasattr(self, "_connection_lookup"):
            outgoing_map = {}
            incoming_map = {}

            outgoing_connections = Connection.objects.filter(
                owner=request_person,
                target__account__user__isnull=False,
            ).select_related("target__account__user")
            for connection in outgoing_connections:
                target_user_id = getattr(connection.target.account.user, "id", None)
                if target_user_id is not None:
                    outgoing_map[target_user_id] = connection

            incoming_connections = Connection.objects.filter(
                target=request_person,
                owner__account__user__isnull=False,
            ).select_related("owner__account__user")
            for connection in incoming_connections:
                owner_user_id = getattr(connection.owner.account.user, "id", None)
                if owner_user_id is not None:
                    incoming_map[owner_user_id] = connection

            self._connection_lookup = {
                "outgoing": outgoing_map,
                "incoming": incoming_map,
            }

        outgoing = self._connection_lookup["outgoing"].get(user.id)
        incoming = self._connection_lookup["incoming"].get(user.id)

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
            'person_id',
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

    def validate_name(self, value):
        value = (value or "").strip()
        if not value:
            raise serializers.ValidationError("This field may not be blank.")
        instance = self.instance
        if instance is None:
            return value
        owner = instance.owner
        qs = Tag.objects.filter(owner=owner, name=value).exclude(pk=instance.pk)
        if qs.exists():
            raise serializers.ValidationError("A tag with this name already exists.")
        return value

# -------------------------------------------------------------------
# Connection (replaces Contact)
# -------------------------------------------------------------------
class ConnectionSerializer(serializers.ModelSerializer):
    # Fields for app user connection
    target_person_id = serializers.IntegerField(write_only=True, required=False)
    profile_picture = serializers.ImageField(required=False, allow_null=True)
    
    # Fields for manual contact creation
    first_name = serializers.CharField(write_only=True, required=False)
    last_name = serializers.CharField(write_only=True, required=False, allow_blank=True)
    email = serializers.EmailField(write_only=True, required=False, allow_blank=True)
    phone = serializers.CharField(write_only=True, required=False, allow_blank=True)
    extra_contacts = serializers.ListField(
        child=serializers.DictField(), write_only=True, required=False
    )
    birthday = serializers.DateField(write_only=True, required=False, allow_null=True)
    notes = serializers.CharField(required=False, allow_blank=True)
    tags = serializers.ListField(write_only=True, required=False, child=serializers.CharField())
    nickname = serializers.CharField(required=False, allow_blank=True)

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

    def to_internal_value(self, data):
        """Ignore URL-like profile_picture strings; only accept file uploads."""
        mutable_data = data.copy() if hasattr(data, "copy") else dict(data)
        profile_picture = mutable_data.get("profile_picture")
        if isinstance(profile_picture, str):
            mutable_data.pop("profile_picture", None)
        for key in ("extra_contacts", "tags"):
            value = mutable_data.get(key)
            if isinstance(value, str):
                try:
                    mutable_data[key] = json.loads(value)
                except (TypeError, ValueError):
                    pass
        return super().to_internal_value(mutable_data)

    def validate(self, attrs):
        # Normalize blank numeric fields
        if attrs.get('no_contact_threshold') in ['', None]:
            attrs['no_contact_threshold'] = None
        # Normalize blank date fields
        if attrs.get('birthday') == '':
            attrs['birthday'] = None

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

        # Extract organization override early if present (for connection-specific label)
        conn_org_override = validated_data.pop("organization", "")
        tag_names = validated_data.pop("tags", [])

        # Handle manual contact creation
        if 'first_name' in validated_data:
            target_person = Person.objects.create(
                owner=owner_person,  # Set the owner for manual contacts
                first_name=validated_data.pop('first_name'),
                last_name=validated_data.pop('last_name', ''),
                email=validated_data.pop('email', ''),
                phone=validated_data.pop('phone', ''),
                birthday=validated_data.pop('birthday', None),
                extra_contacts=validated_data.pop('extra_contacts', []),
                profile_picture=validated_data.pop('profile_picture', None),
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
                "organization": conn_org_override,
                "nickname": validated_data.pop("nickname", ""),
            },
        )
        # If connection existed and we provided a new organization override, update it
        if conn_org_override and conn.organization != conn_org_override:
            conn.organization = conn_org_override
            conn.save(update_fields=["organization"])

        # Handle tag assignments (only if the request included any)
        if tag_names:
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
            "extra_contacts",
            "profile_picture",
        ]

        # Determine if this is a manual contact (target.person.owner == connection.owner)
        is_manual = getattr(target_person, "owner", None) == instance.owner

        if is_manual:
            # Skip profile_picture if it's an existing URL string (not new upload)
            if 'profile_picture' in validated_data and isinstance(validated_data['profile_picture'], str):
                validated_data.pop('profile_picture')

            # Apply person field updates and remove them from validated_data so
            # the Connection model isn't affected by unknown attrs.
            for field in person_fields:
                if field in validated_data:
                    setattr(target_person, field, validated_data.pop(field))
            target_person.save()

        # Organization and nickname override – always editable by the connection owner
        if "organization" in validated_data:
            instance.organization = validated_data.pop("organization")
        if "nickname" in validated_data:
            instance.nickname = validated_data.pop("nickname")

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
        # Surface effective labels
        data["effective_organization"] = instance.organization or getattr(instance.target, "organization", "")
        data["nickname"] = instance.nickname or ""
        # Backward compatibility for legacy manual contacts that stored notes on Person.
        if not data.get("notes"):
            data["notes"] = getattr(instance.target, "notes", "") or ""
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
            "nickname",
            "organization",
            "tags",
            "target",
            "owner",
            "status",
            "is_mutual",
            "created_at",
            "last_contact_date",
            "no_contact_threshold",
            "extra_contacts",
            "profile_picture",
        )
        read_only_fields = ("id", "owner", "is_mutual", "created_at")


# -------------------------------------------------------------------
# Interaction
# -------------------------------------------------------------------
class InteractionSerializer(serializers.ModelSerializer):
    actor = PersonSerializer(read_only=True)
    target = PersonSerializer(read_only=True)
    actor_person_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    target_person_id = serializers.IntegerField(write_only=True)
    type_display = serializers.SerializerMethodField(read_only=True)

    def get_type_display(self, obj):
        if hasattr(obj, 'get_type_display'):
            return obj.get_type_display()
        # During validation/creation, obj might be a dict
        return dict(Interaction.INTERACTION_TYPE_CHOICES).get(obj.get('type', obj) if isinstance(obj, dict) else obj, '')

    def validate(self, attrs):
        request = self.context.get("request")
        if not request:
            return attrs

        actor_person = request.user.account.person
        target_id = attrs.get("target_person_id")
        if not Person.objects.filter(id=target_id).exists():
            raise serializers.ValidationError({"target_person_id": "Person does not exist."})

        has_connection = Connection.objects.filter(
            owner=actor_person,
            target_id=target_id,
            status__in=[Connection.ACCEPTED, Connection.PENDING],
        ).exists()
        if not has_connection:
            raise serializers.ValidationError("You need a connection before logging an interaction.")
        return attrs

    def create(self, validated_data):
        validated_data.pop("actor_person_id", None)
        target_id = validated_data.pop("target_person_id")
        actor_person = self.context["request"].user.account.person
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
    people = PersonSerializer(many=True, read_only=True)
    people_ids = serializers.ListField(
        child=serializers.IntegerField(),
        write_only=True,
        required=False,
        allow_empty=True,
    )
    tags = TagSerializer(many=True, read_only=True)
    tag_ids = serializers.ListField(
        child=serializers.IntegerField(),
        write_only=True,
        required=False,
        allow_empty=True,
    )
    title = serializers.CharField()
    start_date = serializers.DateField()
    end_date = serializers.DateField(allow_null=True, required=False)
    display_title = serializers.SerializerMethodField()

    def _get_owner_person(self):
        request = self.context.get("request")
        if not request or not hasattr(request.user, "account"):
            return None
        return request.user.account.person

    def _resolve_people(self, people_ids):
        owner_person = self._get_owner_person()
        if owner_person is None:
            return Person.objects.none()
        connection_target_ids = Connection.objects.filter(
            owner=owner_person
        ).exclude(
            status=Connection.DECLINED
        ).values_list("target_id", flat=True)
        return Person.objects.filter(id__in=people_ids).filter(
            Q(id__in=connection_target_ids) | Q(id=owner_person.id)
        )

    def _resolve_tags(self, tag_ids):
        owner_person = self._get_owner_person()
        if owner_person is None:
            return Tag.objects.none()
        return Tag.objects.filter(owner=owner_person, id__in=tag_ids)

    def get_display_title(self, obj):
        # For birthday events, check if we have a year and calculate age
        if obj.type == 'birthday' and hasattr(obj, 'start_date') and obj.start_date:
            # Calculate age
            today = timezone.localdate()
            age = today.year - obj.start_date.year
            # Adjust age if birthday hasn't occurred this year
            if today.month < obj.start_date.month or (today.month == obj.start_date.month and today.day < obj.start_date.day):
                age -= 1
            return f"{obj.title} (turning {age + 1})"
        return obj.title
    def update(self, instance, validated_data):
        people = None
        tags = None

        # Update people if people_ids is provided
        if 'people_ids' in validated_data:
            people_ids = validated_data.pop('people_ids')
            people = self._resolve_people(people_ids)
            if people.count() != len(set(people_ids)):
                raise serializers.ValidationError({"people_ids": "One or more people are not valid for this user."})

        # Update all other fields
        tag_ids = validated_data.pop('tag_ids', None)
        if tag_ids is not None:
            tags = self._resolve_tags(tag_ids)
            if tags.count() != len(set(tag_ids)):
                raise serializers.ValidationError({"tag_ids": "One or more tags are not valid for this user."})

        for field, value in validated_data.items():
            setattr(instance, field, value)

        instance.save()
        if people is not None:
            instance.people.set(people)

        if tags is not None:
            instance.tags.set(tags)
        return instance

    def create(self, validated_data):
        people_ids = validated_data.pop('people_ids', [])
        tag_ids = validated_data.pop('tag_ids', [])
        people = self._resolve_people(people_ids)
        if people.count() != len(set(people_ids)):
            raise serializers.ValidationError({"people_ids": "One or more people are not valid for this user."})

        tags = self._resolve_tags(tag_ids)
        if tags.count() != len(set(tag_ids)):
            raise serializers.ValidationError({"tag_ids": "One or more tags are not valid for this user."})

        event = Event.objects.create(**validated_data)
        if people_ids:
            event.people.set(people)
        if tag_ids:
            event.tags.set(tags)
        return event

    class Meta:
        model = Event
        fields = (
            "id",
            "start_date",
            "end_date",
            "type",
            "title",
            "display_title",
            "notes",
            "people",  # nested read-only data
            "people_ids",
            "tags",
            "tag_ids",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at", "tags", "people")

    def validate(self, attrs):
        start = attrs.get("start_date") or getattr(self.instance, "start_date", None)
        end = attrs.get("end_date", None)
        if end and end < start:
            raise serializers.ValidationError({"end_date": "End date cannot be before start_date"})
        return super().validate(attrs)


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
                    return (timezone.localdate() - conn.last_contact_date).days
        # Fallback: use the notification's stored date
        if obj.date:
            return (timezone.localdate() - obj.date).days
        return None

    def get_daysUntil(self, obj):
        """Return days until the event date for UPCOMING_EVENT notifications."""
        if obj.type == Notification.UPCOMING_EVENT:
            # Prefer the event relation, fallback to stored date field
            event_date = None
            if obj.event and hasattr(obj.event, 'start_date'):
                event_date = obj.event.start_date
            elif obj.date:
                event_date = obj.date  # legacy fallback
            if event_date:
                return (event_date - timezone.localdate()).days
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
            "created_at",
        )


class DashboardSerializer(serializers.Serializer):
    user = serializers.SerializerMethodField()
    events = serializers.SerializerMethodField()
    notifications = NotificationSerializer(many=True)

    def get_user(self, obj):
        user = self.context["request"].user
        return {
            "id": user.id,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "email": user.email,
        }

    def get_events(self, obj):
        events = obj.get("events", []) if isinstance(obj, dict) else []
        result = []
        for event in events:
            if isinstance(event, dict):
                result.append(event)
            else:
                result.append(EventSerializer(event, context=self.context).data)
        return result

    class Meta:
        fields = ("user", "events", "notifications")


# -------------------------------------------------------------------
# Current user profile
# -------------------------------------------------------------------
class UserProfileSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    first_name = serializers.CharField(required=False, allow_blank=True)
    last_name = serializers.CharField(required=False, allow_blank=True)
    email = serializers.EmailField(required=False, allow_blank=True, read_only=True)
    login_email = serializers.EmailField(required=False, allow_blank=True, read_only=True)
    contact_email = serializers.EmailField(required=False, allow_blank=True, allow_null=True)
    phone = serializers.CharField(required=False, allow_blank=True)
    birthday = serializers.DateField(required=False, allow_null=True)
    organization = serializers.CharField(required=False, allow_blank=True)
    location = serializers.CharField(required=False, allow_blank=True)
    extra_contacts = serializers.ListField(child=serializers.DictField(), required=False)
    profile_picture = serializers.ImageField(required=False, allow_null=True)

    def to_internal_value(self, data):
        """Multipart uploads send JSON lists as strings; ignore URL-like profile_picture strings."""
        mutable_data = data.copy() if hasattr(data, "copy") else dict(data)
        profile_picture = mutable_data.get("profile_picture")
        if isinstance(profile_picture, str):
            mutable_data.pop("profile_picture", None)
        value = mutable_data.get("extra_contacts")
        if isinstance(value, str):
            try:
                mutable_data["extra_contacts"] = json.loads(value)
            except (TypeError, ValueError):
                pass
        return super().to_internal_value(mutable_data)

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
            "login_email": (user.email if user else person.email) or "",
            "contact_email": person.contact_email if person.contact_email is not None else person.email,
            "phone": person.phone or "",
            "organization": person.organization or "",
            "location": person.location or "",
            "birthday": person.birthday,
            "extra_contacts": person.extra_contacts,
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
        # Backward compatibility: treat legacy email payload as contact_email.
        if "email" in validated_data and "contact_email" not in validated_data:
            validated_data["contact_email"] = validated_data.pop("email")

        # Update Person fields
        for attr in ("phone", "birthday", "profile_picture", "extra_contacts", "organization", "location", "contact_email"):
            if attr in validated_data:
                setattr(person, attr, validated_data[attr])
        person.save()

        # Update related User fields if Account & User exist
        if hasattr(person, "account") and hasattr(person.account, "user"):
            user = person.account.user
            for attr in ("first_name", "last_name"):
                if attr in validated_data:
                    setattr(user, attr, validated_data[attr])
                    # Clear duplicates on Person so it behaves like a wrapper
                    setattr(person, attr, None)
            user.save()
            person.save()
        
        return person