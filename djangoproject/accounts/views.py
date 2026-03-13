import json

from django.contrib.auth import authenticate, get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.db import models
from django.db.models import Q
from django.db import transaction
from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.generics import RetrieveUpdateAPIView
from rest_framework_simplejwt.tokens import RefreshToken
from datetime import date, timedelta
from django.views.decorators.http import require_http_methods

# New imports for DRF class-based view
from rest_framework.views import APIView
from rest_framework import viewsets, serializers, mixins
from .serializers import (
    DashboardSerializer,
    ConnectionSerializer,
    UserSearchSerializer,
    InteractionSerializer,
    EventSerializer,
    UserProfileSerializer,
    TagSerializer,
)
from .models import Connection, Interaction, Person, Account, Event, Tag

from .forms import UserRegistrationForm


# -------------------------------------------------
# JWT helper
# -------------------------------------------------

def _tokens_for_user(user):
    """Return access + refresh token pair for a given user."""
    refresh = RefreshToken.for_user(user)
    return {
        'access': str(refresh.access_token),
        'refresh': str(refresh),
    }


# Create your views here.

# -------------------------------------------------
# Utility helpers
# -------------------------------------------------

def get_or_create_person_for_user(user):
    """Get the Person object for a given User, creating one if it doesn't exist."""
    try:
        account = Account.objects.get(user=user)
        return account.person
    except Account.DoesNotExist:
        # Create a person and account for this user
        person = Person.objects.create(
            first_name=user.first_name,
            last_name=user.last_name,
            email=user.email,
        )
        Account.objects.create(user=user, person=person)
        return person

# =========================================================================
# AUTHENTICATION VIEWS (function based)
# =========================================================================

@csrf_exempt
def signup(request):
    if request.method == "POST":
        form = UserRegistrationForm(json.loads(request.body))
        if form.is_valid():
            with transaction.atomic():
                user = form.save()
                
                # Create a Person and Account for this user
                person = Person.objects.create(
                    first_name=user.first_name,
                    last_name=user.last_name,
                    email=user.email,
                )
                Account.objects.create(user=user, person=person)
                
                tokens = _tokens_for_user(user)
                return JsonResponse(
                    {
                        "message": "Account created successfully!",
                        "success": True,
                        "tokens": tokens,
                        "user": {
                            "id": user.id,
                            "email": user.email,
                            "first_name": user.first_name,
                            "last_name": user.last_name,
                        },
                    },
                    status=201,
                )
        else:
            return JsonResponse(
                {"message": "Invalid form data", "errors": form.errors}, status=400
            )

    return JsonResponse({"message": "Method not allowed"}, status=405)


@csrf_exempt
def signin(request):
    if request.method == "POST":
        data = json.loads(request.body)
        email = data.get("email")
        password = data.get("password")

        if not email or not password:
            return JsonResponse(
                {"success": False, "message": "Email and password are required"},
                status=400,
            )

        # Try authenticating with the provided value as both username and email
        user = authenticate(username=email, password=password)  # Try direct username auth
        
        if user is None:
            # If username auth failed, try to find user by email
            try:
                user_obj = get_user_model().objects.get(email=email)
                user = authenticate(username=user_obj.username, password=password)
            except get_user_model().DoesNotExist:
                user = None

        if user is not None:
            tokens = _tokens_for_user(user)
            return JsonResponse(
                {
                    "success": True,
                    "message": "Login successful!",
                    "tokens": tokens,
                    "user": {
                        "id": user.id,
                        "email": user.email,
                        "first_name": user.first_name,
                        "last_name": user.last_name,
                    },
                }
            )
        else:
            return JsonResponse(
                {"success": False, "message": "Invalid username/email or password"},
                status=401,
            )

    return JsonResponse({"message": "Method not allowed"}, status=405)


@csrf_exempt
def signout(request):
    """With JWT the client simply discards its tokens.
    This endpoint exists for symmetry / future token blacklisting."""
    if request.method == "POST":
        return JsonResponse({"message": "Logged out successfully!"})
    return JsonResponse({"message": "Method not allowed"}, status=405)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_user(request):
    return Response({
        "success": True,
        "user": {
            "id": request.user.id,
            "email": request.user.email,
            "first_name": request.user.first_name,
            "last_name": request.user.last_name,
        }
    })

@csrf_exempt
def password_reset(request):
    if request.method == 'POST':
        data = json.loads(request.body.decode('utf-8'))
        email = data.get('email')
        
        try:
            user = get_user_model().objects.get(email=email)
            
            # Generate token
            token = default_token_generator.make_token(user)
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            
            # Build reset URL from the FRONTEND_BASE_URL env var
            frontend_url = getattr(settings, 'FRONTEND_BASE_URL', 'http://localhost:8081')
            reset_url = f"{frontend_url}/reset-password/{uid}/{token}"
            
            try:
                subject = 'Password Reset Request'
                message = render_to_string('password_reset_email.html', {
                    'user': user,
                    'reset_url': reset_url,
                })
                send_mail(subject, message, settings.DEFAULT_FROM_EMAIL, [email])
            except Exception:
                pass  # Silently handle email errors in development
            
            response_data = {
                'message': 'Password reset email sent if account exists',
            }
            # Only expose the link directly in dev mode
            if settings.DEBUG:
                response_data['reset_link'] = reset_url
            return JsonResponse(response_data)
        except get_user_model().DoesNotExist:
            # Return success even if email doesn't exist (for security)
            return JsonResponse({
                'message': 'Password reset email sent if account exists'
            })
    
    return JsonResponse({'message': 'Method not allowed'}, status=405)

@csrf_exempt
def password_reset_confirm(request, uid, token):
    if request.method == 'POST':
        data = json.loads(request.body.decode('utf-8'))
        new_password = data.get('password')
        
        try:
            user_id = force_str(urlsafe_base64_decode(uid))
            user = get_user_model().objects.get(pk=user_id)
            
            if default_token_generator.check_token(user, token):
                user.set_password(new_password)
                user.save()
                return JsonResponse({'message': 'Password reset successful'})
            else:
                return JsonResponse({'message': 'Invalid token'}, status=400)
                
        except (ValueError, get_user_model().DoesNotExist):
            return JsonResponse({'message': 'Invalid request'}, status=400)
    
    return JsonResponse({'message': 'Method not allowed'}, status=405)

# =========================================================================
# API VIEWS (class based)
# =========================================================================

class DashboardAPIView(APIView):
    permission_classes = [IsAuthenticated]

    # -----------------------------------------------------------------
    # Lightweight per-user notification refresh.  We keep a simple
    # in-memory dict so that repeated fast refreshes (pull-to-refresh,
    # tab switching) don't rescan on every request.  The worst case is
    # that after a deploy / restart, the first request per user does a
    # scan — which is fine.
    # -----------------------------------------------------------------
    _last_notif_refresh = {}  # {user_id: datetime}

    def _refresh_notifications(self, request):
        """Update no-contact + upcoming-event notifications for current user only."""
        from .models import Notification
        from django.utils import timezone
        import datetime as _dt

        user = request.user
        user_person = get_or_create_person_for_user(user)
        now = timezone.now()

        # Throttle: skip if we refreshed for this user in the last 60 min
        last = self._last_notif_refresh.get(user.id)
        if last and (now - last) < _dt.timedelta(hours=1):
            return
        self._last_notif_refresh[user.id] = now

        today = date.today()

        # --- No-contact notifications (scoped to THIS user's connections) ---
        connections = Connection.objects.filter(
            owner=user_person,
            status=Connection.ACCEPTED,
            last_contact_date__isnull=False,
        ).select_related('target')

        for conn in connections:
            days_since = (today - conn.last_contact_date).days
            threshold = conn.no_contact_threshold
            if threshold is None:
                Notification.objects.filter(user=user, type=Notification.NO_CONTACT, person=conn.target).delete()
                continue
            if days_since >= threshold:
                existing = Notification.objects.filter(user=user, type=Notification.NO_CONTACT, person=conn.target)
                if not existing.exists():
                    Notification.objects.create(
                        user=user,
                        type=Notification.NO_CONTACT,
                        person=conn.target,
                        message=f"You haven't talked to {conn.target.first_name or 'them'} in {days_since} days – reach out!",
                        date=conn.last_contact_date,
                    )
                elif existing.count() > 1:
                    keep = existing.order_by('-created_at').first()
                    existing.exclude(id=keep.id).delete()
            else:
                Notification.objects.filter(user=user, type=Notification.NO_CONTACT, person=conn.target).delete()

        # --- Upcoming-event notifications (7 days out) ---
        Notification.objects.filter(
            user=user,
            type=Notification.UPCOMING_EVENT,
            event__start_date__lt=today - timedelta(days=1),
        ).delete()

        upcoming_events = Event.objects.filter(
            user=user,
            start_date__gte=today,
            start_date__lte=today + timedelta(days=7),
        )
        for event in upcoming_events:
            if not Notification.objects.filter(user=user, type=Notification.UPCOMING_EVENT, event=event).exists():
                days_until = (event.start_date - today).days
                Notification.objects.create(
                    user=user,
                    type=Notification.UPCOMING_EVENT,
                    message=f"{event.title} is in {days_until} days",
                    event=event,
                    date=event.start_date,
                )

    def get(self, request):
        user_person = get_or_create_person_for_user(request.user)
        today = date.today()
        start_date = today - timedelta(days=365)
        end_date = today + timedelta(days=365)

        events = Event.objects.filter(
            user=request.user,
            start_date__gte=start_date,
            start_date__lte=end_date,
        ).order_by('start_date')

        # Refresh notifications (scoped + throttled)
        self._refresh_notifications(request)

        notifications = request.user.notifications.order_by('-created_at')[:10]

        data = {
            'user': request.user,
            'events': events,
            'notifications': notifications,
        }

        serializer = DashboardSerializer(data, context={'request': request})
        return Response(serializer.data)


class UserSearchViewSet(viewsets.ReadOnlyModelViewSet):
    """Search for users to add as contacts."""
    serializer_class = UserSearchSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        query = self.request.query_params.get('q', '').strip()
        if not query:
            return get_user_model().objects.none()

        return get_user_model().objects.filter(
            Q(first_name__icontains=query) |
            Q(last_name__icontains=query) |
            Q(email__icontains=query)
        ).exclude(
            id=self.request.user.id  # Don't show current user
        )


# =========================================================================
# VIEWSETS FOR MAIN MODELS
# =========================================================================

class ConnectionViewSet(viewsets.ModelViewSet):
    """Manage connections between people."""
    serializer_class = ConnectionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user_person = get_or_create_person_for_user(self.request.user)
        # Show connections where user is owner, plus pending connections where user is target
        return Connection.objects.filter(
            Q(owner=user_person) | 
            Q(target=user_person, status='pending')
        ).order_by('target__first_name', 'target__last_name')

    def perform_create(self, serializer):
        user_person = get_or_create_person_for_user(self.request.user)
        serializer.save(owner=user_person)

    @action(detail=True, methods=['post'])
    def accept(self, request, pk=None):
        """Accept a connection request."""
        connection = self.get_object()
        user_person = get_or_create_person_for_user(request.user)
        
        if connection.target != user_person:
            raise PermissionDenied("You can only accept requests sent to you")
        if connection.status != 'pending':
            return Response(
                {"detail": "Connection is not in pending state"},
                status=status.HTTP_400_BAD_REQUEST
            )

        connection.status = 'accepted'
        connection.save()
        
        # Create reciprocal connection
        Connection.objects.update_or_create(
            owner=user_person,
            target=connection.owner,
            defaults={'status': 'accepted', 'no_contact_threshold': connection.no_contact_threshold}
        )
        
        return Response({"detail": "Connection accepted"})

    @action(detail=True, methods=['post'])
    def decline(self, request, pk=None):
        """Decline a connection request."""
        connection = self.get_object()
        user_person = get_or_create_person_for_user(request.user)
        
        if connection.target != user_person:
            raise PermissionDenied("You can only decline requests sent to you")
        if connection.status != 'pending':
            return Response(
                {"detail": "Connection is not in pending state"},
                status=status.HTTP_400_BAD_REQUEST
            )

        connection.status = 'declined'
        connection.save()
        return Response({"detail": "Connection declined"})

    def destroy(self, request, *args, **kwargs):
        """Delete a connection and its reciprocal."""
        connection = self.get_object()
        user_person = get_or_create_person_for_user(request.user)
        
        # Only allow deletion if user is the owner
        if connection.owner != user_person:
            raise PermissionDenied("You can only delete connections you own")
        
        # Delete reciprocal connection if it exists
        Connection.objects.filter(
            owner=connection.target,
            target=connection.owner
        ).delete()
        
        # Delete the original connection
        connection.delete()
        
        return Response(status=status.HTTP_204_NO_CONTENT)


class InteractionViewSet(viewsets.ModelViewSet):
    """Manage interactions between people."""
    serializer_class = InteractionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user_person = get_or_create_person_for_user(self.request.user)
        queryset = Interaction.objects.filter(
            Q(actor=user_person) | Q(target=user_person)
        ).order_by('-date')
        
        # Filter by specific target person if provided
        target_person_id = self.request.query_params.get('target')
        if target_person_id:
            queryset = queryset.filter(
                Q(actor=user_person, target_id=target_person_id) |
                Q(target=user_person, actor_id=target_person_id)
            )
        
        return queryset

    def perform_create(self, serializer):
        user_person = get_or_create_person_for_user(self.request.user)
        # The serializer handles actor assignment from request data
        serializer.save()


class EventViewSet(viewsets.ModelViewSet):
    """Manage events."""
    serializer_class = EventSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Event.objects.filter(user=self.request.user).order_by('start_date')

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    def create(self, request, *args, **kwargs):
        """Custom create to handle validation errors."""
        serializer = self.get_serializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)


# -------------------------------------------------
# Tag ViewSet – list & create, scoped to request user
# -------------------------------------------------


class TagViewSet(mixins.ListModelMixin,
                 mixins.CreateModelMixin,
                 viewsets.GenericViewSet):
    serializer_class = TagSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user_person = get_or_create_person_for_user(self.request.user)
        return Tag.objects.filter(owner=user_person).order_by("name")

    def perform_create(self, serializer):
        user_person = get_or_create_person_for_user(self.request.user)
        name = serializer.validated_data.get("name")
        color = serializer.validated_data.get("color", "#cccccc")

        tag, created = Tag.objects.get_or_create(owner=user_person, name=name, defaults={"color": color})

        # If tag existed but color changed, update it
        if not created and tag.color != color:
            tag.color = color
            tag.save(update_fields=["color"])

        self._created = created  # flag for custom status
        self.tag_instance = tag

    def create(self, request, *args, **kwargs):
        response = super().create(request, *args, **kwargs)
        if hasattr(self, "_created") and not self._created:
            response.status_code = status.HTTP_200_OK
            response.data = TagSerializer(self.tag_instance).data
        return response


class UserProfileAPIView(APIView):
    """Get and update user profile data."""
    serializer_class = UserProfileSerializer
    permission_classes = [IsAuthenticated]

    def get(self, request):
        person = get_or_create_person_for_user(request.user)
        serializer = self.serializer_class(person, context={'request': request})
        return Response(serializer.data)

    def patch(self, request):
        person = get_or_create_person_for_user(request.user)
        serializer = self.serializer_class(person, data=request.data, partial=True, context={'request': request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class DeleteAccountAPIView(APIView):
    """Permanently delete the authenticated user's account and all related data.
    Required by Apple App Store guidelines for apps that support account creation.
    """
    permission_classes = [IsAuthenticated]

    def delete(self, request):
        user = request.user

        with transaction.atomic():
            # Get the user's Person record if it exists
            try:
                person = user.account.person

                # Delete manual contacts owned by this person
                Person.objects.filter(owner=person).delete()

                # Delete connections (both directions)
                Connection.objects.filter(Q(owner=person) | Q(target=person)).delete()

                # Delete interactions involving this person
                Interaction.objects.filter(Q(actor=person) | Q(target=person)).delete()

                # Delete the Person (cascades to Account, Tags, Notifications, etc.)
                person.delete()
            except (Account.DoesNotExist, AttributeError):
                pass

            # Delete events owned by this user
            Event.objects.filter(user=user).delete()

            # Delete the auth User itself (cascades remaining FKs)
            user.delete()

        return Response({"message": "Account deleted successfully."}, status=status.HTTP_204_NO_CONTENT)
