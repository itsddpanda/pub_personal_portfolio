import logging
import os
import sys


def setup_logging():
    log_level_str = os.getenv("LOG_LEVEL", "INFO").upper()
    log_level = getattr(logging, log_level_str, logging.INFO)

    handlers = [logging.StreamHandler(sys.stdout)]

    # Optional: File logging if inside Docker
    if os.path.exists("/app/logs"):
        handlers.append(logging.FileHandler("/app/logs/backend.log"))

    logging.basicConfig(
        level=log_level,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        handlers=handlers,
    )

    # Silence third-party logs
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("uvicorn.error").setLevel(logging.INFO)
    logging.getLogger("pdfminer").setLevel(logging.WARNING)
    logging.getLogger("pdfminer.pdfinterp").setLevel(logging.WARNING)
    logging.getLogger("pdfminer.pdfpage").setLevel(logging.WARNING)
    logging.getLogger("pdfminer.pdfdocument").setLevel(logging.WARNING)

    logger = logging.getLogger("app")
    logger.info(f"Logging initialized at {log_level_str} level")
    return logger
