"""
Event processing for Agnost Analytics.

This module handles event processing in background threads for optimal performance.
"""

import logging
import threading
from queue import Queue, Empty
from typing import Any, Dict, Optional

import requests

logger = logging.getLogger("agnost.analytics.events")


class EventProcessor:
    """Handles event processing in background thread."""

    def __init__(self, endpoint: str, org_id: str):
        self.endpoint = endpoint
        self.org_id = org_id
        self._queue: Queue = Queue()
        self._session = requests.Session()
        self._worker_thread: Optional[threading.Thread] = None
        self._shutdown_event = threading.Event()
        logger.debug("EventProcessor initialized")
        self._start_worker()

    def _start_worker(self) -> None:
        """Start background worker thread."""
        if self._worker_thread is None or not self._worker_thread.is_alive():
            self._shutdown_event.clear()
            self._worker_thread = threading.Thread(target=self._worker_loop, daemon=True)
            self._worker_thread.start()
            logger.debug("Background event worker started")

    def _worker_loop(self) -> None:
        """Background worker loop."""
        while not self._shutdown_event.is_set():
            try:
                event_data = self._queue.get(timeout=1.0)
                self._send_event(event_data)
                self._queue.task_done()
            except Empty:
                continue
            except Exception as e:
                logger.error(f"Worker error: {e}")

    def _send_event(self, event_data: Dict[str, Any]) -> None:
        """Send event to API."""
        try:
            response = self._session.post(
                f"{self.endpoint}/api/v1/capture-event",
                headers={
                    "Content-Type": "application/json",
                    "X-Org-Id": self.org_id,
                },
                json=event_data,
                timeout=10
            )
            response.raise_for_status()
            logger.debug(f"Event sent successfully to {self.endpoint}")
        except Exception as e:
            logger.error(f"Failed to send event: {e}")

    def queue_event(self, event_data: Dict[str, Any]) -> None:
        """Queue event for background processing."""
        try:
            self._queue.put(event_data, block=False)
            logger.debug(f"Event queued for processing")
        except Exception as e:
            logger.error(f"Failed to queue event: {e}")

    def shutdown(self) -> None:
        """Shutdown processor."""
        logger.info("Shutting down EventProcessor")
        self._shutdown_event.set()
        if self._worker_thread and self._worker_thread.is_alive():
            self._worker_thread.join(timeout=5.0)
        self._session.close()
        logger.debug("EventProcessor shutdown complete")