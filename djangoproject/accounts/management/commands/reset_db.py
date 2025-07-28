from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.db import connection
from django.conf import settings
import os

User = get_user_model()

class Command(BaseCommand):
    help = 'Resets the database and creates test users'

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

        self.stdout.write('Creating test users...')
        for user_data in test_users:
            is_superuser = user_data.pop('is_superuser', False)
            is_staff = user_data.pop('is_staff', False)
            
            if User.objects.filter(username=user_data['username']).exists():
                self.stdout.write(f"User {user_data['username']} already exists, skipping...")
                continue

            if is_superuser:
                user = User.objects.create_superuser(**user_data)
            else:
                user = User.objects.create_user(**user_data)
            
            user.is_staff = is_staff
            user.save()
            
            self.stdout.write(f"Created user: {user.username} ({user.email})")

        self.stdout.write(self.style.SUCCESS('Database reset complete!'))
        self.stdout.write('\nTest Users:')
        self.stdout.write('1. Superuser')
        self.stdout.write('   Username: akaash2003@gmail.com')
        self.stdout.write('   Email: akaash2003@gmail.com')
        self.stdout.write('   Password: password123')
        self.stdout.write('\n2. Regular User')
        self.stdout.write('   Username: user@example.com')
        self.stdout.write('   Email: user@example.com')
        self.stdout.write('   Password: password123') 