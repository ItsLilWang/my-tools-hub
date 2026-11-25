"""
mymark_decode.py — mở két MyMark (.dat) ra JSON chữ rõ.

Cách dùng:
    pip install cryptography
    python mymark_decode.py vault.dat            → ra vault.json cạnh file .dat
    python mymark_decode.py vault.dat out.json   → ra out.json

Két được khoá giống hệt trên web:
    PIN + salt --(PBKDF2-SHA256, 250.000 vòng)--> chìa 256-bit --(AES-GCM)--> data
"""
import base64
import getpass
import json
import sys
from pathlib import Path

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

PBKDF2_ITER = 250_000   # phải khớp PBKDF2_ITER trong script.js


def decode(vault: dict, pin: str):
    """Trả về data đã mở khoá, sai PIN thì báo lỗi InvalidTag."""
    salt = base64.b64decode(vault["salt"])
    iv = base64.b64decode(vault["iv"])
    cipher = base64.b64decode(vault["data"])   # WebCrypto gắn sẵn tag 16 byte ở cuối
    key = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=salt, iterations=PBKDF2_ITER).derive(pin.encode("utf-8"))
    return json.loads(AESGCM(key).decrypt(iv, cipher, None))


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    src = Path(sys.argv[1])
    out = Path(sys.argv[2]) if len(sys.argv) > 2 else src.with_suffix(".json")

    vault = json.loads(src.read_text(encoding="utf-8"))
    for _ in range(3):   # cho nhập sai 3 lần
        try:
            data = decode(vault, getpass.getpass("PIN: "))
            break
        except InvalidTag:
            print("Sai PIN.")
    else:
        sys.exit(1)

    bookmarks = data if isinstance(data, list) else data.get("bookmarks", [])
    out.write_text(json.dumps(bookmarks, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Xong: {len(bookmarks)} bookmark → {out}")


if __name__ == "__main__":
    main()
