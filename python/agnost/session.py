"""
Session management for Agnost Analytics.

This module handles analytics sessions with caching and client info management.
"""

import uuid
import logging
import asyncio
import os
from typing import Dict, Optional, Any

import requests

from .adapters import SessionInfo
from .types import UserIdentity, AgnostConfig

logger = logging.getLogger("agnost.analytics.session")


class SessionManager:
    """Manages analytics sessions with caching and client info."""

    def __init__(self, endpoint: str, org_id: str, session: requests.Session, config: AgnostConfig, request_context: Any = None, server_adapter: Any = None):
        self.endpoint = endpoint
        self.org_id = org_id
        self.session = session
        self.config = config
        self.request_context = request_context
        self.server_adapter = server_adapter
        self._sessions: Dict[str, str] = {}
        self._cached_user: Optional[UserIdentity] = None
        self._user_resolved = False
        logger.debug(f"SessionManager initialized for org: {org_id}")

        # Set up callback for proactive session creation on tools/list
        if server_adapter and hasattr(server_adapter, '_session_callback'):
            server_adapter._session_callback = self._create_initial_session_on_tools_list

    def _create_initial_session_on_tools_list(self) -> None:
        """Create initial session when tools/list is first called by a client.

        This ensures:
        - All tools are registered (after @mcp.tool() decorators)
        - We have a real client connection
        - Better developer experience - track() can be called before tool decorators
        """
        try:
            logger.info("Client requested tools/list - creating initial session")
            session_id = self._create_session('_initial', 'mcp_client')
            if session_id:
                logger.info(f"Initial session created on tools/list: {session_id}")
        except Exception as e:
            logger.warning(f"Failed to create initial session on tools/list: {e}")

    def get_or_create_session(self, session_info: Optional[SessionInfo]) -> str:
        """Get existing session or create new one."""
        if not session_info:
            logger.debug("No session info provided, using _initial or default session")
            # Prefer _initial session created on tools/list, fallback to default
            return self._sessions.get('_initial', self._sessions.get('default', ''))

        session_id = self._sessions.get(session_info.session_key)
        if session_id:
            logger.debug(f"Using existing session: {session_id}")
            return session_id

        logger.debug(f"Creating new session for client: {session_info.client_name}")
        return self._create_session(session_info.session_key, session_info.client_name)

    def _create_session(self, session_key: str, client_name: str) -> str:
        """Create a new session."""
        try:
            session_id = str(uuid.uuid4())

            # Extract tools if server adapter is available
            tools = []
            if self.server_adapter:
                try:
                    tools = self.server_adapter.extract_tools()
                except Exception as e:
                    logger.warning(f"Failed to extract tools: {e}")

            # Build session payload
            session_payload = {
                "session_id": session_id,
                "client_config": client_name,
                "connection_type": "",
                "ip": "",
                "user_data": self._get_user_identity(),
            }

            # Add tools list if found
            if tools:
                session_payload["tools"] = tools

            response = self.session.post(
                f"{self.endpoint}/api/v1/capture-session",
                headers={
                    "Content-Type": "application/json",
                    "X-Org-Id": self.org_id,
                },
                json=session_payload,
                timeout=10
            )
            response.raise_for_status()
            self._sessions[session_key] = session_id
            logger.info(f"New session created: {session_id} for client: {client_name}")
            return session_id
        except Exception as e:
            logger.error(f"Failed to create session: {e}")
            return ""

    def _get_user_identity(self) -> Optional[UserIdentity]:
        """Get user identity using identify function if provided."""
        if not self.config.identify:
            return None

        # Return cached user if already resolved
        if self._user_resolved:
            return self._cached_user

        try:
            # Pass both request context and environment variables
            import os
            result = self.config.identify(self.request_context, dict(os.environ))

            # Handle async functions
            if hasattr(result, '__await__'):
                # For async functions, we need to run in event loop
                try:
                    loop = asyncio.get_event_loop()
                    if loop.is_running():
                        # If loop is running, we can't use asyncio.run()
                        # This is a limitation - async identify functions won't work in this case
                        logger.warning("Cannot resolve async identify function in running event loop")
                        result = None
                    else:
                        result = asyncio.run(result)
                except RuntimeError:
                    # No event loop running
                    result = asyncio.run(result)

            # Validate result
            if result and isinstance(result, dict) and 'userId' not in result:
                logger.warning("User identity missing required 'userId' field")
                result = None

            self._cached_user = result
            self._user_resolved = True

            if result:
                logger.debug(f"User identified: {result.get('userId', 'unknown')}")

            return result
        except Exception as e:
            logger.warning(f"User identification failed: {e}")
            self._cached_user = None
            self._user_resolved = True
            return None