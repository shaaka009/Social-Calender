import json

from django.contrib.auth import authenticate, login, logout, get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from django.views.decorators.http import require_http_methods

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

        # Since we're using email as username, we pass email as username
        user = authenticate(username=email, password=password)

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
                {"success": False, "message": "Invalid email or password"},
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
