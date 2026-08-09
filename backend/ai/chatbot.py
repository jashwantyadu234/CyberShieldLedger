"""Complaint-wizard copilot extension point."""
def next_question(_: list[dict]) -> str:
    return "Please describe what happened, including the date, channel, and any payment details."
