"""
Server adapters for different MCP server implementations.

This module contains adapter classes that provide a unified interface
for interacting with different types of MCP servers.
"""

import logging
from abc import ABC, abstractmethod
from typing import Any, Callable, Optional, Protocol, runtime_checkable
from datetime import datetime, timezone

from mcp import ServerResult
from mcp.types import CallToolRequest
from .utils import is_mcp_error_response

logger = logging.getLogger("agnost.analytics.adapters")


@runtime_checkable
class SessionInfo(Protocol):
    """Protocol for session information."""
    session_key: str
    client_name: str


class ServerAdapter(ABC):
    """Abstract base class for MCP server adapters."""

    @abstractmethod
    def get_session_info(self) -> Optional[SessionInfo]:
        """Get session information from the server."""
        pass

    @abstractmethod
    def patch_server(self, analytics_callback: Callable) -> bool:
        """Patch the server to intercept tool calls."""
        pass

    @abstractmethod
    def extract_tools(self) -> list[str]:
        """Extract list of tool names from the server."""
        pass


class FastMCPAdapter(ServerAdapter):
    """Adapter for FastMCP servers."""

    def __init__(self, server: Any):
        self.server = server
        self._mcp_server = server._mcp_server
        self._session_callback = None  # Will be set during patching

    def get_session_info(self) -> Optional[SessionInfo]:
        """Get session info from FastMCP server."""
        try:
            if hasattr(self._mcp_server, 'request_context') and self._mcp_server.request_context:
                if hasattr(self._mcp_server.request_context, 'session') and self._mcp_server.request_context.session:
                    session = self._mcp_server.request_context.session
                    return type('SessionInfo', (), {
                        'session_key': hex(id(session)),
                        'client_name': session.client_params.clientInfo.name
                    })()
            return type('SessionInfo', (), {
                'session_key': 'fastmcp_default',
                'client_name': 'fastmcp_client'
            })()
        except Exception as e:
            logger.debug(f"FastMCP session info error: {e}")
            return None

    def patch_server(self, analytics_callback: Callable) -> bool:
        """Patch FastMCP server by replacing the CallToolRequest handler."""
        try:
            # Patch the CallToolRequest handler to intercept tool calls
            # We can't patch FastMCP.call_tool directly because the handler
            # was already registered with a closure that captured the original method
            mcp_server = self._mcp_server
            original_handler = mcp_server.request_handlers.get(CallToolRequest)

            if not original_handler:
                logger.error("No CallToolRequest handler found")
                return False

            async def wrapped_handler(request: CallToolRequest):
                tool_name = request.params.name
                arguments = request.params.arguments or {}

                start_time = datetime.now(timezone.utc)
                success = True
                result = None

                try:
                    exec_start = datetime.now(timezone.utc)
                    result = await original_handler(request)
                    exec_end = datetime.now(timezone.utc)
                    exec_time = int((exec_end - exec_start).total_seconds() * 1000)

                    is_error, error_message = is_mcp_error_response(result)
                    if is_error:
                        success = False
                        logger.error(f"Tool {tool_name} returned error: {error_message}")

                except Exception as e:
                    success = False
                    exec_time = int((datetime.now(timezone.utc) - start_time).total_seconds() * 1000)
                    logger.error(f"Error calling tool {tool_name}: {e}")
                    raise
                finally:
                    analytics_callback(tool_name, arguments, exec_time, success, result, start_time)

                return result

            # Replace the handler
            mcp_server.request_handlers[CallToolRequest] = wrapped_handler

            # Patch list_tools to trigger session creation on first call
            self._patch_list_tools()

            logger.debug("FastMCP server patched successfully")
            return True
        except Exception as e:
            logger.error(f"Failed to patch FastMCP server: {e}")
            return False

    def _patch_list_tools(self) -> None:
        """Patch the ListToolsRequest handler to create session when client first lists tools.

        This ensures:
        1. Tools are fully registered (after all @mcp.tool() decorators have run)
        2. We have a real client connection
        3. Session is created with accurate tools list for better DX
        """
        try:
            from mcp.types import ListToolsRequest

            # Get the MCP server instance
            mcp_server = self.server._mcp_server
            logger.info(f"DEBUG: _patch_list_tools called, mcp_server type: {type(mcp_server)}")
            logger.info(f"DEBUG: _session_callback set: {self._session_callback is not None}")

            # Patch the ListToolsRequest handler in request_handlers dictionary
            original_handler = mcp_server.request_handlers.get(ListToolsRequest)
            if not original_handler:
                logger.warning("No ListToolsRequest handler found - session creation patch skipped")
                return

            logger.info(f"DEBUG: Found ListToolsRequest handler: {type(original_handler)}")
            session_created = [False]  # Mutable flag

            # Store reference to session_callback (set from outside)
            adapter_self = self

            async def patched_list_tools_handler(request):
                logger.info(f"DEBUG: ListToolsRequest handler called! session_created={session_created[0]}, callback={adapter_self._session_callback is not None}")
                # Create session on first tools/list call
                if not session_created[0] and adapter_self._session_callback:
                    session_created[0] = True
                    logger.info("ListToolsRequest received - creating initial session with tools")
                    try:
                        adapter_self._session_callback()
                    except Exception as e:
                        logger.error(f"Failed to create initial session on ListToolsRequest: {e}", exc_info=True)
                elif not adapter_self._session_callback:
                    logger.warning("DEBUG: ListToolsRequest handler called but _session_callback is None!")

                # Call original handler
                return await original_handler(request)

            # Replace the handler in request_handlers dictionary
            mcp_server.request_handlers[ListToolsRequest] = patched_list_tools_handler
            logger.info("ListToolsRequest handler patched successfully for session creation")
        except Exception as e:
            logger.error(f"Could not patch ListToolsRequest handler: {e}", exc_info=True)

    def extract_tools(self) -> list[str]:
        """Extract list of tool names from FastMCP server.

        For FastMCP, tools are available immediately after registration via @mcp.tool() decorators.
        This method will be called during session creation to capture the initial tool list.
        """
        try:
            # Access the tool manager's tool registry
            if hasattr(self.server, '_tool_manager'):
                tool_manager = self.server._tool_manager

                # FastMCP stores tools in _tools dict after registration
                if hasattr(tool_manager, '_tools') and tool_manager._tools:
                    tools = list(tool_manager._tools.keys())
                    logger.info(f"Extracted {len(tools)} tools from FastMCP: {', '.join(tools)}")
                    return tools
                else:
                    logger.warning("FastMCP tool manager _tools is empty - tools may not be registered yet")
                    return []

            logger.warning("FastMCP server missing _tool_manager attribute")
            return []
        except Exception as e:
            logger.error(f"Failed to extract tools from FastMCP server: {e}")
            return []


class LowLevelMCPAdapter(ServerAdapter):
    """Adapter for low-level MCP servers."""

    def __init__(self, server: Any):
        self.server = server._mcp_server if hasattr(server, '_mcp_server') else server

    def get_session_info(self) -> Optional[SessionInfo]:
        """Get session info from low-level MCP server."""
        try:
            if hasattr(self.server, 'request_context') and self.server.request_context:
                if hasattr(self.server.request_context, 'session') and self.server.request_context.session:
                    session = self.server.request_context.session
                    return type('SessionInfo', (), {
                        'session_key': hex(id(session)),
                        'client_name': session.client_params.clientInfo.name
                    })()
            return type('SessionInfo', (), {
                'session_key': 'lowlevel_default',
                'client_name': 'lowlevel_client'
            })()
        except Exception as e:
            logger.debug(f"LowLevel MCP session info error: {e}")
            return None

    def patch_server(self, analytics_callback: Callable) -> bool:
        """Patch low-level MCP server request handlers."""
        try:
            original_handler = self.server.request_handlers.get(CallToolRequest)
            if not original_handler:
                logger.error("No CallToolRequest handler found")
                return False

            async def wrapped_handler(request: CallToolRequest) -> ServerResult:
                tool_name = request.params.name
                arguments = request.params.arguments or {}

                start_time = datetime.now(timezone.utc)
                success = True
                result = None

                try:
                    exec_start = datetime.now(timezone.utc)
                    result = await original_handler(request)
                    exec_end = datetime.now(timezone.utc)
                    exec_time = int((exec_end - exec_start).total_seconds() * 1000)

                    is_error, error_message = is_mcp_error_response(result)
                    if is_error:
                        success = False
                        logger.error(f"Tool {tool_name} returned error: {error_message}")

                except Exception as e:
                    success = False
                    exec_time = int((datetime.now(timezone.utc) - start_time).total_seconds() * 1000)
                    logger.error(f"Error calling tool {tool_name}: {e}")
                    raise
                finally:
                    analytics_callback(tool_name, arguments, exec_time, success, result, start_time)

                return result

            self.server.request_handlers[CallToolRequest] = wrapped_handler
            logger.debug("Low-level MCP server patched successfully")
            return True
        except Exception as e:
            logger.error(f"Failed to patch low-level MCP server: {e}")
            return False

    def extract_tools(self) -> list[str]:
        """Extract list of tool names from low-level MCP server.

        Note: For low-level MCP servers, tool extraction works best when tools are
        properly registered and the server is fully initialized. In test/mock contexts,
        this may return an empty list.

        In production, tools will be extracted when the server processes the first
        tools/list request from a client.
        """
        try:
            # Access the _tool_cache which stores tool definitions after they're cached
            if hasattr(self.server, '_tool_cache') and self.server._tool_cache:
                tools = list(self.server._tool_cache.keys())
                logger.info(f"Extracted {len(tools)} tools from low-level MCP: {', '.join(tools)}")
                return tools

            # For low-level MCP servers in test/early initialization,
            # the cache may be empty. In production use, tools are populated
            # when the server handles a real tools/list request from a client.
            logger.debug("No tools found in _tool_cache (server may not be fully initialized)")
            return []

        except Exception as e:
            logger.warning(f"Failed to extract tools from low-level MCP server: {e}")
            return []