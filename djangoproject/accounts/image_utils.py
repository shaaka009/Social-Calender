"""Helpers for processing user-uploaded images (profile pictures for now,
connection photos later)."""

import os
from io import BytesIO

from django.core.files.base import ContentFile

try:
    from PIL import Image, ImageOps
except ImportError:  # pragma: no cover - Pillow is a hard dependency, but be safe
    Image = None
    ImageOps = None


def resize_profile_picture(field_file, *, max_size=512, quality=85):
    """Downscale + re-encode an uploaded profile image to a small JPEG, in place.

    - Honors EXIF orientation, flattens to RGB, caps the longest edge at
      ``max_size`` px, and re-encodes as optimized JPEG.
    - Must be called BEFORE the model row is saved (uses ``save=False``).
    - Safe no-op if Pillow is unavailable or the file can't be decoded as an
      image, so a bad upload never blocks saving the record.
    """
    if Image is None or not field_file:
        return
    try:
        field_file.open("rb")
        field_file.seek(0)
        img = Image.open(field_file)
        img = ImageOps.exif_transpose(img)
        img = img.convert("RGB")
        img.thumbnail((max_size, max_size), Image.LANCZOS)
        buffer = BytesIO()
        img.save(buffer, format="JPEG", quality=quality, optimize=True)
        buffer.seek(0)
    except Exception:
        return  # leave the original file untouched on any failure

    base = os.path.splitext(os.path.basename(field_file.name or "profile"))[0]
    field_file.save(f"{base}.jpg", ContentFile(buffer.read()), save=False)
