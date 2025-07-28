import json

from django.contrib.auth import authenticate, login, logout, get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.db.models import Q
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
from rest_framework import status
from rest_framework.decorators import action
# added for DashboardAPIView date calculations
from datetime import date, timedelta
from django.views.decorators.http import require_http_methods

# New imports for DRF class-based view
from rest_framework.views import APIView
from rest_framework import viewsets
from .serializers import DashboardSerializer, ContactSerializer
from .serializers import UserSearchSerializer
from .models import Contact
from .authentication import CsrfExemptSessionAuthentication

from .forms import UserRegistrationForm

# Create your views here.


@csrf_exempt
def signup(request):
    if request.method == "POST":
        data = json.loads(request.body)
        form = UserRegistrationForm(data)
        if form.is_valid():
            user = form.save()
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


# ---------------- ContactViewSet -----------------


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

class ContactViewSet(viewsets.ModelViewSet):
    serializer_class = ContactSerializer
    permission_classes = [IsAuthenticated]
    authentication_classes = [CsrfExemptSessionAuthentication]

    def get_queryset(self):
        # Return:
        # 1. Contacts I own (for my contact list)
        # 2. Pending contacts where I'm the target (for requests)
        return Contact.objects.filter(
            Q(user=self.request.user) |  # My contacts
            Q(contact_user=self.request.user, status='pending')  # Requests to me
        ).order_by("first_name", "last_name")

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=True, methods=['post'])
    def accept(self, request, pk=None):
        """Accept a contact request."""
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
        """Decline a contact request."""
        contact = self.get_object()
        
        if not contact.contact_user:
            return Response(
                {"detail": "Can only decline app user contacts"},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        contact.status = Contact.DECLINED
        contact.save()
        return Response(self.serializer_class(contact).data)
