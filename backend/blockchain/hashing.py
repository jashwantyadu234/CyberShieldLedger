"""SHA-256 utilities for chain-of-custody records."""
import hashlib

def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()
