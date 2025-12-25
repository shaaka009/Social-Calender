from django.db import migrations, models


def forwards(apps, schema_editor):
    Event = apps.get_model("accounts", "Event")
    for event in Event.objects.all():
        # Copy existing single date into new range fields
        event.start_date = event.date
        event.end_date = event.date
        event.save(update_fields=["start_date", "end_date"])


def backwards(apps, schema_editor):
    Event = apps.get_model("accounts", "Event")
    for event in Event.objects.all():
        # Revert range back to single date (use start_date as source)
        event.date = event.start_date
        event.save(update_fields=["date"])


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0016_remove_person_nickname_connection_nickname"),
    ]

    operations = [
        migrations.AddField(
            model_name="event",
            name="start_date",
            field=models.DateField(null=True, blank=True),
        ),
        migrations.AddField(
            model_name="event",
            name="end_date",
            field=models.DateField(null=True, blank=True),
        ),
        migrations.RunPython(forwards, backwards),
        migrations.RemoveField(
            model_name="event",
            name="date",
        ),
    ]
