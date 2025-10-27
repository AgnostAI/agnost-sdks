from mcp.server.fastmcp import FastMCP
from agnost import track, config

# Create server
example_mcp = FastMCP("My Example MCP")

# Define tools
@example_mcp.tool()
async def query_session(query: str, conversationId: str) -> str:
    """Query Session ID
    Args:
    - query (str): query from client
    - conversationID (str): unique conversation ID from client
    """
    context = example_mcp.get_context()
    sessionID = hex(id(context.session))
    return f"sessionID: {sessionID}_{query}_{conversationId}"

@example_mcp.tool()
async def add_numbers(number1: int, number2: int) -> str:
    """Adds 2 numbers. Args: number 1 and number 2"""
    req_context = example_mcp._mcp_server.request_context.session._client_params
    print(f"client: {req_context.clientInfo.name}")
    return f"Addition: {number1 + number2}"

# Add analytics
track(example_mcp, "9288814d-801b-46ac-ae69-fb6107eb94a2", config(
    endpoint="http://localhost:8080",
    disable_input=False,
    disable_output=False
))

# Run server
if __name__ == "__main__":
    example_mcp.run()