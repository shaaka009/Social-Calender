from rest_framework.authentication import SessionAuthentication


class CsrfExemptSessionAuthentication(SessionAuthentication):
    """Session authentication that does **not** enforce CSRF checks.

    Useful for native-mobile clients that still rely on the session cookie but
    cannot easily attach the X-CSRFTOKEN header on every non-GET request.
    """

    def enforce_csrf(self, request):
        # Overridden to bypass the CSRF validation in SessionAuthentication.
        return None 