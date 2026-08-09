"""On-chain hash comparison helpers."""
def hashes_match(local_hash: str | None, chain_hash: str | None) -> bool:
    return bool(local_hash and chain_hash and local_hash == chain_hash)
