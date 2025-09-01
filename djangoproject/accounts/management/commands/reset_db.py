from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from accounts.models import Person, Account
from django.db import connection
from django.conf import settings
import os

User = get_user_model()

class Command(BaseCommand):
    help = 'Resets the database, creates test users, and seeds sample data'

    def handle(self, *args, **options):
        # 1. Delete the database file
        db_path = settings.DATABASES['default']['NAME']
        if os.path.exists(db_path):
            self.stdout.write(f'Removing database file: {db_path}')
            os.remove(db_path)
        
        # 2. Run migrations
        from django.core.management import call_command
        self.stdout.write('Running migrations...')
        call_command('migrate')

        # 3. Create test users
        test_users = [
            {
                'username': 'akaash@2003@gmail.com',
                'email': 'akaash2003@gmail.com',
                'password': 'password123',
                'first_name': 'Akaash',
                'last_name': 'Mahinth',
                'phone': '+155555501',
                'birthday': '2003-02-10',
                'notes': 'Superuser account',
                'is_superuser': True,
                'is_staff': True,
            },
            {
                'username': 'user@example.com',
                'email': 'user@example.com',
                'password': 'password123',
                'first_name': 'Test',
                'last_name': 'User',
            },
        ]

        self.stdout.write('Creating test users and corresponding Person/Account rows...')
        for user_data in test_users:
            is_superuser = user_data.pop('is_superuser', False)
            is_staff = user_data.pop('is_staff', False)

            # Extract person-specific extras BEFORE creating User
            phone = user_data.pop('phone', '')
            birthday = user_data.pop('birthday', None)
            notes = user_data.pop('notes', '')

            if User.objects.filter(username=user_data['username']).exists():
                user = User.objects.get(username=user_data['username'])
                self.stdout.write(f"User {user.username} already exists, using existing record...")
            else:
                if is_superuser:
                    user = User.objects.create_superuser(**user_data)
                else:
                    user = User.objects.create_user(**user_data)
                user.is_staff = is_staff
                user.save()

            # Ensure a Person row exists
            person, _ = Person.objects.get_or_create(
                email=user.email,
                defaults={
                    'first_name': user.first_name,
                    'last_name': user.last_name,
                    'phone': phone,
                    'birthday': birthday,
                    'notes': notes,
                }
            )

            # Ensure an Account row links User to Person
            Account.objects.get_or_create(user=user, defaults={'person': person})

            self.stdout.write(f"Linked Person {person.id} to User {user.username}")

        self.stdout.write(self.style.SUCCESS('Base users created!'))
        self.stdout.write('\nTest Users:')
        self.stdout.write('1. Superuser')
        self.stdout.write('   Username: akaash2003@gmail.com')
        self.stdout.write('   Email: akaash2003@gmail.com')
        self.stdout.write('   Password: password123')
        self.stdout.write('\n2. Regular User')
        self.stdout.write('   Username: user@example.com')
        self.stdout.write('   Email: user@example.com')
        self.stdout.write('   Password: password123')

        # 4. Seed sample data
        self.stdout.write('\nSeeding sample data...')
        call_command('seed_sample_data')