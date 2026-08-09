"""AES-256-GCM encryption helpers for local evidence storage."""
import hashlib
import os
import secrets
from pathlib import Path

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

_default_storage = Path(__file__).resolve().parents[2] / "evidence" / "encrypted"
STORAGE_DIR = Path(os.getenv("EVIDENCE_STORAGE_DIR", str(_default_storage))).resolve()
MAX_EVIDENCE_FILE_BYTES = int(os.getenv("MAX_EVIDENCE_FILE_BYTES", str(10 * 1024 * 1024)))


def _encryption_key() -> bytes:
    secret = os.getenv("EVIDENCE_ENCRYPTION_KEY") or os.getenv("SECRET_KEY")
    if not secret:
        raise RuntimeError("Set EVIDENCE_ENCRYPTION_KEY or SECRET_KEY before uploading evidence")
    return hashlib.sha256(secret.encode("utf-8")).digest()


def encrypt_evidence(content: bytes, original_filename: str) -> tuple[str, str, str, int]:
    if not content:
        raise ValueError("Evidence file is empty")
    if len(content) > MAX_EVIDENCE_FILE_BYTES:
        raise ValueError(f"Evidence file exceeds the {MAX_EVIDENCE_FILE_BYTES // (1024 * 1024)} MB limit")

    STORAGE_DIR.mkdir(parents=True, exist_ok=True)
    nonce = secrets.token_bytes(12)
    encrypted = AESGCM(_encryption_key()).encrypt(nonce, content, original_filename.encode("utf-8"))
    storage_name = f"{secrets.token_hex(16)}.enc"
    (STORAGE_DIR / storage_name).write_bytes(encrypted)
    return storage_name, nonce.hex(), hashlib.sha256(content).hexdigest(), len(encrypted)


def decrypt_evidence(storage_name: str, nonce_hex: str, original_filename: str) -> bytes:
    encrypted_path = STORAGE_DIR / storage_name
    if not encrypted_path.is_file():
        raise FileNotFoundError("Encrypted evidence file is unavailable")
    return AESGCM(_encryption_key()).decrypt(bytes.fromhex(nonce_hex), encrypted_path.read_bytes(), original_filename.encode("utf-8"))
