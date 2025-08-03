from django.contrib import admin
from .models import Event, Notification, Person, Connection, Interaction

admin.site.register(Event)
admin.site.register(Notification)
admin.site.register(Person)
admin.site.register(Connection)
admin.site.register(Interaction)
