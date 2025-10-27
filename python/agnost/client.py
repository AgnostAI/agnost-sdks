"""
Agnost Analytics SDK for MCP Integration.

This module provides a client for tracking and analyzing MCP server interactions.
"""

import json
import logging
from typing import Any, Optional
import requests
from datetime import datetime

from .adapters import ServerAdapter, FastMCPAdapter, LowLevelMCPAdapter
from .session import SessionManager
from .events import EventProcessor
from .utils import is_fastmcp_server
from .types import AgnostConfig

# Set up logger
logger = logging.getLogger("agnost.analytics")

# Create console handler if no handlers exist
if not logger.handlers:
    console_handler = logging.StreamHandler()
    formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)

class AgnostAnalytics:
    """
    Client for the Agnost MCP Analytics service.

    This class provides methods to track and analyze MCP server interactions.
    """

    def __init__(self) -> None:
        """Initialize the Agnost Analytics client."""
        self.config: Optional[AgnostConfig] = None
        self.org_id: Optional[str] = None
        self.initialized: bool = False

        # Core components
        self._server_adapter: Optional[ServerAdapter] = None
        self._session_manager: Optional[SessionManager] = None
        self._event_processor: Optional[EventProcessor] = None
        self._http_session = requests.Session()
        self._request_context: Optional[Any] = None

    def initialize(self, server: Any, org_id: str, config: AgnostConfig, request_context: Any = None) -> bool:
        """
        Initialize the SDK with clean separation of concerns.

        Args:
            server: MCP server instance to track
            org_id: Organization ID for Agnost Analytics
            config: AgnostConfig instance

        Returns:
            bool: True if initialization was successful
        """
        if self.initialized:
            logger.debug("SDK already initialized")
            return True

        try:
            self.org_id = org_id
            self.config = config
            self._request_context = request_context

            # Set logging level based on config
            log_level = getattr(config, 'log_level', 'INFO')
            logger.setLevel(getattr(logging, log_level.upper(), logging.INFO))
            # Also set level for all child loggers
            logging.getLogger("agnost").setLevel(getattr(logging, log_level.upper(), logging.INFO))

            logger.info(f"Initializing Agnost Analytics SDK - Org ID: {org_id}, Endpoint: {config.endpoint}, Log Level: {log_level}")

            endpoint = config.endpoint.rstrip('/')

            # Initialize components
            logger.debug("Creating server adapter")
            self._server_adapter = self._create_adapter(server)

            logger.debug(f"Initializing session manager with endpoint: {endpoint}")
            self._session_manager = SessionManager(endpoint, org_id, self._http_session, config, request_context, self._server_adapter)

            logger.debug("Initializing event processor")
            self._event_processor = EventProcessor(endpoint, org_id)

            self.initialized = True
            logger.info("Agnost Analytics SDK initialized successfully")
            return True

        except Exception as e:
            logger.error(f"SDK initialization failed: {e}")
            return False

    def _create_adapter(self, server: Any) -> ServerAdapter:
        """Create appropriate server adapter based on server type."""
        if is_fastmcp_server(server):
            return FastMCPAdapter(server)
        else:
            return LowLevelMCPAdapter(server)

    def shutdown(self) -> None:
        """Shutdown and clean up resources."""
        if self._event_processor:
            self._event_processor.shutdown()
        self._http_session.close()

   
    def record_event(self,
                     primitive_type: str,
                     primitive_name: str,
                     args: Any,
                     latency: int = 0,
                     success: bool = True,
                     result: Any = None) -> bool:
        """
        Record an event for analytics using background processing.

        Args:
            primitive_type: Type of primitive (tool/resource/prompt)
            primitive_name: Name of the primitive
            args: Arguments passed to the primitive
            latency: Execution time in milliseconds
            success: Whether the call was successful
            result: Output/result of the primitive call

        Returns:
            bool: True if queued successfully, False otherwise
        """
        if not self.initialized or not self._session_manager or not self._event_processor:
            logger.warning("AgnostAnalytics not initialized")
            return False

        try:
            # Get session info through adapter
            session_info = self._server_adapter.get_session_info() if self._server_adapter else None
            session_id = self._session_manager.get_or_create_session(session_info)

            # Prepare event data
            send_args = None if self.config and self.config.disable_input else args
            send_result = None if self.config and self.config.disable_output else str(result)

            event_data = {
                "org_id": self.org_id,
                "session_id": session_id,
                "primitive_type": primitive_type,
                "primitive_name": primitive_name,
                "latency": latency,
                "success": success,
                "args": json.dumps(send_args) if send_args is not None else "",
                "result": json.dumps(send_result) if send_result is not None else "",
            }

            # Queue for background processing
            self._event_processor.queue_event(event_data)

            logger.debug(f"Event queued for '{primitive_name}' - Type: {primitive_type}, Success: {success}")
            return True

        except Exception as e:
            logger.warning(f"Failed to record event: {e}")
            return False


    def _analytics_callback(self, tool_name: str, arguments: Any, exec_time: int,
                           success: bool, result: Any, start_time: datetime) -> None:
        """Callback for tool execution analytics."""
        logger.debug(f"Recording analytics for tool '{tool_name}' - Execution time: {exec_time}ms, Success: {success}")
        self.record_event("tool", str(tool_name), str(arguments), exec_time, success, result)


    def track_mcp(self, server: Any, org_id: str, config: AgnostConfig, request_context: Any = None) -> Any:
        """
        Enable tracking for an MCP server instance with clean architecture.

        Args:
            server: MCP server instance to track
            org_id: Organization ID for Agnost Analytics
            config: AgnostConfig instance

        Returns:
            Any: The server instance with tracking enabled
        """
        if not self.initialize(server, org_id, config, request_context):
            logger.error("Failed to initialize analytics - tracking disabled")
            return server

        try:
            if self._server_adapter:
                logger.debug("Patching server for analytics tracking")
                success = self._server_adapter.patch_server(self._analytics_callback)
                if success:
                    logger.info("MCP server tracking enabled successfully")
                else:
                    logger.error("Failed to patch server for analytics")
            else:
                logger.error("No server adapter available - tracking disabled")
        except Exception as e:
            logger.error(f"MCP tracking setup failed: {e}")

        return server
