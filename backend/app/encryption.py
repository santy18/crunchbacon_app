from cryptography.fernet import Fernet

from .config import ENCRYPTION_KEY_PATH

_fernet: Fernet | None = None


def _get_fernet() -> Fernet:
    global _fernet
    if _fernet is not None:
        return _fernet

    if ENCRYPTION_KEY_PATH.exists():
        key = ENCRYPTION_KEY_PATH.read_bytes().strip()
    else:
        key = Fernet.generate_key()
        ENCRYPTION_KEY_PATH.write_bytes(key)
    _fernet = Fernet(key)
    return _fernet


def encrypt_value(plaintext: str) -> str:
    """Encrypt a string and return the base64-encoded ciphertext."""
    return _get_fernet().encrypt(plaintext.encode()).decode()


def decrypt_value(ciphertext: str) -> str:
    """Decrypt a base64-encoded ciphertext back to the original string."""
    return _get_fernet().decrypt(ciphertext.encode()).decode()
