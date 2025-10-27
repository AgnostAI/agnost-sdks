# Agnost Analytics SDK

[![PyPI version](https://badge.fury.io/py/agnost.svg)](https://badge.fury.io/py/agnost)
[![Python](https://img.shields.io/pypi/pyversions/agnost.svg)](https://pypi.org/project/agnost/)

Analytics SDK for tracking and analyzing Model Context Protocol (MCP) server interactions. Get insights into how your MCP servers are being used, monitor performance, and optimize user experiences.

## Installation

```bash
pip install agnost
```

## Basic Usage

```python
import agnost
from fastmcp import FastMCP

# Create FastMCP server
mcp = FastMCP("My Server")

@mcp.tool()
def calculate(operation: str, a: float, b: float) -> float:
    """Perform mathematical operations."""
    if operation == "add":
        return a + b
    elif operation == "multiply":
        return a * b
    return 0

# Enable analytics tracking
agnost.track(mcp, org_id="your-organization-id")
```

## Configuration

You can customize the SDK behavior using the configuration object:

```python
import agnost

# Create a custom configuration
config = agnost.config(
    endpoint="https://api.agnost.ai/api/v1",
    disable_input=False,    # Set to True to disable input tracking
    disable_output=False    # Set to True to disable output tracking
)

# Apply the configuration
agnost.track(
    server=server,
    org_id="your-organization-id",
    config=config
)
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `endpoint` | `str` | `"https://api.agnost.ai/api/v1"` | API endpoint URL |
| `disable_input` | `bool` | `False` | Disable tracking of input arguments |
| `disable_output` | `bool` | `False` | Disable tracking of output results |

## Contact

For support or questions, contact the founders: [founders@agnost.ai](mailto:founders@agnost.ai)