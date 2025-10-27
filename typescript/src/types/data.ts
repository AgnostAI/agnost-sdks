/**
 * Data structure interfaces for the Agnost Analytics SDK
 */

/**
 * Session data structure for tracking user sessions
 */
export interface SessionData {
  session_id: string;
  client_config: string;
  connection_type: string;
  ip: string;
  user_data?: Record<string, any>; // Dynamic user fields
  tools?: string[]; // List of registered tool names
}

/**
 * Event data structure for tracking analytics events
 */
export interface EventData {
  org_id: string;
  session_id: string;
  primitive_type: string;
  primitive_name: string;
  latency: number;
  success: boolean;
  args: string;
  result: string;
}