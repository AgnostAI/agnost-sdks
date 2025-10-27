/**
 * MCP-specific utility functions
 */

import { logger } from '../performance/index.js';

/**
 * Check if object has a property
 */
function hasattr(obj: any, prop: string): boolean {
  return obj && typeof obj === "object" && prop in obj;
}

/**
 * Check if the response is an MCP error
 * @param response Any response from an MCP server
 * @returns A tuple containing [isError, errorMessage]
 */
export function isMcpErrorResponse(response: any): [boolean, string] {
  try {
    if (hasattr(response, 'root')) {
      const result = response.root;
      if (hasattr(result, 'isError') && result.isError) {
        if (hasattr(result, 'content') && result.content) {
          for (const contentItem of result.content) {
            if (hasattr(contentItem, 'text')) {
              return [true, String(contentItem.text)];
            } else if (hasattr(contentItem, 'type') && hasattr(contentItem, 'content')) {
              if (contentItem.type === 'text') {
                return [true, String(contentItem.content)];
              }
            }
          }
          if (result.content && result.content.length > 0) {
            return [true, String(result.content[0])];
          }
          return [true, "Unknown error"];
        }
        return [true, "Unknown error"];
      }
    }

    // Check for direct error properties
    if (hasattr(response, 'isError') && response.isError) {
      // First check if there's content array with error message
      if (hasattr(response, 'content') && Array.isArray(response.content)) {
        for (const contentItem of response.content) {
          if (hasattr(contentItem, 'text')) {
            return [true, String(contentItem.text)];
          } else if (hasattr(contentItem, 'type') && hasattr(contentItem, 'content')) {
            if (contentItem.type === 'text') {
              return [true, String(contentItem.content)];
            }
          }
        }
        // If content array exists but we couldn't extract text, stringify first item
        if (response.content.length > 0) {
          const firstItem = response.content[0];
          if (typeof firstItem === 'string') {
            return [true, firstItem];
          } else if (typeof firstItem === 'object') {
            return [true, JSON.stringify(firstItem)];
          }
        }
      }
      // Fall back to message or error properties
      return [true, response.message || response.error || "Unknown error"];
    }

    // Check if response is an Error instance
    if (response instanceof Error) {
      return [true, response.message];
    }

    return [false, ""];
  } catch (error) {
    logger.warning(`Error checking response: ${error instanceof Error ? error.message : String(error)}`);
    return [false, `Error checking response: ${error instanceof Error ? error.message : String(error)}`];
  }
}

/**
 * Optimized argument filtering for analytics (removes sensitive data)
 */
export function filterSensitiveArgs(args: any[]): any[] {
  return args.map(arg => {
    if (typeof arg === 'object' && arg !== null) {
      // More efficient filtering without object spread
      const filtered: any = {};
      for (const key in arg) {
        if (key !== 'org_id' && key !== 'orgId' && arg.hasOwnProperty(key)) {
          filtered[key] = arg[key];
        }
      }
      return filtered;
    }
    return arg;
  });
}