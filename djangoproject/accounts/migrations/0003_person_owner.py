# Generated manually

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ('accounts', '0002_remove_event_contact_id_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='person',
            name='owner',
            field=models.ForeignKey(
                blank=True,
                help_text='For manual contacts, the Person who created this record. Null for app users.',
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='manual_contacts',
                to='accounts.person'
            ),
        ),
    ]