"""Wallet configuration helpers that never expose the private key."""
import os

def configured() -> bool:
    return bool(os.getenv("PRIVATE_KEY") and os.getenv("CONTRACT_ADDRESS"))
