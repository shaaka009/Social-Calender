import json
import logging
import secrets
import string

from django.contrib.auth import authenticate, get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.db import IntegrityError
from django.db import models
from django.db.models import Q
from django.db import transaction
from django.core.mail import send_mail
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from urllib.parse import urlencode
from django.utils import timezone
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
from .birthday_events import build_virtual_birthday_events

from .forms import UserRegistrationForm

logger = logging.getLogger(__name__)


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


def _generate_verification_code():
    return "".join(secrets.choice(string.digits) for _ in range(6))


def _send_verification_email(user, verification_code):
    """Send 6-digit verification code. Fail silently in development."""
    subject = "Verify your email address"
    message = (
        f"Hi {user.first_name or 'there'},\n\n"
        "Thanks for signing up for Social Calendar.\n"
        "Please verify your email address using this 6-digit code:\n\n"
        f"{verification_code}\n\n"
        "This code expires in 15 minutes.\n\n"
        "If you did not create this account, you can ignore this email."
    )
    try:
        send_mail(subject, message, settings.DEFAULT_FROM_EMAIL, [user.email])
    except Exception:
        pass


def _send_login_email_change_code(first_name, new_email, verification_code):
    """Send 6-digit code for login email change."""
    subject = "Confirm your new login email"
    message = (
        f"Hi {first_name or 'there'},\n\n"
        "Use this code to confirm your new login email:\n\n"
        f"{verification_code}\n\n"
        "This code expires in 15 minutes.\n\n"
        "If you did not request this change, you can ignore this email."
    )
    try:
        send_mail(subject, message, settings.DEFAULT_FROM_EMAIL, [new_email])
    except Exception:
        pass


def _send_password_reset_email(user, web_reset_url, app_reset_url=None):
    """Send plain-text reset instructions (no HTML template dependency)."""
    first = (user.first_name or "").strip() or "there"
    parts = [
        f"Hi {first},",
        "",
        "We received a request to reset your Social Calendar password.",
        "",
        "Open this link in your browser to choose a new password:",
        web_reset_url,
        "",
        "Then sign in to the Social Calendar app with your new password.",
        "",
        "If you did not request a password reset, you can ignore this email.",
    ]
    # App-scheme links only help once a native build + Universal Links are set up.
    # Keep them out of production emails for now so users aren't sent a dead link.
    if app_reset_url and settings.DEBUG:
        parts.extend(
            [
                "",
                "(Dev) In-app deep link:",
                app_reset_url,
            ]
        )
    send_mail(
        "Password reset — Social Calendar",
        "\n".join(parts),
        settings.DEFAULT_FROM_EMAIL,
        [user.email],
    )


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
            contact_email=user.email,
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
            try:
                with transaction.atomic():
                    user = form.save()
                    user.is_active = False
                    user.save(update_fields=["is_active"])
                    verification_code = _generate_verification_code()
                    verification_expiry = timezone.now() + timedelta(minutes=15)
                    
                    # Create a Person and Account for this user
                    person = Person.objects.create(
                        first_name=user.first_name,
                        last_name=user.last_name,
                        email=user.email,
                        contact_email=user.email,
                    )
                    Account.objects.create(
                        user=user,
                        person=person,
                        verification_code=verification_code,
                        verification_code_expires_at=verification_expiry,
                    )
                    _send_verification_email(user, verification_code)
                    return JsonResponse(
                        {
                            "message": "Account created. Please verify your email to continue.",
                            "success": True,
                            "requires_verification": True,
                            "user": {
                                "id": user.id,
                                "email": user.email,
                                "first_name": user.first_name,
                                "last_name": user.last_name,
                            },
                        },
                        status=201,
                    )
            except IntegrityError:
                return JsonResponse(
                    {"message": "Invalid form data", "errors": {"email": ["An account with this email already exists."]}},
                    status=400,
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
                if user_obj.check_password(password) and not user_obj.is_active:
                    return JsonResponse(
                        {
                            "success": False,
                            "message": "Please verify your email before signing in.",
                            "requires_verification": True,
                        },
                        status=403,
                    )
                user = authenticate(username=user_obj.username, password=password)
            except (get_user_model().DoesNotExist, get_user_model().MultipleObjectsReturned):
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
def verify_email(request):
    if request.method != "POST":
        return JsonResponse({"message": "Method not allowed"}, status=405)

    data = json.loads(request.body or "{}")
    email = (data.get("email") or "").strip().lower()
    code = (data.get("code") or "").strip()

    if not email or not code:
        return JsonResponse({"success": False, "message": "Email and code are required."}, status=400)

    try:
        user = get_user_model().objects.get(email__iexact=email)
    except get_user_model().DoesNotExist:
        return JsonResponse({"success": False, "message": "Invalid verification code."}, status=400)

    # Already-active accounts must sign in with a password. Never mint JWTs
    # here — that would let anyone with a known email bypass authentication
    # by posting any non-empty verification code.
    if user.is_active:
        return JsonResponse(
            {
                "success": False,
                "message": "This email is already verified. Please sign in.",
            },
            status=400,
        )

    try:
        account = user.account
    except Account.DoesNotExist:
        return JsonResponse({"success": False, "message": "Unable to verify account."}, status=400)

    if not account.verification_code or account.verification_code != code:
        return JsonResponse({"success": False, "message": "Invalid verification code."}, status=400)
    if not account.verification_code_expires_at or timezone.now() > account.verification_code_expires_at:
        return JsonResponse({"success": False, "message": "Verification code expired. Please request a new code."}, status=400)

    user.is_active = True
    user.save(update_fields=["is_active"])
    account.verification_code = ""
    account.verification_code_expires_at = None
    account.save(update_fields=["verification_code", "verification_code_expires_at"])

    tokens = _tokens_for_user(user)
    return JsonResponse(
        {
            "success": True,
            "message": "Email verified successfully.",
            "tokens": tokens,
        }
    )


@csrf_exempt
def resend_verification_email(request):
    if request.method != "POST":
        return JsonResponse({"message": "Method not allowed"}, status=405)

    data = json.loads(request.body or "{}")
    email = (data.get("email") or "").strip().lower()
    if not email:
        return JsonResponse({"success": False, "message": "Email is required."}, status=400)

    try:
        user = get_user_model().objects.get(email__iexact=email)
        if not user.is_active:
            account = user.account
            verification_code = _generate_verification_code()
            account.verification_code = verification_code
            account.verification_code_expires_at = timezone.now() + timedelta(minutes=15)
            account.save(update_fields=["verification_code", "verification_code_expires_at"])
            _send_verification_email(user, verification_code)
    except get_user_model().DoesNotExist:
        # Avoid leaking account existence.
        pass
    except Account.DoesNotExist:
        pass

    return JsonResponse(
        {
            "success": True,
            "message": "If this email exists and is unverified, a verification code has been sent.",
        }
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def request_login_email_change(request):
    current_password = (request.data.get("current_password") or "").strip()
    new_email = (request.data.get("new_email") or "").strip().lower()
    user = request.user

    if not current_password or not new_email:
        return Response(
            {"success": False, "message": "Current password and new login email are required."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if new_email == (user.email or "").strip().lower():
        return Response(
            {"success": False, "message": "New login email must be different from current login email."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if not user.check_password(current_password):
        return Response(
            {"success": False, "message": "Current password is incorrect."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if get_user_model().objects.filter(Q(email__iexact=new_email) | Q(username__iexact=new_email)).exclude(
        id=user.id
    ).exists():
        return Response(
            {"success": False, "message": "That email is already in use."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        account = user.account
    except Account.DoesNotExist:
        return Response(
            {"success": False, "message": "Unable to update login email for this account."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    verification_code = _generate_verification_code()
    account.pending_login_email = new_email
    account.login_email_change_code = verification_code
    account.login_email_change_code_expires_at = timezone.now() + timedelta(minutes=15)
    account.save(
        update_fields=["pending_login_email", "login_email_change_code", "login_email_change_code_expires_at"]
    )
    _send_login_email_change_code(user.first_name, new_email, verification_code)
    return Response(
        {
            "success": True,
            "message": "Verification code sent to your new login email.",
        }
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def verify_login_email_change(request):
    code = (request.data.get("code") or "").strip()
    if not code:
        return Response(
            {"success": False, "message": "Verification code is required."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    user = request.user
    try:
        account = user.account
    except Account.DoesNotExist:
        return Response(
            {"success": False, "message": "Unable to verify login email change."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if not account.pending_login_email or not account.login_email_change_code:
        return Response(
            {"success": False, "message": "No login email change is pending."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if account.login_email_change_code != code:
        return Response(
            {"success": False, "message": "Invalid verification code."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if (
        not account.login_email_change_code_expires_at
        or timezone.now() > account.login_email_change_code_expires_at
    ):
        return Response(
            {"success": False, "message": "Verification code expired. Request a new code."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    normalized_email = account.pending_login_email.strip().lower()
    if get_user_model().objects.filter(Q(email__iexact=normalized_email) | Q(username__iexact=normalized_email)).exclude(
        id=user.id
    ).exists():
        return Response(
            {"success": False, "message": "That email is already in use."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    user.email = normalized_email
    user.username = normalized_email
    user.save(update_fields=["email", "username"])

    # Keep Person.email aligned so connection/search UIs don't show the old login email.
    person = account.person
    if person.email != normalized_email:
        person.email = normalized_email
        person.save(update_fields=["email"])

    account.pending_login_email = None
    account.login_email_change_code = ""
    account.login_email_change_code_expires_at = None
    account.save(
        update_fields=["pending_login_email", "login_email_change_code", "login_email_change_code_expires_at"]
    )
    return Response(
        {
            "success": True,
            "message": "Login email updated successfully.",
            "login_email": user.email,
        }
    )


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
    person_id = None
    try:
        person_id = request.user.account.person_id
    except Account.DoesNotExist:
        person_id = None

    return Response({
        "success": True,
        "user": {
            "id": request.user.id,
            "person_id": person_id,
            "email": request.user.email,
            "first_name": request.user.first_name,
            "last_name": request.user.last_name,
        }
    })

@csrf_exempt
def password_reset(request):
    if request.method != "POST":
        return JsonResponse({"message": "Method not allowed"}, status=405)

    try:
        data = json.loads(request.body.decode("utf-8") or "{}")
    except (json.JSONDecodeError, UnicodeDecodeError):
        return JsonResponse({"message": "Invalid JSON"}, status=400)

    email = (data.get("email") or "").strip().lower()
    if not email:
        return JsonResponse({"message": "Email is required"}, status=400)

    User = get_user_model()
    try:
        user = User.objects.get(email__iexact=email)
    except User.DoesNotExist:
        return JsonResponse({"message": "Password reset email sent if account exists"})

    token = default_token_generator.make_token(user)
    uid = urlsafe_base64_encode(force_bytes(user.pk))

    frontend_url = getattr(settings, "FRONTEND_BASE_URL", "http://localhost:8081").rstrip("/")
    # Query-param URL hits a static page on join-social.com (no dynamic routing needed).
    web_reset_url = f"{frontend_url}/reset.html?{urlencode({'uid': uid, 'token': token})}"

    scheme = getattr(settings, "PASSWORD_RESET_APP_SCHEME", "") or ""
    app_reset_url = f"{scheme}://reset-password/{uid}/{token}" if scheme else None
    # In DEBUG, expose the in-app deep link so simulators/devices open Expo, not the web URL.
    dev_reset_link = app_reset_url or web_reset_url

    generic_ok = {"message": "Password reset email sent if account exists"}

    try:
        _send_password_reset_email(user, web_reset_url, app_reset_url)
    except Exception:
        logger.exception("Password reset email failed for user_id=%s", user.pk)
        if settings.DEBUG:
            out = dict(generic_ok)
            out["reset_link"] = dev_reset_link
            out["email_error"] = True
            return JsonResponse(out)
        return JsonResponse(generic_ok)

    response_data = dict(generic_ok)
    if settings.DEBUG:
        response_data["reset_link"] = dev_reset_link
    return JsonResponse(response_data)

@csrf_exempt
def password_reset_confirm(request, uid, token):
    if request.method != "POST":
        return JsonResponse({"message": "Method not allowed"}, status=405)

    try:
        data = json.loads(request.body.decode("utf-8") or "{}")
    except (json.JSONDecodeError, UnicodeDecodeError):
        return JsonResponse({"message": "Invalid JSON"}, status=400)

    new_password = data.get("password")
    if not new_password or not isinstance(new_password, str):
        return JsonResponse({"message": "Password is required."}, status=400)

    User = get_user_model()
    try:
        user_id = force_str(urlsafe_base64_decode(uid))
        user = User.objects.get(pk=user_id)
    except (ValueError, TypeError, OverflowError, User.DoesNotExist):
        return JsonResponse({"message": "Invalid request"}, status=400)

    if not default_token_generator.check_token(user, token):
        return JsonResponse(
            {"message": "Invalid or expired reset link. Please request a new one."},
            status=400,
        )

    try:
        validate_password(new_password, user=user)
    except DjangoValidationError as exc:
        return JsonResponse({"message": " ".join(exc.messages)}, status=400)

    user.set_password(new_password)
    user.save()
    return JsonResponse({"message": "Password reset successful"})

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

        today = timezone.localdate()

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
        today = timezone.localdate()
        start_date = today - timedelta(days=365)
        end_date = today + timedelta(days=365)

        persisted_events = Event.objects.filter(
            user=request.user,
            start_date__gte=start_date,
            start_date__lte=end_date,
        ).order_by('start_date')
        serialized_events = EventSerializer(persisted_events, many=True, context={'request': request}).data
        birthday_events = build_virtual_birthday_events(user_person=user_person, today=today)
        events = list(serialized_events) + birthday_events
        events.sort(key=lambda item: (item.get("start_date") or "", str(item.get("id"))))

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
        ).select_related("account")


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
            Q(target=user_person, status=Connection.PENDING)
        ).select_related('owner', 'target').prefetch_related('tags').order_by('target__first_name', 'target__last_name')

    def perform_create(self, serializer):
        user_person = get_or_create_person_for_user(self.request.user)
        serializer.save(owner=user_person)

    def perform_update(self, serializer):
        user_person = get_or_create_person_for_user(self.request.user)
        if serializer.instance.owner != user_person:
            raise PermissionDenied("You can only edit connections you own")
        serializer.save()

    @action(detail=True, methods=['post'])
    def accept(self, request, pk=None):
        """Accept a connection request."""
        connection = self.get_object()
        user_person = get_or_create_person_for_user(request.user)
        
        if connection.target != user_person:
            raise PermissionDenied("You can only accept requests sent to you")
        if connection.status != Connection.PENDING:
            return Response(
                {"detail": "Connection is not in pending state"},
                status=status.HTTP_400_BAD_REQUEST
            )

        connection.status = Connection.ACCEPTED
        connection.save()
        
        # Create reciprocal connection
        Connection.objects.update_or_create(
            owner=user_person,
            target=connection.owner,
            defaults={'status': Connection.ACCEPTED, 'no_contact_threshold': connection.no_contact_threshold}
        )
        
        return Response({"detail": "Connection accepted"})

    @action(detail=True, methods=['post'])
    def decline(self, request, pk=None):
        """Decline a connection request."""
        connection = self.get_object()
        user_person = get_or_create_person_for_user(request.user)
        
        if connection.target != user_person:
            raise PermissionDenied("You can only decline requests sent to you")
        if connection.status != Connection.PENDING:
            return Response(
                {"detail": "Connection is not in pending state"},
                status=status.HTTP_400_BAD_REQUEST
            )

        connection.status = Connection.DECLINED
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
        return Event.objects.filter(user=self.request.user).prefetch_related('people', 'tags').order_by('start_date')

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        serialized_events = self.get_serializer(queryset, many=True).data

        user_person = get_or_create_person_for_user(request.user)
        birthday_events = build_virtual_birthday_events(user_person=user_person, today=timezone.localdate())

        merged_events = list(serialized_events) + birthday_events
        merged_events.sort(key=lambda item: (item.get("start_date") or "", str(item.get("id"))))
        return Response(merged_events)

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
                 mixins.RetrieveModelMixin,
                 mixins.UpdateModelMixin,
                 mixins.DestroyModelMixin,
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
        serializer.instance = tag

    def create(self, request, *args, **kwargs):
        response = super().create(request, *args, **kwargs)
        if hasattr(self, "tag_instance"):
            response.data = TagSerializer(self.tag_instance).data
        if hasattr(self, "_created") and not self._created:
            response.status_code = status.HTTP_200_OK
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


class ChangePasswordAPIView(APIView):
    """Update password for the authenticated user (settings flow)."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        current_password = (request.data.get("current_password") or "").strip()
        new_password = request.data.get("new_password")
        new_password = new_password.strip() if isinstance(new_password, str) else ""

        if not current_password or not new_password:
            return Response(
                {"success": False, "message": "Current password and new password are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not user.check_password(current_password):
            return Response(
                {"success": False, "message": "Current password is incorrect."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if user.check_password(new_password):
            return Response(
                {"success": False, "message": "New password must be different from your current password."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            validate_password(new_password, user=user)
        except DjangoValidationError as exc:
            return Response(
                {"success": False, "message": " ".join(exc.messages)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.set_password(new_password)
        user.save(update_fields=["password"])
        return Response(
            {"success": True, "message": "Your password has been updated."},
            status=status.HTTP_200_OK,
        )


class DeleteAccountAPIView(APIView):
    """Permanently delete the authenticated user's account and all related data.
    Required by Apple App Store guidelines for apps that support account creation.
    """
    permission_classes = [IsAuthenticated]

    def delete(self, request):
        user = request.user
        password = request.data.get("password") if isinstance(request.data, dict) else None
        if not password:
            return Response(
                {"message": "Password is required to delete account."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not user.check_password(password):
            return Response(
                {"message": "Incorrect password."},
                status=status.HTTP_400_BAD_REQUEST,
            )

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
