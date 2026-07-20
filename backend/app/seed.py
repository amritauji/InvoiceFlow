"""
Seed script: Creates default departments and workflow users.
Run: python -m app.seed
"""
import asyncio
import uuid
from sqlalchemy import select, text
from app.database import async_session_factory, engine, Base
from app.models.department import Department
from app.models.user import UserProfile
from app.services.auth_service import AuthService
from app.config import get_settings
from app.core.security import get_supabase_client

settings = get_settings()

DEPARTMENTS = [
    {"name": "CPNM", "code": "CPNM", "description": "CPNM Department"},
    {"name": "CONTENT", "code": "CONTENT", "description": "Content Department"},
    {"name": "NUVERSE", "code": "NUVERSE", "description": "Nuverse Department"},
    {"name": "MULTIA", "code": "MULTIA", "description": "Multia Department"},
    {"name": "PEOPLE AND CULTURE", "code": "PNC", "description": "People and Culture Department"},
    {"name": "ACCOUNTS", "code": "ACCOUNTS", "description": "Accounts Department"},
    {"name": "SYSTEM ADMIN", "code": "SYSADMIN", "description": "System Administration"},
]

ADMIN_USER = {
    "email": "admin@invoiceflow.com",
    "password": "Admin@12345",
    "full_name": "System Administrator",
    "role": "admin",
}

DEFAULT_USERS = [
    {"email": "user@invoiceflow.com", "password": "User@12345", "full_name": "Department User", "role": "department_user"},
    {"email": "accountant1@invoiceflow.com", "password": "Account1@123", "full_name": "Primary Accountant", "role": "accountant_1"},
    {"email": "accountant2@invoiceflow.com", "password": "Account2@123", "full_name": "Secondary Accountant", "role": "accountant_2"},
    {"email": "manager@invoiceflow.com", "password": "Manager@123", "full_name": "Department Manager", "role": "manager"},
    {"email": "ceo@invoiceflow.com", "password": "Ceo@12345", "full_name": "Chief Executive Officer", "role": "ceo"},
]


async def profile_exists_by_email(email: str) -> bool:
    async with async_session_factory() as db:
        result = await db.execute(select(UserProfile).where(UserProfile.email == email))
        return result.scalar_one_or_none() is not None


async def profile_exists_by_id(uid: uuid.UUID) -> bool:
    async with async_session_factory() as db:
        result = await db.execute(select(UserProfile).where(UserProfile.id == uid))
        return result.scalar_one_or_none() is not None


async def insert_profile_direct(uid: uuid.UUID, email: str, full_name: str, role: str) -> bool:
    """Insert a profile row using raw SQL to avoid session state issues."""
    async with async_session_factory() as db:
        try:
            await db.execute(
                text("INSERT INTO user_profiles (id, email, full_name, role, is_active) "
                     "VALUES (:id, :email, :name, :role, true) "
                     "ON CONFLICT (id) DO NOTHING"),
                {"id": str(uid), "email": email, "name": full_name, "role": role},
            )
            await db.commit()
            return True
        except Exception as e:
            print(f"    Raw insert failed: {e}")
            await db.rollback()
            return False


async def update_profile_role_by_email(email: str, role: str) -> bool:
    """Update an existing profile's role using raw SQL."""
    async with async_session_factory() as db:
        try:
            await db.execute(
                text("UPDATE user_profiles SET role = :role WHERE email = :email"),
                {"role": role, "email": email},
            )
            await db.commit()
            return True
        except Exception as e:
            print(f"    Role update failed: {e}")
            await db.rollback()
            return False


def find_supabase_user(email: str):
    """Find a user in Supabase Auth by email."""
    auth_client = get_supabase_client().auth
    users = auth_client.admin.list_users()
    for u in users:
        if u.email == email:
            return u
    return None


async def seed_user(user_data):
    """Seed a single user in its own session."""
    email = user_data["email"]
    role = user_data["role"]

    # 1. Check if profile already exists
    if await profile_exists_by_email(email):
        print(f"  [OK] {email} already exists. Updating role to '{role}' if needed.")
        await update_profile_role_by_email(email, role)
        return

    # 2. Check if Supabase Auth user exists (from a prior partial run)
    supa_user = find_supabase_user(email)
    if supa_user:
        uid = uuid.UUID(supa_user.id)
        print(f"  [FIX] {email} exists in Supabase Auth (UUID: {uid}) but no profile. Creating profile...")
        if await profile_exists_by_id(uid):
            print(f"  [OK] Profile for {email} already exists.")
            return
        await insert_profile_direct(uid, email, user_data["full_name"], role)
        print(f"  [OK] Created profile for {email} with role '{role}'")
        return

    # 3. Create both Supabase Auth user + profile in a fresh session
    async with async_session_factory() as db:
        try:
            await AuthService.create_user(
                db,
                email=email,
                password=user_data["password"],
                full_name=user_data["full_name"],
                role=role,
            )
            await db.commit()
            print(f"  [OK] Created user: {email} with role '{role}'")
        except Exception as e:
            print(f"  [FAIL] Could not create {email}: {e}")
            await db.rollback()


async def seed():
    # Seed departments
    async with async_session_factory() as db:
        existing = await db.execute(select(Department).limit(1))
        if existing.scalar_one_or_none():
            print("Departments already seeded. Skipping.")
        else:
            for dept_data in DEPARTMENTS:
                db.add(Department(**dept_data))
            await db.commit()
            print(f"Seeded {len(DEPARTMENTS)} departments.")

    # Seed all users (each in its own session)
    print("\nSeeding users...")
    await seed_user(ADMIN_USER)
    for user_data in DEFAULT_USERS:
        await seed_user(user_data)

    print("\nSeed complete.")


if __name__ == "__main__":
    asyncio.run(seed())
