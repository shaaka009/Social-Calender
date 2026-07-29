from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0020_alter_event_type"),
    ]

    operations = [
        migrations.AddField(
            model_name="connection",
            name="notes",
            field=models.TextField(
                blank=True,
                help_text="Private notes about this contact, scoped to the connection owner.",
            ),
        ),
    ]
