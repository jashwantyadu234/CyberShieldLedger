"""Web3.py adapter for the CyberShieldLedger EVM contract."""
import json
import os

from dotenv import load_dotenv
from web3 import Web3

load_dotenv()

BLOCKCHAIN_RPC = os.getenv("BLOCKCHAIN_RPC") or os.getenv("POLYGON_RPC", "")
CONTRACT_ADDRESS = os.getenv("CONTRACT_ADDRESS", "").strip()
PRIVATE_KEY = os.getenv("PRIVATE_KEY", "")
CHAIN_ID = int(os.getenv("CHAIN_ID", "80002"))
w3 = Web3(Web3.HTTPProvider(BLOCKCHAIN_RPC))

CONTRACT_ABI = json.loads('''[
  {"inputs":[{"internalType":"uint256","name":"_complaintId","type":"uint256"},{"internalType":"string","name":"_evidenceHash","type":"string"},{"internalType":"string","name":"_agency","type":"string"}],"name":"submitComplaint","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"_complaintId","type":"uint256"}],"name":"verifyComplaint","outputs":[{"internalType":"uint256","name":"","type":"uint256"},{"internalType":"string","name":"","type":"string"},{"internalType":"uint256","name":"","type":"uint256"},{"internalType":"string","name":"","type":"string"},{"internalType":"string","name":"","type":"string"},{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"_complaintId","type":"uint256"},{"internalType":"string","name":"_newStatus","type":"string"}],"name":"updateStatus","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"_complaintId","type":"uint256"},{"internalType":"address","name":"_authority","type":"address"}],"name":"grantAccess","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"_complaintId","type":"uint256"},{"internalType":"string","name":"_evidenceHash","type":"string"}],"name":"updateEvidenceHash","outputs":[],"stateMutability":"nonpayable","type":"function"}
]''')


def _is_valid_private_key(key: str) -> bool:
    raw = key[2:] if key.startswith("0x") else key
    try:
        return len(raw) == 64 and bool(int(raw, 16) >= 0)
    except ValueError:
        return False


contract = None
account = None
try:
    if CONTRACT_ADDRESS and Web3.is_address(CONTRACT_ADDRESS) and w3.is_connected():
        contract = w3.eth.contract(address=Web3.to_checksum_address(CONTRACT_ADDRESS), abi=CONTRACT_ABI)
        if _is_valid_private_key(PRIVATE_KEY):
            account = w3.eth.account.from_key(PRIVATE_KEY)
except Exception as error:
    print(f"Blockchain initialization error: {error}")


def _write(function, gas: int) -> str:
    if not contract or not account:
        return "blockchain_disabled"
    try:
        transaction = function.build_transaction({
            "from": account.address, "nonce": w3.eth.get_transaction_count(account.address),
            "gas": gas, "gasPrice": w3.eth.gas_price, "chainId": CHAIN_ID,
        })
        signed = account.sign_transaction(transaction)
        return w3.to_hex(w3.eth.send_raw_transaction(signed.rawTransaction))
    except Exception as error:
        print(f"Blockchain transaction error: {error}")
        return "blockchain_error"


def submit_to_blockchain(complaint_id: int, evidence_hash: str, agency: str = "Unassigned") -> str:
    return _write(contract.functions.submitComplaint(complaint_id, evidence_hash, agency), 200000) if contract else "blockchain_disabled"


def verify_on_chain(complaint_id: int) -> dict:
    if not contract:
        return {"exists": False, "error": "contract_not_initialized"}
    try:
        result = contract.functions.verifyComplaint(complaint_id).call()
        return {"id": result[0], "evidence_hash": result[1], "timestamp": result[2], "agency": result[3], "status": result[4], "exists": result[5]}
    except Exception as error:
        return {"exists": False, "error": str(error)}


def update_status_on_chain(complaint_id: int, new_status: str) -> str:
    return _write(contract.functions.updateStatus(complaint_id, new_status), 100000) if contract else "blockchain_disabled"


def update_evidence_hash_on_chain(complaint_id: int, evidence_hash: str) -> str:
    return _write(contract.functions.updateEvidenceHash(complaint_id, evidence_hash), 120000) if contract else "blockchain_disabled"
