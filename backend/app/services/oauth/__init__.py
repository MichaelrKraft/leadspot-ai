"""OAuth integration services for InnoSynth.ai"""

from .base import BaseOAuthProvider
from .gmail import GmailOAuthProvider
from .google import GoogleOAuthProvider
from .microsoft import MicrosoftOAuthProvider
from .salesforce import SalesforceOAuthProvider
from .slack import SlackOAuthProvider

__all__ = [
    "BaseOAuthProvider",
    "GmailOAuthProvider",
    "GoogleOAuthProvider",
    "MicrosoftOAuthProvider",
    "SalesforceOAuthProvider",
    "SlackOAuthProvider",
]
