import json

from django.contrib.auth import authenticate, login, logout, get_user_model
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
# added for DashboardAPIView date calculations
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
)
from .models import Connection, Interaction, Person, Account, Event
from .authentication import CsrfExemptSessionAuthentication

from .forms import UserRegistrationForm

# Create your views here.

# -------------------------------------------------------------------
# Stub serializer kept only so legacy Contact-based code still parses
# -------------------------------------------------------------------
class ContactSerializer(serializers.Serializer):
    """Placeholder to satisfy references in deprecated code paths."""
    pass

class _ContactManager:
    def filter(self, *args, **kwargs):
        return Person.objects.none()
    def update_or_create(self, *args, **kwargs):
        return (None, False)
    def delete(self, *args, **kwargs):
        return 0

class Contact:
    """Lightweight stand-in for the old Contact model so legacy code still parses."""
    PENDING = "pending"
    ACCEPTED = "accepted"
    DECLINED = "declined"
    objects = _ContactManager()

    def __init__(self, *args, **kwargs):
        pass

# -------------------------------------------------
# Utility helpers
# -------------------------------------------------

def _get_person_for_request(request):
    """Return the Person linked to the authenticated request.user."""
    try:
        return request.user.account.person
    except Exception:
        raise PermissionDenied("Account is not linked to a Person record.")


@csrf_exempt
def signup(request):
    if request.method == "POST":
        data = json.loads(request.body)
        form = UserRegistrationForm(data)
        if form.is_valid():
            with transaction.atomic():  # Ensure all records are created or none
                user = form.save()
                
                # Create Person record
                person = Person.objects.create(
                    first_name=user.first_name,
                    last_name=user.last_name,
                    email=user.email,
                )
                
                # Create Account to link User and Person
                Account.objects.create(user=user, person=person)
                
                login(request, user)
                return JsonResponse(
                    {
                        "success": True,
                        "message": "Registration successful!",
                        "user": {
                            "id": user.id,
                            "email": user.email,
                            "first_name": user.first_name,
                            "last_name": user.last_name,
                        },
                    }
                )
        else:
            return JsonResponse({"success": False, "errors": form.errors}, status=400)

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
            login(request, user)
            return JsonResponse(
                {
                    "success": True,
                    "message": "Login successful!",
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
    if request.method == "POST":
        logout(request)
        return JsonResponse({"success": True, "message": "Logged out successfully"})

    return JsonResponse({"message": "Method not allowed"}, status=405)


def get_user(request):
    if request.user.is_authenticated:
        return JsonResponse(
            {
                "success": True,
                "user": {
                    "id": request.user.id,
                    "email": request.user.email,
                    "first_name": request.user.first_name,
                    "last_name": request.user.last_name,
                },
            }
        )
    return JsonResponse({"success": False, "message": "Not authenticated"}, status=401)


@csrf_exempt
@require_http_methods(["POST"])
def password_reset_request(request):
    data = json.loads(request.body)
    email = data.get('email')
    
    if not email:
        return JsonResponse(
            {'message': 'Email is required'},
            status=400
        )

    User = get_user_model()
    try:
        user = User.objects.get(email=email)
    except User.DoesNotExist:
        # We return success even if the email doesn't exist for security
        return JsonResponse({'message': 'Password reset email sent if account exists'})

    # Generate password reset token
    token = default_token_generator.make_token(user)
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    
    # Build reset URL (this should point to your frontend reset page)
    reset_url = f"exp://192.168.1.153:8081/--/reset-password/{uid}/{token}"
    
    # Email content
    subject = 'Password Reset Request'
    message = f'''
    Hello {user.first_name},

    You requested to reset your password. Please click the link below to reset it:

    {reset_url}

    If you're using Expo Go, you can click the link directly.
    
    If you didn't request this, you can safely ignore this email.

    Best regards,
    Your App Team
    '''
    
    try:
        send_mail(
            subject,
            message,
            settings.DEFAULT_FROM_EMAIL,
            [user.email],
            fail_silently=False,
        )
        return JsonResponse({
            'message': 'Password reset email sent if account exists',
            'reset_link': reset_url  # Include the link in the response for development
        })
    except Exception as e:
        print(f"Error sending email: {e}")  # Log the error
        return JsonResponse(
            {'message': 'Error sending email'},
            status=500
        )

@csrf_exempt
@require_http_methods(["POST"])
def password_reset_confirm(request, uidb64, token):
    try:
        uid = force_str(urlsafe_base64_decode(uidb64))
        user = get_user_model().objects.get(pk=uid)
    except (TypeError, ValueError, OverflowError, get_user_model().DoesNotExist):
        return JsonResponse(
            {'message': 'Invalid reset link'},
            status=400
        )

    if not default_token_generator.check_token(user, token):
        return JsonResponse(
            {'message': 'Invalid or expired reset link'},
            status=400
        )

    data = json.loads(request.body)
    password = data.get('password')
    if not password:
        return JsonResponse(
            {'message': 'Password is required'},
            status=400
        )

    user.set_password(password)
    user.save()
    return JsonResponse({'message': 'Password reset successful'})


class DashboardAPIView(APIView):
    """Returns user info, next 30-day events, and latest notifications."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        today = date.today()
        upcoming_end = today + timedelta(days=30)

        events_qs = (
            user.events.filter(date__range=(today, upcoming_end))
            .order_by("date")
        )

        notifications_qs = user.notifications.all()[:50]

        serializer = DashboardSerializer(
            {
                "events": events_qs,
                "notifications": notifications_qs,
            },
            context={"request": request},
        )

        return Response(serializer.data)


'''DEPRECATED CONTACT VIEWSET (old schema) ----------------'''



class UserSearchViewSet(viewsets.ReadOnlyModelViewSet):
    """Search for users to add as contacts."""
    serializer_class = UserSearchSerializer
    permission_classes = [IsAuthenticated]
    authentication_classes = [CsrfExemptSessionAuthentication]

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

# DEPRECATED CONTACT SCHEMA REMOVED BELOW
    # serializer_class = ContactSerializer  # deprecated
    permission_classes = [IsAuthenticated]
    authentication_classes = [CsrfExemptSessionAuthentication]

    def deprecated_contact_get_queryset(self):
        # Return:
        # 1. Contacts I own (for my contact list)
        # 2. Pending contacts where I'm the target (for requests)
        return Contact.objects.filter(
            Q(user=self.request.user) |  # My contacts
            Q(contact_user=self.request.user, status='pending')  # Requests to me
        ).order_by("first_name", "last_name")

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    def partial_update(self, request, *args, **kwargs):
        #Handle PATCH requests with proper validation.
        instance = self.get_object()
        
        # If this is an app-user contact, only allow updating certain fields
        if instance.contact_user:
            allowed_fields = {'phone', 'birthday', 'notes', 'tags'}
            data = {k: v for k, v in request.data.items() if k in allowed_fields}
            if not data:
                return Response(
                    {"detail": "No valid fields to update"},
                    status=status.HTTP_400_BAD_REQUEST
                )
        else:
            # For manual contacts, allow updating all fields
            data = request.data

        serializer = self.get_serializer(instance, data=data, partial=True)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)

        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def accept(self, request, pk=None):
        #Accept a contact request.
        contact = self.get_object()
        
        if not contact.contact_user:
            return Response(
                {"detail": "Can only accept app user contacts"},
                status=status.HTTP_400_BAD_REQUEST
            )
        if contact.status != Contact.PENDING:
            return Response(
                {"detail": "Contact is not in pending state"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Mark the original request as accepted
        contact.status = Contact.ACCEPTED
        contact.save()

        # Ensure the accepter has a corresponding accepted contact pointing to the requester
        reciprocal, _ = Contact.objects.update_or_create(
            user=request.user,                    # current user (accepter)
            contact_user=contact.user,            # original requester
            defaults={
                "first_name": contact.user.first_name,
                "last_name": contact.user.last_name,
                "email": contact.user.email,
                "status": Contact.ACCEPTED,
            },
        )
        
        return Response(self.serializer_class(contact).data)

    @action(detail=True, methods=['post'])
    def decline(self, request, pk=None):
        #Decline a contact request.
        contact = self.get_object()
        
        if not contact.contact_user:
            return Response(
                {"detail": "Can only decline app user contacts"},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        contact.status = Contact.DECLINED
        contact.save()
        return Response(self.serializer_class(contact).data)

    def destroy(self, request, *args, **kwargs):
        contact = self.get_object()
        
        # If this is an app-user contact, delete the reciprocal contact if it exists
        if contact.contact_user:
            # Find and delete the reciprocal contact (B → A)
            Contact.objects.filter(
                user=contact.contact_user,  # B's record
                contact_user=request.user    # pointing to A
            ).delete()
        
        # Delete the original contact (A → B)
        contact.delete()
        
        return Response({
            "success": True,
            "message": "Contact deleted successfully"
        }, status=status.HTTP_200_OK)

class ConnectionViewSet(viewsets.ModelViewSet):
    """ViewSet for managing person-to-person connections (friends/contacts)."""
    serializer_class = ConnectionSerializer
    permission_classes = [IsAuthenticated]
    authentication_classes = [CsrfExemptSessionAuthentication]

    def get_queryset(self):
        person = _get_person_for_request(self.request)
        return Connection.objects.filter(
            models.Q(owner=person) |
            models.Q(target=person, status=Connection.PENDING)
        )

    def perform_create(self, serializer):
        owner_person = _get_person_for_request(self.request)
        serializer.save(owner=owner_person)

    @action(detail=True, methods=["post"])
    def accept(self, request, pk=None):
        conn: Connection = self.get_object()
        person = _get_person_for_request(request)

        if conn.target != person:
            raise PermissionDenied("Only the target person can accept this connection request.")
        if conn.status != Connection.PENDING:
            return Response({"detail": "Connection is not pending."}, status=status.HTTP_400_BAD_REQUEST)

        conn.status = Connection.ACCEPTED
        conn.save()

        # Ensure reciprocal row exists
        Connection.objects.update_or_create(
            owner=person,
            target=conn.owner,
            defaults={"status": Connection.ACCEPTED},
        )
        return Response(self.serializer_class(conn).data)

    @action(detail=True, methods=["post"])
    def decline(self, request, pk=None):
        conn: Connection = self.get_object()
        person = _get_person_for_request(request)
        if conn.target != person:
            raise PermissionDenied("Only the target person can decline.")
        conn.status = Connection.DECLINED
        conn.save()
        return Response(self.serializer_class(conn).data)


class EventViewSet(viewsets.ModelViewSet):
    """ViewSet for managing events."""
    serializer_class = EventSerializer
    permission_classes = [IsAuthenticated]
    authentication_classes = [CsrfExemptSessionAuthentication]

    def get_queryset(self):
        """Return events for the current user."""
        return Event.objects.filter(user=self.request.user).order_by('date')

    def perform_create(self, serializer):
        """Set the user when creating an event."""
        serializer.save(user=self.request.user)

    def perform_update(self, serializer):
        """Ensure user can only update their own events."""
        if serializer.instance.user != self.request.user:
            raise PermissionDenied("You can only update your own events.")
        serializer.save()


class InteractionViewSet(viewsets.ModelViewSet):
    """ViewSet for managing contact interactions."""
    serializer_class = InteractionSerializer
    permission_classes = [IsAuthenticated]
    authentication_classes = [CsrfExemptSessionAuthentication]

    def get_queryset(self):
        """Return interactions involving the current person. Optional filter by target person ID."""
        person = _get_person_for_request(self.request)
        target_id = self.request.query_params.get('target')
        if target_id:
            return Interaction.objects.filter(
                models.Q(actor=person, target_id=target_id) |
                models.Q(actor_id=target_id, target=person)
            )
        return Interaction.objects.filter(
            models.Q(actor=person) | models.Q(target=person)
        )

    def perform_create(self, serializer):
        serializer.save()


    def perform_update(self, serializer):
        person = _get_person_for_request(self.request)
        if serializer.instance.actor != person:
            raise PermissionDenied("You can only update interactions you created.")
        serializer.save()

    def perform_destroy(self, instance):
        person = _get_person_for_request(self.request)
        if instance.actor != person:
            raise PermissionDenied("You can only delete interactions you created.")
        instance.delete()
