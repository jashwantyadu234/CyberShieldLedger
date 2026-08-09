from app.database import SessionLocal, engine, Base
from app.models import User
from app.security.auth import hash_password

# Create tables
Base.metadata.create_all(bind=engine)

# Create session
db = SessionLocal()

# Check if admin already exists
existing = db.query(User).filter(User.email == "admin@cybershield.com").first()
if existing:
    print("✅ Admin already exists!")
    print(f"   Email: admin@cybershield.com")
    reset = input("Reset this admin password now? [y/N]: ").strip().lower() == "y"
    if reset:
        import getpass
        password = getpass.getpass("New admin password: ")
        if len(password) < 8:
            raise ValueError("Admin password must be at least 8 characters")
        existing.password = hash_password(password)
        db.commit()
        print("✅ Admin password reset.")
else:
    import getpass
    password = getpass.getpass("Create an admin password: ")
    if len(password) < 8:
        raise ValueError("Admin password must be at least 8 characters")
    # Create admin user
    admin = User(
        name="Admin",
        email="admin@cybershield.com",
        password=hash_password(password),
        role="admin",
        status="approved",
    )
    db.add(admin)
    db.commit()
    print("✅ Admin account created!")
    print(f"   Email: admin@cybershield.com")

db.close()
