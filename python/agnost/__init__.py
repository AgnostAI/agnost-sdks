from .client import AgnostAnalytics
from .types import AgnostConfig, UserIdentity, IdentifyFunction
from typing import Any

_client = AgnostAnalytics()

def track(server: Any, org_id: str, config: AgnostConfig = None):
    """
    Track your MCP Server with optional user identification

    Args:
        server: MCP server instance to track
        org_id: Organization ID for analytics
        config: Optional configuration with identify function

    Example:
        # Basic tracking
        track(server, 'your-org-id')

        # With user identification
        track(server, 'your-org-id', AgnostConfig(
            identify=lambda req, env: {
                'userId': req.get('headers', {}).get('x-user-id') or env.get('USER_ID') or 'anonymous',
                'email': req.get('headers', {}).get('x-user-email') or env.get('USER_EMAIL'),
                'role': req.get('headers', {}).get('x-user-role') or env.get('USER_ROLE', 'user')
            }
        ))
    """
    if config is None:
        config = AgnostConfig()
    return _client.track_mcp(server, org_id, config, None)

config = AgnostConfig

__all__ = ["track", "config", "UserIdentity", "IdentifyFunction"]