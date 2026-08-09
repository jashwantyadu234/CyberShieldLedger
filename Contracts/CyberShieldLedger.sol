// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title CyberShield Ledger
/// @notice Stores tamper-evident hashes of cybercrime complaints on any EVM chain.
/// @dev Personal details and complaint text stay off-chain; only their SHA-256 hash is anchored.
contract CyberShieldLedger {
    struct Complaint {
        uint256 id;
        string evidenceHash;
        uint256 timestamp;
        string agency;
        string status;
        bool exists;
    }

    address public immutable owner;
    mapping(uint256 => Complaint) private complaints;
    mapping(uint256 => mapping(address => bool)) private accessGrants;

    event ComplaintSubmitted(uint256 indexed complaintId, string evidenceHash, uint256 timestamp);
    event ComplaintStatusUpdated(uint256 indexed complaintId, string newStatus);
    event EvidenceHashUpdated(uint256 indexed complaintId, string evidenceHash);
    event AccessGranted(uint256 indexed complaintId, address indexed authority);

    error Unauthorized();
    error ComplaintAlreadyExists(uint256 complaintId);
    error ComplaintNotFound(uint256 complaintId);
    error EmptyEvidenceHash();

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    /// @notice Anchor a complaint evidence hash. Only the backend wallet may write.
    function submitComplaint(uint256 complaintId, string calldata evidenceHash, string calldata agency) external onlyOwner {
        if (complaints[complaintId].exists) revert ComplaintAlreadyExists(complaintId);
        if (bytes(evidenceHash).length == 0) revert EmptyEvidenceHash();

        complaints[complaintId] = Complaint({
            id: complaintId,
            evidenceHash: evidenceHash,
            timestamp: block.timestamp,
            agency: agency,
            status: "Pending",
            exists: true
        });

        emit ComplaintSubmitted(complaintId, evidenceHash, block.timestamp);
    }

    /// @notice Record which authority wallet may access a case off-chain.
    function grantAccess(uint256 complaintId, address authority) external onlyOwner {
        if (!complaints[complaintId].exists) revert ComplaintNotFound(complaintId);
        if (authority == address(0)) revert Unauthorized();
        accessGrants[complaintId][authority] = true;
        emit AccessGranted(complaintId, authority);
    }

    function hasAccess(uint256 complaintId, address authority) external view returns (bool) {
        return authority == owner || accessGrants[complaintId][authority];
    }

    /// @notice Fetch an anchored complaint. This is free when called off-chain.
    function verifyComplaint(uint256 complaintId)
        external
        view
        returns (uint256, string memory, uint256, string memory, string memory, bool)
    {
        Complaint memory complaint = complaints[complaintId];
        return (
            complaint.id,
            complaint.evidenceHash,
            complaint.timestamp,
            complaint.agency,
            complaint.status,
            complaint.exists
        );
    }

    /// @notice Update the public case status without putting personal information on-chain.
    function updateStatus(uint256 complaintId, string calldata newStatus) external onlyOwner {
        if (!complaints[complaintId].exists) revert ComplaintNotFound(complaintId);
        complaints[complaintId].status = newStatus;
        emit ComplaintStatusUpdated(complaintId, newStatus);
    }

    /// @notice Replace the case bundle hash after authorised evidence is appended.
    function updateEvidenceHash(uint256 complaintId, string calldata evidenceHash) external onlyOwner {
        if (!complaints[complaintId].exists) revert ComplaintNotFound(complaintId);
        if (bytes(evidenceHash).length == 0) revert EmptyEvidenceHash();
        complaints[complaintId].evidenceHash = evidenceHash;
        emit EvidenceHashUpdated(complaintId, evidenceHash);
    }
}
