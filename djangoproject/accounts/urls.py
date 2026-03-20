from django.urls import path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from . import views


router = DefaultRouter()
router.register("connections", views.ConnectionViewSet, basename="connection")
router.register("users/search", views.UserSearchViewSet, basename="user-search")
router.register("interactions", views.InteractionViewSet, basename="interaction")
router.register("events", views.EventViewSet, basename="event")
router.register("tags", views.TagViewSet, basename="tag")

urlpatterns = [
    path("signup/", views.signup, name="signup"),
    path("verify-email/", views.verify_email, name="verify_email"),
    path("verify-email/resend/", views.resend_verification_email, name="resend_verification_email"),
    path("signin/", views.signin, name="signin"),
    path("signout/", views.signout, name="signout"),
    path("user/", views.get_user, name="get_user"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("password-reset/", views.password_reset, name="password_reset"),
    path("password-reset/<str:uid>/<str:token>/", views.password_reset_confirm, name="password_reset_confirm"),
    path("dashboard/", views.DashboardAPIView.as_view(), name="dashboard"),
    path("profile/", views.UserProfileAPIView.as_view(), name="user_profile"),
    path("account/delete/", views.DeleteAccountAPIView.as_view(), name="delete_account"),
] + router.urls
