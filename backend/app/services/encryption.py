"""
Encryption service for sensitive data using Fernet symmetric encryption.

Uses Fernet symmetric encryption (AES-128-CBC with HMAC).
Document content and OAuth tokens are encrypted at rest.

Setup:
    Generate a key: python -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())'
    Set ENCRYPTION_KEY environment variable.
"""

import logging

from cryptography.fernet import Fernet, InvalidToken

from app.config import settings

logger = logging.getLogger(__name__)


class EncryptionService:
    """
    Service for encrypting and decrypting sensitive data.

    Uses Fernet symmetric encryption which provides:
    - AES-128 encryption in CBC mode
    - HMAC-SHA256 for authentication

    Gracefully handles missing encryption key by logging warnings.
    """

    def __init__(self, encryption_key: str | None = None):
        """
        Initialize encryption service with a key.

        Args:
            encryption_key: Base64-encoded Fernet key. If None, uses settings.ENCRYPTION_KEY
        """
        self._fernet: Fernet | None = None
        self._initialize(encryption_key)

    def _initialize(self, encryption_key: str | None) -> None:
        """Initialize Fernet cipher with provided or configured key."""
        key = encryption_key or settings.ENCRYPTION_KEY

        if not key:
            logger.warning(
                "ENCRYPTION_KEY not configured. Encryption is disabled. "
                "Generate a key with: python -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())'"
            )
            return

        try:
            self._fernet = Fernet(key.encode() if isinstance(key, str) else key)
            logger.info("Encryption service initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize encryption: {e}")
            self._fernet = None

    @property
    def is_enabled(self) -> bool:
        """Check if encryption is properly configured."""
        return self._fernet is not None

    def encrypt(self, plaintext: str) -> str:
        """
        Encrypt a string value.

        Args:
            plaintext: The value to encrypt

        Returns:
            Base64-encoded encrypted string with ENC: prefix,
            or original text if encryption disabled
        """
        if not plaintext:
            return ""

        if not self._fernet:
            logger.debug("Encryption disabled, returning plaintext")
            return plaintext

        try:
            encrypted_bytes = self._fernet.encrypt(plaintext.encode('utf-8'))
            # Prefix with 'ENC:' to identify encrypted content
            return f"ENC:{encrypted_bytes.decode('utf-8')}"
        except Exception as e:
            logger.error(f"Encryption failed: {e}")
            # Return plaintext on failure - don't lose data
            return plaintext

    def decrypt(self, ciphertext: str) -> str:
        """
        Decrypt an encrypted string value.

        Args:
            ciphertext: The encrypted value to decrypt

        Returns:
            Decrypted plaintext string, or original text if not encrypted
        """
        if not ciphertext:
            return ""

        # Check if content is actually encrypted (has ENC: prefix)
        if not ciphertext.startswith("ENC:"):
            # Not encrypted, return as-is
            return ciphertext

        if not self._fernet:
            logger.error("Found encrypted content but ENCRYPTION_KEY not configured")
            return "[Encrypted content - key not configured]"

        try:
            # Remove the ENC: prefix
            encrypted_data = ciphertext[4:]
            decrypted_bytes = self._fernet.decrypt(encrypted_data.encode('utf-8'))
            return decrypted_bytes.decode('utf-8')
        except InvalidToken:
            logger.error("Decryption failed: invalid token or wrong key")
            return "[Decryption failed - invalid key]"
        except Exception as e:
            logger.error(f"Decryption failed: {e}")
            return "[Decryption failed]"

    def encrypt_document_content(self, content: str) -> str:
        """
        Encrypt document content for storage.

        Args:
            content: Document text content

        Returns:
            Encrypted content or original if encryption disabled
        """
        return self.encrypt(content)

    def decrypt_document_content(self, content: str) -> str:
        """
        Decrypt document content for reading.

        Args:
            content: Possibly encrypted document content

        Returns:
            Decrypted content
        """
        return self.decrypt(content)

    @staticmethod
    def generate_key() -> str:
        """
        Generate a new Fernet encryption key.

        Returns:
            Base64-encoded encryption key as string
        """
        return Fernet.generate_key().decode()


# Singleton instance
_encryption_service: EncryptionService | None = None


def get_encryption_service() -> EncryptionService:
    """Get or create the singleton encryption service instance."""
    global _encryption_service
    if _encryption_service is None:
        _encryption_service = EncryptionService()
    return _encryption_service
