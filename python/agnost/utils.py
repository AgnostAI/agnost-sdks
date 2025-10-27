import logging
from typing import Any, Tuple
from mcp.server import Server
from mcp import ServerResult

logger = logging.getLogger("agnost.analytics")

def is_fastmcp_server(server: Any) -> bool:
    """
    Check if the server is a FastMCP instance.
    """
    return hasattr(server, "_mcp_server") and hasattr(server, "_tool_manager")

def is_mcp_error_response(response: ServerResult) -> Tuple[bool, str]:
    """
    Check if the response is an MCP error.
    """
    try:
        if hasattr(response, 'root'):
            result = response.root
            if hasattr(result, 'isError') and result.isError:
                if hasattr(result, 'content') and result.content:
                    for content_item in result.content:
                        if hasattr(content_item, 'text'):
                            return True, str(content_item.text)
                        elif hasattr(content_item, 'type') and hasattr(content_item, 'content'):
                            if content_item.type == 'text':
                                return True, str(content_item.content)
                    if result.content and len(result.content) > 0:
                        return True, str(result.content[0])
                    return True, "Unknown error"
                return True, "Unknown error"
        return False, ""
    except (AttributeError, IndexError):
        return False, ""
    except Exception as e:
        logger.debug(f"Error checking response: {str(e)}")
        return False, f"Error checking response: {str(e)}"
