from django.urls import path
from rest_framework.routers import DefaultRouter

from . import views


router = DefaultRouter()
router.register("contacts", views.ContactViewSet, basename="contact")
router.register("users/search", views.UserSearchViewSet, basename="user-search")

urlpatterns = [
    path("signup/", views.signup, name="signup"),
    path("signin/", views.signin, name="signin"),
    path("signout/", views.signout, name="signout"),
    path("user/", views.get_user, name="get_user"),
    path("password-reset/", views.password_reset_request, name="password_reset_request"),
    path("password-reset/<str:uidb64>/<str:token>/", views.password_reset_confirm, name="password_reset_confirm"),
    path("dashboard/", views.DashboardAPIView.as_view(), name="dashboard"),
] + router.urls
