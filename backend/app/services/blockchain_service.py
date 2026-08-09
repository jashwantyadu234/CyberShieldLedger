"""Facade for EVM chain-of-custody operations."""
from blockchain.contract import submit_to_blockchain, update_evidence_hash_on_chain, update_status_on_chain, verify_on_chain

__all__ = ["submit_to_blockchain", "update_evidence_hash_on_chain", "update_status_on_chain", "verify_on_chain"]
